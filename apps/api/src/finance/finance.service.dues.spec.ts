import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { UsageService } from '../usage/usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthMethod, Prisma, PaymentMethod } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('FinanceService - Dues & Reprints', () => {
  let service: FinanceService;
  let prisma: PrismaService;

  const actor = {
    tenantId: 't1',
    userId: 'u1',
    roles: ['admin'],
    permissions: ['fees:manage', 'receipts:manage'],
    authMethod: AuthMethod.PASSWORD,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: PrismaService,
          useValue: {
            receipt: {
              findFirst: jest.fn(),
              reprintHistory: { create: jest.fn() },
            },
            tenant: { findUnique: jest.fn() },
            receiptReprintHistory: { create: jest.fn() },
            invoice: { findMany: jest.fn(), count: jest.fn() },
            feeWaiver: { findMany: jest.fn() },
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CommunicationsService, useValue: {} },
        { provide: AccountingPostingService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
        {
          provide: UsageService,
          useValue: {
            verifyLimit: jest.fn().mockResolvedValue(undefined),
            incrementUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('reprintReceipt', () => {
    it('throws NotFound if receipt does not exist', async () => {
      (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reprintReceipt('r1', { reason: 'Lost' }, actor as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('records history and generates PDF for valid receipt', async () => {
      const mockReceipt = {
        id: 'r1',
        receiptNumber: 'REC-001',
        payment: {
          paidAt: new Date(),
          method: PaymentMethod.CASH,
          amount: new Prisma.Decimal(1000),
          student: {
            studentSystemId: 'S1',
            firstNameEn: 'John',
            lastNameEn: 'Doe',
            class: { name: 'Class 1' },
          },
          invoice: {
            invoiceNumber: 'INV-001',
            subtotal: new Prisma.Decimal(1000),
            totalAmount: new Prisma.Decimal(1000),
            lines: [
              {
                feeHead: { name: 'Tuition' },
                totalAmount: new Prisma.Decimal(1000),
              },
            ],
          },
        },
      };

      (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(mockReceipt);
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        name: 'School',
      });

      const result = await service.reprintReceipt(
        'r1',
        { reason: 'Lost' },
        actor as any,
      );

      expect(prisma.receiptReprintHistory.create).toHaveBeenCalled();
      expect(result.pdf).toBeDefined();
      expect(result.fileName).toContain('REC-001');
    });
  });

  describe('getDuesTableReport', () => {
    it('calculates dues correctly', async () => {
      const mockInvoices = [
        {
          id: 'i1',
          totalAmount: new Prisma.Decimal(5000),
          dueDate: new Date(),
          student: {
            firstNameEn: 'Alice',
            lastNameEn: 'Smith',
            class: { name: 'Class A' },
          },
          lines: [
            {
              feeHeadId: 'fh1',
              feeHead: { name: 'Admission' },
              totalAmount: new Prisma.Decimal(5000),
            },
          ],
          payments: [],
        },
      ];

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(
        mockInvoices.length,
      );
      (prisma.feeWaiver.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getDuesTableReport({}, actor as any);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].outstanding).toBe(5000);
      expect(result.summary.totalOutstanding).toBe(5000);
    });
  });
});
