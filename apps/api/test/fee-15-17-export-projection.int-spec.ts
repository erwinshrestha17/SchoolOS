import 'dotenv/config';
import { ClsService } from 'nestjs-cls';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import { FinanceService } from '../src/finance/finance.service';
import type { AuthContext } from '../src/auth/auth.types';

/**
 * Real-database proof that FEE-15 and FEE-17 export drains reuse the same
 * enveloped projections the screen renders.
 *
 * Run with: pnpm --filter @schoolos/api test:integration -- fee-15-17-export-projection
 */

class FakeCls {
  private readonly store = new Map<string, unknown>();

  setTenant(tenantId: string | undefined) {
    this.store.set(TENANT_ID_KEY, tenantId);
  }

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, value: unknown) {
    this.store.set(key, value);
  }

  isActive() {
    return true;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

const SUFFIX = `fee1517-int-${Date.now()}`;

describe('FEE-15 / FEE-17 export projection parity (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let service: FinanceService;
  let tenantId: string;
  let studentId: string;
  let actor: AuthContext;

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);
    service = new FinanceService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    cls.setTenant(undefined);
    const tenant = await prisma.tenant.create({
      data: { name: `FEE1517 Tenant ${SUFFIX}`, slug: `fee1517-${SUFFIX}` },
    });
    tenantId = tenant.id;

    actor = {
      tenantId,
      tenantSlug: `fee1517-${SUFFIX}`,
      userId: `user-${SUFFIX}`,
      email: 'accountant@school.test',
      roles: ['accountant'],
      permissions: ['receipts:read', 'ledger:read'],
      authMethod: 'PASSWORD',
    } as AuthContext;

    cls.setTenant(tenantId);
    const classroom = await prisma.class.create({
      data: {
        tenantId,
        name: `Grade 10 ${SUFFIX}`,
        level: 10,
      },
    });
    const academicYear = await prisma.academicYear.create({
      data: {
        tenantId,
        name: `AY ${SUFFIX}`,
        startsOn: new Date('2026-04-01T00:00:00.000Z'),
        endsOn: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    const student = await prisma.student.create({
      data: {
        tenantId,
        studentSystemId: `ST-${SUFFIX}`,
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        dateOfBirth: new Date('2012-05-04T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2020-04-01T00:00:00.000Z'),
        classId: classroom.id,
      },
    });
    studentId = student.id;

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        studentId,
        academicYearId: academicYear.id,
        invoiceNumber: `INV-${SUFFIX}`,
        dueDate: new Date('2026-07-01T00:00:00.000Z'),
        issuedAt: new Date('2026-07-01T00:00:00.000Z'),
        subtotal: new Prisma.Decimal('5000.00'),
        vatAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal('5000.00'),
      },
    });

    const payment1 = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice.id,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        amount: new Prisma.Decimal('3000.00'),
        paidAt: new Date('2026-07-05T04:00:00.000Z'),
      },
    });
    await prisma.receipt.create({
      data: {
        tenantId,
        paymentId: payment1.id,
        receiptNumber: `RCP-A-${SUFFIX}`,
        issuedAt: new Date('2026-07-05T04:00:00.000Z'),
      },
    });
    await prisma.paymentRefund.create({
      data: {
        tenantId,
        paymentId: payment1.id,
        refundNumber: `REF-A-${SUFFIX}`,
        amount: new Prisma.Decimal('500.00'),
        refundDate: new Date('2026-07-10T04:00:00.000Z'),
        reason: 'Partial refund',
      },
    });

    const payment2 = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice.id,
        method: PaymentMethod.BANK,
        status: PaymentStatus.SUCCESS,
        amount: new Prisma.Decimal('2000.00'),
        paidAt: new Date('2026-07-08T04:00:00.000Z'),
      },
    });
    await prisma.receipt.create({
      data: {
        tenantId,
        paymentId: payment2.id,
        receiptNumber: `RCP-B-${SUFFIX}`,
        issuedAt: new Date('2026-07-08T04:00:00.000Z'),
      },
    });

    const payment3 = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice.id,
        method: PaymentMethod.CASH,
        status: PaymentStatus.REVERSED,
        amount: new Prisma.Decimal('1000.00'),
        paidAt: new Date('2026-07-12T04:00:00.000Z'),
        reversedAt: new Date('2026-07-15T04:00:00.000Z'),
        reversalReason: 'Duplicate collection',
      },
    });
    await prisma.receipt.create({
      data: {
        tenantId,
        paymentId: payment3.id,
        receiptNumber: `RCP-C-${SUFFIX}`,
        issuedAt: new Date('2026-07-12T04:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('test teardown', async () => {
      await prisma.paymentRefund.deleteMany({ where: { tenantId } });
      await prisma.receipt.deleteMany({ where: { tenantId } });
      await prisma.payment.deleteMany({ where: { tenantId } });
      await prisma.invoice.deleteMany({ where: { tenantId } });
      await prisma.student.deleteMany({ where: { tenantId } });
      await prisma.academicYear.deleteMany({ where: { tenantId } });
      await prisma.class.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  beforeEach(() => cls.setTenant(tenantId));

  it('FEE-17 export drain matches every paged screen row and summary totals', async () => {
    const filters = {
      studentId,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    };

    const screenPage1 = await service.getReceiptRegisterRows(actor, {
      ...filters,
      page: 1,
      limit: 1,
    });
    const screenPage2 = await service.getReceiptRegisterRows(actor, {
      ...filters,
      page: 2,
      limit: 1,
    });
    const screenPage3 = await service.getReceiptRegisterRows(actor, {
      ...filters,
      page: 3,
      limit: 1,
    });
    const screenRows = [
      ...screenPage1.rows,
      ...screenPage2.rows,
      ...screenPage3.rows,
    ];

    const exported = await service.getReceiptRegisterExport(actor, filters);

    expect(exported.report.id).toBe('FEE-17');
    expect(exported.rows).toHaveLength(screenPage1.summary.totalReceipts);
    expect(exported.rows.map((row) => row.receiptNumber)).toEqual(
      screenRows.map((row) => row.receiptNumber),
    );
    expect(exported.summary.totalAmount).toBe(screenPage1.summary.totalAmount);
    expect(exported.summary.totalRefundedAmount).toBe(
      screenPage1.summary.totalRefundedAmount,
    );
    expect(exported.summary.totalNetAmount).toBe(
      screenPage1.summary.totalNetAmount,
    );

    const executeTotals = {
      rowCount: String(screenPage1.summary.totalReceipts),
      totalAmount: screenPage1.summary.totalAmount,
      totalRefundedAmount: screenPage1.summary.totalRefundedAmount,
      totalNetAmount: screenPage1.summary.totalNetAmount,
    };
    expect(String(exported.rows.length)).toBe(executeTotals.rowCount);
    expect(exported.summary.totalAmount).toBe(executeTotals.totalAmount);
    expect(exported.pageTotals.rowCount).toBe(exported.rows.length);
  });

  it('FEE-15 export drain matches every paged screen row and summary totals', async () => {
    const filters = {
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    };

    const screenPage1 = await service.getRefundReversalRegisterRows(actor, {
      ...filters,
      page: 1,
      limit: 1,
    });
    const screenPage2 = await service.getRefundReversalRegisterRows(actor, {
      ...filters,
      page: 2,
      limit: 1,
    });
    const screenRows = [...screenPage1.rows, ...screenPage2.rows];

    const exported = await service.getRefundReversalRegisterExport(
      actor,
      filters,
    );

    expect(exported.report.id).toBe('FEE-15');
    expect(exported.rows).toHaveLength(screenPage1.summary.totalRecords);
    expect(exported.rows.map((row) => row.recordNumber)).toEqual(
      screenRows.map((row) => row.recordNumber),
    );
    expect(exported.summary.totalAmount).toBe(screenPage1.summary.totalAmount);
    expect(exported.summary.refundCount).toBe(screenPage1.summary.refundCount);
    expect(exported.summary.reversalCount).toBe(
      screenPage1.summary.reversalCount,
    );

    const executeTotals = {
      rowCount: String(screenPage1.summary.totalRecords),
      refundCount: String(screenPage1.summary.refundCount),
      reversalCount: String(screenPage1.summary.reversalCount),
      totalAmount: screenPage1.summary.totalAmount,
    };
    expect(String(exported.rows.length)).toBe(executeTotals.rowCount);
    expect(String(exported.summary.refundCount)).toBe(
      executeTotals.refundCount,
    );
    expect(String(exported.summary.reversalCount)).toBe(
      executeTotals.reversalCount,
    );
    expect(exported.summary.totalAmount).toBe(executeTotals.totalAmount);
    expect(exported.pageTotals.rowCount).toBe(exported.rows.length);
  });
});
