import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StaffLeaveBalance, StaffStatus, Prisma } from '@prisma/client';

@Injectable()
export class StaffLeaveAccrualService {
  private readonly logger = new Logger(StaffLeaveAccrualService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Processes monthly leave accruals for all active staff in a tenant.
   * This would typically be called by a cron job or a manual trigger.
   */
  async processMonthlyAccruals(
    tenantId: string,
    year: number,
    month: number,
    actorUserId: string,
  ) {
    this.logger.log(
      `Processing monthly accruals for tenant ${tenantId}, period ${year}-${month}`,
    );

    // Idempotency lock using TenantSetting
    const settingKey = `hr:accrual:lock:${year}:${month}`;
    const existingLock = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: settingKey,
        },
      },
    });

    if (existingLock) {
      this.logger.warn(
        `Accruals for ${year}-${month} already processed for tenant ${tenantId}. Skipping.`,
      );
      return {
        processedCount: 0,
        accrualsGenerated: 0,
        skipped: true,
      };
    }

    const activeStaff = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: StaffStatus.ACTIVE,
      },
    });

    const accrualRules = [
      { leaveType: 'EARNED', monthlyAmount: 1.5 },
      { leaveType: 'SICK', monthlyAmount: 1.0 },
      { leaveType: 'CASUAL', monthlyAmount: 0.5 },
    ];

    const results: StaffLeaveBalance[] = [];

    for (const staff of activeStaff) {
      for (const rule of accrualRules) {
        const balance = await this.prisma.staffLeaveBalance.upsert({
          where: {
            tenantId_staffId_leaveType_year: {
              tenantId,
              staffId: staff.id,
              leaveType: rule.leaveType,
              year,
            },
          },
          update: {
            accrued: { increment: new Prisma.Decimal(rule.monthlyAmount) },
          },
          create: {
            tenantId,
            staffId: staff.id,
            leaveType: rule.leaveType,
            year,
            accrued: new Prisma.Decimal(rule.monthlyAmount),
            opening: new Prisma.Decimal(0),
            allocated: new Prisma.Decimal(0),
            used: new Prisma.Decimal(0),
            carried: new Prisma.Decimal(0),
          },
        });

        results.push(balance);
      }
    }

    await this.prisma.tenantSetting.create({
      data: {
        tenantId,
        key: settingKey,
        value: {
          processedAt: new Date(),
          processedBy: actorUserId,
          staffCount: activeStaff.length,
          accrualsCount: results.length,
        },
      },
    });

    await this.auditService.record({
      action: 'process_accruals',
      resource: 'staff_leave_balance',
      tenantId,
      userId: actorUserId,
      after: {
        year,
        month,
        staffCount: activeStaff.length,
        accrualRules,
      },
    });

    return {
      processedCount: activeStaff.length,
      accrualsGenerated: results.length,
    };
  }
}
