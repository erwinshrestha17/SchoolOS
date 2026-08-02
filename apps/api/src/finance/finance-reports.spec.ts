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
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
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
        count: jest.fn().mockResolvedValue(1),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(1000) },
        }),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(200) },
        }),
      },
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue(null),
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

    expect(report.rows[0]?.netAmount).toBe('800.00');
    expect(report.summary.totalReceipts).toBe(1);

    // Report-wide money totals come from database aggregates over the whole
    // filtered set, not from summing the displayed page.
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ _sum: { amount: true } }),
    );
    expect(report.summary.totalAmount).toBe('1000.00');
    expect(report.summary.totalRefundedAmount).toBe('200.00');
    expect(report.summary.totalNetAmount).toBe('800.00');

    // Page totals stay separate and are labelled as such.
    expect(report.pageTotals).toEqual({
      rowCount: 1,
      amount: '1000.00',
      refundedAmount: '200.00',
      netAmount: '800.00',
    });

    // FEE-17 carries the same versioned envelope as FEE-01.
    expect(report.report).toEqual(
      expect.objectContaining({
        id: 'FEE-17',
        definitionVersion: '1.0',
        title: 'Receipt Register',
        classification: 'CONFIDENTIAL',
      }),
    );
    expect(report.fiscalContext.accountingBasis).toBe('CASH');
    expect(report.pagination).toEqual(
      expect.objectContaining({ page: 1, total: 1, totalPages: 1 }),
    );
  });

  it('returns paginated backend-owned unallocated payment balances with posting lineage', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            paymentId: 'payment-1',
            paymentDate: new Date('2026-07-01T00:00:00.000Z'),
            receiptNumber: 'REC-001',
            studentId: 'student-1',
            studentSystemId: 'ST-001',
            firstNameEn: 'Asha',
            lastNameEn: 'Shrestha',
            paymentMethod: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.SUCCESS,
            referenceNumber: null,
            originalAmount: new Prisma.Decimal('1500.00'),
            unallocatedBalance: new Prisma.Decimal('500.00'),
            isAdvance: true,
          },
        ])
        .mockResolvedValueOnce([
          { total: 1n, totalBalance: new Prisma.Decimal('500.00') },
        ]),
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'journal-1',
            sourceId: 'payment-1',
            entryNumber: 'JE-001',
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

    const report = await service.getUnallocatedPaymentReport(actor, {
      page: 1,
      limit: 25,
    });

    expect(report.rows[0]).toEqual(
      expect.objectContaining({
        paymentId: 'payment-1',
        unallocatedBalance: '500.00',
        balanceType: 'ADVANCE',
        postingStatus: 'POSTED',
        journalEntryNumber: 'JE-001',
      }),
    );
    expect(report.summary).toEqual({
      totalPayments: 1,
      totalUnallocatedAmount: '500.00',
      displayedUnallocatedAmount: '500.00',
    });
    expect(report.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
  });
  it('reports FEE-15 refund/reversal totals from aggregates, not from the fetched page', async () => {
    const prisma = {
      paymentRefund: {
        findMany: jest.fn().mockResolvedValue([]),
        // Report-wide: 40 refunds totalling 9,000 across every page.
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 40 },
          _sum: { amount: new Prisma.Decimal('9000.00') },
        }),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 10 },
          _sum: { amount: new Prisma.Decimal('1000.00') },
        }),
      },
      journalEntry: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalYear: { findFirst: jest.fn().mockResolvedValue(null) },
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

    const report = await service.getRefundReversalRegisterRows(actor, {
      page: 1,
      limit: 10,
    });

    // Counts and money are backend aggregates over the whole filtered set.
    expect(report.summary).toEqual({
      totalRecords: 50,
      refundCount: 40,
      reversalCount: 10,
      totalAmount: '10000.00',
    });
    expect(report.pagination).toEqual(
      expect.objectContaining({ total: 50, page: 1, limit: 10, totalPages: 5 }),
    );
    // Page totals describe only what was fetched.
    expect(report.pageTotals).toEqual({ rowCount: 0, amount: '0.00' });

    // Each source is bounded to skip+limit rather than scanning the tenant.
    expect(prisma.paymentRefund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );

    expect(report.report).toEqual(
      expect.objectContaining({ id: 'FEE-15', title: 'Refund Report' }),
    );
  });

  it('refuses refund-register deep paging beyond the bounded scan ceiling', async () => {
    const prisma = {
      paymentRefund: { findMany: jest.fn(), aggregate: jest.fn() },
      payment: { findMany: jest.fn(), aggregate: jest.fn() },
      journalEntry: { findMany: jest.fn() },
      fiscalYear: { findFirst: jest.fn() },
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

    await expect(
      service.getRefundReversalRegisterRows(actor, { page: 200, limit: 50 }),
    ).rejects.toThrow(/Narrow the date range/);
    expect(prisma.paymentRefund.findMany).not.toHaveBeenCalled();
  });
});
