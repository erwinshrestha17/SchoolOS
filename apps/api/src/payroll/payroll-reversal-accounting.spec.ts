import { ConflictException } from '@nestjs/common';
import { JournalLineSide, PayrollRunStatus, Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  roles: ['admin'],
  permissions: ['payroll:run:reverse', 'payroll:run:post'],
};

describe('PayrollService reversal accounting reconciliation', () => {
  it('reverses paid payroll by reversing disbursement and accrual journals before cancelling the run', async () => {
    const paidRun = buildPayrollRun({
      status: PayrollRunStatus.PAID,
      journalEntryId: 'journal-accrual-1',
      disbursementJournalEntryId: 'journal-disbursement-1',
    });
    const accrualEntry = buildJournalEntry('journal-accrual-1');
    const disbursementEntry = buildJournalEntry('journal-disbursement-1');
    const { service, tx, accountingPostingService } = buildService({
      payrollRun: paidRun,
      journalEntries: {
        'journal-accrual-1': accrualEntry,
        'journal-disbursement-1': disbursementEntry,
      },
    });

    const result = await service.reversePayrollRun(
      paidRun.id,
      { reason: 'Bank rejection correction' },
      actor as never,
    );

    expect(tx.journalEntry.findUnique).toHaveBeenCalledWith({
      where: { id: 'journal-disbursement-1' },
      include: { lines: true },
    });
    expect(tx.journalEntry.findUnique).toHaveBeenCalledWith({
      where: { id: 'journal-accrual-1' },
      include: { lines: true },
    });
    expect(accountingPostingService.postReversal).toHaveBeenCalledTimes(2);
    expect(accountingPostingService.postReversal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: actor.tenantId,
        originalEntryId: 'journal-disbursement-1',
        reason: 'Bank rejection correction',
        lines: [
          expect.objectContaining({ side: JournalLineSide.CREDIT }),
          expect.objectContaining({ side: JournalLineSide.DEBIT }),
        ],
      }),
      actor,
      tx,
    );
    expect(accountingPostingService.postReversal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: actor.tenantId,
        originalEntryId: 'journal-accrual-1',
        reason: 'Bank rejection correction',
      }),
      actor,
      tx,
    );
    expect(tx.payrollRun.update).toHaveBeenCalledWith({
      where: { id: paidRun.id },
      data: expect.objectContaining({
        status: PayrollRunStatus.CANCELLED,
        reversalReason: 'Bank rejection correction',
        reversedById: actor.userId,
      }),
    });
    expect(result).toMatchObject({ status: PayrollRunStatus.CANCELLED });
  });

  it('requires a reversal reason before touching accounting entries', async () => {
    const postedRun = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-accrual-1',
    });
    const { service, tx, accountingPostingService } = buildService({
      payrollRun: postedRun,
    });

    await expect(
      service.reversePayrollRun(postedRun.id, {}, actor as never),
    ).rejects.toThrow('Reversal reason is required');

    expect(tx.journalEntry.findUnique).not.toHaveBeenCalled();
    expect(accountingPostingService.postReversal).not.toHaveBeenCalled();
  });

  it('prevents posted payroll from being rejected instead of reversed/corrected', async () => {
    const postedRun = buildPayrollRun({ status: PayrollRunStatus.POSTED });
    const { service, prisma } = buildService({ payrollRun: postedRun });

    await expect(
      service.rejectPayrollRun(
        postedRun.id,
        { reason: 'Unsafe mutation attempt' },
        actor as never,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.payrollRun.update).not.toHaveBeenCalled();
  });

  it('prevents regenerating locked posted payroll lines', async () => {
    const postedRun = buildPayrollRun({ status: PayrollRunStatus.POSTED });
    const { service, tx } = buildService({ payrollRun: postedRun });

    await expect(
      service.regeneratePayrollLines(postedRun.id, actor as never),
    ).rejects.toThrow('Payroll run in POSTED status cannot be edited');

    expect(tx.payrollLine.deleteMany).not.toHaveBeenCalled();
  });
});

function buildService(options: {
  payrollRun?: unknown;
  journalEntries?: Record<string, unknown>;
}) {
  const tx = {
    journalEntry: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        options.journalEntries?.[where.id] ?? null,
      ),
    },
    payrollLine: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    payrollRun: {
      update: jest.fn().mockResolvedValue(
        buildPayrollRun({
          ...(options.payrollRun as Record<string, unknown> | undefined),
          status: PayrollRunStatus.CANCELLED,
          reversalReason: 'Bank rejection correction',
        }),
      ),
    },
  };

  const prisma = {
    payrollRun: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.payrollRun ?? buildPayrollRun()),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const accountingPostingService = {
    postPayrollAccrual: jest.fn(),
    postPayrollDisbursement: jest.fn(),
    postReversal: jest.fn().mockResolvedValue({ id: 'journal-reversal-1' }),
  };

  return {
    service: new PayrollService(
      prisma as never,
      auditService as never,
      accountingPostingService as never,
    ),
    prisma,
    tx,
    auditService,
    accountingPostingService,
  };
}

function buildPayrollRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    tenantId: actor.tenantId,
    periodMonth: 5,
    periodYear: 2026,
    periodStart: new Date('2026-05-01T00:00:00.000Z'),
    periodEnd: new Date('2026-05-31T00:00:00.000Z'),
    status: PayrollRunStatus.POSTED,
    grossAmount: new Prisma.Decimal(50000),
    deductionAmount: new Prisma.Decimal(1000),
    netAmount: new Prisma.Decimal(49000),
    pfEmployeeAmount: new Prisma.Decimal(0),
    pfEmployerAmount: new Prisma.Decimal(0),
    tdsAmount: new Prisma.Decimal(0),
    journalEntryId: 'journal-accrual-1',
    disbursementJournalEntryId: null,
    notes: null,
    lines: [],
    payslips: [],
    ...overrides,
  };
}

function buildJournalEntry(id: string) {
  return {
    id,
    lines: [
      {
        chartAccountId: 'account-debit-1',
        side: JournalLineSide.DEBIT,
        amount: new Prisma.Decimal(49000),
        description: 'Payroll debit',
      },
      {
        chartAccountId: 'account-credit-1',
        side: JournalLineSide.CREDIT,
        amount: new Prisma.Decimal(49000),
        description: 'Payroll credit',
      },
    ],
  };
}
