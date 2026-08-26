import { AttendanceCron } from './attendance.cron';

function buildCron() {
  const prisma = {
    tenant: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    runWithTenantScope: jest.fn(
      async (_tenantId: string, fn: () => Promise<unknown>) => fn(),
    ),
  };
  const attendanceService = {
    processDailyEscalationWarnings: jest
      .fn()
      .mockResolvedValue({ warningCount: 1 }),
  };
  const cron = new AttendanceCron(prisma as never, attendanceService as never);
  return { cron, prisma, attendanceService };
}

describe('AttendanceCron', () => {
  it('looks up the tenant actor inside runWithTenantScope', async () => {
    const { cron, prisma, attendanceService } = buildCron();
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', slug: 'school-a', isActive: true },
    ]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'admin@school.test',
      authMethod: 'PASSWORD',
    });

    await cron.processDailyEscalations();

    expect(prisma.runWithTenantScope).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(
      attendanceService.processDailyEscalationWarnings,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1' }),
    );
  });
});
