import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountingPeriodStatus,
  InvoiceStatus,
  JournalLineSide,
  JournalSourceType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AuditService } from '../src/audit/audit.service';
import { AppModule } from '../src/app.module';
import { FinanceService } from '../src/finance/finance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  createAuthContextMock,
  createPrismaMock,
  mockBullQueues,
  PrismaMock,
} from './test-helpers';

interface JournalCreateInput {
  data: {
    tenantId: string;
    sourceModule?: string | null;
    sourceType?: JournalSourceType | null;
    sourceId?: string | null;
    postingType?: string | null;
    reversalOfId?: string | null;
    lines: {
      create: {
        side: JournalLineSide;
        amount: Prisma.Decimal | number | string;
      }[];
    };
  };
}

describe('Finance + M9 Accounting Integration (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let financeService: FinanceService;
  let postingService: AccountingPostingService;
  let auditService: AuditService;
  let paymentAllocationSequence = 0;

  const tenantId = 'tenant-finance-integration';
  const actor = createAuthContextMock({
    tenantId,
    permissions: [
      'payments:collect',
      'payments:refund',
      'payments:reverse',
      'payments:close',
      'fees:manage',
      'receipts:manage',
      'receipts:read',
    ],
  });

  beforeEach(async () => {
    prisma = createPrismaMock() as unknown as PrismaMock;
    paymentAllocationSequence = 0;

    // Payment allocations became the authoritative fee-payment linkage. Keep
    // this focused integration mock aligned with the current Prisma contract
    // rather than falling back to the legacy direct invoice/payment shape.
    (prisma as any).paymentAllocation = {
      create: jest.fn(({ data }: any) =>
        Promise.resolve({
          id: `allocation-${++paymentAllocationSequence}`,
          ...data,
          createdAt: new Date(),
        }),
      ),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };

    (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue(
      openFiscalPeriod(),
    );
    (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue({
      id: 'fy-2026',
      status: 'OPEN',
    });

    prisma.__state.tenants.push({
      id: tenantId,
      name: 'Integration Test School',
      panNumber: 'PAN123',
      isActive: true,
    });

    prisma.__state.platformPlans.push({
      id: 'professional-plan',
      key: 'professional',
      name: 'Professional Plan',
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-1',
      tenantId,
      planId: 'professional-plan',
      status: 'ACTIVE',
      startsAt: new Date(),
      createdAt: new Date(),
    });

    prisma.__state.students.push({
      id: 'student-1',
      tenantId,
      studentSystemId: 'ST-1',
      firstNameEn: 'Integration',
      lastNameEn: 'Student',
    });

    (prisma.chartAccount.findUnique as jest.Mock).mockImplementation((q) =>
      Promise.resolve(chartAccountForCode(q.where?.tenantId_code?.code)),
    );
    (prisma.chartAccount.findUniqueOrThrow as jest.Mock).mockImplementation(
      (q) => Promise.resolve(chartAccountForCode(q.where?.tenantId_code?.code)),
    );
    (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: tenantId,
      panNumber: 'PAN123',
    });

    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(),
      });

    moduleRef = await mockBullQueues(moduleBuilder).compile();

    financeService = moduleRef.get(FinanceService);
    postingService = moduleRef.get(AccountingPostingService);
    auditService = moduleRef.get(AuditService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Posting boundaries and correctness', () => {
    it('posts fee payment through AccountingPostingService and creates one finance journal', async () => {
      const postingSpy = jest.spyOn(postingService, 'postFeePayment');
      seedInvoice();
      mockCreatedPayment();

      await collectCashPayment();

      expect(postingSpy).toHaveBeenCalledTimes(1);
      expect(postingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          paymentId: 'pay-1',
          invoiceNumber: 'INV-001',
          paymentAmount: new Prisma.Decimal(1000),
        }),
        actor,
        expect.any(Object),
      );

      const journal = latestJournalCreateInput();
      expect(journal.data).toEqual(
        expect.objectContaining({
          tenantId,
          sourceModule: 'FINANCE',
          sourceType: JournalSourceType.FEE_PAYMENT,
          sourceId: 'pay-1',
          postingType: 'RECEIPT',
        }),
      );
      expect(prisma.journalEntry.create).toHaveBeenCalledTimes(1);
    });

    it('creates a balanced double-entry journal for fee payment', async () => {
      seedInvoice();
      mockCreatedPayment();

      await collectCashPayment();

      const { totalDebit, totalCredit } = summarizeJournalLines(
        latestJournalCreateInput().data.lines.create,
      );

      expect(totalDebit.equals(totalCredit)).toBe(true);
      expect(totalDebit.equals(new Prisma.Decimal(1000))).toBe(true);
      expect(totalCredit.equals(new Prisma.Decimal(1000))).toBe(true);
    });

    it('stores payment source document linkage on the posted journal', async () => {
      seedInvoice();
      mockCreatedPayment();

      await collectCashPayment();

      expect(latestJournalCreateInput().data).toEqual(
        expect.objectContaining({
          sourceType: JournalSourceType.FEE_PAYMENT,
          sourceId: 'pay-1',
        }),
      );
    });

    it('returns existing idempotent payment without creating a duplicate journal', async () => {
      seedInvoice();
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-existing',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1000),
        method: PaymentMethod.CASH,
        paidAt: new Date(),
        receipt: { receiptNumber: 'RCP-123' },
        allocations: [],
      });

      const result = await collectCashPayment({ idempotencyKey: 'idem-key-1' });

      expect(result.paymentId).toBe('pay-existing');
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate payment reference before journal posting', async () => {
      seedInvoice();
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-with-reference',
        referenceNumber: 'BANK-REF-001',
        status: PaymentStatus.SUCCESS,
      });

      await expect(
        collectCashPayment({ referenceNumber: 'BANK-REF-001' }),
      ).rejects.toThrow(/already been used/i);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('creates reversal journal instead of mutating original posted journal', async () => {
      seedPaymentForReversal();
      seedOriginalPaymentJournal();

      await financeService.reversePayment(
        'pay-1',
        { reason: 'Refund', idempotencyKey: 'reverse-pay-1' },
        actor,
      );

      expect(prisma.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'je-1' },
          data: expect.objectContaining({
            status: 'REVERSED',
            reversalReason: 'Refund',
            reversedById: actor.userId,
            reversedAt: expect.any(Date),
          }),
        }),
      );

      const updateCall = (prisma.journalEntry.update as jest.Mock).mock
        .calls[0]?.[0];
      expect(updateCall?.data?.lines).toBeUndefined();
      expect(updateCall?.data?.entryDate).toBeUndefined();
      expect(updateCall?.data?.fiscalYearId).toBeUndefined();
      expect(updateCall?.data?.fiscalPeriodId).toBeUndefined();
      expect(updateCall?.data?.sourceId).toBeUndefined();

      expect(prisma.journalEntry.delete).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            reversalOfId: 'je-1',
            sourceType: JournalSourceType.REVERSAL,
            sourceId: 'je-1',
            postingType: 'REVERSAL',
          }),
        }),
      );
    });

    it.each([AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED])(
      'rejects fee payment posting into %s fiscal period',
      async (status) => {
        (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue({
          ...openFiscalPeriod(),
          status,
        });
        seedInvoice();
        mockCreatedPayment();

        await expect(collectCashPayment()).rejects.toThrow(ConflictException);
        expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      },
    );

    it('rejects cross-tenant invoice source access before payment or journal creation', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        collectCashPayment({ invoiceId: 'inv-other-tenant' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('writes audit records for payment posting and reversal', async () => {
      const auditSpy = jest.spyOn(auditService, 'record');
      seedInvoice();
      mockCreatedPayment();

      await collectCashPayment();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'post',
          resource: 'journal_entry',
          tenantId,
          resourceId: expect.any(String),
        }),
      );

      seedPaymentForReversal();
      seedOriginalPaymentJournal();

      await financeService.reversePayment(
        'pay-1',
        { reason: 'Test', idempotencyKey: 'reverse-pay-1-audit' },
        actor,
      );

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reverse',
          resource: 'journal_entry',
          tenantId,
          resourceId: expect.any(String),
        }),
      );
    });
  });

  describe('Overpayment protection', () => {
    it('rejects payment if it exceeds remaining balance', async () => {
      const invoice = buildInvoice({
        payments: [{ amount: new Prisma.Decimal(800), refunds: [] }],
      });
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([invoice]);

      await expect(collectCashPayment({ amount: 300 })).rejects.toThrow(
        /exceeds the remaining balance/i,
      );
    });
  });

  describe('Cashier close and reconciliation', () => {
    it('finalizes cashier close and verifies finance/accounting consistency', async () => {
      const openedAt = new Date(Date.now() - 3600000);
      const closedAt = new Date();
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashierClose.create as jest.Mock).mockResolvedValue({
        id: 'close-1',
        tenantId,
        closeNumber: 'CC-001',
        closeWindowKey: 'cashier-window-key',
        openedAt,
        closedAt,
        collectorUserId: null,
        collectorUser: null,
        paymentMethod: null,
        grossCollected: new Prisma.Decimal(1000),
        totalRefunded: new Prisma.Decimal(0),
        netCollected: new Prisma.Decimal(1000),
        expectedCashAmount: new Prisma.Decimal(1000),
        actualCashAmount: new Prisma.Decimal(1000),
        varianceAmount: new Prisma.Decimal(0),
        varianceReason: null,
        denominationBreakdown: null,
        methodBreakdown: [],
        paymentCount: 1,
        refundCount: 0,
        firstReceiptNumber: 'RCP-001',
        lastReceiptNumber: 'RCP-001',
        notes: null,
        closedById: actor.userId,
        closedBy: { id: actor.userId, email: actor.email },
        createdAt: closedAt,
        updatedAt: closedAt,
      });

      jest
        .spyOn(
          financeService as unknown as {
            buildCashierCloseSummary: FinanceService['buildCashierCloseSummary'];
          },
          'buildCashierCloseSummary',
        )
        .mockResolvedValue({
          grossCollected: 1000,
          totalRefunded: 0,
          netCollected: 1000,
          expectedCashAmount: 1000,
          paymentCount: 1,
          refundCount: 0,
          methodBreakdown: [],
          firstReceiptNumber: 'RCP-001',
          lastReceiptNumber: 'RCP-001',
          openedAt,
          closedAt,
          collectorUserId: null,
          paymentMethod: null,
          actualCashAmount: null,
          varianceAmount: null,
          varianceReason: null,
          denominationBreakdown: null,
        });

      const close = await financeService.finalizeCashierClose(
        {
          openedAt: openedAt.toISOString(),
          closedAt: closedAt.toISOString(),
          actualCashAmount: 1000,
        },
        actor,
      );

      expect(close).toBeDefined();
      expect(prisma.cashierClose.create).toHaveBeenCalled();

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([
        { amount: new Prisma.Decimal(1000), status: PaymentStatus.SUCCESS },
      ]);
      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue([
        {
          lines: [
            { debit: new Prisma.Decimal(1000), credit: new Prisma.Decimal(0) },
          ],
        },
      ]);

      const consistency =
        await financeService.runFinanceConsistencyCheck(actor);
      expect(consistency.isConsistent).toBe(true);
      expect(consistency.paymentTotal).toBe(1000);
      expect(consistency.journalTotal).toBe(1000);
    });
  });

  function buildInvoice(
    overrides: Record<string, unknown> = {},
  ): Record<string, any> {
    return {
      id: 'inv-1',
      tenantId,
      totalAmount: new Prisma.Decimal(1000),
      vatAmount: new Prisma.Decimal(0),
      payments: [],
      paymentAllocations: [],
      invoiceNumber: 'INV-001',
      fiscalYear: '2026',
      studentId: 'student-1',
      status: InvoiceStatus.ISSUED,
      paidAt: null,
      student: { id: 'student-1' },
      lines: [
        {
          id: 'line-1',
          totalAmount: new Prisma.Decimal(1000),
          feeHead: { code: 'TUI' },
          description: 'Tuition',
        },
      ],
      ...overrides,
    };
  }

  function seedInvoice() {
    const invoice = buildInvoice();
    prisma.__state.invoices.push(invoice);
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(invoice);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([invoice]);
  }

  function mockCreatedPayment() {
    (prisma.payment.create as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      tenantId,
      studentId: 'student-1',
      invoiceId: 'inv-1',
      amount: new Prisma.Decimal(1000),
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      paidAt: new Date(),
      referenceNumber: null,
      receipt: { receiptNumber: 'RCP-001' },
    });
  }

  function seedPaymentForReversal() {
    const invoice = buildInvoice({
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
    });
    if (!prisma.__state.invoices.some((item) => item.id === invoice.id)) {
      prisma.__state.invoices.push(invoice);
    }

    const payment = {
      id: 'pay-1',
      tenantId,
      invoiceId: 'inv-1',
      studentId: 'student-1',
      collectedById: actor.userId,
      method: PaymentMethod.CASH,
      amount: new Prisma.Decimal(1000),
      status: PaymentStatus.SUCCESS,
      reversedAt: null,
      reversalIdempotencyKey: null,
      reversalReason: null,
      paidAt: new Date(),
      refunds: [],
      allocations: [],
      receipt: { receiptNumber: 'RCP-1' },
      invoice,
    };

    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(payment);
    prisma.__state.payments.push(payment);
  }

  function seedOriginalPaymentJournal() {
    const journal = {
      id: 'je-1',
      tenantId,
      entryNumber: 'JE-1',
      status: 'POSTED',
      lines: [
        {
          chartAccountId: 'acc-cash',
          side: JournalLineSide.DEBIT,
          amount: new Prisma.Decimal(1000),
        },
        {
          chartAccountId: 'acc-rev',
          side: JournalLineSide.CREDIT,
          amount: new Prisma.Decimal(1000),
        },
      ],
    };
    (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(journal);
    if (!prisma.__state.journalEntries.some((item) => item.id === journal.id)) {
      prisma.__state.journalEntries.push(journal);
    }
  }

  async function collectCashPayment(
    overrides: Partial<{
      invoiceId: string;
      amount: number;
      idempotencyKey: string;
      referenceNumber: string;
    }> = {},
  ) {
    return financeService.collectPayment(
      {
        invoiceId: overrides.invoiceId ?? 'inv-1',
        amount: new Prisma.Decimal(overrides.amount ?? 1000).toFixed(2),
        method: PaymentMethod.CASH,
        idempotencyKey:
          overrides.idempotencyKey ??
          `collect-${overrides.referenceNumber ?? 'cash'}`,
        ...(overrides.referenceNumber
          ? { referenceNumber: overrides.referenceNumber }
          : {}),
      },
      actor,
    );
  }

  function latestJournalCreateInput() {
    const calls = (prisma.journalEntry.create as jest.Mock).mock.calls;
    return calls[calls.length - 1][0] as JournalCreateInput;
  }
});

function openFiscalPeriod() {
  return {
    id: 'p-open',
    tenantId: 'tenant-finance-integration',
    status: AccountingPeriodStatus.OPEN,
    fiscalYearId: 'fy-2026',
    fiscalYear: { status: 'OPEN', name: 'FY 2026' },
  };
}

function chartAccountForCode(code = '1010') {
  return {
    id: `acc-${code}`,
    code,
    tenantId: 'tenant-finance-integration',
  };
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
