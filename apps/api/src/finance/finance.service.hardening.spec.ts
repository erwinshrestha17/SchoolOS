import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthMethod, Prisma, InvoiceStatus } from '@prisma/client';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('FinanceService - Hardening', () => {
  let service: FinanceService;
  let prisma: PrismaService;

  const actor = {
    tenantId: 't1',
    userId: 'u1',
    roles: ['admin'],
    permissions: ['fees:manage', 'fees:refund'],
    authMethod: AuthMethod.PASSWORD,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: PrismaService,
          useValue: {
            payment: { findFirst: jest.fn() },
            paymentRefund: { count: jest.fn(), create: jest.fn() },
            invoice: { findUnique: jest.fn(), update: jest.fn() },
            cashierClose: { findFirst: jest.fn(), create: jest.fn() },
            journalEntry: { findFirst: jest.fn() },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CommunicationsService, useValue: {} },
        { provide: AccountingPostingService, useValue: { postPaymentRefund: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('refundPayment', () => {
    it('prevents refund exceeding net paid amount', async () => {
      const mockPayment = {
        id: 'p1',
        amount: new Prisma.Decimal(1000),
        refunds: [{ amount: new Prisma.Decimal(600) }],
        invoice: { id: 'i1', status: InvoiceStatus.PAID, totalAmount: new Prisma.Decimal(1000), payments: [] },
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
      (prisma.cashierClose.findFirst as jest.Mock).mockResolvedValue({ id: 'c1', closeNumber: 'CC-001' });

      await expect(
        service.finalizeCashierClose(
          { openedAt: '2026-05-01T08:00:00Z', closedAt: '2026-05-01T17:00:00Z' },
          actor as any,
        ),
      ).rejects.toThrow('CC-001 already overlaps the selected window');
    });
  });
});
