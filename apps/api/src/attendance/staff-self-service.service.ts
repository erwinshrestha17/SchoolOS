import { Injectable, NotFoundException } from '@nestjs/common';
import { availableLeaveDays } from '../hr/staff-leave-policy';
import { StaffLeaveWorkflow } from '../hr/staff-leave-workflow';
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
      take: 100,
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
      available: Number(availableLeaveDays(balance)),
    }));
  }

  async createMyLeaveRequest(
    dto: CreateMyStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const staff = await this.getActorStaff(actor);
    // Phase 7.6: the shared leave workflow (employment window, balance,
    // overlap guarded by the database).
    return new StaffLeaveWorkflow(this.prisma, this.auditService).create(
      {
        staffId: staff.id,
        leaveType: dto.leaveType,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        reason: dto.reason,
        dayPart: dto.dayPart,
      },
      actor,
    );
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
