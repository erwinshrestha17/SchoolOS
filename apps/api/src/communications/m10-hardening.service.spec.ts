import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { NotificationStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { M10HardeningService } from './m10-hardening.service';

describe('M10HardeningService operations depth', () => {
  const actor: AuthContext = {
    userId: 'admin-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'admin@school.test',
    roles: ['admin'],
    permissions: ['communications:read_deliveries'],
    authMethod: 'PASSWORD',
  };

  function createService() {
    const prisma = {
      notificationDelivery: {
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      providerConfig: {
        findFirst: jest.fn(),
      },
      noticeReadReceipt: { count: jest.fn() },
      parentTeacherMessage: { count: jest.fn() },
      parentTeacherThread: { count: jest.fn() },
      chatEscalation: { count: jest.fn() },
      chatAbuseReport: { count: jest.fn() },
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const auditService = {
      record: jest.fn(),
    };
    const service = new M10HardeningService(
      prisma as never,
      {} as never,
      {} as never,
      auditService as never,
      { jwtSecret: 'school-os-access-secret' } as never,
    );

    return { service, prisma, auditService };
  }

  function signProviderStatusPayload(
    payload: Record<string, unknown>,
    secret = 'callback-secret',
  ) {
    return `sha256=${createHmac('sha256', secret)
      .update(stableStringify(payload))
      .digest('hex')}`;
  }

  it('returns tenant-scoped retention review counts without deleting records', async () => {
    const { service, prisma } = createService();
    prisma.notificationDelivery.count.mockResolvedValue(3);
    prisma.noticeReadReceipt.count.mockResolvedValue(2);
    prisma.parentTeacherMessage.count.mockResolvedValue(5);
    prisma.parentTeacherThread.count.mockResolvedValue(1);
    prisma.chatEscalation.count.mockResolvedValue(4);
    prisma.chatAbuseReport.count.mockResolvedValue(6);

    const result = await service.getRetentionPolicyStatus(actor);

    expect(result.mode).toBe('review_only');
    expect(result.policies).toHaveLength(6);
    expect(result.policies.map((policy) => policy.reviewCount)).toEqual([
      3, 2, 5, 1, 4, 6,
    ]);
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        createdAt: { lt: expect.any(Date) },
      }),
    });
    expect(prisma.parentTeacherMessage.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        thread: { status: 'CLOSED' },
      }),
    });
  });

  it('returns a paginated communication audit trail scoped to allowed resources', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-05-31T10:00:00.000Z');
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        tenantId: 'tenant-1',
        action: 'read',
        resource: 'notice',
        resourceId: 'notice-1',
        userId: 'user-1',
        requestId: 'req-1',
        before: null,
        after: { noticeId: 'notice-1' },
        createdAt,
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listCommunicationAuditTrail(
      {
        resource: 'notice',
        action: 'read',
        startDate: '2026-05-01T00:00:00.000Z',
        page: 1,
        limit: 10,
      },
      actor,
    );

    expect(result.items[0]).toMatchObject({
      id: 'audit-1',
      resource: 'notice',
      createdAt: createdAt.toISOString(),
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          resource: 'notice',
          action: 'read',
        }),
        take: 10,
      }),
    );
  });

  it('rejects audit reads for non-communication resources', async () => {
    const { service } = createService();

    await expect(
      service.listCommunicationAuditTrail({ resource: 'journal_entry' }, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects forged provider callbacks with mismatched provider message ids', async () => {
    const { service, prisma } = createService();
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.SENT,
      providerMessageId: 'provider-real',
    });

    await expect(
      service.recordProviderDeliveryStatus(
        {
          deliveryId: 'delivery-1',
          providerMessageId: 'provider-forged',
          status: 'DELIVERED',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('verifies signed provider callbacks before updating delivery status', async () => {
    const { service, prisma } = createService();
    prisma.providerConfig.findFirst.mockResolvedValue({
      id: 'provider-1',
      type: 'SMS',
      name: 'NEPAL_SMS',
      enabled: true,
      configEncrypted: { callbackSecret: 'callback-secret' },
      secretKeys: ['callbackSecret'],
    });
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.SENT,
      providerMessageId: 'provider-1',
      sentAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    prisma.notificationDelivery.update.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.DELIVERED,
      providerMessageId: 'provider-1',
    });
    const payload = {
      deliveryId: null,
      failureCode: null,
      failureReason: null,
      providerMessageId: 'provider-1',
      providerName: 'NEPAL_SMS',
      providerType: 'SMS',
      status: 'DELIVERED',
    };

    await service.recordProviderDeliveryStatus(
      {
        providerType: 'SMS',
        providerName: 'NEPAL_SMS',
        providerMessageId: 'provider-1',
        status: 'DELIVERED',
        signature: signProviderStatusPayload(payload),
      },
      actor,
    );

    expect(prisma.providerConfig.findFirst).toHaveBeenCalledWith({
      where: { type: 'SMS', enabled: true, name: 'NEPAL_SMS' },
      orderBy: [{ updatedAt: 'desc' }],
    });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery-1' },
        data: expect.objectContaining({
          status: NotificationStatus.DELIVERED,
          providerMessageId: 'provider-1',
        }),
      }),
    );
  });

  it('rejects provider callbacks with missing signatures before delivery lookup', async () => {
    const { service, prisma } = createService();

    await expect(
      service.recordProviderDeliveryStatus(
        {
          providerType: 'SMS',
          providerName: 'NEPAL_SMS',
          providerMessageId: 'provider-1',
          status: 'DELIVERED',
        },
        actor,
      ),
    ).rejects.toThrow('signature is required');

    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('rejects invalid provider callback signatures and audits without raw secrets', async () => {
    const { service, prisma, auditService } = createService();
    prisma.providerConfig.findFirst.mockResolvedValue({
      id: 'provider-1',
      type: 'SMS',
      name: 'NEPAL_SMS',
      enabled: true,
      configEncrypted: { callbackSecret: 'callback-secret' },
      secretKeys: ['callbackSecret'],
    });

    await expect(
      service.recordProviderDeliveryStatus(
        {
          providerType: 'SMS',
          providerName: 'NEPAL_SMS',
          providerMessageId: 'provider-1',
          status: 'DELIVERED',
          signature: 'sha256=deadbeef',
        },
        actor,
      ),
    ).rejects.toThrow('Invalid provider callback signature');

    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain(
      'callback-secret',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider_status_rejected',
        after: expect.objectContaining({
          reason: 'invalid_signature',
          providerType: 'SMS',
          providerName: 'NEPAL_SMS',
        }),
      }),
    );
  });

  it('fails closed when a provider callback targets a disabled provider', async () => {
    const { service, prisma } = createService();
    prisma.providerConfig.findFirst.mockResolvedValue(null);

    await expect(
      service.recordProviderDeliveryStatus(
        {
          providerType: 'SMS',
          providerName: 'NEPAL_SMS',
          providerMessageId: 'provider-1',
          status: 'DELIVERED',
          signature: 'sha256=deadbeef',
        },
        actor,
      ),
    ).rejects.toThrow('Provider SMS is disabled or not configured');

    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('ignores delayed out-of-order provider callbacks after delivery is terminal', async () => {
    const { service, prisma, auditService } = createService();
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.DELIVERED,
      providerMessageId: 'provider-1',
    });

    const result = await service.recordProviderDeliveryStatus(
      {
        providerMessageId: 'provider-1',
        status: 'SENT',
      },
      actor,
    );

    expect(result).toEqual({
      deliveryId: 'delivery-1',
      status: NotificationStatus.DELIVERED,
      ignored: true,
      reason: 'delivered_is_terminal',
    });
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider_status_ignored',
        after: expect.objectContaining({
          reason: 'delivered_is_terminal',
        }),
      }),
    );
  });

  it('sanitizes failed provider callback reasons before persisting or auditing', async () => {
    const { service, prisma } = createService();
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.SENT,
      providerMessageId: 'provider-1',
      sentAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    prisma.notificationDelivery.update.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationStatus.FAILED,
      providerMessageId: 'provider-1',
      failureCode: 'PROVIDER_FAILED',
      failureReason: 'gateway failed token=***',
    });

    await service.recordProviderDeliveryStatus(
      {
        providerMessageId: 'provider-1',
        status: 'FAILED',
        failureCode: 'PROVIDER_FAILED',
        failureReason: 'gateway failed token=super-secret',
      },
      actor,
    );

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        failureReason: 'gateway failed token=***',
        errorMessage: 'gateway failed token=***',
      }),
    });
  });
});

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
