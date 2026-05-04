import { ConflictException } from '@nestjs/common';
import {
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AccountingPostingService } from './accounting-posting.service';

function createPostingClient(overrides?: {
  existingJournal?: { entryNumber: string } | null;
  closedPeriod?: { name: string } | null;
}) {
  const upsertedAccounts = new Map([
    ['5010', { id: 'salary-expense', type: ChartAccountType.EXPENSE }],
    ['2200', { id: 'salary-payable', type: ChartAccountType.LIABILITY }],
    ['2300', { id: 'statutory-payable', type: ChartAccountType.LIABILITY }],
  ]);

  return {
    accountingPeriod: {
      findFirst: jest.fn().mockResolvedValue(overrides?.closedPeriod ?? null),
    },
    journalEntry: {
      count: jest.fn().mockResolvedValue(4),
      findFirst: jest.fn().mockResolvedValue(overrides?.existingJournal ?? null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'journal-1',
          entryNumber: data.entryNumber,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          lines: data.lines.create,
        }),
      ),
    },
    chartAccount: {
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        const account = upsertedAccounts.get(where.tenantId_code.code);
        return Promise.resolve({
          id: account?.id ?? create.code,
          code: create.code,
          type: account?.type ?? create.type,
        });
      }),
    },
  };
}

describe('AccountingPostingService payroll posting', () => {
  it('creates a balanced immutable payroll accrual journal', async () => {
    const client = createPostingClient();
    const service = new AccountingPostingService(client as never);

    const entry = await service.postPayrollAccrual(
      {
        tenantId: 'tenant-1',
        payrollRunId: 'run-1',
        periodMonth: 5,
        periodYear: 2026,
        grossAmount: new Prisma.Decimal(75000),
        deductionAmount: new Prisma.Decimal(1750),
        netAmount: new Prisma.Decimal(73250),
      },
      { tenantId: 'tenant-1', userId: 'user-1' } as never,
      client as never,
    );

    expect(entry.entryNumber).toBe('JE-2026-00005');
    expect(entry.sourceType).toBe(JournalSourceType.PAYROLL);
    expect(entry.sourceId).toBe('run-1');
    expect(entry.lines).toHaveLength(3);

    const debit = entry.lines
      .filter((line: { side: JournalLineSide }) => line.side === JournalLineSide.DEBIT)
      .reduce(
        (sum: Prisma.Decimal, line: { amount: Prisma.Decimal }) => sum.plus(line.amount),
        new Prisma.Decimal(0),
      );
    const credit = entry.lines
      .filter((line: { side: JournalLineSide }) => line.side === JournalLineSide.CREDIT)
      .reduce(
        (sum: Prisma.Decimal, line: { amount: Prisma.Decimal }) => sum.plus(line.amount),
        new Prisma.Decimal(0),
      );

    expect(debit.equals(credit)).toBe(true);
    expect(client.chartAccount.upsert).toHaveBeenCalledTimes(3);
  });

  it('blocks duplicate payroll journal posting for the same source document', async () => {
    const client = createPostingClient({
      existingJournal: { entryNumber: 'JE-2026-00005' },
    });
    const service = new AccountingPostingService(client as never);

    await expect(
      service.postPayrollAccrual(
        {
          tenantId: 'tenant-1',
          payrollRunId: 'run-1',
          periodMonth: 5,
          periodYear: 2026,
          grossAmount: new Prisma.Decimal(75000),
          deductionAmount: new Prisma.Decimal(1750),
          netAmount: new Prisma.Decimal(73250),
        },
        { tenantId: 'tenant-1', userId: 'user-1' } as never,
        client as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks payroll posting into a closed accounting period', async () => {
    const client = createPostingClient({
      closedPeriod: { name: 'FY 2026 Closed' },
    });
    const service = new AccountingPostingService(client as never);

    await expect(
      service.postPayrollAccrual(
        {
          tenantId: 'tenant-1',
          payrollRunId: 'run-1',
          periodMonth: 5,
          periodYear: 2026,
          grossAmount: new Prisma.Decimal(75000),
          deductionAmount: new Prisma.Decimal(1750),
          netAmount: new Prisma.Decimal(73250),
          entryDate: new Date(Date.UTC(2026, 4, 31)),
        },
        { tenantId: 'tenant-1', userId: 'user-1' } as never,
        client as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
