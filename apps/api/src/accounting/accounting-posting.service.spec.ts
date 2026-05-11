import { ConflictException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AccountingPostingService } from './accounting-posting.service';

function createPostingClient(overrides?: {
  existingJournal?: { entryNumber: string } | null;
  closedPeriod?: { name: string; status?: AccountingPeriodStatus } | null;
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
    fiscalPeriod: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'fp-1',
        status: AccountingPeriodStatus.OPEN,
        label: 'OPEN Period',
        fiscalYear: { status: AccountingPeriodStatus.OPEN, name: 'FY 2026' },
      }),
    },
    journalEntry: {
      count: jest.fn().mockResolvedValue(4),
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides?.existingJournal ?? null),
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

function sumLines(
  lines: { side: JournalLineSide; amount: Prisma.Decimal }[],
  side: JournalLineSide,
) {
  return lines
    .filter((line) => line.side === side)
    .reduce(
      (sum, line) =>
        new Prisma.Decimal(sum).add(new Prisma.Decimal(line.amount)),
      new Prisma.Decimal(0),
    );
}

describe('AccountingPostingService payroll posting', () => {
  it('creates a balanced immutable payroll accrual journal', async () => {
    const client = createPostingClient();
    const auditService = { record: jest.fn() };
    const service = new AccountingPostingService(
      client as never,
      auditService as never,
    );

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

    expect(entry.entryNumber).toBe('JE-2026-000005');
    expect(entry.sourceType).toBe(JournalSourceType.PAYROLL_RUN);
    expect(entry.sourceId).toBe('run-1');
    expect(entry.lines).toHaveLength(3);

    const debit = sumLines(entry.lines, JournalLineSide.DEBIT);
    const credit = sumLines(entry.lines, JournalLineSide.CREDIT);

    expect(debit.toString()).toBe(credit.toString());
    expect(client.chartAccount.upsert).toHaveBeenCalledTimes(6);
  });

  it('returns existing payroll journal for duplicate source document posting', async () => {
    const client = createPostingClient({
      existingJournal: { entryNumber: 'JE-2026-00005' },
    });
    const auditService = { record: jest.fn() };
    const service = new AccountingPostingService(
      client as never,
      auditService as never,
    );

    const result = await service.postPayrollAccrual(
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

    expect(result.entryNumber).toBe('JE-2026-00005');
  });

  it('blocks payroll posting into a closed accounting period', async () => {
    const client = createPostingClient({
      closedPeriod: {
        name: 'FY 2026 Closed',
        status: AccountingPeriodStatus.CLOSED,
      },
    });
    const auditService = { record: jest.fn() };
    const service = new AccountingPostingService(
      client as never,
      auditService as never,
    );

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
