import { FiscalYearStatus, JournalEntryStatus } from '@prisma/client';
import { AccountingM9Service } from './accounting-m9.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
} as any;

function buildService() {
  const prisma = {
    fiscalYear: { findFirst: jest.fn() },
    journalEntry: { groupBy: jest.fn() },
    journalLine: { groupBy: jest.fn() },
    chartAccount: { findMany: jest.fn() },
  };
  const sourceMappings = {
    getSourceMappingHealth: jest.fn(),
  };
  const service = new AccountingM9Service(prisma as any, sourceMappings as any);
  return { service, prisma, sourceMappings };
}

describe('AccountingM9Service.principalSnapshot', () => {
  it('reports read-only fiscal, posting-queue, net-position, and reconciliation state', async () => {
    const { service, prisma, sourceMappings } = buildService();

    prisma.fiscalYear.findFirst.mockResolvedValue({
      id: 'fy-1',
      name: 'FY 2082-83',
      status: FiscalYearStatus.OPEN,
      periods: [
        {
          id: 'period-1',
          label: 'Shrawan',
          status: 'OPEN',
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-07-31'),
        },
      ],
    });
    prisma.journalEntry.groupBy.mockResolvedValue([
      { status: JournalEntryStatus.SUBMITTED, _count: { _all: 3 } },
      { status: JournalEntryStatus.APPROVED, _count: { _all: 2 } },
    ]);
    prisma.journalLine.groupBy.mockResolvedValue([
      { chartAccountId: 'acc-revenue', _sum: { debit: 0, credit: 500 } },
      { chartAccountId: 'acc-expense', _sum: { debit: 200, credit: 0 } },
    ]);
    prisma.chartAccount.findMany.mockResolvedValue([
      { id: 'acc-revenue', type: 'REVENUE' },
      { id: 'acc-expense', type: 'EXPENSE' },
    ]);
    sourceMappings.getSourceMappingHealth.mockResolvedValue({
      isClean: true,
      missingSourceId: { count: 0 },
      checkedAt: '2026-07-24T00:00:00.000Z',
    });

    const snapshot = await service.principalSnapshot(actor);

    expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, status: FiscalYearStatus.OPEN },
      }),
    );
    expect(snapshot).toEqual(
      expect.objectContaining({
        readOnly: true,
        fiscalYear: { id: 'fy-1', name: 'FY 2082-83', status: 'OPEN' },
        currentPeriod: expect.objectContaining({ id: 'period-1' }),
        postingQueue: { awaitingReview: 3, awaitingPosting: 2 },
        netPosition: expect.objectContaining({
          totalIncome: '500.00',
          totalExpense: '200.00',
          netSurplusOrDeficit: '300.00',
          resultType: 'SURPLUS',
        }),
        reconciliation: {
          isClean: true,
          missingSourceIdCount: 0,
          checkedAt: '2026-07-24T00:00:00.000Z',
        },
      }),
    );
  });

  it('returns null fiscal year and net position when no fiscal year is open', async () => {
    const { service, prisma, sourceMappings } = buildService();

    prisma.fiscalYear.findFirst.mockResolvedValue(null);
    prisma.journalEntry.groupBy.mockResolvedValue([]);
    sourceMappings.getSourceMappingHealth.mockResolvedValue({
      isClean: true,
      missingSourceId: { count: 0 },
      checkedAt: '2026-07-24T00:00:00.000Z',
    });

    const snapshot = await service.principalSnapshot(actor);

    expect(snapshot.fiscalYear).toBeNull();
    expect(snapshot.currentPeriod).toBeNull();
    expect(snapshot.netPosition).toBeNull();
    expect(snapshot.postingQueue).toEqual({
      awaitingReview: 0,
      awaitingPosting: 0,
    });
    expect(prisma.journalLine.groupBy).not.toHaveBeenCalled();
  });
});
