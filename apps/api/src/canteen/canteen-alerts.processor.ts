import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AudienceType, ConsentType, NotificationChannel } from '@prisma/client';
import { CommunicationsService } from '../communications/communications.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
  ) {
    super();
  }

  async process(
    job: Job<
      LowBalanceNotificationJob,
      { skipped: true; reason: string } | { sent: true } | undefined
    >,
  ) {
    if (job.name === 'low-balance-notification') {
      const { tenantId, studentId, balance, threshold, windowKey, actor } =
        job.data;

      const sourceId = `canteen-low-balance:${studentId}:${threshold}:${windowKey}`;

      // Idempotency check: Don't send multiple alerts in the same window
      const existing = await this.prisma.notificationDelivery.count({
        where: {
          tenantId,
          sourceType: 'canteen_low_balance',
          sourceId,
        },
      });

      if (existing > 0) {
        return { skipped: true, reason: 'Already sent in this window' };
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

      return { sent: true };
    }
  }
}
