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

describe('FinanceService - Hardening', () => {
  let service: FinanceService;
  let prisma: PrismaService;
  let fileRegistry: FileRegistryService;
  let auditService: AuditService;

  const actor = {
    tenantId: 't1',
    userId: 'u1',
    roles: ['admin'],
    permissions: [
      'fees:manage',
      'payments:refund',
      'payments:reverse',
      'payments:close',
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
      receipt: { findFirst: jest.fn(), count: jest.fn() },
      fileAsset: { findFirst: jest.fn() },
      tenant: { findUnique: jest.fn() },
      providerConfig: { findFirst: jest.fn() },
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
});
