import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from '../usage/usage.service';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuthMethod,
  Prisma,
  InvoiceStatus,
  PaymentStatus,
  JournalSourceType,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InvoiceAdjustmentDirection } from './dto/create-invoice-adjustment.dto';

describe('FinanceService - Hardening', () => {
  let service: FinanceService;
  let prisma: PrismaService;
  let fileRegistry: FileRegistryService;
  let auditService: AuditService;
  let accountingPostingService: AccountingPostingService;

  const actor = {
    tenantId: 't1',
    userId: 'u1',
    roles: ['admin'],
    permissions: [
      'fees:manage',
      'payments:refund',
      'payments:reverse',
      'payments:close',
      'payments:collect',
      'receipts:manage',
      'receipts:read',
    ],
    authMethod: AuthMethod.PASSWORD,
  };

  beforeEach(async () => {
    const mockPrisma = {
      payment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      paymentRefund: { count: jest.fn(), create: jest.fn() },
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      cashierClose: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      journalEntry: { findFirst: jest.fn() },
      accountingPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
      receipt: { findFirst: jest.fn(), count: jest.fn() },
      fileAsset: { findFirst: jest.fn() },
      tenant: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 't1', slug: 't1' }),
      },
      providerConfig: { findFirst: jest.fn() },
      financeApprovalRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      feeHead: {
        findFirst: jest.fn(),
      },
      invoiceLine: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CommunicationsService, useValue: {} },
        {
          provide: AccountingPostingService,
          useValue: {
            postPaymentRefund: jest.fn(),
            postReversal: jest.fn().mockResolvedValue({ id: 'rev-1' }),
            postInvoiceAdjustment: jest.fn().mockResolvedValue({ id: 'adj-1' }),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: UsageService,
          useValue: {
            verifyLimit: jest.fn().mockResolvedValue(undefined),
            checkLimit: jest.fn().mockResolvedValue(undefined),
            incrementUsage: jest.fn().mockResolvedValue(undefined),
          } as any,
        },
        {
          provide: FileRegistryService,
          useValue: {
            registerGeneratedFile: jest.fn(),
            getProtectedDownload: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    prisma = module.get<PrismaService>(PrismaService);
    fileRegistry = module.get<FileRegistryService>(FileRegistryService);
    auditService = module.get<AuditService>(AuditService);
    accountingPostingService = module.get<AccountingPostingService>(
      AccountingPostingService,
    );
  });

  describe('refundPayment', () => {
    it('prevents refund exceeding net paid amount', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        refunds: [{ amount: new Prisma.Decimal(600) }],
        invoice: {
          id: 'i1',
          status: InvoiceStatus.PAID,
          totalAmount: new Prisma.Decimal(1000),
          payments: [],
        },
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'j1',
        lines: [{ id: 'l1' }],
      });

      await expect(
        service.refundPayment(
          'p1',
          { amount: 500, refundDate: '2026-05-01', reason: 'Overpaid' },
          actor as any,
        ),
      ).rejects.toThrow('Refund exceeds the remaining refundable amount');
    });
  });

  describe('finalizeCashierClose', () => {
    it('prevents overlapping cashier close windows', async () => {
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue({
        id: 'c1',
        closeNumber: 'CC-001',
      });

      await expect(
        service.finalizeCashierClose(
          {
            openedAt: '2026-05-01T08:00:00Z',
            closedAt: '2026-05-01T17:00:00Z',
          },
          actor as any,
        ),
      ).rejects.toThrow('This cashier window is already closed for today.');
    });
  });

  describe('reversePayment', () => {
    it('blocks reversal without service-level permission', async () => {
      await expect(
        service.reversePayment('p1', { reason: 'Incorrect collection' }, {
          ...actor,
          permissions: [],
        } as any),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('requires a reason before reversing a payment', async () => {
      await expect(
        service.reversePayment('p1', { reason: '   ' }, actor as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('prevents reversal of already refunded payments', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        status: PaymentStatus.SUCCESS,
        refunds: [{ id: 'r1', amount: new Prisma.Decimal(100) }],
        tenantId: 't1',
        invoiceId: 'i1',
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      await expect(
        service.reversePayment('p1', { reason: 'Error' }, actor as any),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents reversal of already reversed payments', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        status: PaymentStatus.REVERSED,
        reversedAt: new Date('2026-05-01T10:00:00.000Z'),
        refunds: [],
        tenantId: 't1',
        invoiceId: 'i1',
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      await expect(
        service.reversePayment(
          'p1',
          { reason: 'Incorrect collection' },
          actor as any,
        ),
      ).rejects.toThrow('This payment is already reversed.');
    });

    it('blocks reversal for a closed cashier day', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        status: PaymentStatus.SUCCESS,
        refunds: [],
        tenantId: 't1',
        invoiceId: 'i1',
        paidAt: new Date('2026-05-01T10:00:00.000Z'),
        collectedById: 'cashier-1',
        method: 'CASH',
        invoice: { id: 'i1', totalAmount: new Prisma.Decimal(1000) },
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue({
        id: 'close-1',
        closeNumber: 'CLS-001',
      });

      await expect(
        service.reversePayment(
          'p1',
          { reason: 'Incorrect collection' },
          actor as any,
        ),
      ).rejects.toThrow(
        'This cashier day is already closed. Please contact an administrator.',
      );

      expect(prisma.journalEntry.findFirst).not.toHaveBeenCalled();
    });

    it('correctly updates statuses and posts to ledger on valid reversal', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        status: PaymentStatus.SUCCESS,
        refunds: [],
        tenantId: 't1',
        invoiceId: 'i1',
        paidAt: new Date('2026-05-01T10:00:00.000Z'),
        collectedById: 'cashier-1',
        method: 'CASH',
        invoice: { id: 'i1', totalAmount: new Prisma.Decimal(1000) },
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'j1',
        entryNumber: 'JE-001',
        lines: [],
      });
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]); // No remaining payments

      const result = await service.reversePayment(
        'p1',
        { reason: 'Incorrect charge' },
        actor as any,
      );

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({
            status: PaymentStatus.REVERSED,
          }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'i1' },
          data: expect.objectContaining({
            status: InvoiceStatus.ISSUED,
          }),
        }),
      );
    });
  });

  describe('handleOnlinePaymentWebhook', () => {
    it('returns existing payment if webhook is a duplicate (idempotency)', async () => {
      const mockPayment = {
        id: 'p-webhook-1',
        amount: new Prisma.Decimal(1500),
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'webhook:esewa:ref-123',
      };

      (prisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'prov-1',
        name: 'ESEWA',
        configEncrypted: { webhookSecret: 'secret' },
      });
      jest
        .spyOn(service as any, 'verifyWebhookSignature')
        .mockReturnValue(true);
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.handleOnlinePaymentWebhook(
        'esewa',
        {
          reference: 'REF-123',
          amount: 1500,
          status: 'SUCCESS',
        },
        {
          signature: 'valid-signature',
          'x-tenant-id': actor.tenantId,
        },
      );

      expect(result).toEqual({
        duplicate: true,
        message: 'Payment already processed and posted.',
        paymentId: 'p-webhook-1',
        postedToLedger: true,
        status: 'verified',
      });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('ignores online payment webhook if invoice is already paid', async () => {
      const mockInvoice = {
        id: 'i-webhook-1',
        status: InvoiceStatus.PAID,
        totalAmount: new Prisma.Decimal(1000),
        vatAmount: new Prisma.Decimal(130),
        payments: [
          {
            amount: new Prisma.Decimal(1000),
            refunds: [],
          },
        ],
      };

      (prisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'prov-2',
        name: 'KHALTI',
        configEncrypted: { webhookSecret: 'secret' },
      });
      jest
        .spyOn(service as any, 'verifyWebhookSignature')
        .mockReturnValue(true);
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await service.handleOnlinePaymentWebhook(
        'khalti',
        {
          reference: 'REF-456',
          amount: 1000,
          status: 'SUCCESS',
          invoiceId: 'i-webhook-1',
        },
        {
          signature: 'valid-signature',
          'x-tenant-id': actor.tenantId,
        },
      );

      expect(result).toEqual({
        status: 'verified',
        postedToLedger: false,
        message:
          'Invoice is already fully paid. Webhook event ignored to prevent duplicate payment.',
      });
    });

    it('acknowledges failed or pending webhook events without posting payment', async () => {
      (prisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'prov-3',
        name: 'ESEWA',
        configEncrypted: { webhookSecret: 'secret' },
      });
      jest
        .spyOn(service as any, 'verifyWebhookSignature')
        .mockReturnValue(true);

      const result = await service.handleOnlinePaymentWebhook(
        'esewa',
        {
          reference: 'REF-FAILED',
          amount: 1500,
          status: 'FAILED',
        },
        {
          signature: 'valid-signature',
          'x-tenant-id': actor.tenantId,
        },
      );

      expect(result).toEqual({
        status: 'ignored',
        postedToLedger: false,
        message:
          'Webhook event failed was acknowledged without creating a payment.',
      });
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it('rejects successful webhook events without a payment reference', async () => {
      (prisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'prov-4',
        name: 'ESEWA',
        configEncrypted: { webhookSecret: 'secret' },
      });
      jest
        .spyOn(service as any, 'verifyWebhookSignature')
        .mockReturnValue(true);

      await expect(
        service.handleOnlinePaymentWebhook(
          'esewa',
          {
            amount: 1500,
            status: 'SUCCESS',
          },
          {
            signature: 'valid-signature',
            'x-tenant-id': actor.tenantId,
          },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it('rejects successful webhook events with zero amount', async () => {
      (prisma.providerConfig.findFirst as jest.Mock).mockResolvedValue({
        id: 'prov-5',
        name: 'KHALTI',
        configEncrypted: { webhookSecret: 'secret' },
      });
      jest
        .spyOn(service as any, 'verifyWebhookSignature')
        .mockReturnValue(true);

      await expect(
        service.handleOnlinePaymentWebhook(
          'khalti',
          {
            reference: 'REF-ZERO',
            amount: 0,
            status: 'SUCCESS',
          },
          {
            signature: 'valid-signature',
            'x-tenant-id': actor.tenantId,
          },
        ),
      ).rejects.toThrow('Webhook amount must be greater than zero.');
      expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('Finance Approval Requests', () => {
    it('creates a PENDING refund approval request successfully', async () => {
      const mockPayment = {
        id: 'p-req-1',
        amount: new Prisma.Decimal(2000),
        status: PaymentStatus.SUCCESS,
        refunds: [],
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.financeApprovalRequest.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.financeApprovalRequest.create as jest.Mock).mockResolvedValue({
        id: 'req-refund-1',
        status: 'PENDING',
        amount: new Prisma.Decimal(1000),
      });

      const result = await service.requestRefund(
        'p-req-1',
        { amount: 1000, reason: 'Accidental charge' },
        actor as any,
      );

      expect(prisma.financeApprovalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REFUND',
            amount: new Prisma.Decimal(1000),
            status: 'PENDING',
          }),
        }),
      );
      expect(result.id).toBe('req-refund-1');
    });

    it('creates a PENDING reversal approval request successfully', async () => {
      const mockPayment = {
        id: 'p-req-2',
        amount: new Prisma.Decimal(2000),
        status: PaymentStatus.SUCCESS,
        refunds: [],
      };

      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.financeApprovalRequest.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.financeApprovalRequest.create as jest.Mock).mockResolvedValue({
        id: 'req-reverse-1',
        status: 'PENDING',
      });

      const result = await service.requestReversal(
        'p-req-2',
        { reason: 'Wrong student billed' },
        actor as any,
      );

      expect(prisma.financeApprovalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REVERSAL',
            amount: null,
            status: 'PENDING',
          }),
        }),
      );
      expect(result.id).toBe('req-reverse-1');
    });

    it('approves a request and runs actual refund', async () => {
      const mockRequest = {
        id: 'req-1',
        type: 'REFUND',
        paymentId: 'p1',
        amount: new Prisma.Decimal(500),
        reason: 'Double billing',
        status: 'PENDING',
      };

      (prisma.financeApprovalRequest.findFirst as jest.Mock).mockResolvedValue(
        mockRequest,
      );
      (prisma.financeApprovalRequest.update as jest.Mock).mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
      });

      // Mock refundPayment dependencies
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        status: PaymentStatus.SUCCESS,
        refunds: [],
        invoice: {
          id: 'i1',
          status: InvoiceStatus.PAID,
          totalAmount: new Prisma.Decimal(1000),
          payments: [],
        },
      };
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'j1',
        entryNumber: 'JE-001',
        lines: [
          {
            chartAccountId: 'acc-1',
            amount: new Prisma.Decimal(1000),
            description: 'Fee payment revenue line',
            side: 'CREDIT',
          },
        ],
      });
      (prisma.paymentRefund.count as jest.Mock).mockResolvedValue(0);
      (prisma.paymentRefund.create as jest.Mock).mockResolvedValue({
        id: 'refund-1',
        refundNumber: 'RFD-2026-00001',
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        id: 'i1',
        status: 'PARTIAL',
      });
      (
        accountingPostingService.postPaymentRefund as jest.Mock
      ).mockResolvedValue({
        entryNumber: 'JE-REF-001',
      });

      const result = await service.reviewApprovalRequest(
        'req-1',
        {
          status: 'APPROVED' as any,
          reviewNote: 'Approved by principal',
        },
        actor as any,
      );

      expect(result.status).toBe('APPROVED');
      expect(prisma.financeApprovalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewNote: 'Approved by principal',
          }),
        }),
      );
    });
  });

  describe('Invoice Adjustment Ledger Posting', () => {
    it('successfully calls accountingPostingService on adjustment', async () => {
      const mockInvoice = {
        id: 'i-adj-1',
        invoiceNumber: 'INV-2026-001',
        subtotal: new Prisma.Decimal(5000),
        vatAmount: new Prisma.Decimal(650),
        totalAmount: new Prisma.Decimal(5650),
        status: InvoiceStatus.ISSUED,
        payments: [],
      };

      const mockFeeHead = {
        id: 'fh-1',
        code: 'ADMISSION',
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.feeHead.findFirst as jest.Mock).mockResolvedValue(mockFeeHead);
      (prisma.invoiceLine.create as jest.Mock).mockResolvedValue({
        id: 'il-adj-1',
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        subtotal: new Prisma.Decimal(6000),
        totalAmount: new Prisma.Decimal(6780),
      });

      const accountingPostingService = service['accountingPostingService'];

      await service.createInvoiceAdjustment(
        'i-adj-1',
        {
          feeHeadId: 'fh-1',
          amount: 1000,
          vatAmount: 130,
          direction: InvoiceAdjustmentDirection.INCREASE,
          reason: 'Correction',
        },
        actor as any,
      );

      expect(
        accountingPostingService.postInvoiceAdjustment,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: actor.tenantId,
          invoiceId: 'i-adj-1',
          invoiceNumber: 'INV-2026-001',
          amount: new Prisma.Decimal(1130),
          reason: 'Correction',
        }),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});
