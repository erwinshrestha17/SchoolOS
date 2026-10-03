import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { getNepalSchoolDay, shiftGregorianDateOnly } from '@schoolos/core';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { FinanceService } from '../src/finance/finance.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AccountingReportsService } from '../src/accounting/accounting-reports.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import {
  closeLedgerFixturePool,
  withLedgerGuardsOff,
} from './helpers/ledger-fixture';

/**
 * Phase 7.11b — one receivables aging definition and AR = GL, on real
 * PostgreSQL, through the real fee services:
 * - a multi-invoice receipt, an advance applied later and an invoice-linked
 *   waiver (never subtracted twice);
 * - totals and segments over the whole filtered set, not one page;
 * - as-of a past Nepal school day;
 * - void reverses the invoice's journals; a void in a locked period is
 *   refused; a void after an allocation is refused;
 * - late fees post to the ledger; a second adjustment on one invoice posts;
 * - the subledger equals the receivable control account, and an unposted
 *   invoice is reported as a reconciling item.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

interface Fixture {
  tenantId: string;
  academicYearId: string;
  classId: string;
  periodId: string;
  actor: AuthContext;
}

describeDatabase('Phase 7.11b receivables aging and AR = GL', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let posting: AccountingPostingService;
  let finance: FinanceService;
  let reports: AccountingReportsService;
  const fixtures: Fixture[] = [];

  const today = getNepalSchoolDay(new Date()).gregorianDate;
  const daysAgo = (days: number) =>
    new Date(`${shiftGregorianDateOnly(today, -days)}T00:00:00.000Z`);
  const scope = <T>(fixture: Fixture, work: () => Promise<T>) =>
    prisma.runWithTenantScope(fixture.tenantId, work);
  const money = (value: Prisma.Decimal.Value | null | undefined) =>
    new Prisma.Decimal(value ?? 0).toFixed(2);

  async function makeFixture(name: string): Promise<Fixture> {
    return prisma.runWithoutTenantScope('Phase 7.11b fixtures', async () => {
      const tenant = await prisma.tenant.create({
        data: { name, slug: `p711b-${randomUUID()}` },
      });
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `bursar-${randomUUID()}@example.test`,
          status: 'ACTIVE',
        },
      });
      const year = await prisma.fiscalYear.create({
        data: {
          tenantId: tenant.id,
          name: 'Synthetic fiscal year',
          startDate: daysAgo(400),
          endDate: daysAgo(-400),
        },
      });
      const period = await prisma.fiscalPeriod.create({
        data: {
          tenantId: tenant.id,
          fiscalYearId: year.id,
          label: 'Synthetic period',
          periodNumber: 1,
          startDate: daysAgo(400),
          endDate: daysAgo(-400),
        },
      });
      const chart: [
        string,
        string,
        'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE',
      ][] = [
        ['1000', 'Cash', 'ASSET'],
        ['1010', 'Bank', 'ASSET'],
        ['1200', 'Student Receivables', 'ASSET'],
        ['2250', 'Student Advances', 'LIABILITY'],
        ['4000', 'Tuition Fees', 'REVENUE'],
        ['5100', 'Fee Waivers', 'EXPENSE'],
      ];
      for (const [code, accountName, type] of chart) {
        await prisma.chartAccount.create({
          data: { tenantId: tenant.id, code, name: accountName, type },
        });
      }
      const academicYear = await prisma.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: 'Synthetic year',
          startsOn: daysAgo(400),
          endsOn: daysAgo(-400),
        },
      });
      const classroom = await prisma.class.create({
        data: { tenantId: tenant.id, name: 'Class 5', level: 5 },
      });
      const fixture: Fixture = {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        classId: classroom.id,
        periodId: period.id,
        actor: {
          userId: user.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          email: user.email,
          authMethod: 'PASSWORD',
          roles: ['bursar'],
          permissions: [
            'payments:collect',
            'receipts:manage',
            'fees:manage',
            'fees:adjust',
            'fees:discount',
            'ledger:read',
          ],
        } as AuthContext,
      };
      fixtures.push(fixture);
      return fixture;
    });
  }

  const makeStudent = (fixture: Fixture, firstName: string) =>
    scope(fixture, () =>
      prisma.student.create({
        data: {
          tenantId: fixture.tenantId,
          classId: fixture.classId,
          studentSystemId: `STU-${randomUUID().slice(0, 8)}`,
          firstNameEn: firstName,
          lastNameEn: 'Synthetic',
          gender: 'OTHER',
          dateOfBirth: new Date('2016-01-01'),
          admissionDate: daysAgo(300),
        },
      }),
    );

  async function issueInvoice(
    fixture: Fixture,
    studentId: string,
    total: string,
    dueDaysAgo: number,
    options: { post?: boolean } = { post: true },
  ) {
    return scope(fixture, async () => {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: fixture.tenantId,
          studentId,
          academicYearId: fixture.academicYearId,
          invoiceNumber: `INV-${randomUUID().slice(0, 8)}`,
          dueDate: daysAgo(dueDaysAgo),
          issuedAt: daysAgo(Math.max(dueDaysAgo + 10, 10)),
          subtotal: total,
          vatAmount: 0,
          totalAmount: total,
          status: 'ISSUED',
        },
      });
      if (options.post !== false) {
        await posting.postInvoice(
          {
            tenantId: fixture.tenantId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            studentId,
            totalAmount: new Prisma.Decimal(total),
            entryDate: daysAgo(Math.max(dueDaysAgo + 10, 10)),
            lines: [
              {
                accountCode: '4000',
                amount: new Prisma.Decimal(total),
                description: 'Tuition',
              },
            ],
          },
          fixture.actor,
        );
      }
      return invoice;
    });
  }

  const collect = (
    fixture: Fixture,
    body: Record<string, unknown>,
  ): Promise<{ paymentId: string }> =>
    scope(fixture, () =>
      finance.collectPayment(
        { method: 'CASH', idempotencyKey: randomUUID(), ...body } as never,
        fixture.actor,
      ),
    ) as Promise<{ paymentId: string }>;

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    const audit = new AuditService(prisma, cls);
    posting = new AccountingPostingService(prisma, audit);
    finance = new FinanceService(
      prisma,
      audit,
      {
        recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 1 }),
      } as never,
      posting,
      new EventEmitter2(),
      {
        checkLimit: async () => undefined,
        verifyLimit: async () => undefined,
        incrementUsage: async () => undefined,
      } as never,
    );
    reports = new AccountingReportsService(prisma, audit);
  });

  afterAll(async () => {
    for (const fixture of fixtures.splice(0)) {
      await withLedgerGuardsOff(async (query) => {
        const tables = await query(
          `SELECT DISTINCT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'tenantId'`,
        );
        for (const row of tables.rows as { table_name: string }[]) {
          await query(`DELETE FROM "${row.table_name}" WHERE "tenantId" = $1`, [
            fixture.tenantId,
          ]);
        }
        await query('DELETE FROM "Tenant" WHERE "id" = $1', [fixture.tenantId]);
      });
    }
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  let school: Fixture;
  let other: Fixture;
  let invoiceA: { id: string; invoiceNumber: string };
  let invoiceB: { id: string; invoiceNumber: string };
  let invoiceC: { id: string; invoiceNumber: string };
  let studentOne: { id: string };

  beforeAll(async () => {
    school = await makeFixture('Phase 7.11b school');
    other = await makeFixture('Phase 7.11b other school');
    studentOne = await makeStudent(school, 'Aarati');
    invoiceA = await issueInvoice(school, studentOne.id, '1000.00', 45);
    invoiceB = await issueInvoice(school, studentOne.id, '600.00', 100);
    invoiceC = await issueInvoice(school, studentOne.id, '300.00', -20);

    // One receipt across two invoices (no legacy Payment.invoiceId link).
    await collect(school, {
      amount: '700.00',
      studentId: studentOne.id,
      allocations: [
        { invoiceId: invoiceA.id, amount: '400.00' },
        { invoiceId: invoiceB.id, amount: '300.00' },
      ],
    });
    // An advance, part of which is applied to invoice A later.
    const advance = await collect(school, {
      amount: '200.00',
      studentId: studentOne.id,
      isAdvance: true,
    });
    await scope(school, () =>
      finance.reallocatePayment(
        advance.paymentId,
        {
          idempotencyKey: randomUUID(),
          reason: 'Apply advance',
          allocations: [{ invoiceId: invoiceA.id, amount: '100.00' }],
        },
        school.actor,
      ),
    );
    // An invoice-linked waiver: lowers B's total; must not be subtracted again.
    await scope(school, () =>
      finance.createWaiver(
        {
          studentId: studentOne.id,
          invoiceId: invoiceB.id,
          amount: '50.00',
          reason: 'Sibling concession',
        } as never,
        school.actor,
      ),
    );
    // Another school's overdue invoice must never appear.
    const outsider = await makeStudent(other, 'Outside');
    await issueInvoice(other, outsider.id, '999.00', 40);
  });

  it('ages invoices on the Nepal school day with allocations, advances and waivers', async () => {
    const aging = await scope(school, () =>
      reports.getReceivablesAging(school.tenantId, {}),
    );
    expect(aging.asOfDate).toBe(today);
    const byInvoice = Object.fromEntries(
      aging.rows.map((row) => [row.invoiceId, [row.outstanding, row.bucket]]),
    );
    expect(byInvoice).toEqual({
      [invoiceA.id]: ['500.00', '31-60'],
      [invoiceB.id]: ['250.00', '90+'],
      [invoiceC.id]: ['300.00', 'CURRENT'],
    });
    expect(aging.totals.totalOutstanding).toBe('1050.00');
    expect(aging.totals.overdueOutstanding).toBe('750.00');
    expect(aging.advancesHeld).toBe('100.00');
    expect(aging.byClass).toEqual([
      expect.objectContaining({
        className: 'Class 5',
        invoiceCount: 3,
        outstanding: '1050.00',
        overdueOutstanding: '750.00',
      }),
    ]);
  });

  it('pages defaulters after filtering and totals the whole set', async () => {
    const firstPage = await scope(school, () =>
      finance.listDefaulters(school.actor, { limit: 1, sortBy: 'outstanding' }),
    );
    expect(firstPage.total).toBe(2);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].invoiceId).toBe(invoiceB.id);
    expect(firstPage.hasNextPage).toBe(true);
    expect(firstPage.totalOutstanding).toBe('750.00');
    expect(firstPage.segments).toEqual([
      { agingBucket: '0-30', count: 0, outstanding: '0.00' },
      { agingBucket: '31-60', count: 1, outstanding: '500.00' },
      { agingBucket: '61-90', count: 0, outstanding: '0.00' },
      { agingBucket: '90+', count: 1, outstanding: '250.00' },
    ]);

    const filtered = await scope(school, () =>
      finance.listDefaulters(school.actor, { agingBucket: '90+' }),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.totalOutstanding).toBe('250.00');
    // Segment cards still show every bucket under a bucket filter.
    expect(
      filtered.segments.find((s) => s.agingBucket === '31-60')?.count,
    ).toBe(1);
  });

  it('reminds a selected invoice even when it is not on the first page', async () => {
    const result = await scope(school, () =>
      finance.sendDefaulterReminders(
        { invoiceIds: [invoiceA.id], channels: ['PUSH'] } as never,
        school.actor,
      ),
    );
    expect(result.reminded).toBe(1);
  });

  it('builds the defaulter aging report on allocations without double-counting waivers', async () => {
    const report = await scope(school, () =>
      finance.getDefaulterAgingReportRows(school.actor, {}),
    );
    expect(report.summary.asOfDate).toBe(today);
    expect(report.summary.totalOutstanding).toBe(750);
    const row = report.rows.find(
      (r) => r.invoiceNumber === invoiceB.invoiceNumber,
    );
    expect(row?.outstandingAmount).toBe(250);
    expect(row?.waiverAmount).toBe(0);
  });

  it('reports receivables as of a past Nepal school day', async () => {
    const yesterday = shiftGregorianDateOnly(today, -1);
    const aging = await scope(school, () =>
      reports.getReceivablesAging(school.tenantId, { asOfDate: yesterday }),
    );
    // Nothing had been received yesterday; B's total already reflects the
    // later waiver (invoice totals are current).
    const outstanding = Object.fromEntries(
      aging.rows.map((row) => [row.invoiceId, row.outstanding]),
    );
    expect(outstanding[invoiceA.id]).toBe('1000.00');
    expect(outstanding[invoiceB.id]).toBe('550.00');
    expect(aging.advancesHeld).toBe('0.00');
  });

  it('keeps the subledger equal to the receivable control account', async () => {
    const recon = await scope(school, () =>
      reports.getReceivablesReconciliation(school.tenantId, {}),
    );
    expect(recon.controlAccounts.map((a) => a.code)).toEqual(['1200']);
    expect(recon.subledgerTotal).toBe('1050.00');
    expect(recon.ledgerBalance).toBe('1050.00');
    expect(recon.isReconciled).toBe(true);
    expect(recon.items).toEqual([]);
  });

  it('posts a second adjustment on the same invoice', async () => {
    const feeHead = await scope(school, () =>
      prisma.feeHead.create({
        data: {
          tenantId: school.tenantId,
          code: 'TUITION',
          name: 'Tuition',
          frequency: 'MONTHLY',
          defaultAmount: 0,
        },
      }),
    );
    for (const amount of [40, 60]) {
      await scope(school, () =>
        finance.createInvoiceAdjustment(
          invoiceC.id,
          {
            direction: 'INCREASE',
            feeHeadId: feeHead.id,
            amount,
            vatAmount: 0,
            reason: `Lab charge ${String(amount)}`,
          } as never,
          school.actor,
        ),
      );
    }
    const recon = await scope(school, () =>
      reports.getReceivablesReconciliation(school.tenantId, {}),
    );
    expect(recon.subledgerTotal).toBe('1150.00');
    expect(recon.isReconciled).toBe(true);
  });

  it('posts late fees to the ledger and charges an invoice only once', async () => {
    await scope(school, async () => {
      await prisma.tenantSetting.create({
        data: {
          tenantId: school.tenantId,
          key: 'late_fee_enabled',
          value: true,
        },
      });
      await prisma.feeHead.create({
        data: {
          tenantId: school.tenantId,
          code: 'LATEFEE',
          name: 'Late fee',
          frequency: 'ONE_TIME',
          defaultAmount: 25,
          vatApplicable: false,
        },
      });
    });
    const first = await scope(school, () =>
      finance.calculateLateFeesForTenant(school.tenantId),
    );
    expect(first).toMatchObject({ applied: 2, postingRefused: 0 });
    const second = await scope(school, () =>
      finance.calculateLateFeesForTenant(school.tenantId),
    );
    expect(second).toMatchObject({ applied: 0, skipped: 2 });
    const recon = await scope(school, () =>
      reports.getReceivablesReconciliation(school.tenantId, {}),
    );
    expect(recon.subledgerTotal).toBe('1200.00');
    expect(recon.isReconciled).toBe(true);
  });

  it('reverses every journal of a voided invoice and stays reconciled', async () => {
    const student = await makeStudent(school, 'Chandra');
    const doomed = await issueInvoice(school, student.id, '400.00', 5);
    await scope(school, () =>
      finance.voidInvoice(doomed.id, { reason: 'Issued twice' }, school.actor),
    );
    const journals = await scope(school, () =>
      prisma.journalEntry.findMany({
        where: {
          tenantId: school.tenantId,
          OR: [{ sourceId: doomed.id }, { reversalOfId: { not: null } }],
        },
        select: { status: true, sourceType: true, reversalOfId: true },
      }),
    );
    expect(
      journals.filter((j) => j.sourceType === 'INVOICE').map((j) => j.status),
    ).toEqual(['REVERSED']);
    const recon = await scope(school, () =>
      reports.getReceivablesReconciliation(school.tenantId, {}),
    );
    expect(recon.isReconciled).toBe(true);
    expect(recon.subledgerTotal).toBe('1200.00');
  });

  it('refuses to void an invoice that has received money', async () => {
    const student = await makeStudent(school, 'Dipa');
    const paid = await issueInvoice(school, student.id, '200.00', 3);
    await collect(school, { invoiceId: paid.id, amount: '20.00' });
    await expect(
      scope(school, () =>
        finance.voidInvoice(paid.id, { reason: 'Mistake' }, school.actor),
      ),
    ).rejects.toThrow('Paid invoices must be refunded or reversed');
  });

  it('reports an unposted invoice as a reconciling item', async () => {
    const student = await makeStudent(school, 'Ekta');
    const unposted = await issueInvoice(school, student.id, '75.00', 2, {
      post: false,
    });
    const recon = await scope(school, () =>
      reports.getReceivablesReconciliation(school.tenantId, {}),
    );
    expect(recon.isReconciled).toBe(false);
    expect(recon.difference).toBe('-75.00');
    expect(recon.items).toEqual([
      expect.objectContaining({
        cause: 'INVOICE_NOT_POSTED',
        count: 1,
        effect: '-75.00',
        examples: [{ reference: unposted.invoiceNumber, amount: '-75.00' }],
      }),
    ]);
    expect(recon.isFullyExplained).toBe(true);
    expect(recon.unexplained).toBe('0.00');
  });

  it('refuses a void in a locked period and leaves the invoice open', async () => {
    const student = await makeStudent(school, 'Gita');
    const invoice = await issueInvoice(school, student.id, '90.00', 1);
    await prisma.runWithoutTenantScope('lock fixture period', () =>
      prisma.fiscalPeriod.update({
        where: { id: school.periodId },
        data: { status: 'LOCKED' },
      }),
    );
    try {
      await expect(
        scope(school, () =>
          finance.voidInvoice(invoice.id, { reason: 'Late' }, school.actor),
        ),
      ).rejects.toThrow();
      const state = await scope(school, () =>
        prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } }),
      );
      expect(state.status).toBe('ISSUED');
    } finally {
      await prisma.runWithoutTenantScope('unlock fixture period', () =>
        prisma.fiscalPeriod.update({
          where: { id: school.periodId },
          data: { status: 'OPEN' },
        }),
      );
    }
  });

  it('never includes another school', async () => {
    const aging = await scope(school, () =>
      reports.getReceivablesAging(school.tenantId, { search: 'Outside' }),
    );
    expect(aging.rows).toEqual([]);
    expect(money(aging.totals.totalOutstanding)).toBe('0.00');
    const theirs = await scope(other, () =>
      reports.getReceivablesAging(other.tenantId, {}),
    );
    expect(theirs.totals.totalOutstanding).toBe('999.00');
  });
});
