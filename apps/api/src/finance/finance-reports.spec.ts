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
    expect(report.report).toEqual(
      expect.objectContaining({
        id: 'AR-06',
        title: 'Unallocated Payment Report',
      }),
    );
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

  it('drains every receipt-register page for export', async () => {
    const issuedAt = new Date('2026-07-01T00:00:00.000Z');
    const receiptRow = {
      receiptNumber: 'REC-001',
      issuedAt,
      studentSystemId: 'ST-001',
      studentName: 'Asha Shrestha',
      invoiceNumber: 'INV-001',
      amount: '1000.00',
      refundedAmount: '0.00',
      netAmount: '1000.00',
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.SUCCESS,
      cashierEmail: 'cashier@school.test',
      reprintCount: 0,
      latestReprintAt: null,
    };
    const envelope = {
      report: {
        id: 'FEE-17',
        definitionVersion: '1.0',
        title: 'Receipt Register',
        classification: 'CONFIDENTIAL',
      },
      fiscalContext: { accountingBasis: 'CASH' },
      pagination: { page: 1, limit: 500, total: 501, totalPages: 2 },
      summary: {
        totalReceipts: 501,
        displayedReceipts: 1,
        totalAmount: '2000.00',
        totalRefundedAmount: '0.00',
        totalNetAmount: '2000.00',
      },
      pageTotals: {
        rowCount: 1,
        amount: '1000.00',
        refundedAmount: '0.00',
        netAmount: '1000.00',
      },
    };

    const prisma = {
      receipt: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal('2000.00') },
        }),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(0) },
        }),
      },
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

    jest
      .spyOn(service, 'getReceiptRegisterRows')
      .mockResolvedValueOnce({
        ...envelope,
        rows: [receiptRow],
        pagination: { total: 501, page: 1, limit: 500, totalPages: 2 },
      } as never)
      .mockResolvedValueOnce({
        ...envelope,
        rows: [{ ...receiptRow, receiptNumber: 'REC-002' }],
        pagination: { total: 501, page: 2, limit: 500, totalPages: 2 },
      } as never);

    const exported = await service.getReceiptRegisterExport(actor, {});

    expect(service.getReceiptRegisterRows).toHaveBeenCalledTimes(2);
    expect(exported.rows).toHaveLength(2);
    expect(exported.rows.map((row) => row.receiptNumber)).toEqual([
      'REC-001',
      'REC-002',
    ]);
    expect(exported.pageTotals.rowCount).toBe(2);
    expect(exported.pageTotals.amount).toBe('2000.00');
  });

  it('refuses receipt-register export above the row ceiling', async () => {
    const service = new FinanceService(
      {
        receipt: { findMany: jest.fn(), count: jest.fn() },
        payment: { aggregate: jest.fn() },
        paymentRefund: { aggregate: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service, 'getReceiptRegisterRows').mockResolvedValueOnce({
      rows: [],
      pagination: { total: 10001, page: 1, limit: 500, totalPages: 21 },
      summary: {
        totalReceipts: 10001,
        displayedReceipts: 0,
        totalAmount: '0.00',
        totalRefundedAmount: '0.00',
        totalNetAmount: '0.00',
      },
    } as never);

    await expect(service.getReceiptRegisterExport(actor, {})).rejects.toThrow(
      /export limit/,
    );
    expect(service.getReceiptRegisterRows).toHaveBeenCalledTimes(1);
  });

  it('drains every refund-register page for export', async () => {
    const processedAt = new Date('2026-07-01T00:00:00.000Z');
    const row = {
      recordType: 'REFUND' as const,
      recordNumber: 'REF-001',
      originalReceiptNumber: 'REC-001',
      originalPaymentId: 'pay-1',
      invoiceNumber: 'INV-001',
      studentSystemId: 'ST-001',
      studentName: 'Asha Shrestha',
      amount: '500.00',
      reason: 'Overpayment',
      processedAt,
      requestedByEmail: 'cashier@school.test',
      approvedByEmail: 'accountant@school.test',
      journalEntryNumber: 'JE-001',
      reversalOfJournalEntryNumber: null,
      status: 'COMPLETED',
    };
    const envelope = {
      report: { id: 'FEE-15', title: 'Refund Report' },
      summary: {
        totalRecords: 51,
        refundCount: 51,
        reversalCount: 0,
        totalAmount: '1000.00',
      },
      pageTotals: { rowCount: 1, amount: '500.00' },
      pagination: { total: 51, page: 1, limit: 50, totalPages: 2 },
    };

    const service = new FinanceService(
      {
        paymentRefund: { findMany: jest.fn(), aggregate: jest.fn() },
        payment: { findMany: jest.fn(), aggregate: jest.fn() },
        journalEntry: { findMany: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest
      .spyOn(service, 'getRefundReversalRegisterRows')
      .mockResolvedValueOnce({
        ...envelope,
        rows: [row],
      } as never)
      .mockResolvedValueOnce({
        ...envelope,
        rows: [{ ...row, recordNumber: 'REF-002' }],
        pagination: { total: 51, page: 2, limit: 50, totalPages: 2 },
      } as never);

    const exported = await service.getRefundReversalRegisterExport(actor, {});

    expect(service.getRefundReversalRegisterRows).toHaveBeenCalledTimes(2);
    expect(exported.rows).toHaveLength(2);
    expect(exported.pageTotals.amount).toBe('1000.00');
  });

  it('refuses refund-register export above the scan ceiling', async () => {
    const service = new FinanceService(
      {
        paymentRefund: { findMany: jest.fn(), aggregate: jest.fn() },
        payment: { findMany: jest.fn(), aggregate: jest.fn() },
        journalEntry: { findMany: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service, 'getRefundReversalRegisterRows').mockResolvedValueOnce({
      rows: [],
      summary: {
        totalRecords: 5001,
        refundCount: 5001,
        reversalCount: 0,
        totalAmount: '0.00',
      },
      pagination: { total: 5001, page: 1, limit: 50, totalPages: 101 },
    } as never);

    await expect(
      service.getRefundReversalRegisterExport(actor, {}),
    ).rejects.toThrow(/export limit/);
  });

  it('drains every invoice-register page for export', async () => {
    const issuedAt = new Date('2026-07-01T00:00:00.000Z');
    const invoiceRow = {
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-001',
      studentSystemId: 'ST-001',
      studentName: 'Asha Shrestha',
      className: 'Grade 10',
      sectionName: 'A',
      billingPeriod: '2026',
      feeHeadNames: 'Tuition',
      grossAmount: '3500.00',
      discountAmount: '0.00',
      netAmount: '3500.00',
      paidAmount: '3500.00',
      balanceAmount: '0.00',
      dueDate: issuedAt,
      issuedAt,
      status: 'PAID' as const,
      journalEntryId: null,
      journalEntryNumber: null,
      postingStatus: 'PENDING' as const,
    };
    const envelope = {
      report: { id: 'AR-01', title: 'Student Invoice Register' },
      summary: {
        totalInvoices: 501,
        displayedInvoices: 1,
        totalGrossAmount: '7000.00',
        totalNetAmount: '7000.00',
        totalPaidAmount: '5000.00',
        totalBalanceAmount: '2000.00',
      },
      pagination: { total: 501, page: 1, limit: 500, totalPages: 2 },
    };

    const service = new FinanceService(
      {
        invoice: { findMany: jest.fn(), count: jest.fn() },
        journalEntry: { findMany: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest
      .spyOn(service, 'getInvoiceRegisterRows')
      .mockResolvedValueOnce({
        ...envelope,
        rows: [invoiceRow],
      } as never)
      .mockResolvedValueOnce({
        ...envelope,
        rows: [{ ...invoiceRow, invoiceNumber: 'INV-002' }],
        pagination: { total: 501, page: 2, limit: 500, totalPages: 2 },
      } as never);

    const exported = await service.getInvoiceRegisterExport(actor, {});

    expect(service.getInvoiceRegisterRows).toHaveBeenCalledTimes(2);
    expect(exported.rows).toHaveLength(2);
    expect(exported.pageTotals.netAmount).toBe('7000.00');
  });

  it('refuses invoice-register export above the row ceiling', async () => {
    const service = new FinanceService(
      {
        invoice: { findMany: jest.fn(), count: jest.fn() },
        journalEntry: { findMany: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service, 'getInvoiceRegisterRows').mockResolvedValueOnce({
      rows: [],
      pagination: { total: 10001, page: 1, limit: 500, totalPages: 21 },
      summary: {
        totalInvoices: 10001,
        displayedInvoices: 0,
        totalGrossAmount: '0.00',
        totalNetAmount: '0.00',
        totalPaidAmount: '0.00',
        totalBalanceAmount: '0.00',
      },
    } as never);

    await expect(service.getInvoiceRegisterExport(actor, {})).rejects.toThrow(
      /export limit/,
    );
  });

  it('drains every unallocated-payment page for export', async () => {
    const row = {
      paymentId: 'pay-1',
      paymentDate: '2026-07-01T00:00:00.000Z',
      receiptNumber: 'REC-001',
      studentId: 'student-1',
      studentSystemId: 'ST-001',
      studentName: 'Asha Shrestha',
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.SUCCESS,
      referenceNumber: null,
      originalAmount: '1500.00',
      unallocatedBalance: '500.00',
      balanceType: 'ADVANCE' as const,
      journalEntryId: null,
      journalEntryNumber: 'JE-001',
      postingStatus: 'POSTED' as const,
    };
    const envelope = {
      report: { id: 'AR-06', title: 'Unallocated Payment Report' },
      summary: {
        totalPayments: 501,
        totalUnallocatedAmount: '1000.00',
        displayedUnallocatedAmount: '500.00',
      },
      pagination: { total: 501, page: 1, limit: 500, totalPages: 2 },
    };

    const service = new FinanceService(
      {
        $queryRaw: jest.fn(),
        journalEntry: { findMany: jest.fn() },
        fiscalYear: { findFirst: jest.fn() },
      } as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest
      .spyOn(service, 'getUnallocatedPaymentReport')
      .mockResolvedValueOnce({
        ...envelope,
        rows: [row],
      } as never)
      .mockResolvedValueOnce({
        ...envelope,
        rows: [{ ...row, paymentId: 'pay-2' }],
        pagination: { total: 501, page: 2, limit: 500, totalPages: 2 },
      } as never);

    const exported = await service.getUnallocatedPaymentExport(actor, {});

    expect(service.getUnallocatedPaymentReport).toHaveBeenCalledTimes(2);
    expect(exported.rows).toHaveLength(2);
    expect(exported.pageTotals.unallocatedAmount).toBe('1000.00');
  });
});
