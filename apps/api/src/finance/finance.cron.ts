import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

@Injectable()
export class FinanceCron {
  private readonly logger = new Logger(FinanceCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDueSchedules() {
    this.logger.log('Starting daily fee due schedule processing...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Due schedules are swept across every tenant by design; each schedule is
    // then processed under its own tenant's scope below.
    const activeSchedules = await this.prisma.runWithoutTenantScope(
      'daily fee due-schedule sweep across all tenants',
      () =>
        this.prisma.feeDueSchedule.findMany({
          where: {
            tenant: { isActive: true },
            dueDate: { lte: today },
            OR: [{ lastProcessedAt: null }, { lastProcessedAt: { lt: today } }],
          },
        }),
    );

    for (const schedule of activeSchedules) {
      this.logger.log(
        `Processing fee schedule ${schedule.id} (${schedule.name}) for tenant ${schedule.tenantId}...`,
      );

      try {
        const result = await this.prisma.runWithTenantScope(
          schedule.tenantId,
          async () => {
            const adminUser = await this.prisma.user.findFirst({
              where: {
                tenantId: schedule.tenantId,
                status: UserStatus.ACTIVE,
              },
            });

            if (!adminUser) {
              return null;
            }

            return this.financeService.processDueSchedule(
              schedule.id,
              {
                message: `Automated reminder: Please clear your pending fee balance for ${schedule.name}.`,
              },
              {
                userId: adminUser.id,
                tenantId: schedule.tenantId,
                tenantSlug: 'system',
                email: adminUser.email ?? 'system@schoolos.com',
                authMethod: adminUser.authMethod,
                roles: ['platform_super_admin'],
                permissions: [],
              },
            );
          },
        );

        if (!result) {
          continue;
        }

        this.logger.log(
          `Schedule ${schedule.id} processed successfully. Reminded ${result.reminderResult?.reminded ?? 0} defaulters.`,
        );
      } catch (error) {
        this.logger.error(`Failed to process schedule ${schedule.id}:`, error);
      }
    }
  }
}
