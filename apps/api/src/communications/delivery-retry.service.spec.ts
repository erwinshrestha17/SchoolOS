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
      },
    };
    const service = new DeliveryRetryService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(service.listFailureDashboard(actor)).resolves.toEqual({
      total: 1,
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
        take: 100,
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
});
