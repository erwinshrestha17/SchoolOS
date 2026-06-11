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

export interface RetryDeliveryOptions {
  reason?: string | null;
}

export interface DeliveryFailureDashboardItem {
  id: string;
  status: NotificationStatus;
  channel: NotificationChannel;
  sourceType: string;
  sourceId: string;
  title: string;
  lastFailureReason: string | null;
  retryCount: number;
  retryStatus: 'retryable' | 'pending' | 'not_retryable';
  lastRetryAt: string | null;
  failedAt: string | null;
  createdAt: string;
  recipientSummary: {
    audienceType: string;
    recipientUserId: string | null;
    guardianId: string | null;
    studentId: string | null;
    destinationMasked: string | null;
  };
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
    options: RetryDeliveryOptions = {},
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

    const result = await this.dispatchRetry(delivery, actor, options);

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
    options: RetryDeliveryOptions = {},
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
      results.push(await this.dispatchRetry(delivery, actor, options));
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
        reason: options.reason ?? null,
      },
    });

    return {
      requested: deliveries.length,
      retried: results.length,
      results,
    };
  }

  async listFailureDashboard(actor: AuthContext): Promise<{
    items: DeliveryFailureDashboardItem[];
    total: number;
  }> {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        tenantId: actor.tenantId,
        status: {
          in: [
            NotificationStatus.FAILED,
            NotificationStatus.RETRY_PENDING,
            NotificationStatus.SKIPPED,
          ],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        status: true,
        channel: true,
        sourceType: true,
        sourceId: true,
        title: true,
        errorMessage: true,
        failureReason: true,
        failureCode: true,
        retryCount: true,
        lastRetryAt: true,
        failedAt: true,
        createdAt: true,
        audienceType: true,
        recipientUserId: true,
        guardianId: true,
        studentId: true,
        destination: true,
      },
    });

    return {
      total: deliveries.length,
      items: deliveries.map((delivery) => ({
        id: delivery.id,
        status: delivery.status,
        channel: delivery.channel,
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
        title: delivery.title,
        lastFailureReason:
          delivery.failureReason ??
          delivery.errorMessage ??
          delivery.failureCode ??
          null,
        retryCount: delivery.retryCount,
        retryStatus:
          delivery.status === NotificationStatus.RETRY_PENDING
            ? 'pending'
            : isRetryable(delivery.status)
              ? 'retryable'
              : 'not_retryable',
        lastRetryAt: delivery.lastRetryAt?.toISOString() ?? null,
        failedAt: delivery.failedAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        recipientSummary: {
          audienceType: delivery.audienceType,
          recipientUserId: delivery.recipientUserId,
          guardianId: delivery.guardianId,
          studentId: delivery.studentId,
          destinationMasked: maskDestination(delivery.destination),
        },
      })),
    };
  }

  private async dispatchRetry(
    delivery: RetryableDelivery,
    actor: AuthContext,
    options: RetryDeliveryOptions = {},
  ): Promise<DeliveryRetryResult> {
    const retriedAt = new Date();

    const claimed = await this.prisma.notificationDelivery.updateMany({
      where: {
        id: delivery.id,
        tenantId: actor.tenantId,
        status: {
          in: [
            NotificationStatus.FAILED,
            NotificationStatus.QUEUED,
            NotificationStatus.RETRY_PENDING,
          ],
        },
      },
      data: {
        status: NotificationStatus.RETRY_PENDING,
        errorMessage: null,
        retryCount: { increment: 1 },
        lastRetryAt: retriedAt,
        retryReason: options.reason ?? null,
        requestedById: actor.userId,
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException('Delivery is no longer retryable');
    }

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

      return {
        deliveryId: delivery.id,
        status: NotificationStatus.RETRY_PENDING,
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
          failedAt: new Date(),
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
    status === NotificationStatus.FAILED ||
    status === NotificationStatus.QUEUED ||
    status === NotificationStatus.RETRY_PENDING
  );
}

function maskDestination(destination: string | null) {
  if (!destination) return null;
  if (destination.includes('@')) {
    const [name, domain] = destination.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (destination.length <= 4) return '***';
  return `${destination.slice(0, 3)}***${destination.slice(-2)}`;
}
