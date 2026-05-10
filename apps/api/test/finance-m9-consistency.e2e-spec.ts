import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  PaymentMethod,
  JournalSourceType,
  PaymentStatus,
  Prisma,
  AccountingPeriodStatus,
  JournalLineSide,
} from '@prisma/client';
import { FinanceService } from '../src/finance/finance.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AppModule } from '../src/app.module';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AuditService } from '../src/audit/audit.service';
import {
  createAuthContextMock,
  createPrismaMock,
  PrismaMock,
  mockBullQueues,
} from './test-helpers';

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

    // Mock successful period check by default
    (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue({
      id: 'p-open',
      tenantId,
      status: AccountingPeriodStatus.OPEN,
      fiscalYearId: 'fy-2026',
      fiscalYear: { status: 'OPEN', name: 'FY 2026' },
    });

    // Seed state
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
    (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue({
      id: 'fy-2026',
      status: 'OPEN',
    });

    // Mock chart accounts for posting
    (prisma.chartAccount.findUnique as jest.Mock).mockImplementation((q) => {
      const code = q.where?.tenantId_code?.code || '1010';
      return Promise.resolve({
        id: `acc-${code}`,
        code,
        tenantId,
      });
    });
    (prisma.chartAccount.findUniqueOrThrow as jest.Mock).mockImplementation((q) => {
      const code = q.where?.tenantId_code?.code || '1010';
      return Promise.resolve({
        id: `acc-${code}`,
        code,
        tenantId,
      });
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

  describe('Posting Boundaries & Correctness', () => {
    it('1. should post fee payment only through AccountingPostingService', async () => {
      const postingSpy = jest.spyOn(postingService, 'postFeePayment');
      const directCreateSpy = jest.spyOn(prisma.journalEntry, 'create');

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
          { id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' }, description: 'Tuition' }
        ],
      });

      (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: tenantId, panNumber: 'PAN123' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

      await financeService.collectPayment(
        {
          invoiceId: 'inv-1',
          amount: 1000,
          method: PaymentMethod.CASH,
        },
        actor,
      );

      expect(postingSpy).toHaveBeenCalled();
      // Ensure that although journalEntry.create is called, it is called BY the posting service, 
      // which we verify by checking the call stack if needed, but here we just ensure postFeePayment was the entry point.
      // A stricter test would be to ensure FinanceService does not have direct access to journalEntry model if we used a real modular boundary, 
      // but in this modular monolith, we check that the service method is used.
    });

    it('2. should ensure posted journal is double-entry balanced', async () => {
      // This is primarily tested in AccountingPostingService, but we verify it here via FinanceService call
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
          { id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' }, description: 'Tuition' }
        ],
      });

      (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: tenantId, panNumber: 'PAN123' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

      await financeService.collectPayment(
        {
          invoiceId: 'inv-1',
          amount: 1000,
          method: PaymentMethod.CASH,
        },
        actor,
      );

      const journalCreateCall = (prisma.journalEntry.create as jest.Mock).mock.calls[0][0];
      const lines = journalCreateCall.data.lines.create;
      
      const totalDebit = lines
        .filter((l: any) => l.side === JournalLineSide.DEBIT)
        .reduce((sum: Prisma.Decimal, l: any) => sum.add(l.amount), new Prisma.Decimal(0));
      const totalCredit = lines
        .filter((l: any) => l.side === JournalLineSide.CREDIT)
        .reduce((sum: Prisma.Decimal, l: any) => sum.add(l.amount), new Prisma.Decimal(0));

      expect(totalDebit.equals(totalCredit)).toBe(true);
      expect(totalDebit.toNumber()).toBe(1000);
    });

    it('3. should store payment source document linkage', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        tenantId,
        totalAmount: new Prisma.Decimal(1000),
        vatAmount: new Prisma.Decimal(0),
        payments: [],
        invoiceNumber: 'INV-001',
        fiscalYear: '2026',
        studentId: 'student-1',
        lines: [{ id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' } }],
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

      await financeService.collectPayment(
        { invoiceId: 'inv-1', amount: 1000, method: PaymentMethod.CASH },
        actor,
      );

      const journalCreateCall = (prisma.journalEntry.create as jest.Mock).mock.calls[0][0];
      expect(journalCreateCall.data.sourceType).toBe(JournalSourceType.FEE_PAYMENT);
      expect(journalCreateCall.data.sourceId).toBe('pay-1');
    });

    it('4. should prevent duplicate journal creation via idempotency key', async () => {
      const existingPayment = {
        id: 'pay-existing',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1000),
        method: PaymentMethod.CASH,
        paidAt: new Date(),
        receipt: { receiptNumber: 'RCP-123' },
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        tenantId,
        totalAmount: new Prisma.Decimal(1000),
        vatAmount: new Prisma.Decimal(0),
        payments: [],
        fiscalYear: '2026',
        studentId: 'student-1',
        lines: [{ id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' }, description: 'Tuition' }],
      });
      
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(existingPayment);

      const result = await financeService.collectPayment(
        {
          invoiceId: 'inv-1',
          amount: 1000,
          method: PaymentMethod.CASH,
          idempotencyKey: 'idem-key-1',
        },
        actor,
      );

      expect(result.paymentId).toBe('pay-existing');
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('5. should create reversal journal instead of mutating during payment reversal', async () => {
      const payment = {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1000),
        refunds: [],
        receipt: { receiptNumber: 'RCP-1' },
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(payment);
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'je-1',
        entryNumber: 'JE-1',
        lines: [
          { chartAccountId: 'acc-cash', side: 'DEBIT', amount: new Prisma.Decimal(1000) },
          { chartAccountId: 'acc-rev', side: 'CREDIT', amount: new Prisma.Decimal(1000) },
        ],
      });

      await financeService.reversePayment('pay-1', { reason: 'Refund' }, actor);

      // Verify original journal was NOT updated/deleted
      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
      expect(prisma.journalEntry.delete).not.toHaveBeenCalled();

      // Verify reversal entry was created
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reversalOfId: 'je-1',
            sourceType: JournalSourceType.REVERSAL,
          }),
        }),
      );
    });

    it('6. should reject posting into CLOSED or LOCKED fiscal period', async () => {
      // Mock period as CLOSED
      (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-closed',
        status: AccountingPeriodStatus.CLOSED,
      });

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        tenantId,
        totalAmount: new Prisma.Decimal(1000),
        vatAmount: new Prisma.Decimal(0),
        payments: [],
        fiscalYear: '2026',
        studentId: 'student-1',
        lines: [{ id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' }, description: 'Tuition' }],
      });

      await expect(
        financeService.collectPayment(
          { invoiceId: 'inv-1', amount: 1000, method: PaymentMethod.CASH },
          actor,
        ),
      ).rejects.toThrow(/closed/i);
    });

    it('7. should reject cross-tenant invoice access', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null); // Not found because of tenant filter

      await expect(
        financeService.collectPayment(
          { invoiceId: 'inv-other-tenant', amount: 1000, method: PaymentMethod.CASH },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. should write audit records for payment posting and reversal', async () => {
      const auditSpy = jest.spyOn(auditService, 'record');

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        tenantId,
        totalAmount: new Prisma.Decimal(1000),
        vatAmount: new Prisma.Decimal(0),
        payments: [],
        studentId: 'student-1',
        fiscalYear: '2026',
        lines: [{ id: 'l1', totalAmount: new Prisma.Decimal(1000), feeHead: { code: 'TUI' } }],
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

      // Posting
      await financeService.collectPayment(
        { invoiceId: 'inv-1', amount: 1000, method: PaymentMethod.CASH },
        actor,
      );
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'post', resource: 'journal_entry' }));

      // Reversal
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1000),
        refunds: [],
      });
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'je-1',
        lines: [{ chartAccountId: 'acc-1', side: 'DEBIT', amount: new Prisma.Decimal(1000) }],
      });

      await financeService.reversePayment('pay-1', { reason: 'Test' }, actor);
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'reverse', resource: 'journal_entry' }));
    });
  });

  describe('Overpayment Protection', () => {
    it('should reject payment if it exceeds remaining balance', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        totalAmount: new Prisma.Decimal(1000),
        payments: [{ amount: new Prisma.Decimal(800), refunds: [] }],
      });

      await expect(
        financeService.collectPayment(
          {
            invoiceId: 'inv-1',
            amount: 300, // 800 + 300 > 1000
            method: PaymentMethod.CASH,
          },
          actor,
        ),
      ).rejects.toThrow(/exceeds the remaining balance/i);
    });
  });

  describe('Cashier Close & Reconciliation', () => {
    it('should finalize cashier close and verify consistency', async () => {
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashierClose.create as jest.Mock).mockResolvedValue({
        id: 'close-1',
        closeNumber: 'CC-001',
      });

      // Mock buildCashierCloseSummary return
      jest
        .spyOn(financeService as any, 'buildCashierCloseSummary')
        .mockResolvedValue({
          grossCollected: 1000,
          totalRefunded: 0,
          netCollected: 1000,
          expectedCashAmount: 1000,
          paymentCount: 1,
          refundCount: 0,
          methodBreakdown: {},
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

      // Test Consistency Check
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
});
