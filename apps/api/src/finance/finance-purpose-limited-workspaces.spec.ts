import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, PaymentMethod, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@school.test',
  roles: ['accountant'],
  permissions: ['payments:collect', 'ledger:read', 'fees:manage'],
  authMethod: AuthMethod.PASSWORD,
};

function createService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    $queryRaw: jest.fn(),
    student: { findMany: jest.fn() },
    ...prismaOverrides,
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

describe('FinanceService purpose-limited M3 workspaces', () => {
  it('returns bounded tenant-scoped collection candidates with backend outstanding totals', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'student-1',
        studentSystemId: 'ST-001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        className: 'Grade 5',
        sectionName: 'A',
        guardianName: 'Maya Shrestha',
        guardianPhone: '9800000000',
        openInvoiceCount: 2n,
        totalOutstanding: new Prisma.Decimal('1250.50'),
      },
    ]);

    const result = await service.searchCollectionStudents('Asha', actor);

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'student-1',
        openInvoiceCount: 2,
        totalOutstanding: '1250.50',
      }),
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps ledger student discovery bounded and tenant scoped', async () => {
    const { service, prisma } = createService();
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        studentSystemId: 'ST-001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        class: { name: 'Grade 5' },
        sectionRef: { name: 'A' },
        guardianLinks: [],
        _count: { invoices: 3 },
      },
    ]);

    const result = await service.searchLedgerStudents('ST-001', actor);

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'student-1', invoiceCount: 3 }),
    );
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
        take: 20,
      }),
    );
  });

  it('projects the ledger page from the database without recomputing balances in JS', async () => {
    // The SQL itself is proven against real Postgres in
    // test/student-fee-ledger-projection.int-spec.ts. This asserts the mapping
    // layer: decimal strings, backend-owned running balances passed through
    // untouched, and page totals kept separate from window totals.
    const { service, prisma } = createService({
      student: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'student-1',
          studentSystemId: 'ST-001',
          firstNameEn: 'Asha',
          lastNameEn: 'Shrestha',
          class: { name: 'Grade 5' },
          sectionRef: { name: 'A' },
          guardianLinks: [],
        }),
      },
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fy-1',
          name: 'FY 2082/83',
          periods: [{ id: 'fp-1', label: 'Shrawan 2082' }],
        }),
      },
    });
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          eventId: 'payment:1',
          eventDate: new Date('2026-06-02T00:00:00.000Z'),
          eventType: 'PAYMENT',
          reference: 'REC-001',
          description: 'CASH allocation for INV-001',
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('500'),
          runningBalance: new Prisma.Decimal('500'),
          affectsBalance: true,
          invoiceId: 'invoice-1',
          invoiceNumber: 'INV-001',
          paymentId: 'payment-1',
          receiptNumber: 'REC-001',
          status: 'SUCCESS',
        },
      ])
      .mockResolvedValueOnce([
        {
          total: 1n,
          openingBalance: new Prisma.Decimal('0'),
          windowDebit: new Prisma.Decimal('0'),
          windowCredit: new Prisma.Decimal('500'),
        },
      ])
      .mockResolvedValueOnce([
        {
          totalInvoiced: new Prisma.Decimal('1000'),
          totalPaid: new Prisma.Decimal('500'),
          totalRefunded: new Prisma.Decimal('0'),
          totalWaived: new Prisma.Decimal('0'),
        },
      ]);

    const result = await service.getStudentFeeLedgerPage(
      'student-1',
      { page: 1, limit: 1, transactionType: 'PAYMENT' },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        total: 1,
        page: 1,
        limit: 1,
        hasNextPage: false,
        outstandingBalance: '500.00',
      }),
    );
    expect(result.rows[0]).toEqual(
      expect.objectContaining({ type: 'PAYMENT', runningBalance: '500.00' }),
    );
    // Versioned report metadata envelope (FEE-01).
    expect(result.report).toEqual({
      id: 'FEE-01',
      definitionVersion: '1.0',
      title: 'Student Fee Ledger',
      family: 'FEE',
      ownerModule: 'M3',
      classification: 'CONFIDENTIAL',
      requiresProfessionalVerification: false,
      professionalVerificationStatus: 'NOT_REQUIRED',
    });
    expect(result.fiscalContext).toEqual({
      fiscalYearId: 'fy-1',
      fiscalYearLabel: 'FY 2082/83',
      fiscalPeriodId: 'fp-1',
      fiscalPeriodLabel: 'Shrawan 2082',
      accountingBasis: 'ACCRUAL',
      postingBasis: 'POSTED_WITH_PENDING_DISCLOSED',
    });
    expect(result.validation).toEqual({ status: 'VALID', warnings: [] });
    expect(result.sourceFreshness).toEqual([
      { module: 'M3', refreshedAt: result.generatedAt, includesPending: true },
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    // Normalized filters are sorted and drop undefined entries.
    expect(Object.keys(result.normalizedFilters)).toEqual([
      'academicYearId',
      'fromDate',
      'invoiceStatus',
      'sortDirection',
      'studentId',
      'toDate',
      'transactionType',
    ]);
    expect(result.totals.outstandingBalance).toBe('500.00');
    expect(result.rows[0].drilldown).toEqual({
      kind: 'SOURCE_RECORD',
      id: 'payment-1',
      route: '/dashboard/fees/payments/payment-1',
    });

    expect(result.pageTotals).toEqual({
      rowCount: 1,
      debit: '0.00',
      credit: '500.00',
    });
    expect(result.windowTotals).toEqual({
      rowCount: 1,
      debit: '0.00',
      credit: '500.00',
    });
    // Paging and filtering are pushed into SQL, not applied in the process.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('returns Decimal-safe payment-method totals for the requested Nepal date range', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw.mockResolvedValue([
      {
        method: PaymentMethod.CASH,
        paymentCount: 4n,
        refundCount: 1n,
        grossAmount: new Prisma.Decimal('2000'),
        refundedAmount: new Prisma.Decimal('250'),
        netAmount: new Prisma.Decimal('1750'),
      },
    ]);

    const result = await service.getPaymentMethodReport(actor, {
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });

    expect(result.rows[0]).toEqual({
      method: PaymentMethod.CASH,
      paymentCount: 4,
      refundCount: 1,
      grossAmount: '2000.00',
      refundedAmount: '250.00',
      netAmount: '1750.00',
    });
    expect(result.period).toEqual({
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      timeZone: 'Asia/Kathmandu',
    });
  });

  it('fails closed when the purpose-limited permission is missing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.searchCollectionStudents('Asha', {
        ...actor,
        permissions: ['ledger:read'],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
