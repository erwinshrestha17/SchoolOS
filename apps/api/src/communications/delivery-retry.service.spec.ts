import {
  AuthMethod,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { DeliveryRetryService } from './delivery-retry.service';

describe('DeliveryRetryService failure dashboard', () => {
  const actor: AuthContext = {
    userId: 'admin-1',
    tenantId: 'tenant-1',
    tenantSlug: 'green-valley',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['communications:read_deliveries'],
  };

  it('returns tenant-scoped failed delivery details without raw destination leakage', async () => {
    const prisma = {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.EMAIL,
            sourceType: 'notice',
            sourceId: 'notice-1',
            title: 'Fee reminder',
            errorMessage: 'Provider timeout',
            failureReason: null,
            failureCode: null,
            retryCount: 2,
            lastRetryAt: new Date('2026-05-17T09:00:00.000Z'),
            failedAt: new Date('2026-05-17T09:01:00.000Z'),
            createdAt: new Date('2026-05-17T08:00:00.000Z'),
            audienceType: 'CLASS',
            recipientUserId: 'guardian-user-1',
            guardianId: 'guardian-1',
            studentId: 'student-1',
            destination: 'guardian@example.edu',
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new DeliveryRetryService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(service.listFailureDashboard(actor)).resolves.toEqual({
      total: 1,
      page: 1,
      limit: 25,
      hasNextPage: false,
      items: [
        expect.objectContaining({
          id: 'delivery-1',
          lastFailureReason: 'Provider timeout',
          retryCount: 2,
          retryStatus: 'retryable',
          recipientSummary: expect.objectContaining({
            destinationMasked: 'gu***@example.edu',
          }),
        }),
      ],
    });

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
        skip: 0,
        take: 25,
      }),
    );
  });

  it('stores the operator reason when failed deliveries are retried in bulk', async () => {
    const prisma = {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            tenantId: 'tenant-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.EMAIL,
            sourceType: 'notice',
            sourceId: 'notice-1',
            destination: 'guardian@example.edu',
            title: 'Fee reminder',
            body: 'Please review the latest invoice.',
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
    };
    const notificationsService = {
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: true,
        failureCode: null,
        failureReason: null,
      }),
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notificationsService as never,
      auditService as never,
    );

    await expect(
      service.retryFailedDeliveries(actor, {
        reason: 'Provider incident recovered',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        requested: 1,
        retried: 1,
      }),
    );

    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'delivery-1',
          tenantId: 'tenant-1',
        }),
        data: expect.objectContaining({
          retryReason: 'Provider incident recovered',
          requestedById: 'admin-1',
          status: NotificationStatus.RETRY_PENDING,
        }),
      }),
    );
    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          notificationDeliveryId: 'delivery-1',
          retry: 'true',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_failed',
        tenantId: 'tenant-1',
        after: expect.objectContaining({
          reason: 'Provider incident recovered',
        }),
      }),
    );
  });

  it('fails closed without enqueueing when a channel provider is disabled', async () => {
    const prisma = {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'delivery-1',
          tenantId: 'tenant-1',
          status: NotificationStatus.FAILED,
          channel: NotificationChannel.SMS,
          sourceType: 'notice',
          sourceId: 'notice-1',
          destination: '+9779800000000',
          title: 'Emergency notice',
          body: 'School is closed today.',
          errorMessage: 'Previous provider outage',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const notificationsService = {
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: false,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'SMS dispatch is disabled. token=very-secret-value',
      }),
      sendSms: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notificationsService as never,
      auditService as never,
    );

    await expect(
      service.retryDelivery('delivery-1', actor, {
        reason: 'Retry after provider maintenance',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        deliveryId: 'delivery-1',
        status: NotificationStatus.FAILED,
        errorMessage: 'SMS dispatch is disabled. token=***',
      }),
    );

    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'SMS dispatch is disabled. token=***',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_blocked',
        resource: 'notification_delivery',
        tenantId: 'tenant-1',
        after: expect.objectContaining({
          channel: NotificationChannel.SMS,
          failureCode: 'PROVIDER_DISABLED',
        }),
      }),
    );
  });

  it('fails closed for bulk retry when a channel provider is disabled', async () => {
    const prisma = {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            tenantId: 'tenant-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.SMS,
            sourceType: 'notice',
            sourceId: 'notice-1',
            destination: '+9779800000000',
            title: 'Emergency notice',
            body: 'School is closed today.',
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const notificationsService = {
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: false,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'SMS dispatch is disabled. bearer=secret-token',
      }),
      sendSms: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notificationsService as never,
      auditService as never,
    );

    await expect(
      service.retryFailedDeliveries(actor, {
        reason: 'Retry queued after outage',
      }),
    ).resolves.toEqual({
      requested: 1,
      retried: 1,
      results: [
        expect.objectContaining({
          deliveryId: 'delivery-1',
          status: NotificationStatus.FAILED,
          errorMessage: 'SMS dispatch is disabled. bearer=***',
        }),
      ],
    });

    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'SMS dispatch is disabled. bearer=***',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_blocked',
        resource: 'notification_delivery',
        resourceId: 'delivery-1',
        after: expect.objectContaining({
          failureCode: 'PROVIDER_DISABLED',
          reason: 'Retry queued after outage',
        }),
      }),
    );
  });

  it('keeps bulk retry replay-safe when a delivery claim loses the retry race', async () => {
    const prisma = {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            tenantId: 'tenant-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.EMAIL,
            sourceType: 'notice',
            sourceId: 'notice-1',
            destination: 'guardian@example.edu',
            title: 'Fee reminder',
            body: 'Please review the latest invoice.',
          },
          {
            id: 'delivery-2',
            tenantId: 'tenant-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.EMAIL,
            sourceType: 'notice',
            sourceId: 'notice-2',
            destination: 'second@example.edu',
            title: 'Exam reminder',
            body: 'Exam starts tomorrow.',
          },
        ]),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        update: jest.fn(),
      },
    };
    const notificationsService = {
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: true,
        failureCode: null,
        failureReason: null,
      }),
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notificationsService as never,
      auditService as never,
    );

    const result = await service.retryFailedDeliveries(actor, {
      reason: 'Bulk operator retry',
    });

    expect(result).toEqual(
      expect.objectContaining({
        requested: 2,
        retried: 2,
        results: [
          expect.objectContaining({
            deliveryId: 'delivery-1',
            status: NotificationStatus.FAILED,
            errorMessage: 'Delivery is no longer retryable',
          }),
          expect.objectContaining({
            deliveryId: 'delivery-2',
            status: NotificationStatus.RETRY_PENDING,
            errorMessage: null,
          }),
        ],
      }),
    );
    expect(notificationsService.sendEmail).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'second@example.edu',
        metadata: expect.objectContaining({
          notificationDeliveryId: 'delivery-2',
          retry: 'true',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_skipped',
        resourceId: 'delivery-1',
        after: expect.objectContaining({
          diagnostic: 'Delivery is no longer retryable',
          reason: 'Bulk operator retry',
        }),
      }),
    );
  });

  it('replays pending activity delivery retries without dispatching a duplicate provider request', async () => {
    const lastRetryAt = new Date('2026-05-17T09:05:00.000Z');
    const prisma = {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'delivery-1',
          tenantId: 'tenant-1',
          status: NotificationStatus.RETRY_PENDING,
          channel: NotificationChannel.PUSH,
          sourceType: 'activity_post',
          sourceId: 'activity-post-1',
          destination: 'guardian-user-1',
          title: 'Class activity',
          body: 'Students painted today.',
          errorMessage: null,
          lastRetryAt,
        }),
        updateMany: jest.fn(),
      },
    };
    const notificationsService = {
      sendPushNotification: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notificationsService as never,
      auditService as never,
    );

    await expect(
      service.retryDelivery('delivery-1', actor, {
        reason: 'Teacher retried from activity feed',
      }),
    ).resolves.toEqual({
      deliveryId: 'delivery-1',
      status: NotificationStatus.RETRY_PENDING,
      errorMessage: null,
      retriedAt: lastRetryAt.toISOString(),
      replayed: true,
    });

    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_replayed',
        resource: 'notification_delivery',
        tenantId: 'tenant-1',
        after: expect.objectContaining({
          sourceType: 'activity_post',
          sourceId: 'activity-post-1',
        }),
      }),
    );
  });
});
