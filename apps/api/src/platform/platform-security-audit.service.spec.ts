import { BadRequestException } from '@nestjs/common';
import { PlatformService } from './platform.service';

type PlatformServiceArgs = ConstructorParameters<typeof PlatformService>;
interface AuditLogFindManyArgs {
  where?: {
    tenantId?: string;
    action?: { in: string[] };
    resource?: { in: string[] };
  };
  take?: number;
}

describe('PlatformService security audit log hardening', () => {
  const makeQueue = () => ({
    getJobCounts: jest.fn(),
    isPaused: jest.fn(),
    getWorkers: jest.fn(),
    getFailed: jest.fn(),
    getJob: jest.fn(),
  });

  function buildService() {
    const prisma = {
      auditLog: {
        findMany: jest
          .fn<Promise<unknown[]>, [AuditLogFindManyArgs]>()
          .mockResolvedValue([]),
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      },
    };

    const service = new PlatformService(
      prisma as unknown as PlatformServiceArgs[0],
      { record: jest.fn() } as unknown as PlatformServiceArgs[1],
      {} as PlatformServiceArgs[2],
      {} as PlatformServiceArgs[3],
      {} as PlatformServiceArgs[4],
      {} as PlatformServiceArgs[5],
      {} as PlatformServiceArgs[6],
      makeQueue() as unknown as PlatformServiceArgs[7],
      makeQueue() as unknown as PlatformServiceArgs[8],
      makeQueue() as unknown as PlatformServiceArgs[9],
      makeQueue() as unknown as PlatformServiceArgs[10],
      makeQueue() as unknown as PlatformServiceArgs[11],
      makeQueue() as unknown as PlatformServiceArgs[12],
      makeQueue() as unknown as PlatformServiceArgs[13],
    );

    return { service, prisma };
  }

  it('lists only high-risk authentication audit events with tenant filters', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'login_failed',
        resource: 'auth',
        resourceId: 'user-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        before: null,
        after: { failedLoginCount: 2 },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        requestId: 'req-1',
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
        user: { id: 'user-1', email: 'admin@school.test', phone: null },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listSecurityAuditLogs({
      tenantId: 'tenant-1',
      category: 'authentication',
      page: 1,
      limit: 10,
    });

    const findManyArg = prisma.auditLog.findMany.mock.calls[0]?.[0];
    expect(findManyArg?.where?.tenantId).toBe('tenant-1');
    expect(findManyArg?.where?.action).toEqual({
      in: ['login_failed', 'login_locked', 'api_key_validation_failed'],
    });
    expect(findManyArg?.where?.resource).toEqual({
      in: ['auth', 'platform_api_key'],
    });
    expect(findManyArg?.take).toBe(10);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'audit-1',
        action: 'login_failed',
        requestId: 'req-1',
      }),
    );
  });

  it('rejects unsupported security audit categories', async () => {
    const { service } = buildService();

    await expect(
      service.listSecurityAuditLogs({ category: 'general' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
