import { FinanceCron } from './finance.cron';

function buildCron() {
  const prisma = {
    feeDueSchedule: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    runWithoutTenantScope: jest.fn(
      async (_reason: string, fn: () => Promise<unknown>) => fn(),
    ),
    runWithTenantScope: jest.fn(
      async (_tenantId: string, fn: () => Promise<unknown>) => fn(),
    ),
  };
  const financeService = {
    processDueSchedule: jest
      .fn()
      .mockResolvedValue({ reminderResult: { reminded: 0 } }),
  };
  const cron = new FinanceCron(prisma as never, financeService as never);
  return { cron, prisma, financeService };
}

describe('FinanceCron', () => {
  it('processes due schedules only for active tenants', async () => {
    const { cron, prisma } = buildCron();
    prisma.feeDueSchedule.findMany.mockResolvedValue([]);

    await cron.processDueSchedules();

    expect(prisma.feeDueSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant: { isActive: true },
        }),
      }),
    );
  });

  it('looks up the tenant actor inside runWithTenantScope', async () => {
    const { cron, prisma, financeService } = buildCron();
    prisma.feeDueSchedule.findMany.mockResolvedValue([
      { id: 'schedule-1', name: 'April fees', tenantId: 'tenant-1' },
    ]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'admin@school.test',
      authMethod: 'PASSWORD',
    });

    await cron.processDueSchedules();

    expect(prisma.runWithTenantScope).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(financeService.processDueSchedule).toHaveBeenCalledWith(
      'schedule-1',
      expect.any(Object),
      expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1' }),
    );
  });
});
