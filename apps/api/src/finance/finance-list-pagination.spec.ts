import {
  AuthMethod,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReceiptFileStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'cashier@school.test',
  roles: ['cashier'],
  permissions: ['payments:collect', 'receipts:read', 'ledger:read'],
  authMethod: AuthMethod.PASSWORD,
};

function createService() {
  const prisma = {
    invoice: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-001',
          status: InvoiceStatus.ISSUED,
          dueDate: new Date('2026-06-27T00:00:00.000Z'),
          issuedAt: new Date('2026-06-20T00:00:00.000Z'),
          totalAmount: new Prisma.Decimal(500),
          student: {
            id: 'student-1',
            firstNameEn: 'Asha',
            lastNameEn: 'Shrestha',
            studentSystemId: 'ST-001',
          },
          payments: [],
        },
      ]),
      count: jest.fn().mockResolvedValue(3),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'payment-1',
          amount: new Prisma.Decimal(200),
          method: PaymentMethod.CASH,
          paidAt: new Date('2026-06-27T05:00:00.000Z'),
          student: {
            id: 'student-1',
            firstNameEn: 'Asha',
            lastNameEn: 'Shrestha',
          },
          receipt: { receiptNumber: 'REC-001' },
          refunds: [],
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    receipt: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'receipt-1',
          receiptNumber: 'REC-001',
          issuedAt: new Date('2026-06-27T05:00:00.000Z'),
          fileAssetId: 'file-1',
          fileStatus: ReceiptFileStatus.AVAILABLE,
          paymentId: 'payment-1',
          payment: {
            amount: new Prisma.Decimal(200),
            method: PaymentMethod.CASH,
            invoice: { invoiceNumber: 'INV-001' },
            student: {
              id: 'student-1',
              firstNameEn: 'Asha',
              lastNameEn: 'Shrestha',
            },
            refunds: [],
          },
          reprintHistory: [],
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  const service = new FinanceService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

describe('FinanceService paginated list contracts', () => {
  it('paginates and searches invoices within the actor tenant', async () => {
    const { service, prisma } = createService();

    const result = await service.listInvoices(
      {
        page: 2,
        limit: 2,
        search: 'asha',
        status: InvoiceStatus.ISSUED,
        sortBy: 'dueDate',
        sortDirection: 'asc',
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        total: 3,
        page: 2,
        limit: 2,
        hasNextPage: false,
      }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          status: InvoiceStatus.ISSUED,
        }),
        skip: 2,
        take: 2,
      }),
    );
  });

  it('paginates payment filters without exposing another tenant', async () => {
    const { service, prisma } = createService();

    const result = await service.listPayments(
      {
        page: 1,
        limit: 10,
        status: PaymentStatus.SUCCESS,
        method: PaymentMethod.CASH,
      },
      actor,
    );

    expect(result.items).toHaveLength(1);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          status: PaymentStatus.SUCCESS,
          method: PaymentMethod.CASH,
        }),
        take: 10,
      }),
    );
  });

  it('returns protected receipt metadata with stable pagination', async () => {
    const { service, prisma } = createService();

    const result = await service.listReceipts(
      { page: 1, limit: 25, search: 'REC-001' },
      actor,
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        receiptNumber: 'REC-001',
        fileAssetId: 'file-1',
        fileStatus: ReceiptFileStatus.AVAILABLE,
      }),
    );
    expect(result.items[0]).not.toHaveProperty('pdfUrl');
    expect(prisma.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
        take: 25,
      }),
    );
  });
});
