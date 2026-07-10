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

  it('paginates the backend ledger projection without recalculating running balances in the browser', async () => {
    const { service } = createService();
    jest.spyOn(service, 'getStudentFeeLedger').mockResolvedValue({
      student: {
        id: 'student-1',
        studentSystemId: 'ST-001',
        name: 'Asha Shrestha',
        className: 'Grade 5',
        sectionName: 'A',
        guardianName: null,
        guardianPhone: null,
      },
      openingBalance: 0,
      totalInvoiced: 1000,
      totalPaid: 500,
      totalWaived: 0,
      totalRefunded: 0,
      outstandingBalance: 500,
      rows: [
        {
          id: 'invoice:1',
          date: new Date('2026-06-01T00:00:00.000Z'),
          type: 'INVOICE',
          reference: 'INV-001',
          description: 'Invoice INV-001',
          debit: 1000,
          credit: 0,
          runningBalance: 1000,
          affectsBalance: true,
          invoiceId: 'invoice-1',
          invoiceNumber: 'INV-001',
          paymentId: null,
          receiptNumber: null,
          status: 'ISSUED',
        },
        {
          id: 'payment:1',
          date: new Date('2026-06-02T00:00:00.000Z'),
          type: 'PAYMENT',
          reference: 'REC-001',
          description: 'Cash payment',
          debit: 0,
          credit: 500,
          runningBalance: 500,
          affectsBalance: true,
          invoiceId: 'invoice-1',
          invoiceNumber: 'INV-001',
          paymentId: 'payment-1',
          receiptNumber: 'REC-001',
          status: 'SUCCESS',
        },
      ],
    } as never);

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
      }),
    );
    expect(result.rows[0]).toEqual(
      expect.objectContaining({ type: 'PAYMENT', runningBalance: 500 }),
    );
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
