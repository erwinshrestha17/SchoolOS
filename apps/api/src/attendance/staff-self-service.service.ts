import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMyStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';

@Injectable()
export class StaffSelfServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listMyLeaveBalances(actor: AuthContext) {
    const staff = await this.getActorStaff(actor);
    const balances = await this.prisma.staffLeaveBalance.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id },
      orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
    });

    return balances.map((balance) => ({
      id: balance.id,
      leaveType: balance.leaveType,
      year: balance.year,
      opening: Number(balance.opening),
      accrued: Number(balance.accrued),
      allocated: Number(balance.allocated),
      used: Number(balance.used),
      carried: Number(balance.carried),
      adjusted: Number(balance.adjusted),
      available: Number(
        balance.opening
          .add(balance.accrued)
          .add(balance.allocated)
          .add(balance.carried)
          .add(balance.adjusted)
          .sub(balance.used),
      ),
    }));
  }

  async createMyLeaveRequest(
    dto: CreateMyStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const staff = await this.getActorStaff(actor);
    const startsOn = normalizeDate(dto.startsOn, 'startsOn');
    const endsOn = normalizeDate(dto.endsOn, 'endsOn');

    if (endsOn < startsOn) {
      throw new ForbiddenException('Leave end date cannot be before start date');
    }

    const overlapping = await this.prisma.staffLeaveRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startsOn: { lte: endsOn },
        endsOn: { gte: startsOn },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'A pending or approved leave request already overlaps this date range',
      );
    }

    const leave = await this.prisma.staffLeaveRequest.create({
      data: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        leaveType: dto.leaveType,
        isPaid: isPaidLeave(dto.leaveType),
        startsOn,
        endsOn,
        days: new Prisma.Decimal(countInclusiveDays(startsOn, endsOn)),
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'self_request',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: leave.id,
      after: {
        staffId: staff.id,
        leaveType: leave.leaveType,
        isPaid: leave.isPaid,
        startsOn: leave.startsOn,
        endsOn: leave.endsOn,
      },
    });

    return leave;
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

function normalizeDate(input: string, field: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ConflictException(`${field} must be a valid ISO date`);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function countInclusiveDays(startsOn: Date, endsOn: Date) {
  const millisPerDay = 86_400_000;
  return Math.floor((endsOn.getTime() - startsOn.getTime()) / millisPerDay) + 1;
}

function isPaidLeave(leaveType: string) {
  const normalized = leaveType.trim().toUpperCase();
  return normalized !== 'UNPAID' && normalized !== 'LWP';
}
