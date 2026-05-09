import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  PaymentMethod,
  JournalSourceType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { FinanceService } from '../src/finance/finance.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AppModule } from '../src/app.module';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthContextMock,
  createPrismaMock,
  PrismaMock,
} from './test-helpers';

describe('Finance M9 Consistency (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let financeService: FinanceService;

  const tenantId = 'tenant-finance-hardening';
  const actor = createAuthContextMock({ tenantId });

  beforeEach(async () => {
    prisma = createPrismaMock() as unknown as PrismaMock;

    const ensureMock = (model: any) => {
      if (!model.findMany) model.findMany = jest.fn().mockResolvedValue([]);
      if (!model.findFirst) model.findFirst = jest.fn();
      if (!model.findUnique) model.findUnique = jest.fn();
      if (!model.findUniqueOrThrow) model.findUniqueOrThrow = jest.fn();
      if (!model.create) model.create = jest.fn().mockResolvedValue({ id: 'mock-id' });
      if (!model.count) model.count = jest.fn();
      if (!model.upsert) model.upsert = jest.fn();
      if (!model.update) model.update = jest.fn();
      if (!model.delete) model.delete = jest.fn();
      if (!model.deleteMany) model.deleteMany = jest.fn();
    };

    [
      'invoice', 'payment', 'receipt', 'paymentRefund', 'chartAccount', 
      'journalEntry', 'journalLine', 'feeWaiver', 'student', 'tenant', 
      'cashierClose', 'auditLog', 'fiscalPeriod', 'fiscalYear', 'accountingPeriod'
    ].forEach(m => {
      if (!(prisma as any)[m]) (prisma as any)[m] = {};
      ensureMock((prisma as any)[m]);
    });

    prisma.$transaction = jest.fn().mockImplementation((cb) => cb(prisma));

    (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue({
      id: 'p1',
      status: 'OPEN',
      label: 'May 2026',
      fiscalYear: { id: 'y1', status: 'OPEN', name: 'FY 2026' },
    });
    (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue({ id: 'y1', status: 'OPEN' });

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    financeService = moduleRef.get(FinanceService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Payment Collection & Idempotency', () => {
    it('should reject duplicate payment reference across the tenant', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        totalAmount: new Prisma.Decimal(1000),
        payments: [],
        invoiceNumber: 'INV-001',
      });

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-pay' });

      await expect(
        financeService.collectPayment({
          invoiceId: 'inv-1',
          amount: 500,
          method: PaymentMethod.CASH,
          referenceNumber: 'REF-DUPE-123',
        }, actor)
      ).rejects.toThrow(/already been used/i);
    });

    it('should return existing payment if idempotency key matches', async () => {
      const existingPayment = { id: 'existing-idempotent', receipt: { id: 'r1' } };
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({ id: 'inv-1', totalAmount: new Prisma.Decimal(1000), payments: [] });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(existingPayment);

      const result = await financeService.collectPayment({
        invoiceId: 'inv-1',
        amount: 500,
        method: PaymentMethod.CASH,
        idempotencyKey: 'key-123',
      }, actor);

      expect(result.id).toBe(existingPayment.id);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('Payment Reversal', () => {
    it('should reverse a payment and its associated journal entry', async () => {
      const payment = {
        id: 'pay-to-reverse',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(500),
        refunds: [],
        receipt: { receiptNumber: 'RCP-001' },
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(payment);
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'je-1',
        entryNumber: 'JE-001',
        lines: [
          { chartAccountId: 'cash', side: 'DEBIT', amount: new Prisma.Decimal(500) },
          { chartAccountId: 'rev', side: 'CREDIT', amount: new Prisma.Decimal(500) },
        ],
      });

      const result = await financeService.reversePayment('pay-to-reverse', { reason: 'Error' }, actor);

      expect(result.reversal).toBeDefined();
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-to-reverse' },
        data: expect.objectContaining({
          status: PaymentStatus.REVERSED,
          reversalReason: 'Error',
        }),
      });
      expect(prisma.receipt.deleteMany).not.toHaveBeenCalled();
      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: InvoiceStatus.ISSUED }),
      }));
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
        financeService.collectPayment({
          invoiceId: 'inv-1',
          amount: 300, // 800 + 300 > 1000
          method: PaymentMethod.CASH,
        }, actor)
      ).rejects.toThrow(/exceeds the remaining balance/i);
    });
  });

  describe('Cashier Close & Reconciliation', () => {
    it('should finalize cashier close and verify consistency', async () => {
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashierClose.create as jest.Mock).mockResolvedValue({ id: 'close-1', closeNumber: 'CC-001' });

      // Mock buildCashierCloseSummary return
      jest.spyOn(financeService as any, 'buildCashierCloseSummary').mockResolvedValue({
        grossCollected: 1000,
        totalRefunded: 0,
        netCollected: 1000,
        expectedCashAmount: 1000,
        paymentCount: 1,
        refundCount: 0,
        methodBreakdown: {},
      });

      const close = await financeService.finalizeCashierClose({
        openedAt: new Date(Date.now() - 3600000).toISOString(),
        closedAt: new Date().toISOString(),
        actualCashAmount: 1000,
      }, actor);

      expect(close).toBeDefined();
      expect(prisma.cashierClose.create).toHaveBeenCalled();

      // Test Consistency Check
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([
        { amount: new Prisma.Decimal(1000), status: PaymentStatus.SUCCESS }
      ]);
      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue([
        { lines: [{ debit: new Prisma.Decimal(1000), credit: new Prisma.Decimal(0) }] }
      ]);

      const consistency = await financeService.runFinanceConsistencyCheck(actor);
      expect(consistency.isConsistent).toBe(true);
      expect(consistency.paymentTotal).toBe(1000);
      expect(consistency.journalTotal).toBe(1000);
    });
  });
});
