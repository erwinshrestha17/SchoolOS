import 'dotenv/config';
import { ClsService } from 'nestjs-cls';
import {
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
 * Real-database proof of the bounded student fee-ledger projection.
 *
 * `getStudentFeeLedgerPage` is raw SQL: a UNION ALL event stream, a window
 * function for the running balance, and LIMIT/OFFSET paging. Every other
 * finance suite maps `@prisma/client` to `test/mocks/prisma-client.ts`, so a
 * mocked `$queryRaw` would assert nothing about the SQL that actually runs.
 *
 * The strongest available check is parity: the in-process full-ledger
 * projection (`getStudentFeeLedger`) and the SQL projection must agree row for
 * row, including running balances, over the same fixture.
 *
 * Requires the local database (docker compose: schoolos_postgres on 5433).
 * Run with: pnpm --filter @schoolos/api test:integration
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

const SUFFIX = `ledger-int-${Date.now()}`;

describe('Student fee ledger bounded projection (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let service: FinanceService;
  let tenantId: string;
  let otherTenantId: string;
  let studentId: string;
  let otherStudentId: string;
  let actor: AuthContext;
  let otherTenantActor: AuthContext;

  async function seedStudent(ownerTenantId: string, label: string) {
    const classroom = await prisma.class.create({
      data: { tenantId: ownerTenantId, name: `Grade ${label} ${SUFFIX}`, level: 1 },
    });
    const academicYear = await prisma.academicYear.create({
      data: {
        tenantId: ownerTenantId,
        name: `AY ${label} ${SUFFIX}`,
        startsOn: new Date('2026-04-01T00:00:00.000Z'),
        endsOn: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    const student = await prisma.student.create({
      data: {
        tenantId: ownerTenantId,
        studentSystemId: `SID-${label}-${SUFFIX}`,
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        dateOfBirth: new Date('2012-05-04T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2020-04-01T00:00:00.000Z'),
        classId: classroom.id,
      },
    });
    return { classroom, academicYear, student };
  }

  async function createInvoice(
    ownerTenantId: string,
    ownerStudentId: string,
    academicYearId: string,
    invoiceNumber: string,
    amount: string,
    issuedAt: Date,
  ) {
    return prisma.invoice.create({
      data: {
        tenantId: ownerTenantId,
        studentId: ownerStudentId,
        academicYearId,
        invoiceNumber,
        dueDate: issuedAt,
        issuedAt,
        subtotal: new Prisma.Decimal(amount),
        vatAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(amount),
      },
    });
  }

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
      data: { name: `Ledger Tenant ${SUFFIX}`, slug: `ledger-a-${SUFFIX}` },
    });
    const otherTenant = await prisma.tenant.create({
      data: { name: `Other Tenant ${SUFFIX}`, slug: `ledger-b-${SUFFIX}` },
    });
    tenantId = tenant.id;
    otherTenantId = otherTenant.id;

    actor = {
      tenantId,
      tenantSlug: `ledger-a-${SUFFIX}`,
      userId: `user-${SUFFIX}`,
      email: 'accountant@school.test',
      roles: ['accountant'],
      permissions: ['ledger:read'],
      authMethod: 'PASSWORD',
    } as AuthContext;
    otherTenantActor = { ...actor, tenantId: otherTenantId };

    cls.setTenant(tenantId);
    const primary = await seedStudent(tenantId, 'A');
    studentId = primary.student.id;

    // Invoice 1: allocation-backed, partially paid, then partially refunded.
    const invoice1 = await createInvoice(
      tenantId,
      studentId,
      primary.academicYear.id,
      `INV-1-${SUFFIX}`,
      '10000.00',
      new Date('2026-04-10T04:00:00.000Z'),
    );
    const payment1 = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice1.id,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        amount: new Prisma.Decimal('6000.00'),
        paidAt: new Date('2026-04-15T04:00:00.000Z'),
      },
    });
    await prisma.receipt.create({
      data: {
        tenantId,
        paymentId: payment1.id,
        receiptNumber: `RCP-1-${SUFFIX}`,
        issuedAt: new Date('2026-04-15T04:00:00.000Z'),
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        tenantId,
        paymentId: payment1.id,
        invoiceId: invoice1.id,
        amount: new Prisma.Decimal('6000.00'),
        allocationType: PaymentAllocationType.INVOICE,
        allocatedAt: new Date('2026-04-15T04:00:00.000Z'),
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        tenantId,
        paymentId: payment1.id,
        invoiceId: invoice1.id,
        amount: new Prisma.Decimal('-1500.00'),
        allocationType: PaymentAllocationType.REFUND,
        allocatedAt: new Date('2026-05-02T04:00:00.000Z'),
      },
    });

    // Invoice 2: legacy path (no allocations), with a reversed payment and a refund.
    const invoice2 = await createInvoice(
      tenantId,
      studentId,
      primary.academicYear.id,
      `INV-2-${SUFFIX}`,
      '4000.00',
      new Date('2026-06-01T04:00:00.000Z'),
    );
    const payment2 = await prisma.payment.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice2.id,
        method: PaymentMethod.BANK,
        status: PaymentStatus.REVERSED,
        amount: new Prisma.Decimal('4000.00'),
        paidAt: new Date('2026-06-05T04:00:00.000Z'),
        reversedAt: new Date('2026-06-09T04:00:00.000Z'),
        reversalReason: 'Cheque bounced',
      },
    });
    await prisma.paymentRefund.create({
      data: {
        tenantId,
        paymentId: payment2.id,
        refundNumber: `REF-1-${SUFFIX}`,
        amount: new Prisma.Decimal('250.00'),
        refundDate: new Date('2026-06-12T04:00:00.000Z'),
        reason: 'Bank charge return',
      },
    });

    // Waiver linked to invoice 2 -- never moves the running balance.
    await prisma.feeWaiver.create({
      data: {
        tenantId,
        studentId,
        invoiceId: invoice2.id,
        amount: new Prisma.Decimal('500.00'),
        reason: 'Hardship concession',
        approvedAt: new Date('2026-06-20T04:00:00.000Z'),
      },
    });

    // Another tenant's student with its own ledger, to prove cross-tenant silence.
    cls.setTenant(otherTenantId);
    const other = await seedStudent(otherTenantId, 'B');
    otherStudentId = other.student.id;
    await createInvoice(
      otherTenantId,
      otherStudentId,
      other.academicYear.id,
      `INV-OTHER-${SUFFIX}`,
      '99999.00',
      new Date('2026-04-10T04:00:00.000Z'),
    );
    // Only this tenant gets an open fiscal year, so the envelope's fiscal
    // context is proven both populated and tenant-scoped.
    const otherFiscalYear = await prisma.fiscalYear.create({
      data: {
        tenantId: otherTenantId,
        name: `FY ${SUFFIX}`,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    await prisma.fiscalPeriod.create({
      data: {
        tenantId: otherTenantId,
        fiscalYearId: otherFiscalYear.id,
        label: `Period 1 ${SUFFIX}`,
        periodNumber: 1,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2099-03-31T00:00:00.000Z'),
      },
    });

    cls.setTenant(tenantId);
  });

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('test teardown', async () => {
      await prisma.fiscalPeriod.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.fiscalYear.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.paymentAllocation.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.paymentRefund.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.receipt.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.payment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.feeWaiver.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.invoice.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.academicYear.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.class.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => cls.setTenant(tenantId));

  it('matches the full in-process projection row for row, including running balances', async () => {
    const full = await service.getStudentFeeLedger(studentId, actor);
    const paged = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 100, sortDirection: 'asc' },
      actor,
    );

    expect(paged.rows).toHaveLength(full.rows.length);
    expect(
      paged.rows.map((row) => ({
        id: row.id,
        type: row.type,
        debit: row.debit,
        credit: row.credit,
        runningBalance: row.runningBalance,
        affectsBalance: row.affectsBalance,
      })),
    ).toEqual(
      full.rows.map((row) => ({
        id: row.id,
        type: row.type,
        debit: row.debit,
        credit: row.credit,
        runningBalance: row.runningBalance,
        affectsBalance: row.affectsBalance,
      })),
    );
  });

  it('reports the same backend-owned totals as the full projection', async () => {
    const full = await service.getStudentFeeLedger(studentId, actor);
    const paged = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 5 },
      actor,
    );

    expect(paged.totalInvoiced).toBe(full.totalInvoiced);
    expect(paged.totalPaid).toBe(full.totalPaid);
    expect(paged.totalRefunded).toBe(full.totalRefunded);
    expect(paged.totalWaived).toBe(full.totalWaived);
    expect(paged.outstandingBalance).toBe(full.outstandingBalance);
  });

  it('keeps running balances continuous across page boundaries', async () => {
    const all = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 100, sortDirection: 'asc' },
      actor,
    );
    const firstPage = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 2, sortDirection: 'asc' },
      actor,
    );
    const secondPage = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 2, limit: 2, sortDirection: 'asc' },
      actor,
    );

    expect(firstPage.rows.concat(secondPage.rows)).toEqual(
      all.rows.slice(0, 4),
    );
    // The balance on page 2 continues the stream rather than restarting at zero.
    expect(secondPage.rows[0].runningBalance).toBe(all.rows[2].runningBalance);
    expect(firstPage.total).toBe(all.total);
    expect(firstPage.hasNextPage).toBe(true);
  });

  it('carries an opening balance for a date-windowed page instead of restarting the balance', async () => {
    const windowed = await service.getStudentFeeLedgerPage(
      studentId,
      {
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
        page: 1,
        limit: 50,
        sortDirection: 'asc',
      },
      actor,
    );
    const all = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 100, sortDirection: 'asc' },
      actor,
    );

    // Everything before the window nets to the opening balance: 10000 invoiced
    // less 6000 allocated plus 1500 refunded.
    expect(windowed.openingBalance).toBe('5500.00');
    expect(windowed.rows.length).toBeGreaterThan(0);

    const firstWindowRow = windowed.rows[0];
    const sameRowInFullStream = all.rows.find(
      (row) => row.id === firstWindowRow.id,
    );
    expect(firstWindowRow.runningBalance).toBe(
      sameRowInFullStream?.runningBalance,
    );
  });

  it('separates displayed-page totals from window-wide totals', async () => {
    const paged = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 2, sortDirection: 'asc' },
      actor,
    );

    expect(paged.pageTotals.rowCount).toBe(paged.rows.length);
    expect(paged.pageTotals.rowCount).toBeLessThan(paged.windowTotals.rowCount);
    expect(paged.windowTotals.rowCount).toBe(paged.total);
    expect(paged.pageTotals.debit).toBe(
      paged.rows
        .reduce((sum, row) => sum.add(row.debit), new Prisma.Decimal(0))
        .toFixed(2),
    );
  });

  it('filters by transaction type without losing cumulative balance context', async () => {
    const payments = await service.getStudentFeeLedgerPage(
      studentId,
      { transactionType: 'PAYMENT', page: 1, limit: 50, sortDirection: 'asc' },
      actor,
    );
    const all = await service.getStudentFeeLedgerPage(
      studentId,
      { page: 1, limit: 100, sortDirection: 'asc' },
      actor,
    );

    expect(payments.rows.every((row) => row.type === 'PAYMENT')).toBe(true);
    for (const row of payments.rows) {
      const inFullStream = all.rows.find((candidate) => candidate.id === row.id);
      expect(row.runningBalance).toBe(inFullStream?.runningBalance);
    }
  });

  it('honours the invoice status filter', async () => {
    const paidOnly = await service.getStudentFeeLedgerPage(
      studentId,
      { invoiceStatus: InvoiceStatus.PAID, page: 1, limit: 50 },
      actor,
    );

    expect(paidOnly.rows.filter((row) => row.type === 'INVOICE')).toHaveLength(
      0,
    );
  });

  it('does not expose another tenant ledger and rejects a foreign student id', async () => {
    await expect(
      service.getStudentFeeLedgerPage(
        otherStudentId,
        { page: 1, limit: 50 },
        actor,
      ),
    ).rejects.toThrow(/not found/i);

    cls.setTenant(otherTenantId);
    await expect(
      service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 50 },
        otherTenantActor,
      ),
    ).rejects.toThrow(/not found/i);
  });

  describe('versioned report metadata envelope (FEE-01)', () => {
    it('carries catalog-owned identity, classification, and basis', async () => {
      const paged = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 5 },
        actor,
      );

      expect(paged.report).toEqual(
        expect.objectContaining({
          id: 'FEE-01',
          definitionVersion: '1.0',
          title: 'Student Fee Ledger',
          family: 'FEE',
          classification: 'CONFIDENTIAL',
          requiresProfessionalVerification: false,
          professionalVerificationStatus: 'NOT_REQUIRED',
        }),
      );
      expect(paged.fiscalContext.accountingBasis).toBe('ACCRUAL');
      expect(paged.fiscalContext.postingBasis).toBe(
        'POSTED_WITH_PENDING_DISCLOSED',
      );
      expect(paged.sourceFreshness).toEqual([
        {
          module: 'M3',
          refreshedAt: paged.generatedAt,
          includesPending: true,
        },
      ]);
      expect(new Date(paged.generatedAt).toString()).not.toBe('Invalid Date');
    });

    it('warns instead of inventing a fiscal context when no fiscal year is open', async () => {
      // This tenant has no FiscalYear row at all.
      const paged = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 5 },
        actor,
      );

      expect(paged.fiscalContext.fiscalYearId).toBeNull();
      expect(paged.fiscalContext.fiscalYearLabel).toBeNull();
      expect(paged.validation.status).toBe('WARNING');
      expect(paged.validation.warnings).toContain(
        'No open fiscal year is configured for this school.',
      );
    });

    it('resolves the open fiscal year and covering period from the actor tenant only', async () => {
      cls.setTenant(otherTenantId);
      const paged = await service.getStudentFeeLedgerPage(
        otherStudentId,
        { page: 1, limit: 5 },
        otherTenantActor,
      );

      expect(paged.fiscalContext.fiscalYearLabel).toBe(`FY ${SUFFIX}`);
      expect(paged.fiscalContext.fiscalPeriodLabel).toBe(`Period 1 ${SUFFIX}`);
      expect(paged.fiscalContext.fiscalYearId).not.toBeNull();
      expect(paged.validation.status).toBe('VALID');
      expect(paged.validation.warnings).toEqual([]);
    });

    it('reports envelope pagination and report-wide totals consistently with the page', async () => {
      const paged = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 2, sortDirection: 'asc' },
        actor,
      );

      expect(paged.pagination).toEqual({
        page: 1,
        limit: 2,
        total: paged.total,
        totalPages: Math.ceil(paged.total / 2),
      });
      // Envelope totals are the report-wide figures, not this page's.
      expect(paged.totals.outstandingBalance).toBe(paged.outstandingBalance);
      expect(paged.totals.totalInvoiced).toBe(paged.totalInvoiced);
      expect(paged.totals.openingBalance).toBe(paged.openingBalance);
      expect(paged.pageTotals.rowCount).toBeLessThan(paged.total);
    });

    it('normalizes filters deterministically and discloses the waiver caveat for a year filter', async () => {
      const unfiltered = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 5 },
        actor,
      );
      expect(unfiltered.normalizedFilters.studentId).toBe(studentId);
      expect(unfiltered.normalizedFilters.sortDirection).toBe('desc');
      expect(Object.keys(unfiltered.normalizedFilters)).toEqual(
        [...Object.keys(unfiltered.normalizedFilters)].sort(),
      );

      const academicYear = await prisma.academicYear.findFirst({
        where: { tenantId },
      });
      const yearFiltered = await service.getStudentFeeLedgerPage(
        studentId,
        { academicYearId: academicYear!.id, page: 1, limit: 5 },
        actor,
      );

      expect(yearFiltered.validation.warnings).toContain(
        'Fee waivers carry no academic year of their own, so a year-filtered ledger shows only waivers linked to an invoice in that year.',
      );
    });

    it('exposes context-preserving drill-down references to source records', async () => {
      const paged = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 100, sortDirection: 'asc' },
        actor,
      );

      const invoiceRow = paged.rows.find((row) => row.type === 'INVOICE');
      expect(invoiceRow?.drilldown).toEqual({
        kind: 'SOURCE_RECORD',
        id: invoiceRow?.invoiceId,
        route: `/dashboard/fees/invoices/${invoiceRow?.invoiceId}`,
      });

      const paymentRow = paged.rows.find((row) => row.paymentId);
      expect(paymentRow?.drilldown).toEqual({
        kind: 'SOURCE_RECORD',
        id: paymentRow?.paymentId,
        route: `/dashboard/fees/payments/${paymentRow?.paymentId}`,
      });
    });
  });

  describe('export projection (FEE-01 artifact parity)', () => {
    it('returns every row and the same backend-owned totals as the rendered report', async () => {
      const rendered = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 2, sortDirection: 'asc' },
        actor,
      );
      const exported = await service.getStudentFeeLedgerExport(
        studentId,
        { sortDirection: 'asc' },
        actor,
      );

      // The artifact carries every row, not just a page.
      expect(exported.rows).toHaveLength(rendered.total);
      expect(exported.pageTotals.rowCount).toBe(rendered.total);

      // Displayed-total parity: window totals are identical across both paths.
      expect(exported.windowTotals).toEqual(rendered.windowTotals);
      expect(exported.totalInvoiced).toBe(rendered.totalInvoiced);
      expect(exported.outstandingBalance).toBe(rendered.outstandingBalance);

      // The exported rows sum to exactly the window totals they claim.
      expect(exported.pageTotals.debit).toBe(exported.windowTotals.debit);
      expect(exported.pageTotals.credit).toBe(exported.windowTotals.credit);
    });

    it('produces rows identical to the rendered projection, in order', async () => {
      const rendered = await service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 100, sortDirection: 'asc' },
        actor,
      );
      const exported = await service.getStudentFeeLedgerExport(
        studentId,
        { sortDirection: 'asc' },
        actor,
      );

      expect(exported.rows).toEqual(rendered.rows);
    });

    it('carries the same report envelope as the rendered report', async () => {
      const exported = await service.getStudentFeeLedgerExport(
        studentId,
        { sortDirection: 'asc' },
        actor,
      );

      expect(exported.report.id).toBe('FEE-01');
      expect(exported.report.definitionVersion).toBe('1.0');
      expect(exported.report.classification).toBe('CONFIDENTIAL');
      expect(exported.fiscalContext.accountingBasis).toBe('ACCRUAL');
      expect(exported.normalizedFilters.studentId).toBe(studentId);
    });

    it('honours the applied filters in both rows and totals', async () => {
      const exported = await service.getStudentFeeLedgerExport(
        studentId,
        { transactionType: 'INVOICE', sortDirection: 'asc' },
        actor,
      );

      expect(exported.rows.every((row) => row.type === 'INVOICE')).toBe(true);
      expect(exported.windowTotals.rowCount).toBe(exported.rows.length);
      expect(exported.windowTotals.credit).toBe('0.00');
    });

    it('drains every internal page for a ledger larger than one export page', async () => {
      // The export pages the projection server-side at 500 rows, so this
      // fixture is deliberately larger than one page to exercise the loop.
      const bulkStudentSuffix = `${SUFFIX}-bulk`;
      const bulkClass = await prisma.class.create({
        data: { tenantId, name: `Grade Bulk ${bulkStudentSuffix}`, level: 2 },
      });
      const bulkYear = await prisma.academicYear.create({
        data: {
          tenantId,
          name: `AY Bulk ${bulkStudentSuffix}`,
          startsOn: new Date('2026-04-01T00:00:00.000Z'),
          endsOn: new Date('2027-03-31T00:00:00.000Z'),
        },
      });
      const bulkStudent = await prisma.student.create({
        data: {
          tenantId,
          studentSystemId: `SID-BULK-${bulkStudentSuffix}`,
          firstNameEn: 'Bulk',
          lastNameEn: 'Ledger',
          dateOfBirth: new Date('2012-05-04T00:00:00.000Z'),
          gender: 'MALE',
          admissionDate: new Date('2020-04-01T00:00:00.000Z'),
          classId: bulkClass.id,
        },
      });

      const INVOICE_COUNT = 620;
      await prisma.invoice.createMany({
        data: Array.from({ length: INVOICE_COUNT }, (_, index) => ({
          tenantId,
          studentId: bulkStudent.id,
          academicYearId: bulkYear.id,
          invoiceNumber: `INV-BULK-${index}-${bulkStudentSuffix}`,
          dueDate: new Date(Date.UTC(2026, 3, 1) + index * 86_400_000),
          issuedAt: new Date(Date.UTC(2026, 3, 1) + index * 86_400_000),
          subtotal: new Prisma.Decimal('100.00'),
          vatAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal('100.00'),
        })),
      });

      const exported = await service.getStudentFeeLedgerExport(
        bulkStudent.id,
        { sortDirection: 'asc' },
        actor,
      );

      expect(exported.rows).toHaveLength(INVOICE_COUNT);
      expect(exported.windowTotals.rowCount).toBe(INVOICE_COUNT);
      // No duplicated or dropped rows across the page boundary.
      expect(new Set(exported.rows.map((row) => row.id)).size).toBe(
        INVOICE_COUNT,
      );
      // Running balance stays continuous across the internal page boundary.
      expect(exported.rows[499].runningBalance).toBe('50000.00');
      expect(exported.rows[500].runningBalance).toBe('50100.00');
      expect(exported.pageTotals.debit).toBe(exported.windowTotals.debit);
    });
  });

  it('requires both ends of a date range', async () => {
    await expect(
      service.getStudentFeeLedgerPage(
        studentId,
        { fromDate: '2026-06-01', page: 1, limit: 50 },
        actor,
      ),
    ).rejects.toThrow(/Both fromDate and toDate/);
  });

  it('denies an actor without ledger:read', async () => {
    await expect(
      service.getStudentFeeLedgerPage(
        studentId,
        { page: 1, limit: 50 },
        { ...actor, permissions: [] },
      ),
    ).rejects.toBeDefined();
  });
});
