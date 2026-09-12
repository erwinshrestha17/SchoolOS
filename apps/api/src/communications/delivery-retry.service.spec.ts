import {
  AuthMethod,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
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

  describe('readiness checks before queue handoff', () => {
    function setup() {
      const delivery = {
        id: 'delivery-readiness',
        tenantId: actor.tenantId,
        status: NotificationStatus.FAILED as NotificationStatus,
        channel: NotificationChannel.EMAIL,
        retryCount: 2,
        sourceType: 'notice',
        sourceId: 'notice-readiness',
        destination: 'synthetic@example.invalid',
        title: 'Synthetic readiness check',
        body: 'Synthetic content',
        errorMessage: null as string | null,
      };
      const prisma = {
        notificationDelivery: {
          findFirst: jest.fn(async () => ({ ...delivery })),
          findMany: jest.fn(async () => [{ ...delivery }]),
          updateMany: jest.fn(async ({ where, data }) => {
            if (
              where.id !== delivery.id ||
              where.tenantId !== delivery.tenantId ||
              where.retryCount !== delivery.retryCount ||
              (typeof where.status === 'string'
                ? where.status !== delivery.status
                : !where.status.in.includes(delivery.status))
            ) {
              return { count: 0 };
            }
            Object.assign(delivery, {
              ...data,
              retryCount: data.retryCount
                ? delivery.retryCount + data.retryCount.increment
                : delivery.retryCount,
            });
            return { count: 1 };
          }),
        },
      };
      const notifications = {
        getProviderReadiness: jest.fn(),
        sendEmail: jest.fn(),
      };
      const audit = { record: jest.fn() };
      const service = new DeliveryRetryService(
        prisma as never,
        notifications as never,
        audit as never,
      );
      return { delivery, prisma, notifications, audit, service };
    }

    it.each([
      ['missing result', undefined],
      ['null result', null],
      ['missing enabled flag', {}],
      ['non-boolean enabled flag', { enabled: 'true' }],
    ])('fails closed for %s', async (_label, readiness) => {
      const { service, notifications, delivery, audit } = setup();
      notifications.getProviderReadiness.mockResolvedValue(readiness);

      await expect(
        service.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({
        status: NotificationStatus.FAILED,
        errorMessage:
          'Provider readiness could not be confirmed. No queue handoff was attempted.',
      });
      expect(delivery).toMatchObject({
        status: NotificationStatus.FAILED,
        retryCount: 3,
        failureCode: 'PROVIDER_NOT_READY',
      });
      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'retry_blocked' }),
      );
    });

    it('recovers from a readiness exception without stranding or leaking the attempt', async () => {
      const { service, notifications, delivery, audit } = setup();
      notifications.getProviderReadiness
        .mockRejectedValueOnce(new Error('synthetic-private-provider-error'))
        .mockResolvedValueOnce({ enabled: true });

      const blocked = await service.retryDelivery(delivery.id, actor);
      expect(blocked.status).toBe(NotificationStatus.FAILED);
      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(
        JSON.stringify({ blocked, delivery, audit: audit.record.mock.calls }),
      ).not.toContain('synthetic-private-provider-error');

      await expect(
        service.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({ status: NotificationStatus.RETRY_PENDING });
      expect(delivery.retryCount).toBe(4);
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      expect(notifications.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ deliveryAttempt: '4' }),
        }),
      );
    });

    it('fails closed when the readiness dependency is missing', async () => {
      const { prisma, notifications, delivery, audit } = setup();
      const service = new DeliveryRetryService(
        prisma as never,
        { sendEmail: notifications.sendEmail } as never,
        audit as never,
      );
      await expect(
        service.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({ status: NotificationStatus.FAILED });
      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(delivery.retryCount).toBe(3);
    });

    it('preserves a newer terminal result if readiness fails late', async () => {
      const { service, notifications, delivery } = setup();
      notifications.getProviderReadiness.mockImplementation(async () => {
        delivery.status = NotificationStatus.DELIVERED;
        throw new Error('late readiness failure');
      });
      await expect(
        service.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({
        status: NotificationStatus.DELIVERED,
        errorMessage: null,
        replayed: true,
      });
      expect(delivery.status).toBe(NotificationStatus.DELIVERED);
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });

    it('returns a bounded failed result for bulk readiness exceptions', async () => {
      const { service, notifications, delivery } = setup();
      notifications.getProviderReadiness.mockRejectedValue(
        new Error('synthetic-private-provider-error'),
      );
      await expect(service.retryFailedDeliveries(actor)).resolves.toEqual({
        requested: 1,
        retried: 1,
        results: [
          expect.objectContaining({
            deliveryId: delivery.id,
            status: NotificationStatus.FAILED,
            errorMessage:
              'Provider readiness could not be confirmed. No queue handoff was attempted.',
          }),
        ],
      });
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });
  });

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

  it('returns only bounded diagnostics for support and rejects source probing', async () => {
    const supportActor: AuthContext = {
      ...actor,
      userId: 'platform-operator-1',
      roles: [],
      permissions: ['notifications:view_delivery_diagnostics'],
      isSupportOverride: true,
      supportOverrideReadOnly: true,
      supportOverrideScopes: ['NOTICES_DELIVERY'],
    };
    const prisma = {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            status: NotificationStatus.FAILED,
            channel: NotificationChannel.EMAIL,
            sourceType: 'payroll',
            sourceId: 'payroll-run-1',
            title: 'Private payroll delivery',
            errorMessage:
              'authorization=https://internal.example/token?secret=raw',
            failureReason: null,
            failureCode: 'PROVIDER_AUTH_FAILED',
            retryCount: 2,
            lastRetryAt: null,
            failedAt: new Date('2026-05-17T09:01:00.000Z'),
            createdAt: new Date('2026-05-17T08:00:00.000Z'),
            audienceType: 'STAFF',
            recipientUserId: 'staff-user-1',
            guardianId: null,
            studentId: null,
            destination: 'staff@example.edu',
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

    await expect(service.listFailureDashboard(supportActor)).resolves.toEqual({
      total: 1,
      page: 1,
      limit: 25,
      hasNextPage: false,
      items: [
        expect.objectContaining({
          id: 'delivery-1',
          sourceType: 'notification',
          sourceId: null,
          title: null,
          lastFailureReason: 'Provider authentication failed.',
          recipientSummary: {
            audienceType: 'STAFF',
            recipientUserId: null,
            guardianId: null,
            studentId: null,
            destinationMasked: 'st***@example.edu',
          },
        }),
      ],
    });

    expect(
      JSON.stringify(await service.listFailureDashboard(supportActor)),
    ).not.toContain('payroll-run-1');
    expect(
      JSON.stringify(await service.listFailureDashboard(supportActor)),
    ).not.toContain('internal.example');

    prisma.notificationDelivery.findMany.mockClear();
    prisma.notificationDelivery.count.mockClear();
    await expect(
      service.listFailureDashboard(supportActor, {
        page: 1,
        limit: 25,
        sourceType: 'payroll',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.notificationDelivery.findMany).not.toHaveBeenCalled();
  });

  it('preserves a newer skipped state during an in-app retry', async () => {
    const delivery = {
      id: 'delivery-1',
      tenantId: actor.tenantId,
      status: NotificationStatus.FAILED,
      retryCount: 2,
      channel: NotificationChannel.IN_APP,
      sourceType: 'notice',
      sourceId: 'notice-1',
      destination: actor.userId,
      title: 'Synthetic',
      body: 'Synthetic',
    };
    const prisma = {
      notificationDelivery: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(delivery)
          .mockResolvedValueOnce({
            status: NotificationStatus.SKIPPED,
            errorMessage: null,
          }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        update: jest.fn(),
      },
    };
    const service = new DeliveryRetryService(
      prisma as never,
      {
        getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
        releaseInAppNotification: jest
          .fn()
          .mockRejectedValue(new Error('late enqueue failure')),
      } as never,
      { record: jest.fn() } as never,
    );
    await expect(
      service.retryDelivery(delivery.id, actor),
    ).resolves.toMatchObject({
      status: NotificationStatus.SKIPPED,
      errorMessage: null,
      replayed: true,
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: delivery.id,
          tenantId: actor.tenantId,
          status: NotificationStatus.RETRY_PENDING,
          retryCount: 3,
        },
      }),
    );
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it.each([null, 'admin-1'])(
    'queues an in-app retry for policy evaluation with destination %s',
    async (destination) => {
      const delivery = {
        id: 'delivery-1',
        tenantId: actor.tenantId,
        status: NotificationStatus.FAILED,
        retryCount: 2,
        channel: NotificationChannel.IN_APP,
        sourceType: 'notice',
        sourceId: 'notice-1',
        destination,
        title: 'Synthetic',
        body: 'Synthetic',
      };
      const prisma = {
        notificationDelivery: {
          findFirst: jest.fn().mockResolvedValue(delivery),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn(),
        },
      };
      const notifications = {
        getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
        releaseInAppNotification: jest.fn().mockResolvedValue(undefined),
      };
      const service = new DeliveryRetryService(
        prisma as never,
        notifications as never,
        { record: jest.fn() } as never,
      );
      await expect(
        service.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({
        status: NotificationStatus.RETRY_PENDING,
        errorMessage: null,
      });
      expect(notifications.releaseInAppNotification).toHaveBeenCalledWith({
        metadata: {
          tenantId: actor.tenantId,
          notificationDeliveryId: delivery.id,
          deliveryAttempt: '3',
          sourceType: 'notice',
          sourceId: 'notice-1',
          retry: 'true',
        },
      });
      expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    },
  );

  it('preserves delivery success after a delayed enqueue failure', async () => {
    const delivery = {
      id: 'delivery-1',
      tenantId: actor.tenantId,
      status: NotificationStatus.FAILED,
      retryCount: 2,
      channel: NotificationChannel.EMAIL,
      sourceType: 'notice',
      sourceId: 'notice-1',
      destination: 'synthetic@example.invalid',
      title: 'Synthetic',
      body: 'Synthetic',
    };
    const prisma = {
      notificationDelivery: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(delivery)
          .mockResolvedValueOnce({
            status: NotificationStatus.DELIVERED,
            errorMessage: null,
          }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        update: jest.fn(),
      },
    };
    const notifications = {
      getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
      sendEmail: jest.fn().mockRejectedValue(new Error('late failure')),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notifications as never,
      { record: jest.fn() } as never,
    );
    await expect(
      service.retryDelivery(delivery.id, actor),
    ).resolves.toMatchObject({
      status: NotificationStatus.DELIVERED,
      replayed: true,
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: delivery.id,
          tenantId: actor.tenantId,
          status: NotificationStatus.RETRY_PENDING,
          retryCount: 3,
        },
      }),
    );
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('allows only one claimant for the same observed retry version', async () => {
    const delivery = {
      id: 'delivery-1',
      tenantId: actor.tenantId,
      status: NotificationStatus.FAILED,
      retryCount: 2,
      channel: NotificationChannel.EMAIL,
      sourceType: 'notice',
      sourceId: 'notice-1',
      destination: 'synthetic@example.invalid',
      title: 'Synthetic',
      body: 'Synthetic',
    };
    let claimed = false;
    const prisma = {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue(delivery),
        updateMany: jest.fn(async ({ where }) => {
          expect(where.retryCount).toBe(2);
          expect(where.status.in).toEqual([
            NotificationStatus.FAILED,
            NotificationStatus.QUEUED,
          ]);
          if (claimed) return { count: 0 };
          claimed = true;
          return { count: 1 };
        }),
        update: jest.fn(),
      },
    };
    const notifications = {
      getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
      sendEmail: jest.fn(),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notifications as never,
      { record: jest.fn() } as never,
    );
    const results = await Promise.allSettled([
      service.retryDelivery(delivery.id, actor),
      service.retryDelivery(delivery.id, actor),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps an unconfirmed queue handoff pending and replays without another enqueue', async () => {
    const delivery = {
      id: 'delivery-uncertain',
      tenantId: actor.tenantId,
      status: NotificationStatus.FAILED,
      retryCount: 0,
      channel: NotificationChannel.EMAIL,
      sourceType: 'notice',
      sourceId: 'notice-1',
      destination: 'synthetic@example.invalid',
      title: 'Synthetic',
      body: 'Synthetic',
      errorMessage: null as string | null,
      lastRetryAt: null as Date | null,
    };
    const prisma = {
      notificationDelivery: {
        findFirst: jest.fn(async () => ({ ...delivery })),
        updateMany: jest.fn(async ({ data }) => {
          Object.assign(delivery, {
            ...data,
            retryCount: data.retryCount
              ? delivery.retryCount + data.retryCount.increment
              : delivery.retryCount,
          });
          return { count: 1 };
        }),
      },
    };
    const notifications = {
      getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
      sendEmail: jest
        .fn()
        .mockRejectedValue(
          new Error('Redis acknowledgement lost token=private'),
        ),
    };
    const service = new DeliveryRetryService(
      prisma as never,
      notifications as never,
      { record: jest.fn() } as never,
    );
    const result = await service.retryDelivery(delivery.id, actor);
    expect(result).toMatchObject({
      status: NotificationStatus.RETRY_PENDING,
      errorMessage: expect.stringContaining(
        'Queue handoff could not be confirmed',
      ),
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(delivery.retryCount).toBe(1);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.RETRY_PENDING,
          failureCode: 'QUEUE_HANDOFF_UNCONFIRMED',
          failedAt: undefined,
        }),
      }),
    );
    await expect(
      service.retryDelivery(delivery.id, actor),
    ).resolves.toMatchObject({
      ...result,
      replayed: true,
    });
    expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
    expect(delivery.retryCount).toBe(1);
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
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'delivery-1',
        tenantId: actor.tenantId,
        status: NotificationStatus.RETRY_PENDING,
      }),
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
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'delivery-1',
        tenantId: actor.tenantId,
        status: NotificationStatus.RETRY_PENDING,
      }),
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
