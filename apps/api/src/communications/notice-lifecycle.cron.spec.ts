import { NoticeLifecycleStatus, UserStatus } from '@prisma/client';
import { NoticeLifecycleCron } from './notice-lifecycle.cron';

function buildCron() {
  const prisma = {
    notice: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const communicationsService = {
    processScheduledNotices: jest.fn().mockResolvedValue(undefined),
    processExpiredNotices: jest.fn().mockResolvedValue(undefined),
  };
  const cron = new NoticeLifecycleCron(
    prisma as never,
    communicationsService as never,
  );
  return { cron, prisma, communicationsService };
}

describe('NoticeLifecycleCron', () => {
  it('finds distinct tenants with due scheduled or expired notices', async () => {
    const { cron, prisma } = buildCron();
    prisma.notice.findMany.mockResolvedValue([]);

    await cron.processDueNoticeLifecycle();

    expect(prisma.notice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant: { isActive: true },
          OR: [
            expect.objectContaining({
              lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
              publishedAt: null,
            }),
            expect.objectContaining({
              lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
            }),
          ],
        }),
        distinct: ['tenantId'],
      }),
    );
  });

  it('resolves the oldest active user as the system actor and processes both lifecycles', async () => {
    const { cron, prisma, communicationsService } = buildCron();
    prisma.notice.findMany.mockResolvedValue([{ tenantId: 'tenant-1' }]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'admin@school.test',
      authMethod: 'PASSWORD',
      tenant: { slug: 'school-a' },
    });

    await cron.processDueNoticeLifecycle();

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: UserStatus.ACTIVE,
        }),
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(communicationsService.processScheduledNotices).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'school-a',
        roles: ['system'],
        permissions: [],
      }),
    );
    expect(communicationsService.processExpiredNotices).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1' }),
    );
  });

  it('skips a tenant with no active user without throwing', async () => {
    const { cron, prisma, communicationsService } = buildCron();
    prisma.notice.findMany.mockResolvedValue([{ tenantId: 'tenant-1' }]);
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(cron.processDueNoticeLifecycle()).resolves.toBeUndefined();

    expect(
      communicationsService.processScheduledNotices,
    ).not.toHaveBeenCalled();
    expect(communicationsService.processExpiredNotices).not.toHaveBeenCalled();
  });

  it('isolates a failure in one tenant and still processes the next tenant', async () => {
    const { cron, prisma, communicationsService } = buildCron();
    prisma.notice.findMany.mockResolvedValue([
      { tenantId: 'tenant-1' },
      { tenantId: 'tenant-2' },
    ]);
    prisma.user.findFirst
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@a.test',
        authMethod: 'PASSWORD',
        tenant: { slug: 'school-a' },
      })
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'admin@b.test',
        authMethod: 'PASSWORD',
        tenant: { slug: 'school-b' },
      });
    communicationsService.processScheduledNotices
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await expect(cron.processDueNoticeLifecycle()).resolves.toBeUndefined();

    expect(communicationsService.processScheduledNotices).toHaveBeenCalledTimes(
      2,
    );
  });
});
