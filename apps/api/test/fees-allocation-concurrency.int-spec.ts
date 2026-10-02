import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { FinanceService } from '../src/finance/finance.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
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
 * Phase 7.5 — fees workflow conformance and concurrency on real PostgreSQL.
 *
 * Counter collection used to size its allocations from invoice balances read
 * outside the transaction. These tests race real transactions to prove the
 * database guard + in-transaction recompute keep every invoice and payment
 * within its limits, whichever writer wins.
 */
interface Fixture {
  tenantId: string;
  userId: string;
  academicYearId: string;
  classId: string;
  actor: AuthContext;
}

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 7.5 fees allocation integrity (PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let service: FinanceService;
  const fixtures: Fixture[] = [];

  const scope = <T>(fixture: Fixture, work: () => Promise<T>) =>
    prisma.runWithTenantScope(fixture.tenantId, work);

  async function makeFixture(): Promise<Fixture> {
    return prisma.runWithoutTenantScope('Phase 7.5 fixtures', async () => {
      const tenant = await prisma.tenant.create({
        data: { name: 'Phase 7.5 test', slug: `p75-${randomUUID()}` },
      });
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `cashier-${randomUUID()}@example.test`,
          status: 'ACTIVE',
        },
      });
      const year = await prisma.fiscalYear.create({
        data: {
          tenantId: tenant.id,
          name: 'Synthetic 2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        },
      });
      await prisma.fiscalPeriod.create({
        data: {
          tenantId: tenant.id,
          fiscalYearId: year.id,
          label: 'Synthetic year',
          periodNumber: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        },
      });
      for (const [code, name] of [
        ['1000', 'Cash'],
        ['1010', 'Bank'],
        ['1200', 'Student Receivables'],
      ] as const) {
        await prisma.chartAccount.create({
          data: { tenantId: tenant.id, code, name, type: 'ASSET' },
        });
      }
      const academicYear = await prisma.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: 'Synthetic 2026',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      const classroom = await prisma.class.create({
        data: { tenantId: tenant.id, name: 'Synthetic class', level: 1 },
      });
      const fixture: Fixture = {
        tenantId: tenant.id,
        userId: user.id,
        academicYearId: academicYear.id,
        classId: classroom.id,
        actor: {
          userId: user.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          email: user.email,
          authMethod: 'PASSWORD',
          roles: ['finance'],
          permissions: ['payments:collect', 'receipts:manage'],
        } as AuthContext,
      };
      fixtures.push(fixture);
      return fixture;
    });
  }

  const makeStudent = (fixture: Fixture) =>
    scope(fixture, () =>
      prisma.student.create({
        data: {
          tenantId: fixture.tenantId,
          classId: fixture.classId,
          studentSystemId: randomUUID(),
          firstNameEn: 'Synthetic',
          lastNameEn: 'Student',
          gender: 'OTHER',
          dateOfBirth: new Date('2016-01-01'),
          admissionDate: new Date('2026-01-01'),
        },
      }),
    );

  const makeInvoice = (
    fixture: Fixture,
    studentId: string,
    total: number | string,
  ) =>
    scope(fixture, () =>
      prisma.invoice.create({
        data: {
          tenantId: fixture.tenantId,
          studentId,
          academicYearId: fixture.academicYearId,
          invoiceNumber: `SYN-${randomUUID().slice(0, 8)}`,
          dueDate: new Date(),
          subtotal: total,
          vatAmount: 0,
          totalAmount: total,
          status: 'ISSUED',
        },
      }),
    );

  const collect = (
    fixture: Fixture,
    body: {
      amount: string;
      invoiceId?: string;
      studentId?: string;
      allocations?: { invoiceId: string; amount: string }[];
      isAdvance?: boolean;
    },
  ) =>
    scope(fixture, () =>
      service.collectPayment(
        {
          method: 'CASH',
          idempotencyKey: randomUUID(),
          ...body,
        } as never,
        fixture.actor,
      ),
    );

  const invoiceState = (fixture: Fixture, invoiceId: string) =>
    scope(fixture, async () => {
      const invoice = await prisma.invoice.findFirstOrThrow({
        where: { id: invoiceId },
      });
      const sum = await prisma.paymentAllocation.aggregate({
        where: { invoiceId, reversedAt: null },
        _sum: { amount: true },
      });
      return {
        status: invoice.status,
        total: invoice.totalAmount.toFixed(2),
        allocated: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      };
    });

  const settled = <T>(promises: Promise<T>[]) => Promise.allSettled(promises);

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    const audit = new AuditService(prisma, cls);
    service = new FinanceService(
      prisma,
      audit,
      {} as never,
      new AccountingPostingService(prisma, audit),
      new EventEmitter2(),
      {
        checkLimit: async () => undefined,
        verifyLimit: async () => undefined,
        incrementUsage: async () => undefined,
      } as never,
    );
  });

  afterEach(async () => {
    const doomed = fixtures.splice(0);
    for (const fixture of doomed) {
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
  });

  afterAll(async () => {
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  describe('two cashiers, one invoice', () => {
    it('never over-allocates: of two competing full-balance payments exactly one wins', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const invoice = await makeInvoice(fixture, student.id, '1500.00');

      const outcomes = await settled(
        Array.from({ length: 4 }, () =>
          collect(fixture, { invoiceId: invoice.id, amount: '1500.00' }),
        ),
      );

      const won = outcomes.filter((o) => o.status === 'fulfilled');
      const lost = outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      );
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(3);
      for (const failure of lost) {
        expect(failure.reason).toBeInstanceOf(ConflictException);
      }
      expect(await invoiceState(fixture, invoice.id)).toEqual({
        status: 'PAID',
        total: '1500.00',
        allocated: '1500.00',
      });
    });

    it('marks the invoice PAID when two partial payments together settle it', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const invoice = await makeInvoice(fixture, student.id, '1500.00');

      const outcomes = await settled([
        collect(fixture, { invoiceId: invoice.id, amount: '750.00' }),
        collect(fixture, { invoiceId: invoice.id, amount: '750.00' }),
      ]);

      expect(outcomes.map((o) => o.status)).toEqual(['fulfilled', 'fulfilled']);
      // Both cashiers started from "nothing paid"; the status must still
      // reflect the real balance, not the stale one each of them saw.
      expect(await invoiceState(fixture, invoice.id)).toEqual({
        status: 'PAID',
        total: '1500.00',
        allocated: '1500.00',
      });
    });

    it('serializes cross-ordered multi-invoice collections without deadlock', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const first = await makeInvoice(fixture, student.id, '1000.00');
      const second = await makeInvoice(fixture, student.id, '1000.00');

      const outcomes = await settled(
        Array.from({ length: 6 }, (_, index) =>
          collect(fixture, {
            amount: '200.00',
            allocations:
              index % 2 === 0
                ? [
                    { invoiceId: first.id, amount: '100.00' },
                    { invoiceId: second.id, amount: '100.00' },
                  ]
                : [
                    { invoiceId: second.id, amount: '100.00' },
                    { invoiceId: first.id, amount: '100.00' },
                  ],
          }),
        ),
      );

      expect(outcomes.every((o) => o.status === 'fulfilled')).toBe(true);
      expect(await invoiceState(fixture, first.id)).toMatchObject({
        status: 'PARTIAL',
        allocated: '600.00',
      });
      expect(await invoiceState(fixture, second.id)).toMatchObject({
        status: 'PARTIAL',
        allocated: '600.00',
      });
    });

    it('replays a duplicate idempotency key into one payment even under a race', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const invoice = await makeInvoice(fixture, student.id, '900.00');
      const idempotencyKey = randomUUID();

      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () =>
          scope(fixture, () =>
            service.collectPayment(
              {
                method: 'CASH',
                idempotencyKey,
                invoiceId: invoice.id,
                amount: '900.00',
              } as never,
              fixture.actor,
            ),
          ),
        ),
      );

      expect(new Set(outcomes.map((o) => o.paymentId)).size).toBe(1);
      expect(
        outcomes.filter((o) => o.disposition === 'SUCCEEDED'),
      ).toHaveLength(1);
      expect(await invoiceState(fixture, invoice.id)).toMatchObject({
        status: 'PAID',
        allocated: '900.00',
      });
    });
  });

  describe('advance, overpayment and rounding', () => {
    it('turns an overpayment into an ADVANCE that is later applied to a new invoice', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const first = await makeInvoice(fixture, student.id, '1500.00');

      const paid = await collect(fixture, {
        amount: '2000.00',
        isAdvance: true,
        allocations: [{ invoiceId: first.id, amount: '1500.00' }],
      });
      expect(paid.unallocatedAmount).toBe('500.00');
      await scope(fixture, async () => {
        const advance = await prisma.paymentAllocation.findFirstOrThrow({
          where: { paymentId: paid.paymentId, invoiceId: null },
        });
        expect(advance.allocationType).toBe('ADVANCE');
        expect(advance.amount.toFixed(2)).toBe('500.00');
      });

      // A later invoice is issued; the advance is applied to it (500 of 800).
      const second = await makeInvoice(fixture, student.id, '800.00');
      await scope(fixture, () =>
        service.reallocatePayment(
          paid.paymentId,
          {
            idempotencyKey: randomUUID(),
            reason: 'Apply advance',
            allocations: [{ invoiceId: second.id, amount: '500.00' }],
          },
          fixture.actor,
        ),
      );
      expect(await invoiceState(fixture, second.id)).toMatchObject({
        status: 'PARTIAL',
        allocated: '500.00',
      });
      await scope(fixture, async () => {
        const net = await prisma.paymentAllocation.aggregate({
          where: { paymentId: paid.paymentId, reversedAt: null },
          _sum: { amount: true },
        });
        // Net allocations stay equal to what the parent actually paid.
        expect(net._sum.amount?.toFixed(2)).toBe('2000.00');
        const stillAdvance = await prisma.paymentAllocation.aggregate({
          where: { paymentId: paid.paymentId, invoiceId: null },
          _sum: { amount: true },
        });
        expect(stillAdvance._sum.amount?.toFixed(2)).toBe('0.00');
      });
    });

    it('lets only one of two racing reallocations spend the same advance', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const advancePayment = await collect(fixture, {
        amount: '600.00',
        studentId: student.id,
        isAdvance: true,
      });
      const invoice = await makeInvoice(fixture, student.id, '1000.00');

      const outcomes = await settled(
        Array.from({ length: 3 }, () =>
          scope(fixture, () =>
            service.reallocatePayment(
              advancePayment.paymentId,
              {
                idempotencyKey: randomUUID(),
                reason: 'Apply advance',
                allocations: [{ invoiceId: invoice.id, amount: '400.00' }],
              },
              fixture.actor,
            ),
          ),
        ),
      );

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      expect(await invoiceState(fixture, invoice.id)).toMatchObject({
        status: 'PARTIAL',
        allocated: '400.00',
      });
    });

    it('splits a payment across invoices to the paisa with nothing lost to rounding', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const invoices = await Promise.all(
        ['33.33', '33.33', '33.34'].map((total) =>
          makeInvoice(fixture, student.id, total),
        ),
      );

      const paid = await collect(fixture, {
        amount: '100.00',
        allocations: invoices.map((invoice, index) => ({
          invoiceId: invoice.id,
          amount: ['33.33', '33.33', '33.34'][index],
        })),
      });

      expect(paid.allocatedAmount).toBe('100.00');
      expect(paid.unallocatedAmount).toBe('0.00');
      for (const invoice of invoices) {
        expect((await invoiceState(fixture, invoice.id)).status).toBe('PAID');
      }
      await scope(fixture, async () => {
        const sum = await prisma.paymentAllocation.aggregate({
          where: { paymentId: paid.paymentId },
          _sum: { amount: true },
        });
        expect(sum._sum.amount?.toFixed(2)).toBe('100.00');
      });
    });

    it('rejects sub-paisa amounts and allocations that exceed the payment', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const invoice = await makeInvoice(fixture, student.id, '100.00');

      await expect(
        collect(fixture, { invoiceId: invoice.id, amount: '10.005' }),
      ).rejects.toThrow(/two decimal places/);
      await expect(
        collect(fixture, {
          amount: '50.00',
          allocations: [{ invoiceId: invoice.id, amount: '50.01' }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await invoiceState(fixture, invoice.id)).toMatchObject({
        status: 'ISSUED',
        allocated: '0.00',
      });
    });
  });

  describe('database guard (every writer, not just collectPayment)', () => {
    async function seedPayment(fixture: Fixture, amount: string) {
      const student = await makeStudent(fixture);
      const invoice = await makeInvoice(fixture, student.id, '1000.00');
      const paid = await collect(fixture, {
        invoiceId: invoice.id,
        amount,
      });
      return { student, invoice, paymentId: paid.paymentId };
    }

    const insertAllocation = (
      fixture: Fixture,
      data: {
        paymentId: string;
        invoiceId: string | null;
        amount: string;
        allocationType:
          | 'INVOICE'
          | 'ADVANCE'
          | 'REFUND'
          | 'REVERSAL'
          | 'REALLOCATION';
      },
    ) =>
      scope(fixture, () =>
        prisma.paymentAllocation.create({
          data: { tenantId: fixture.tenantId, ...data },
        }),
      );

    it('refuses an allocation that would push an invoice past its total', async () => {
      const fixture = await makeFixture();
      const { student, invoice } = await seedPayment(fixture, '900.00');
      // A second payment, large enough on its own, still cannot overfill.
      const other = await collect(fixture, {
        studentId: student.id,
        amount: '500.00',
        isAdvance: true,
      });

      await expect(
        insertAllocation(fixture, {
          paymentId: other.paymentId,
          invoiceId: invoice.id,
          amount: '200.00',
          allocationType: 'INVOICE',
        }),
      ).rejects.toThrow(/schoolos_allocation_guard/);
    });

    it('refuses allocations that exceed or undercut the payment', async () => {
      const fixture = await makeFixture();
      const { invoice, paymentId } = await seedPayment(fixture, '400.00');

      await expect(
        insertAllocation(fixture, {
          paymentId,
          invoiceId: invoice.id,
          amount: '0.01',
          allocationType: 'INVOICE',
        }),
      ).rejects.toThrow(/schoolos_allocation_guard/);
      await expect(
        insertAllocation(fixture, {
          paymentId,
          invoiceId: invoice.id,
          amount: '-400.01',
          allocationType: 'REFUND',
        }),
      ).rejects.toThrow(/schoolos_allocation_guard/);
    });

    it('accepts a refund and a full reversal that net the payment to zero', async () => {
      const fixture = await makeFixture();
      const { invoice, paymentId } = await seedPayment(fixture, '400.00');

      await insertAllocation(fixture, {
        paymentId,
        invoiceId: invoice.id,
        amount: '-150.00',
        allocationType: 'REFUND',
      });
      await insertAllocation(fixture, {
        paymentId,
        invoiceId: invoice.id,
        amount: '-250.00',
        allocationType: 'REVERSAL',
      });
      expect(await invoiceState(fixture, invoice.id)).toMatchObject({
        allocated: '0.00',
      });
      // Nothing left to reverse or refund.
      await expect(
        insertAllocation(fixture, {
          paymentId,
          invoiceId: invoice.id,
          amount: '-0.01',
          allocationType: 'REVERSAL',
        }),
      ).rejects.toThrow(/schoolos_allocation_guard/);
    });

    it('rejects zero amounts and wrong-sign allocation types', async () => {
      const fixture = await makeFixture();
      const { invoice, paymentId } = await seedPayment(fixture, '400.00');
      // Headroom on the payment, so the sign CHECK (not the cap) is what fires.
      await insertAllocation(fixture, {
        paymentId,
        invoiceId: invoice.id,
        amount: '-100.00',
        allocationType: 'REFUND',
      });

      for (const [amount, allocationType] of [
        ['0.00', 'INVOICE'],
        ['-10.00', 'INVOICE'],
        ['10.00', 'REFUND'],
        ['10.00', 'REVERSAL'],
      ] as const) {
        await expect(
          insertAllocation(fixture, {
            paymentId,
            invoiceId: invoice.id,
            amount,
            allocationType,
          }),
        ).rejects.toThrow(/PaymentAllocation_amount_sign/);
      }
    });

    it('keeps allocation money columns immutable', async () => {
      const fixture = await makeFixture();
      const { invoice, paymentId } = await seedPayment(fixture, '400.00');
      const allocation = await scope(fixture, () =>
        prisma.paymentAllocation.findFirstOrThrow({
          where: { paymentId, invoiceId: invoice.id },
        }),
      );

      await expect(
        scope(fixture, () =>
          prisma.paymentAllocation.update({
            where: { id: allocation.id },
            data: { amount: '399.00' },
          }),
        ),
      ).rejects.toThrow(/immutable/);
    });

    it('stops an invoice total from dropping below what is already allocated', async () => {
      const fixture = await makeFixture();
      const { invoice } = await seedPayment(fixture, '700.00');

      await expect(
        scope(fixture, () =>
          prisma.invoice.update({
            where: { id: invoice.id },
            data: { totalAmount: '600.00' },
          }),
        ),
      ).rejects.toThrow(/schoolos_allocation_guard/);
      // Lowering to exactly what has been paid is allowed.
      await scope(fixture, () =>
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { totalAmount: '700.00' },
        }),
      );
    });

    it('rejects an allocation that crosses tenants', async () => {
      const fixture = await makeFixture();
      const other = await makeFixture();
      const { paymentId } = await seedPayment(fixture, '300.00');
      const otherStudent = await makeStudent(other);
      const foreignInvoice = await makeInvoice(other, otherStudent.id, '500');

      await expect(
        prisma.runWithoutTenantScope('Phase 7.5 cross-tenant probe', () =>
          prisma.paymentAllocation.create({
            data: {
              tenantId: fixture.tenantId,
              paymentId,
              invoiceId: foreignInvoice.id,
              amount: '1.00',
              allocationType: 'REALLOCATION',
            },
          }),
        ),
      ).rejects.toThrow(/schoolos_allocation_guard/);
    });
  });

  describe('Fees Home summary', () => {
    it('derives outstanding from allocations and surfaces stuck work by permission', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const first = await makeInvoice(fixture, student.id, '1000.00');
      const second = await makeInvoice(fixture, student.id, '1000.00');

      // One receipt across two invoices (no legacy Payment.invoiceId link).
      await collect(fixture, {
        amount: '1500.00',
        allocations: [
          { invoiceId: first.id, amount: '600.00' },
          { invoiceId: second.id, amount: '900.00' },
        ],
      });
      // An advance later applied to the second invoice.
      const advance = await collect(fixture, {
        amount: '300.00',
        studentId: student.id,
        isAdvance: true,
      });
      await scope(fixture, () =>
        service.reallocatePayment(
          advance.paymentId,
          {
            idempotencyKey: randomUUID(),
            reason: 'Apply advance',
            allocations: [{ invoiceId: second.id, amount: '100.00' }],
          },
          fixture.actor,
        ),
      );
      // A refund against the first invoice.
      const refundedPayment = await scope(fixture, () =>
        prisma.payment.findFirstOrThrow({
          where: { tenantId: fixture.tenantId, invoiceId: null, amount: 1500 },
        }),
      );
      await scope(fixture, () =>
        prisma.paymentAllocation.create({
          data: {
            tenantId: fixture.tenantId,
            paymentId: refundedPayment.id,
            invoiceId: first.id,
            amount: '-100.00',
            allocationType: 'REFUND',
          },
        }),
      );

      // Stuck work: a failed fee posting, an unfinished cashier session and a
      // verified-but-parked online payment.
      await scope(fixture, async () => {
        const year = await prisma.fiscalYear.findFirstOrThrow({
          where: { tenantId: fixture.tenantId },
        });
        await prisma.accountingPostingBatch.create({
          data: {
            tenantId: fixture.tenantId,
            fiscalYearId: year.id,
            sourceModule: 'M3',
            sourceType: 'FEE_PAYMENT',
            sourceBatchId: randomUUID(),
            status: 'FAILED',
            sourceTotal: 10,
            idempotencyKey: randomUUID(),
          },
        });
        await prisma.cashierClose.create({
          data: {
            tenantId: fixture.tenantId,
            closeNumber: `CC-${randomUUID().slice(0, 8)}`,
            openedAt: new Date(),
            status: 'OPEN',
            grossCollected: 0,
            totalRefunded: 0,
            netCollected: 0,
            paymentCount: 0,
            refundCount: 0,
          },
        });
        await prisma.onlinePaymentIntent.create({
          data: {
            tenantId: fixture.tenantId,
            studentId: student.id,
            invoiceId: first.id,
            requestedByUserId: fixture.userId,
            provider: 'TESTGW',
            idempotencyKey: randomUUID(),
            amount: '50.00',
            status: 'PENDING',
            failureCode: 'EXCEPTION_AMOUNT_MISMATCH',
          },
        });
      });

      const tomorrow = new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10);
      const summaryFor = (permissions: string[]) =>
        scope(fixture, () =>
          service.getDashboardSummary(
            { date: tomorrow },
            { ...fixture.actor, permissions },
          ),
        );

      const privileged = await summaryFor([
        'fees:manage',
        'payments:close',
        'accounting:posting-batches:read',
      ]);
      // 2000 billed - (600 + 900 + 100 applied advance - 100 refund) = 500.
      expect(privileged.outstanding.amount).toBe('500.00');
      expect(privileged.overdue.amount).toBe('500.00');
      expect(privileged.attention).toEqual({
        failedPostingCount: 1,
        openCashierSessionCount: 1,
        parkedOnlinePaymentCount: 1,
      });

      const cashierOnly = await summaryFor(['payments:collect']);
      expect(cashierOnly.outstanding.amount).toBe('500.00');
      expect(cashierOnly.attention).toEqual({
        failedPostingCount: null,
        openCashierSessionCount: null,
        parkedOnlinePaymentCount: null,
      });
    });
  });

  describe('issued invoices are immutable facts', () => {
    async function billingFixture() {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const head = await scope(fixture, () =>
        prisma.feeHead.create({
          data: {
            tenantId: fixture.tenantId,
            code: 'TUITION',
            name: 'Tuition',
            frequency: 'MONTHLY',
            defaultAmount: 1000,
            vatApplicable: false,
          },
        }),
      );
      const plan = await scope(fixture, () =>
        prisma.feePlan.create({
          data: {
            tenantId: fixture.tenantId,
            academicYearId: fixture.academicYearId,
            classId: fixture.classId,
            code: 'PLAN-A',
            name: 'Plan A',
            items: {
              create: {
                tenantId: fixture.tenantId,
                feeHeadId: head.id,
                amount: 1000,
              },
            },
          },
        }),
      );
      await scope(fixture, () =>
        prisma.studentFeeAssignment.create({
          data: {
            tenantId: fixture.tenantId,
            studentId: student.id,
            feePlanId: plan.id,
            academicYearId: fixture.academicYearId,
          },
        }),
      );
      return { fixture, student, head, plan };
    }

    const generate = (fixture: Fixture, extra: { feePlanId?: string } = {}) =>
      scope(fixture, () =>
        service.generateBillingRun(
          {
            academicYearId: fixture.academicYearId,
            runMonth: 5,
            runYear: 2026,
            dueDate: '2026-05-30',
            ...extra,
          } as never,
          fixture.actor,
        ),
      );

    it('does not change an issued invoice when the fee plan or the student class is edited later', async () => {
      const { fixture, student, plan } = await billingFixture();
      const run = await generate(fixture);
      const invoice = run.invoices[0];
      expect(invoice.totalAmount.toFixed(2)).toBe('1000.00');

      await scope(fixture, async () => {
        await prisma.feePlanItem.updateMany({
          where: { feePlanId: plan.id },
          data: { amount: 2500 },
        });
        const otherClass = await prisma.class.create({
          data: { tenantId: fixture.tenantId, name: 'Moved class', level: 2 },
        });
        await prisma.student.update({
          where: { id: student.id },
          data: { classId: otherClass.id },
        });
      });

      const state = await invoiceState(fixture, invoice.id);
      expect(state.total).toBe('1000.00');
      await scope(fixture, async () => {
        const lines = await prisma.invoiceLine.findMany({
          where: { invoiceId: invoice.id },
        });
        expect(lines.map((line) => line.totalAmount.toFixed(2))).toEqual([
          '1000.00',
        ]);
      });
      // Collection still works against the invoice exactly as issued.
      await collect(fixture, { invoiceId: invoice.id, amount: '1000.00' });
      expect((await invoiceState(fixture, invoice.id)).status).toBe('PAID');
    });

    it('bills a month once even when billing runs race', async () => {
      const { fixture } = await billingFixture();

      const outcomes = await settled([
        generate(fixture),
        generate(fixture),
        generate(fixture),
      ]);

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      for (const failure of outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      )) {
        expect(failure.reason).toBeInstanceOf(ConflictException);
      }
      await scope(fixture, async () => {
        expect(
          await prisma.invoice.count({
            where: { tenantId: fixture.tenantId },
          }),
        ).toBe(1);
        expect(
          await prisma.feeBillingRun.count({
            where: { tenantId: fixture.tenantId },
          }),
        ).toBe(1);
      });
    });

    it('does not let an all-plans run and a plan-specific run bill the same month', async () => {
      const { fixture, plan } = await billingFixture();

      await generate(fixture, { feePlanId: plan.id });
      await expect(generate(fixture)).rejects.toBeInstanceOf(ConflictException);
      await scope(fixture, async () => {
        expect(
          await prisma.invoice.count({
            where: { tenantId: fixture.tenantId },
          }),
        ).toBe(1);
      });
    });

    it('keeps invoice totals consistent with their lines when VAT does not divide evenly', async () => {
      const fixture = await makeFixture();
      const student = await makeStudent(fixture);
      const plan = await scope(fixture, async () => {
        const created = await prisma.feePlan.create({
          data: {
            tenantId: fixture.tenantId,
            academicYearId: fixture.academicYearId,
            classId: fixture.classId,
            code: 'PLAN-VAT',
            name: 'VAT plan',
          },
        });
        for (const code of ['A', 'B', 'C']) {
          const head = await prisma.feeHead.create({
            data: {
              tenantId: fixture.tenantId,
              code: `VAT-${code}`,
              name: `Head ${code}`,
              frequency: 'MONTHLY',
              defaultAmount: 333.33,
              vatApplicable: true,
            },
          });
          await prisma.feePlanItem.create({
            data: {
              tenantId: fixture.tenantId,
              feePlanId: created.id,
              feeHeadId: head.id,
              amount: 333.33,
            },
          });
        }
        await prisma.studentFeeAssignment.create({
          data: {
            tenantId: fixture.tenantId,
            studentId: student.id,
            feePlanId: created.id,
            academicYearId: fixture.academicYearId,
          },
        });
        return created;
      });

      const run = await generate(fixture, { feePlanId: plan.id });

      const invoice = run.invoices[0];
      await scope(fixture, async () => {
        const lines = await prisma.invoiceLine.findMany({
          where: { invoiceId: invoice.id },
        });
        const lineTotal = lines.reduce(
          (sum, line) => sum.add(line.totalAmount),
          new Prisma.Decimal(0),
        );
        const lineVat = lines.reduce(
          (sum, line) => sum.add(line.vatAmount),
          new Prisma.Decimal(0),
        );
        const stored = await prisma.invoice.findFirstOrThrow({
          where: { id: invoice.id },
        });
        expect(stored.totalAmount.toFixed(2)).toBe(lineTotal.toFixed(2));
        expect(stored.vatAmount.toFixed(2)).toBe(lineVat.toFixed(2));
        expect(stored.subtotal.add(stored.vatAmount).toFixed(2)).toBe(
          stored.totalAmount.toFixed(2),
        );
      });
    });
  });
});
