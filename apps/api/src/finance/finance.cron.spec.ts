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
});
