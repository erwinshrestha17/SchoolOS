import { ConflictException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  PayrollLineStatus,
  PayrollPaymentStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { PayrollService } from '../src/payroll/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface JournalCreateInput {
  data: {
    tenantId: string;
    sourceModule?: string | null;
    sourceType?: JournalSourceType | null;
    sourceId?: string | null;
    postingType?: string | null;
    lines: {
      create: {
        side: JournalLineSide;
        amount: Prisma.Decimal | number | string;
      }[];
    };
  };
}

type PayrollRunRecord = ReturnType<typeof buildPayrollRun>;
type PayrollLineRecord = ReturnType<typeof buildPayrollLine>;
interface ChartAccountUpsertInput {
  where?: { tenantId_code?: { code?: string } };
  create?: { code?: string };
  update?: { code?: string };
}
interface TransactionMock {
  $queryRaw: jest.Mock;
  accountingSourceMapping: PayrollM9PrismaMock['accountingSourceMapping'];
  journalEntry: PayrollM9PrismaMock['journalEntry'];
  fiscalPeriod: PayrollM9PrismaMock['fiscalPeriod'];
  fiscalYear: PayrollM9PrismaMock['fiscalYear'];
  accountingPeriod: PayrollM9PrismaMock['accountingPeriod'];
  chartAccount: PayrollM9PrismaMock['chartAccount'];
  payrollLine: {
    updateMany: jest.Mock;
  };
  payslip: {
    updateMany: jest.Mock;
  };
  payrollRun: {
    update: jest.Mock;
  };
}

interface PayrollM9PrismaMock {
  __periodStatus: AccountingPeriodStatus;
  __currentRun: PayrollRunRecord;
  __journalSequence: number;
  __tx?: TransactionMock;
  payrollRun: {
    findFirst: jest.Mock<Promise<PayrollRunRecord>, []>;
    update: jest.Mock;
  };
  payrollLine: {
    updateMany: jest.Mock;
    findMany: jest.Mock<Promise<PayrollLineRecord[]>, []>;
  };
  payslip: {
    createMany: jest.Mock;
  };
  journalEntry: {
    findFirst: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  fiscalPeriod: {
    findFirst: jest.Mock;
  };
  fiscalYear: {
    findFirst: jest.Mock;
  };
  accountingPeriod: {
    findFirst: jest.Mock;
  };
  chartAccount: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    upsert: jest.Mock;
    create: jest.Mock;
  };
  accountingSourceMapping: {
    findFirst: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

describe('Payroll + M9 Accounting Integration (E2E)', () => {
  const tenantId = 'tenant-payroll-integration';
  const actor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-payroll-integration',
    userId: 'payroll-admin',
    email: 'payroll-admin@schoolos.test',
    authMethod: 'PASSWORD' as never,
    roles: ['admin'],
    permissions: ['payroll:run:approve', 'payroll:run:post'],
  };

  let prisma: PayrollM9PrismaMock;
  let auditService: { record: jest.Mock };
  let accountingPostingService: AccountingPostingService;
  let payrollService: PayrollService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    accountingPostingService = new AccountingPostingService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
    payrollService = new PayrollService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      accountingPostingService,
    );
  });

  it('approves a payroll run without creating accounting journals', async () => {
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.REVIEWED,
    });

    const approved = await payrollService.approvePayrollRun('run-1', actor);

    expect(approved.status).toBe(PayrollRunStatus.APPROVED);
    expect(prisma.payrollLine.updateMany).toHaveBeenCalledWith({
      where: { tenantId, payrollRunId: 'run-1' },
      data: { status: PayrollLineStatus.APPROVED },
    });
    expect(prisma.payslip.createMany).toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'approve',
        resource: 'payroll_run',
        tenantId,
        resourceId: 'run-1',
      }),
    );
  });

  it('posts approved payroll through AccountingPostingService as a balanced accrual journal', async () => {
    const postingSpy = jest.spyOn(
      accountingPostingService,
      'postPayrollAccrual',
    );
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.APPROVED,
    });

    const posted = await payrollService.postPayrollRun('run-1', actor);

    expect(postingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        payrollRunId: 'run-1',
        periodMonth: 5,
        periodYear: 2026,
        grossAmount: new Prisma.Decimal(50000),
        deductionAmount: new Prisma.Decimal(1000),
        netAmount: new Prisma.Decimal(49000),
      }),
      actor,
      expect.any(Object),
    );

    const journal = latestJournalCreateInput(prisma);
    expect(journal.data).toEqual(
      expect.objectContaining({
        tenantId,
        sourceModule: 'PAYROLL',
        sourceType: JournalSourceType.PAYROLL_RUN,
        sourceId: 'run-1',
        postingType: 'APPROVAL',
      }),
    );
    expect(summarizeJournalLines(journal.data.lines.create)).toEqual({
      totalDebit: new Prisma.Decimal(50000),
      totalCredit: new Prisma.Decimal(50000),
    });
    expect(prisma.__tx?.payrollLine.updateMany).toHaveBeenCalledWith({
      where: { tenantId, payrollRunId: 'run-1' },
      data: { status: PayrollLineStatus.POSTED },
    });
    expect(posted).toEqual(
      expect.objectContaining({
        status: PayrollRunStatus.POSTED,
        journalEntryId: expect.any(String),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'post',
        resource: 'journal_entry',
        tenantId,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'post',
        resource: 'payroll_run',
        tenantId,
        resourceId: 'run-1',
      }),
    );
  });

  it('does not create duplicate accrual journals when payroll is already posted', async () => {
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-existing',
    });

    await expect(payrollService.postPayrollRun('run-1', actor)).rejects.toThrow(
      ConflictException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it.each([AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED])(
    'rejects payroll posting into %s fiscal period',
    async (status) => {
      prisma.__currentRun = buildPayrollRun({
        status: PayrollRunStatus.APPROVED,
      });
      prisma.__periodStatus = status;

      await expect(
        payrollService.postPayrollRun('run-1', actor),
      ).rejects.toThrow(ConflictException);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      expect(prisma.__tx?.payrollRun.update).not.toHaveBeenCalled();
    },
  );

  it('marks posted payroll as paid through a balanced disbursement journal', async () => {
    const disbursementSpy = jest.spyOn(
      accountingPostingService,
      'postPayrollDisbursement',
    );
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-accrual',
    });

    const paid = await payrollService.markPayrollRunPaid(
      'run-1',
      { reason: 'Bank disbursement', paymentAccountCode: '1010' },
      actor,
    );

    expect(disbursementSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        payrollRunId: 'run-1',
        netAmount: new Prisma.Decimal(49000),
        paymentAccountCode: '1010',
      }),
      actor,
      expect.any(Object),
    );

    const journal = latestJournalCreateInput(prisma);
    expect(journal.data).toEqual(
      expect.objectContaining({
        tenantId,
        sourceModule: 'PAYROLL',
        sourceType: JournalSourceType.PAYROLL_DISBURSEMENT,
        sourceId: 'run-1',
        postingType: 'DISBURSEMENT',
      }),
    );
    expect(summarizeJournalLines(journal.data.lines.create)).toEqual({
      totalDebit: new Prisma.Decimal(49000),
      totalCredit: new Prisma.Decimal(49000),
    });
    expect(prisma.__tx?.payrollLine.updateMany).toHaveBeenCalledWith({
      where: { tenantId, payrollRunId: 'run-1' },
      data: { paymentStatus: PayrollPaymentStatus.PAID },
    });
    expect(prisma.__tx?.payslip.updateMany).toHaveBeenCalledWith({
      where: { tenantId, payrollRunId: 'run-1' },
      data: { paymentStatus: PayrollPaymentStatus.PAID },
    });
    expect(paid).toEqual(
      expect.objectContaining({
        status: PayrollRunStatus.PAID,
        disbursementJournalEntryId: expect.any(String),
      }),
    );
  });

  it('does not create duplicate disbursement journals when payroll is already paid', async () => {
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-accrual',
      disbursementJournalEntryId: 'journal-disbursement-existing',
    });

    await expect(
      payrollService.markPayrollRunPaid(
        'run-1',
        { reason: 'Already paid' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects payroll disbursement into a closed fiscal period', async () => {
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-accrual',
    });
    prisma.__periodStatus = AccountingPeriodStatus.CLOSED;

    await expect(
      payrollService.markPayrollRunPaid('run-1', { reason: 'Pay now' }, actor),
    ).rejects.toThrow(ConflictException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.__tx?.payrollRun.update).not.toHaveBeenCalled();
  });

  it('blocks direct rejection/void-style mutation after payroll is paid', async () => {
    prisma.__currentRun = buildPayrollRun({
      status: PayrollRunStatus.PAID,
      journalEntryId: 'journal-accrual',
      disbursementJournalEntryId: 'journal-disbursement',
    });

    await expect(
      payrollService.rejectPayrollRun(
        'run-1',
        { reason: 'Void paid payroll directly' },
        actor,
      ),
    ).rejects.toThrow(
      'Payroll run in PAID status cannot be returned for correction',
    );
    expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });
});

function buildPrismaMock(): PayrollM9PrismaMock {
  const mock = {
    __periodStatus: AccountingPeriodStatus.OPEN,
    __currentRun: buildPayrollRun(),
    __journalSequence: 0,
    __tx: undefined,
    payrollRun: {
      findFirst: jest.fn(() => Promise.resolve(mock.__currentRun)),
      update: jest.fn((q: { data?: Record<string, unknown> }) => {
        mock.__currentRun = {
          ...mock.__currentRun,
          ...q.data,
          lines: [buildPayrollLine()],
          payslips: [],
        };
        return Promise.resolve(mock.__currentRun);
      }),
    },
    payrollLine: {
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      findMany: jest.fn(() =>
        Promise.resolve([
          buildPayrollLine({ id: 'line-1', staffId: 'staff-1' }),
        ]),
      ),
    },
    payslip: {
      createMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    journalEntry: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      count: jest.fn(() => Promise.resolve(mock.__journalSequence)),
      create: jest.fn((q: JournalCreateInput) => {
        mock.__journalSequence += 1;
        const entry = {
          id: `journal-${String(mock.__journalSequence)}`,
          entryNumber: `JE-2026-${String(mock.__journalSequence).padStart(4, '0')}`,
          ...q.data,
          lines: q.data.lines.create,
        };
        return Promise.resolve(entry);
      }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'period-2026-05',
          tenantId: 'tenant-payroll-integration',
          fiscalYearId: 'fy-2026',
          status: mock.__periodStatus,
          fiscalYear: { id: 'fy-2026', status: 'OPEN' },
        }),
      ),
    },
    fiscalYear: {
      findFirst: jest.fn(() =>
        Promise.resolve({ id: 'fy-2026', status: 'OPEN' }),
      ),
    },
    accountingPeriod: {
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    chartAccount: {
      findUnique: jest.fn(
        (q: { where?: { tenantId_code?: { code?: string } } }) =>
          Promise.resolve(chartAccountForCode(q.where?.tenantId_code?.code)),
      ),
      findUniqueOrThrow: jest.fn(
        (q: { where?: { tenantId_code?: { code?: string } } }) =>
          Promise.resolve(chartAccountForCode(q.where?.tenantId_code?.code)),
      ),
      upsert: jest.fn((q: ChartAccountUpsertInput) =>
        Promise.resolve(
          chartAccountForCode(q.where?.tenantId_code?.code ?? q.create?.code),
        ),
      ),
      create: jest.fn((q: { data?: { code?: string } }) =>
        Promise.resolve(chartAccountForCode(q.data?.code)),
      ),
    },
    accountingSourceMapping: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'mapping-payroll-approval',
          debitAccount: chartAccountForCode('5010'),
          creditAccount: chartAccountForCode('2200'),
        }),
      ),
    },
    $queryRaw: jest.fn(() =>
      Promise.resolve([{ lastValue: mock.__journalSequence + 1 }]),
    ),
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input !== 'function') {
        return Promise.all(input as Promise<unknown>[]);
      }

      mock.__tx = buildTransactionMock(mock as PayrollM9PrismaMock);
      return (input as (tx: TransactionMock) => Promise<unknown>)(mock.__tx);
    }),
  } as PayrollM9PrismaMock;

  return mock;
}

function buildTransactionMock(root: PayrollM9PrismaMock): TransactionMock {
  return {
    $queryRaw: root.$queryRaw,
    accountingSourceMapping: root.accountingSourceMapping,
    journalEntry: root.journalEntry,
    fiscalPeriod: root.fiscalPeriod,
    fiscalYear: root.fiscalYear,
    accountingPeriod: root.accountingPeriod,
    chartAccount: root.chartAccount,
    payrollLine: {
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    payslip: {
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    payrollRun: {
      update: jest.fn((q: { data?: Record<string, unknown> }) => {
        root.__currentRun = {
          ...root.__currentRun,
          ...q.data,
          lines: [buildPayrollLine()],
          payslips: [],
        };
        return Promise.resolve(root.__currentRun);
      }),
    },
  };
}

function buildPayrollRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    tenantId: 'tenant-payroll-integration',
    periodMonth: 5,
    periodYear: 2026,
    periodStart: new Date('2026-05-01T00:00:00.000Z'),
    periodEnd: new Date('2026-05-31T23:59:59.999Z'),
    status: PayrollRunStatus.GENERATED,
    grossAmount: new Prisma.Decimal(50000),
    deductionAmount: new Prisma.Decimal(1000),
    netAmount: new Prisma.Decimal(49000),
    pfEmployeeAmount: new Prisma.Decimal(0),
    pfEmployerAmount: new Prisma.Decimal(0),
    tdsAmount: new Prisma.Decimal(0),
    journalEntryId: null,
    disbursementJournalEntryId: null,
    notes: null,
    lines: [buildPayrollLine()],
    payslips: [],
    ...overrides,
  };
}

function buildPayrollLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    tenantId: 'tenant-payroll-integration',
    payrollRunId: 'run-1',
    staffId: 'staff-1',
    grossSalary: new Prisma.Decimal(50000),
    deductions: new Prisma.Decimal(1000),
    pfEmployee: new Prisma.Decimal(0),
    pfEmployer: new Prisma.Decimal(0),
    tds: new Prisma.Decimal(0),
    netSalary: new Prisma.Decimal(49000),
    ...overrides,
  };
}

function chartAccountForCode(code = '1010') {
  const accountType = code.startsWith('5')
    ? ChartAccountType.EXPENSE
    : code.startsWith('2')
      ? ChartAccountType.LIABILITY
      : ChartAccountType.ASSET;

  return {
    id: `acc-${code}`,
    tenantId: 'tenant-payroll-integration',
    code,
    name: `Account ${code}`,
    type: accountType,
  };
}

function latestJournalCreateInput(prisma: PayrollM9PrismaMock) {
  const calls = (prisma.journalEntry.create as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as JournalCreateInput;
}

function summarizeJournalLines(
  lines: {
    side: JournalLineSide;
    amount: Prisma.Decimal | number | string;
  }[],
) {
  return lines.reduce(
    (summary, line) => {
      const amount = new Prisma.Decimal(line.amount);
      if (line.side === JournalLineSide.DEBIT) {
        return { ...summary, totalDebit: summary.totalDebit.add(amount) };
      }

      return { ...summary, totalCredit: summary.totalCredit.add(amount) };
    },
    {
      totalDebit: new Prisma.Decimal(0),
      totalCredit: new Prisma.Decimal(0),
    },
  );
}
