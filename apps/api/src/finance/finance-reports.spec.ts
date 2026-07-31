import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'finance@school.test',
  roles: ['accountant'],
  permissions: ['fees:manage', 'receipts:read', 'ledger:read'],
  authMethod: 'PASSWORD' as AuthContext['authMethod'],
};

function createService(receipts: Array<Record<string, unknown>>) {
  const prisma = {
    receipt: {
      findMany: jest.fn().mockResolvedValue(receipts),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    paymentRefund: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    journalEntry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  return {
    service: new FinanceService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ),
    prisma,
  };
}

describe('FinanceService P0 report helpers', () => {
  it('detects missing receipt sequence numbers in a fiscal year', async () => {
    const { service } = createService([
      {
        receiptNumber: 'REC-2025-2026-00001',
        fiscalYear: '2025/2026',
        issuedAt: new Date('2026-07-01T00:00:00.000Z'),
        payment: { status: PaymentStatus.SUCCESS },
      },
      {
        receiptNumber: 'REC-2025-2026-00003',
        fiscalYear: '2025/2026',
        issuedAt: new Date('2026-07-02T00:00:00.000Z'),
        payment: { status: PaymentStatus.SUCCESS },
      },
    ]);

    const report = await service.getReceiptSequenceExceptions(actor, {
      fiscalYear: '2025/2026',
    });

    expect(
      report.rows.some(
        (row) =>
          row.exceptionType === 'MISSING_SEQUENCE' &&
          row.expectedSequence === 2,
      ),
    ).toBe(true);
  });

  it('flags reversed payments in the receipt sequence exception report', async () => {
    const { service } = createService([
      {
        receiptNumber: 'REC-2025-2026-00001',
        fiscalYear: '2025/2026',
        issuedAt: new Date('2026-07-01T00:00:00.000Z'),
        payment: { status: PaymentStatus.REVERSED },
      },
    ]);

    const report = await service.getReceiptSequenceExceptions(actor, {});

    expect(
      report.rows.some((row) => row.exceptionType === 'REVERSED_PAYMENT'),
    ).toBe(true);
  });

  it('builds receipt register rows with net amounts after refunds', async () => {
    const prisma = {
      receipt: {
        findMany: jest.fn().mockResolvedValue([
          {
            receiptNumber: 'REC-2025-2026-00001',
            issuedAt: new Date('2026-07-01T00:00:00.000Z'),
            payment: {
              amount: new Prisma.Decimal(1000),
              method: PaymentMethod.CASH,
              status: PaymentStatus.SUCCESS,
              invoice: { invoiceNumber: 'INV-001' },
              student: {
                studentSystemId: 'ST-001',
                firstNameEn: 'Asha',
                lastNameEn: 'Shrestha',
              },
              collectedBy: { email: 'cashier@school.test' },
              refunds: [{ amount: new Prisma.Decimal(200) }],
            },
            reprintHistory: [],
            _count: { reprintHistory: 1 },
          },
        ]),
      },
    };

    const service = new FinanceService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const report = await service.getReceiptRegisterRows(actor, {});

    expect(report.rows[0]?.netAmount).toBe(800);
    expect(report.summary.totalReceipts).toBe(1);
  });
});
