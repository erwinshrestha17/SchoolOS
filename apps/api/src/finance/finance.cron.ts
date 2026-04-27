import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';
import { NotificationChannel } from '@prisma/client';

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

    const activeSchedules = await this.prisma.feeDueSchedule.findMany({
      where: {
        dueDate: { lte: today },
        OR: [
          { lastProcessedAt: null },
          { lastProcessedAt: { lt: today } }
        ]
      },
    });

    for (const schedule of activeSchedules) {
      this.logger.log(`Processing fee schedule ${schedule.id} (${schedule.name}) for tenant ${schedule.tenantId}...`);
      
      try {
        // Construct a system-level auth context since this is automated
        const adminUser = await this.prisma.user.findFirst({
          where: { tenantId: schedule.tenantId }, // Ideally find the tenant super_admin
        });
        
        if (!adminUser) continue;

        const result = await this.financeService.processDueSchedule(
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
            roles: ['super_admin'],
            permissions: [],
          }
        );

        this.logger.log(`Schedule ${schedule.id} processed successfully. Reminded ${result.reminderResult?.reminded ?? 0} defaulters.`);
      } catch (error) {
        this.logger.error(`Failed to process schedule ${schedule.id}:`, error);
      }
    }
  }
}
