import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StaffTimeClockDto } from './dto/staff-time-clock.dto';

@Injectable()
export class StaffTimeClockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getMyTimeClockStatus(actor: AuthContext, dateInput?: string) {
    const staff = await this.getActorStaff(actor);
    const attendanceDate = resolveAttendanceDate(dateInput);
    const record = await this.prisma.staffAttendance.findUnique({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          attendanceDate,
        },
      },
    });

    return {
      staffId: staff.id,
      employeeId: staff.employeeId,
      attendanceDate,
      checkedIn: Boolean(record?.checkInAt),
      checkedOut: Boolean(record?.checkOutAt),
      record,
    };
  }

  async checkIn(dto: StaffTimeClockDto, actor: AuthContext) {
    const staff = await this.getActorStaff(actor);
    const timestamp = resolveTimestamp(dto.timestamp);
    const attendanceDate = resolveAttendanceDate(dto.attendanceDate, timestamp);

    const existing = await this.prisma.staffAttendance.findUnique({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          attendanceDate,
        },
      },
    });

    if (existing?.checkOutAt && existing.checkOutAt < timestamp) {
      throw new ConflictException(
        'Cannot check in after an existing checkout. Use attendance correction instead.',
      );
    }

    const checkInAt = existing?.checkInAt
      ? earlierDate(existing.checkInAt, timestamp)
      : timestamp;

    const record = await this.prisma.staffAttendance.upsert({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          attendanceDate,
        },
      },
      update: {
        status: AttendanceStatus.PRESENT,
        checkInAt,
        note: mergeClockNote(existing?.note, dto.note),
        approvedById: actor.userId,
      },
      create: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        attendanceDate,
        status: AttendanceStatus.PRESENT,
        checkInAt,
        note: dto.note ?? null,
        approvedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'check_in',
      resource: 'staff_attendance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: record.id,
      after: {
        staffId: staff.id,
        attendanceDate,
        checkInAt: record.checkInAt,
      },
    });

    return record;
  }

  async checkOut(dto: StaffTimeClockDto, actor: AuthContext) {
    const staff = await this.getActorStaff(actor);
    const timestamp = resolveTimestamp(dto.timestamp);
    const attendanceDate = resolveAttendanceDate(dto.attendanceDate, timestamp);

    const existing = await this.prisma.staffAttendance.findUnique({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          attendanceDate,
        },
      },
    });

    if (!existing?.checkInAt) {
      throw new ConflictException('Cannot check out before check in.');
    }

    if (timestamp < existing.checkInAt) {
      throw new ConflictException('Checkout time cannot be before check-in time.');
    }

    const record = await this.prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: timestamp,
        note: mergeClockNote(existing.note, dto.note),
        approvedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'check_out',
      resource: 'staff_attendance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: record.id,
      after: {
        staffId: staff.id,
        attendanceDate,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
      },
    });

    return record;
  }

  private async getActorStaff(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true, employeeId: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found for current user');
    }

    return staff;
  }
}

function resolveTimestamp(input?: string) {
  const timestamp = input ? new Date(input) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new ConflictException('timestamp must be a valid ISO date-time');
  }
  return timestamp;
}

function resolveAttendanceDate(input?: string, fallback: Date = new Date()) {
  const source = input ? new Date(input) : fallback;
  if (Number.isNaN(source.getTime())) {
    throw new ConflictException('attendanceDate must be a valid ISO date');
  }

  const attendanceDate = new Date(source);
  attendanceDate.setHours(0, 0, 0, 0);
  return attendanceDate;
}

function earlierDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function mergeClockNote(existing: string | null | undefined, next: string | undefined) {
  const trimmed = next?.trim();
  if (!trimmed) return existing ?? null;
  return existing ? `${existing}\n${trimmed}` : trimmed;
}
