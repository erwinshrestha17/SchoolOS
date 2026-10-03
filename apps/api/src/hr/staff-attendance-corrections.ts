import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type StaffAttendanceCorrection } from '@prisma/client';
import { toBsDateFromGregorian } from '@schoolos/core';
import { payrollPeriodFor } from '../payroll/payroll-period';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import {
  hasDomainPermission,
  requireDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
import type { CorrectStaffAttendanceDto } from '../attendance/dto/correct-staff-attendance.dto';
import {
  authoritativeEmploymentWhere,
  calendarDaysInPeriod,
  employedDaysInPeriod,
} from './employment-timeline';
import {
  attendancePaidContribution,
  payrollDayCounts,
  payrollLeaveOverlapDays,
} from './payroll-day-policy';

export const STAFF_CORRECTION_APPROVE = 'hr:attendance-corrections:approve';

async function lockHistory(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$queryRaw`SELECT staff_attendance_tenant_lock(${tenantId}::text)::text`;
}
async function payrollLocked(
  tx: Prisma.TransactionClient,
  tenantId: string,
  date: Date,
) {
  const rows = await tx.$queryRaw<
    Array<{ locked: boolean }>
  >`SELECT staff_attendance_payroll_locked(${tenantId}::text, ${date}::timestamp) AS locked`;
  return rows[0].locked;
}

export class StaffAttendanceCorrections {
  constructor(private readonly prisma: PrismaService) {}

  async request(
    attendanceId: string,
    input: CorrectStaffAttendanceDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'hr:attendance:correct');
    const reason = input.reason?.trim();
    if (!reason || reason.length > 1000)
      throw new BadRequestException(
        'A reason of 1–1000 characters is required',
      );
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'hr:attendance:correct',
        [],
        async (tx) => {
          await lockHistory(tx, actor.tenantId);
          const row = await tx.staffAttendance.findFirst({
            where: { id: attendanceId, tenantId: actor.tenantId },
          });
          if (!row)
            throw new NotFoundException('Staff attendance record not found');
          const checkIn =
            input.checkInAt === undefined
              ? row.checkInAt
              : input.checkInAt === null
                ? null
                : new Date(input.checkInAt);
          const checkOut =
            input.checkOutAt === undefined
              ? row.checkOutAt
              : input.checkOutAt === null
                ? null
                : new Date(input.checkOutAt);
          if (checkIn && checkOut && checkOut < checkIn)
            throw new BadRequestException('Check-out must follow check-in');
          const correction = await tx.staffAttendanceCorrection.create({
            data: {
              tenantId: actor.tenantId,
              staffId: row.staffId,
              attendanceId: row.id,
              attendanceDate: row.attendanceDate,
              originalStatus: row.status,
              requestedStatus: input.status,
              originalCheckInAt: row.checkInAt,
              requestedCheckInAt: checkIn,
              originalCheckOutAt: row.checkOutAt,
              requestedCheckOutAt: checkOut,
              originalLeaveType: row.leaveType,
              requestedLeaveType:
                input.leaveType === undefined ? row.leaveType : input.leaveType,
              originalNote: row.note,
              requestedNote: input.note === undefined ? row.note : input.note,
              originalUpdatedAt: row.updatedAt,
              reason,
              requesterId: actor.userId,
            },
          });
          await this.audit(tx, actor, correction.id, 'request');
          return correction;
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'An open correction already exists for this staff member and date',
        );
      throw error;
    }
  }

  async list(actor: AuthContext, page = 1, limit = 25) {
    this.requireRead(actor);
    const where: Prisma.StaffAttendanceCorrectionWhereInput = {
      tenantId: actor.tenantId,
      ...(!hasDomainPermission(actor, STAFF_CORRECTION_APPROVE)
        ? { requesterId: actor.userId }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.staffAttendanceCorrection.findMany({
        where,
        include: { staff: { select: { firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.staffAttendanceCorrection.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        staff: { fullName: `${item.staff.firstName} ${item.staff.lastName}` },
      })),
      total,
      page,
      limit,
    };
  }

  async decide(
    id: string,
    decision: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    actor: AuthContext,
    decisionReason?: string,
  ) {
    const permission =
      decision === 'CANCELLED'
        ? 'hr:attendance:correct'
        : STAFF_CORRECTION_APPROVE;
    requireDomainPermission(actor, permission);
    if (decision === 'REJECTED' && !decisionReason?.trim())
      throw new BadRequestException('A rejection reason is required');
    return withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      permission,
      [],
      async (tx) => {
        await lockHistory(tx, actor.tenantId);
        const c = await tx.staffAttendanceCorrection.findFirst({
          where: { id, tenantId: actor.tenantId },
        });
        if (!c) throw new NotFoundException('Correction not found');
        if (decision === 'CANCELLED') {
          if (c.requesterId !== actor.userId)
            throw new ForbiddenException('Only the requester may cancel');
        } else requireIndependentActor(actor, [c.requesterId]);
        const locked = await payrollLocked(
          tx,
          actor.tenantId,
          c.attendanceDate,
        );
        const status =
          decision === 'APPROVED' && locked
            ? 'PENDING_PAYROLL_ADJUSTMENT'
            : decision;
        if (decision === 'APPROVED') {
          const row = await tx.staffAttendance.findFirst({
            where: { id: c.attendanceId, tenantId: actor.tenantId },
          });
          if (
            !row ||
            row.updatedAt.getTime() !== c.originalUpdatedAt.getTime() ||
            row.status !== c.originalStatus ||
            row.leaveType !== c.originalLeaveType ||
            row.note !== c.originalNote ||
            row.checkInAt?.getTime() !== c.originalCheckInAt?.getTime() ||
            row.checkOutAt?.getTime() !== c.originalCheckOutAt?.getTime()
          )
            throw new ConflictException(
              'Attendance changed since this request. Cancel and submit a fresh request.',
            );
        }
        const changed = await tx.staffAttendanceCorrection.updateMany({
          where: { id, tenantId: actor.tenantId, status: 'PENDING' },
          data: {
            status,
            ...(decision !== 'CANCELLED'
              ? {
                  approverId: actor.userId,
                  decidedAt: new Date(),
                  decisionReason: decisionReason?.trim() ?? null,
                }
              : {}),
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Correction was already decided or cancelled. Refresh the queue.',
          );
        if (status === 'APPROVED') {
          await tx.$queryRaw`SELECT set_config('schoolos.staff_attendance_correction', ${id}, true)`;
          await tx.staffAttendance.update({
            where: { id: c.attendanceId },
            data: {
              status: c.requestedStatus,
              checkInAt: c.requestedCheckInAt,
              checkOutAt: c.requestedCheckOutAt,
              leaveType: c.requestedLeaveType,
              note: c.requestedNote,
              approvedById: actor.userId,
            },
          });
        }
        await this.audit(tx, actor, id, status.toLowerCase());
        return tx.staffAttendanceCorrection.findUniqueOrThrow({
          where: { id },
        });
      },
    );
  }

  async impact(id: string, actor: AuthContext, workingDays?: number) {
    this.requireRead(actor);
    const c = await this.prisma.staffAttendanceCorrection.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (
      !c ||
      (!hasDomainPermission(actor, STAFF_CORRECTION_APPROVE) &&
        c.requesterId !== actor.userId)
    )
      throw new NotFoundException('Correction not found');
    return this.prisma.$transaction(
      async (tx) => this.project(tx, c, workingDays),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async project(
    tx: Prisma.TransactionClient,
    c: StaffAttendanceCorrection,
    requestedWorkingDays: number | undefined,
  ) {
    const date = c.attendanceDate;
    // Phase 7.9: the period is the Nepali (BS) payroll month containing the
    // date and the default divisor is its calendar-day count, exactly as the
    // payroll run itself resolves them. A date outside the BS payroll calendar
    // (legacy data) falls back to its Gregorian month.
    let period: { startsOn: Date; endsOn: Date };
    try {
      const window = payrollPeriodFor(...bsYearMonthOf(date));
      period = { startsOn: window.startsOn, endsOn: window.endsOn };
    } catch {
      period = {
        startsOn: new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
        ),
        endsOn: new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        ),
      };
    }
    const workingDays = requestedWorkingDays ?? calendarDaysInPeriod(period);
    const [attendance, leaves, employments] = await Promise.all([
      tx.staffAttendance.findMany({
        where: {
          tenantId: c.tenantId,
          staffId: c.staffId,
          attendanceDate: { gte: period.startsOn, lte: period.endsOn },
        },
        select: { id: true, status: true },
      }),
      tx.staffLeaveRequest.findMany({
        where: {
          tenantId: c.tenantId,
          staffId: c.staffId,
          status: 'APPROVED',
          startsOn: { lte: period.endsOn },
          endsOn: { gte: period.startsOn },
        },
        select: { startsOn: true, endsOn: true, isPaid: true },
      }),
      tx.staffEmployment.findMany({
        where: authoritativeEmploymentWhere(c.tenantId, period, [c.staffId]),
        select: { effectiveFrom: true, effectiveTo: true },
      }),
    ]);
    let paidLeaveDays = 0,
      unpaidLeaveDays = 0;
    for (const leave of leaves) {
      const overlap = payrollLeaveOverlapDays(
        leave.startsOn,
        leave.endsOn,
        period.startsOn,
        period.endsOn,
      );
      if (leave.isPaid) paidLeaveDays += overlap;
      else unpaidLeaveDays += overlap;
    }
    const otherDays = attendance
      .filter((a) => a.id !== c.attendanceId)
      .reduce((n, a) => n + attendancePaidContribution(a.status), 0);
    const inputs = {
      workingDays,
      paidLeaveDays,
      unpaidLeaveDays,
      employedDays: employedDaysInPeriod(employments, period),
      periodCalendarDays: calendarDaysInPeriod(period),
    };
    const before = payrollDayCounts({
      ...inputs,
      presentDays: otherDays + attendancePaidContribution(c.originalStatus),
    });
    const after = payrollDayCounts({
      ...inputs,
      presentDays: otherDays + attendancePaidContribution(c.requestedStatus),
    });
    return {
      correctionId: c.id,
      workingDays,
      paidDaysDelta: after.paidDays - before.paidDays,
      unpaidDaysDelta: after.unpaidDays - before.unpaidDays,
      payrollLocked: await payrollLocked(tx, c.tenantId, date),
      basis: 'CURRENT_PAYROLL_DAY_RULES',
      provisional: true,
    };
  }

  private requireRead(actor: AuthContext) {
    if (
      !hasDomainPermission(actor, STAFF_CORRECTION_APPROVE) &&
      !hasDomainPermission(actor, 'hr:attendance:correct')
    )
      throw new ForbiddenException('Correction access denied');
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthContext,
    id: string,
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        resource: 'staff_attendance_correction',
        resourceId: id,
        action,
      },
    });
  }
}

function bsYearMonthOf(date: Date): [number, number] {
  const bs = toBsDateFromGregorian(date);
  return [bs.year, bs.month];
}
