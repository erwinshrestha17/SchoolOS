import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

interface RetryableDelivery {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sourceType: string;
  sourceId: string;
  destination: string | null;
  title: string;
  body: string;
}

export interface DeliveryRetryResult {
  deliveryId: string;
  status: NotificationStatus;
  errorMessage: string | null;
  retriedAt: string;
}

export interface BulkDeliveryRetryResult {
  requested: number;
  retried: number;
  results: DeliveryRetryResult[];
}

@Injectable()
export class DeliveryRetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async retryDelivery(
    deliveryId: string,
    actor: AuthContext,
  ): Promise<DeliveryRetryResult> {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: deliveryId,
        tenantId: actor.tenantId,
      },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery record not found');
    }

    if (!isRetryable(delivery.status)) {
      throw new BadRequestException(
        `Only failed or queued deliveries can be retried. Current status: ${delivery.status}`,
      );
    }

    const result = await this.dispatchRetry(delivery);

    await this.auditService.record({
      action: 'retry',
      resource: 'notification_delivery',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: delivery.id,
      before: {
        status: delivery.status,
        errorMessage: delivery.errorMessage,
      },
      after: {
        status: result.status,
        errorMessage: result.errorMessage,
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
        channel: delivery.channel,
      },
    });

    return result;
  }

  async retryFailedDeliveries(
    actor: AuthContext,
  ): Promise<BulkDeliveryRetryResult> {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        tenantId: actor.tenantId,
        status: NotificationStatus.FAILED,
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 50,
    });

    const results: DeliveryRetryResult[] = [];

    for (const delivery of deliveries) {
      results.push(await this.dispatchRetry(delivery));
    }

    await this.auditService.record({
      action: 'retry_failed',
      resource: 'notification_delivery',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        requested: deliveries.length,
        retried: results.length,
        failedAfterRetry: results.filter(
          (result) => result.status === NotificationStatus.FAILED,
        ).length,
      },
    });

    return {
      requested: deliveries.length,
      retried: results.length,
      results,
    };
  }

  private async dispatchRetry(
    delivery: RetryableDelivery,
  ): Promise<DeliveryRetryResult> {
    const retriedAt = new Date();

    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: NotificationStatus.QUEUED,
        errorMessage: null,
      },
    });

    try {
      if (!delivery.destination) {
        throw new Error(`No destination resolved for ${delivery.channel}`);
      }

      const metadata: Record<string, string> = {
        tenantId: delivery.tenantId,
        notificationDeliveryId: delivery.id,
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
        retry: 'true',
      };

      if (delivery.channel === NotificationChannel.EMAIL) {
        await this.notificationsService.sendEmail({
          to: delivery.destination,
          subject: delivery.title,
          text: delivery.body,
          metadata,
        });
      } else if (delivery.channel === NotificationChannel.SMS) {
        await this.notificationsService.sendSms({
          to: delivery.destination,
          message: delivery.body,
          metadata,
        });
      } else {
        await this.notificationsService.sendPushNotification({
          title: delivery.title,
          body: delivery.body,
          audience: delivery.destination,
          metadata,
        });
      }

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationStatus.SENT,
          errorMessage: null,
          sentAt: new Date(),
        },
      });

      return {
        deliveryId: delivery.id,
        status: NotificationStatus.SENT,
        errorMessage: null,
        retriedAt: retriedAt.toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Notification retry failed';

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage,
        },
      });

      return {
        deliveryId: delivery.id,
        status: NotificationStatus.FAILED,
        errorMessage,
        retriedAt: retriedAt.toISOString(),
      };
    }
  }
}

function isRetryable(status: NotificationStatus) {
  return (
    status === NotificationStatus.FAILED || status === NotificationStatus.QUEUED
  );
}
