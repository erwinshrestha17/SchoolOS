import { BadRequestException } from '@nestjs/common';
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
      notificationDelivery: { count: jest.fn() },
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
    const service = new M10HardeningService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, prisma };
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
});
