import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AudienceType, ConsentType, NotificationChannel } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { CommunicationsService } from '../communications/communications.service';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';

interface LowBalanceNotificationJob {
  tenantId: string;
  studentId: string;
  balance: string;
  threshold: string;
  windowKey: string;
  actor: AuthContext;
}

@Processor('canteen-alerts')
export class CanteenAlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(CanteenAlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly plansService: PlansService,
    private readonly cls: ClsService,
  ) {
    super();
  }

  async process(
    job: Job<
      LowBalanceNotificationJob,
      { skipped: true; reason: string } | { sent: true } | undefined
    >,
  ) {
    if (job.name !== 'low-balance-notification') {
      return;
    }

    const { tenantId, studentId, balance, threshold, windowKey, actor } =
      job.data;

    const result = await runTenantScopedJob(
      this.cls,
      this.plansService,
      tenantId,
      this.logger,
      'canteen low-balance notification',
      async () => {
        const sourceId = `canteen-low-balance:${studentId}:${threshold}:${windowKey}`;

        const existing = await this.prisma.notificationDelivery.count({
          where: {
            tenantId,
            sourceType: 'canteen_low_balance',
            sourceId,
          },
        });

        if (existing > 0) {
          return { skipped: true as const, reason: 'Already sent in this window' };
        }

        await this.communicationsService.recordDeliveryRecords({
          actor,
          sourceType: 'canteen_low_balance',
          sourceId,
          audienceType: AudienceType.ALL,
          studentIds: [studentId],
          title: 'Canteen wallet low balance',
          body: `Canteen wallet balance is ${balance}, below the threshold ${threshold}.`,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
          requiredConsentTypes: [ConsentType.MESSAGING],
        });

        return { sent: true as const };
      },
    );

    return result ?? { skipped: true as const, reason: 'Tenant inactive' };
  }
}
