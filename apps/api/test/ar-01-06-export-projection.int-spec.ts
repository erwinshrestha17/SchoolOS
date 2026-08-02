import 'dotenv/config';
import { ClsService } from 'nestjs-cls';
import {
  FeeFrequency,
  InvoiceStatus,
  PaymentAllocationType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import { FinanceService } from '../src/finance/finance.service';
import type { AuthContext } from '../src/auth/auth.types';

/**
 * Real-database proof that AR-01 and AR-06 export drains reuse the same
 * enveloped projections the screen renders.
 *
 * Run with: pnpm --filter @schoolos/api test:integration -- ar-01-06-export-projection
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

const SUFFIX = `ar0106-int-${Date.now()}`;

describe('AR-01 / AR-06 export projection parity (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let service: FinanceService;
  let tenantId: string;
  let studentId: string;
  let academicYearId: string;
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
      data: { name: `AR0106 Tenant ${SUFFIX}`, slug: `ar0106-${SUFFIX}` },
    });
    tenantId = tenant.id;

    actor = {
      tenantId,
      tenantSlug: `ar0106-${SUFFIX}`,
      userId: `user-${SUFFIX}`,
      email: 'accountant@school.test',
      roles: ['accountant'],
      permissions: ['ledger:read', 'accounting:reports:read', 'fees:manage'],
      authMethod: 'PASSWORD',
    } as AuthContext;

    cls.setTenant(tenantId);
    const classroom = await prisma.class.create({
      data: { tenantId, name: `Grade 10 ${SUFFIX}`, level: 10 },
    });
    const academicYear = await prisma.academicYear.create({
      data: {
        tenantId,
        name: `AY ${SUFFIX}`,
        startsOn: new Date('2026-04-01T00:00:00.000Z'),
        endsOn: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    academicYearId = academicYear.id;
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

    const tuition = await prisma.feeHead.create({
      data: {
        tenantId,
        name: `Tuition ${SUFFIX}`,
        code: `TUI-${SUFFIX}`,
        frequency: FeeFrequency.ANNUAL,
        defaultAmount: new Prisma.Decimal('5000.00'),
      },
    });

    for (const [index, invoiceNumber] of [
      `INV-A-${SUFFIX}`,
      `INV-B-${SUFFIX}`,
    ].entries()) {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId,
          studentId,
          academicYearId,
          invoiceNumber,
          dueDate: new Date(`2026-07-${10 + index}T00:00:00.000Z`),
          issuedAt: new Date(`2026-07-${10 + index}T00:00:00.000Z`),
          status: InvoiceStatus.PARTIAL,
          subtotal: new Prisma.Decimal('5000.00'),
          vatAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal('5000.00'),
        },
      });
      await prisma.invoiceLine.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          feeHeadId: tuition.id,
          description: 'Tuition',
          quantity: 1,
          unitAmount: new Prisma.Decimal('5000.00'),
          vatAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal('5000.00'),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          tenantId,
          studentId,
          invoiceId: invoice.id,
          method: PaymentMethod.CASH,
          status: PaymentStatus.SUCCESS,
          amount: new Prisma.Decimal('2000.00'),
          paidAt: new Date(`2026-07-${12 + index}T00:00:00.000Z`),
        },
      });
      await prisma.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: new Prisma.Decimal('2000.00'),
          allocationType: PaymentAllocationType.INVOICE,
          allocatedAt: new Date(`2026-07-${12 + index}T00:00:00.000Z`),
        },
      });
    }

    const advancePayment = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        amount: new Prisma.Decimal('1500.00'),
        paidAt: new Date('2026-07-20T00:00:00.000Z'),
        isAdvance: true,
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        tenantId,
        paymentId: advancePayment.id,
        invoiceId: null,
        amount: new Prisma.Decimal('800.00'),
        allocationType: PaymentAllocationType.ADVANCE,
        allocatedAt: new Date('2026-07-20T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('test teardown', async () => {
      await prisma.paymentAllocation.deleteMany({ where: { tenantId } });
      await prisma.payment.deleteMany({ where: { tenantId } });
      await prisma.invoiceLine.deleteMany({ where: { tenantId } });
      await prisma.invoice.deleteMany({ where: { tenantId } });
      await prisma.feeHead.deleteMany({ where: { tenantId } });
      await prisma.student.deleteMany({ where: { tenantId } });
      await prisma.academicYear.deleteMany({ where: { tenantId } });
      await prisma.class.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  beforeEach(() => cls.setTenant(tenantId));

  it('AR-01 export drain matches every paged screen row and summary totals', async () => {
    const filters = { studentId };

    const screenPage1 = await service.getInvoiceRegisterRows(actor, {
      ...filters,
      page: 1,
      limit: 1,
    });
    const screenPage2 = await service.getInvoiceRegisterRows(actor, {
      ...filters,
      page: 2,
      limit: 1,
    });
    const screenRows = [...screenPage1.rows, ...screenPage2.rows];

    const exported = await service.getInvoiceRegisterExport(actor, filters);

    expect(exported.report.id).toBe('AR-01');
    expect(exported.rows).toHaveLength(screenPage1.summary.totalInvoices);
    expect(exported.rows.map((row) => row.invoiceNumber)).toEqual(
      screenRows.map((row) => row.invoiceNumber),
    );
    expect(exported.summary.totalNetAmount).toBe(
      screenPage1.summary.totalNetAmount,
    );
    expect(exported.summary.totalPaidAmount).toBe(
      screenPage1.summary.totalPaidAmount,
    );

    const executeTotals = {
      rowCount: String(screenPage1.summary.totalInvoices),
      totalNetAmount: screenPage1.summary.totalNetAmount,
      totalPaidAmount: screenPage1.summary.totalPaidAmount,
    };
    expect(String(exported.rows.length)).toBe(executeTotals.rowCount);
    expect(exported.summary.totalNetAmount).toBe(executeTotals.totalNetAmount);
    expect(exported.pageTotals.rowCount).toBe(exported.rows.length);
  });

  it('AR-06 export drain matches the screen row and summary totals', async () => {
    const screen = await service.getUnallocatedPaymentReport(actor, {
      page: 1,
      limit: 25,
    });
    const exported = await service.getUnallocatedPaymentExport(actor, {});

    expect(exported.report.id).toBe('AR-06');
    expect(exported.rows).toHaveLength(screen.summary.totalPayments);
    expect(exported.rows[0]?.unallocatedBalance).toBe(
      screen.rows[0]?.unallocatedBalance,
    );
    expect(exported.summary.totalUnallocatedAmount).toBe(
      screen.summary.totalUnallocatedAmount,
    );

    const executeTotals = {
      rowCount: String(screen.summary.totalPayments),
      totalUnallocatedAmount: screen.summary.totalUnallocatedAmount,
    };
    expect(String(exported.rows.length)).toBe(executeTotals.rowCount);
    expect(exported.summary.totalUnallocatedAmount).toBe(
      executeTotals.totalUnallocatedAmount,
    );
    expect(exported.pageTotals.rowCount).toBe(exported.rows.length);
  });
});
