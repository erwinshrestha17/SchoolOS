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

  const tenantId = 'tenant-finance-integration';
  const actor = createAuthContextMock({ tenantId });

  beforeEach(async () => {
    prisma = createPrismaMock() as unknown as PrismaMock;

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
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

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
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

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
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

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
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-existing',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1000),
        method: PaymentMethod.CASH,
        paidAt: new Date(),
        receipt: { receiptNumber: 'RCP-123' },
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

      await financeService.reversePayment('pay-1', { reason: 'Refund' }, actor);

      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
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
        (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

        await expect(collectCashPayment()).rejects.toThrow(ConflictException);
        expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      },
    );

    it('rejects cross-tenant invoice source access before payment or journal creation', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        collectCashPayment({ invoiceId: 'inv-other-tenant' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('writes audit records for payment posting and reversal', async () => {
      const auditSpy = jest.spyOn(auditService, 'record');
      seedInvoice();
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

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

      await financeService.reversePayment('pay-1', { reason: 'Test' }, actor);

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
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        tenantId,
        totalAmount: new Prisma.Decimal(1000),
        payments: [{ amount: new Prisma.Decimal(800), refunds: [] }],
      });

      await expect(collectCashPayment({ amount: 300 })).rejects.toThrow(
        /exceeds the remaining balance/i,
      );
    });
  });

  describe('Cashier close and reconciliation', () => {
    it('finalizes cashier close and verifies finance/accounting consistency', async () => {
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashierClose.create as jest.Mock).mockResolvedValue({
        id: 'close-1',
        closeNumber: 'CC-001',
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
          openedAt: new Date(Date.now() - 3600000),
          closedAt: new Date(),
          collectorUserId: null,
          paymentMethod: null,
          actualCashAmount: null,
          varianceAmount: null,
          varianceReason: null,
          denominationBreakdown: null,
        });

      const close = await financeService.finalizeCashierClose(
        {
          openedAt: new Date(Date.now() - 3600000).toISOString(),
          closedAt: new Date().toISOString(),
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

  function seedInvoice() {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      tenantId,
      totalAmount: new Prisma.Decimal(1000),
      vatAmount: new Prisma.Decimal(0),
      payments: [],
      invoiceNumber: 'INV-001',
      fiscalYear: '2026',
      studentId: 'student-1',
      lines: [
        {
          id: 'line-1',
          totalAmount: new Prisma.Decimal(1000),
          feeHead: { code: 'TUI' },
          description: 'Tuition',
        },
      ],
    });
  }

  function seedPaymentForReversal() {
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      invoiceId: 'inv-1',
      amount: new Prisma.Decimal(1000),
      refunds: [],
      receipt: { receiptNumber: 'RCP-1' },
    });
  }

  function seedOriginalPaymentJournal() {
    (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-1',
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
    });
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
        amount: overrides.amount ?? 1000,
        method: PaymentMethod.CASH,
        ...(overrides.idempotencyKey
          ? { idempotencyKey: overrides.idempotencyKey }
          : {}),
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
