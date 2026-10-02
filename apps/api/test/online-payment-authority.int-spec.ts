import { createHmac, randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
 * Phase 7.4 — online payment authority on a real PostgreSQL database.
 *
 * The provider is a stubbed `fetch`: it answers the server-to-server status
 * pull from `providerState`, exactly like a gateway would. Nothing in a
 * callback payload decides what is settled.
 */
type ProviderAnswer =
  | {
      status: 'SUCCESS' | 'FAILED' | 'PENDING';
      amount?: string | null;
      currency?: string;
      merchantId?: string;
      reference?: string;
      providerReference?: string;
    }
  | 'NOT_FOUND'
  | 'DOWN';

interface Fixture {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  studentId: string;
  invoiceId: string;
  merchantId: string;
  actor: AuthContext;
}

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 7.4 online payment authority (PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  const originalFetch = global.fetch;
  const providerName =
    `TESTGW${randomUUID().replace(/-/g, '').slice(0, 10)}`.toUpperCase();
  const signingSecret = 'int-test-signing-secret';
  let prisma: PrismaService;
  let service: FinanceService;
  const fixtures: Fixture[] = [];
  /** intentId -> what the provider says about it. */
  const providerState = new Map<string, ProviderAnswer>();
  let providerCalls: { reference: string; merchantId: string }[] = [];

  const scope = <T>(tenantId: string, work: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, work);

  async function makeFixture(): Promise<Fixture> {
    return prisma.runWithoutTenantScope('Phase 7.4 fixtures', async () => {
      const tenant = await prisma.tenant.create({
        data: { name: 'Phase 7.4 test', slug: `p74-${randomUUID()}` },
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
      await prisma.chartAccount.create({
        data: {
          tenantId: tenant.id,
          code: '1010',
          name: 'Synthetic bank',
          type: 'ASSET',
        },
      });
      await prisma.chartAccount.create({
        data: {
          tenantId: tenant.id,
          code: '1200',
          name: 'Student Receivables',
          type: 'ASSET',
        },
      });
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
      const student = await prisma.student.create({
        data: {
          tenantId: tenant.id,
          classId: classroom.id,
          studentSystemId: randomUUID(),
          firstNameEn: 'Synthetic',
          lastNameEn: 'Student',
          gender: 'OTHER',
          dateOfBirth: new Date('2016-01-01'),
          admissionDate: new Date('2026-01-01'),
        },
      });
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          academicYearId: academicYear.id,
          invoiceNumber: `SYN-${randomUUID().slice(0, 8)}`,
          dueDate: new Date(),
          subtotal: 1500,
          vatAmount: 0,
          totalAmount: 1500,
          status: 'ISSUED',
        },
      });
      const merchantId = `merchant-${randomUUID().slice(0, 8)}`;
      await prisma.tenantPaymentMerchant.create({
        data: {
          tenantId: tenant.id,
          provider: providerName,
          environment: 'TEST',
          merchantId,
        },
      });
      const fixture: Fixture = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        studentId: student.id,
        invoiceId: invoice.id,
        merchantId,
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

  async function makeIntent(
    fixture: Fixture,
    overrides: {
      amount?: string;
      status?: 'CREATED' | 'READY' | 'PENDING';
      ageMinutes?: number;
      createdAgeHours?: number;
      providerReference?: string | null;
    } = {},
  ) {
    const stale = new Date(Date.now() - (overrides.ageMinutes ?? 30) * 60_000);
    const intent = await scope(fixture.tenantId, () =>
      prisma.onlinePaymentIntent.create({
        data: {
          tenantId: fixture.tenantId,
          studentId: fixture.studentId,
          invoiceId: fixture.invoiceId,
          requestedByUserId: fixture.userId,
          provider: providerName,
          providerReference:
            overrides.providerReference === undefined
              ? `PR-${randomUUID().slice(0, 8)}`
              : overrides.providerReference,
          idempotencyKey: randomUUID(),
          amount: overrides.amount ?? '1500.00',
          status: overrides.status ?? 'READY',
          createdAt: new Date(
            Date.now() - (overrides.createdAgeHours ?? 0.5) * 3_600_000,
          ),
          updatedAt: stale,
        },
      }),
    );
    return intent;
  }

  const providerSays = (
    intent: { id: string; providerReference: string | null },
    fixture: Fixture,
    answer: ProviderAnswer = { status: 'SUCCESS' },
  ) => {
    providerState.set(
      intent.id,
      typeof answer === 'string'
        ? answer
        : {
            amount: '1500.00',
            currency: 'NPR',
            merchantId: fixture.merchantId,
            reference: intent.id,
            providerReference: intent.providerReference ?? undefined,
            ...answer,
          },
    );
  };

  const callback = (
    intent: { id: string },
    status: string,
    extra: Record<string, unknown> = {},
  ) => {
    const payload = { reference: intent.id, status, ...extra };
    const signature = createHmac('sha256', signingSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return service.handleOnlinePaymentWebhook(providerName, payload, {
      [`${providerName.toLowerCase()}-signature`]: `sha256=${signature}`,
    });
  };

  const counts = (fixture: Fixture) =>
    scope(fixture.tenantId, async () => ({
      payments: await prisma.payment.count({
        where: { tenantId: fixture.tenantId },
      }),
      receipts: await prisma.receipt.count({
        where: { tenantId: fixture.tenantId },
      }),
      journals: await prisma.journalEntry.count({
        where: { tenantId: fixture.tenantId, sourceType: 'FEE_PAYMENT' },
      }),
      allocations: await prisma.paymentAllocation.count({
        where: { tenantId: fixture.tenantId },
      }),
    }));

  const verifyAsClient = (fixture: Fixture, intentId: string) =>
    scope(fixture.tenantId, () =>
      service.verifyOnlinePaymentIntent(intentId, fixture.actor),
    );

  const intentOf = (fixture: Fixture, id: string) =>
    scope(fixture.tenantId, () =>
      prisma.onlinePaymentIntent.findFirstOrThrow({
        where: { id, tenantId: fixture.tenantId },
      }),
    );

  beforeAll(async () => {
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
    await prisma.runWithoutTenantScope('Phase 7.4 provider', () =>
      prisma.providerConfig.create({
        data: {
          type: 'PAYMENT_GATEWAY',
          name: providerName,
          enabled: true,
          environment: 'TEST',
          validationStatus: 'VALID',
          lastValidatedAt: new Date(),
          secretKeys: [],
          configEncrypted: {
            adapter: 'generic_json_v1',
            webhookSigningSecret: signingSecret,
            settlementStatusUrl: 'http://127.0.0.1:9/settlements/status',
            intentUrl: 'http://127.0.0.1:9/intents',
            webhookUrl: 'http://127.0.0.1:9/webhook',
          },
        },
      }),
    );
  });

  beforeEach(() => {
    providerState.clear();
    providerCalls = [];
    global.fetch = jest.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      const reference = url.searchParams.get('reference') ?? '';
      providerCalls.push({
        reference,
        merchantId: url.searchParams.get('merchantId') ?? '',
      });
      const answer = providerState.get(reference) ?? 'NOT_FOUND';
      if (answer === 'DOWN') throw new Error('ECONNRESET');
      if (answer === 'NOT_FOUND') {
        return { status: 404, ok: false, json: async () => null } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => answer,
      } as Response;
    }) as unknown as typeof fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
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
    await prisma.runWithoutTenantScope('Phase 7.4 provider cleanup', () =>
      prisma.providerConfig.deleteMany({ where: { name: providerName } }),
    );
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  describe('callback is a hint', () => {
    it('settles concurrent duplicate callbacks into exactly one payment', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);

      const results = await Promise.all(
        Array.from({ length: 6 }, () => callback(intent, 'SUCCESS')),
      );

      expect(results.every((r) => r.status === 'verified')).toBe(true);
      expect(
        results.filter((r) => !('duplicate' in r && r.duplicate)),
      ).toHaveLength(1);
      expect(new Set(results.map((r) => r.paymentId)).size).toBe(1);
      expect(await counts(fixture)).toEqual({
        payments: 1,
        receipts: 1,
        journals: 1,
        allocations: 1,
      });
      const settled = await intentOf(fixture, intent.id);
      expect(settled.status).toBe('SUCCEEDED');
      expect(settled.paymentId).toBe(results[0].paymentId);
      await scope(fixture.tenantId, async () => {
        const invoice = await prisma.invoice.findFirstOrThrow({
          where: { id: fixture.invoiceId },
        });
        expect(invoice.status).toBe('PAID');
      });
    });

    it('creates one payment when the callback arrives before the client confirms (and vice versa)', async () => {
      const fixture = await makeFixture();
      const first = await makeIntent(fixture, { amount: '700.00' });
      providerSays(first, fixture, { status: 'SUCCESS', amount: '700.00' });

      const viaCallback = await callback(first, 'SUCCESS');
      const afterConfirm = await verifyAsClient(fixture, first.id);

      expect(viaCallback.status).toBe('verified');
      expect(afterConfirm).toMatchObject({
        status: 'SUCCEEDED',
        state: 'PAID',
        paid: true,
        paymentId: viaCallback.paymentId,
      });
      expect((await counts(fixture)).payments).toBe(1);

      // Reverse order on a second intent, plus a concurrent callback.
      const second = await makeIntent(fixture, { amount: '800.00' });
      providerSays(second, fixture, { status: 'SUCCESS', amount: '800.00' });
      const [confirm, late] = await Promise.all([
        verifyAsClient(fixture, second.id),
        callback(second, 'SUCCESS'),
      ]);
      expect(confirm.state).toBe('PAID');
      expect(late.status).toBe('verified');
      const state = await counts(fixture);
      expect(state.payments).toBe(2);
      expect(state.receipts).toBe(2);
      expect(state.journals).toBe(2);
    });

    it('ignores the amount in the callback and settles the provider-confirmed intent amount', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);

      const result = await callback(intent, 'SUCCESS', { amount: 1 });

      expect(result.status).toBe('verified');
      await scope(fixture.tenantId, async () => {
        const payment = await prisma.payment.findFirstOrThrow({
          where: { tenantId: fixture.tenantId },
        });
        expect(payment.amount.toFixed(2)).toBe('1500.00');
      });
    });

    it('settles nothing and records an exception when the provider reports a different amount', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture, { status: 'SUCCESS', amount: '1400.00' });

      const result = await callback(intent, 'SUCCESS', { amount: 1500 });

      expect(result).toMatchObject({
        status: 'exception',
        postedToLedger: false,
        code: 'EXCEPTION_AMOUNT_MISMATCH',
      });
      expect(await counts(fixture)).toEqual({
        payments: 0,
        receipts: 0,
        journals: 0,
        allocations: 0,
      });
      const parked = await intentOf(fixture, intent.id);
      expect(parked.status).toBe('PENDING');
      expect(parked.failureCode).toBe('EXCEPTION_AMOUNT_MISMATCH');
      await scope(fixture.tenantId, async () => {
        const audit = await prisma.auditLog.findFirst({
          where: {
            tenantId: fixture.tenantId,
            action: 'settlement_exception',
            resourceId: intent.id,
          },
        });
        expect(audit).not.toBeNull();
      });

      // A person must resolve it: the reconciler never retries parked intents.
      providerCalls = [];
      const summary = await service.reconcileStaleOnlinePaymentIntents({
        now: new Date(Date.now() + 3_600_000),
      });
      expect(providerCalls.filter((c) => c.reference === intent.id)).toEqual(
        [],
      );
      expect(summary.exceptions).toBe(0);
    });

    it('keeps an unconfirmed callback pending verification instead of paid', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture, { status: 'PENDING' });

      const result = await callback(intent, 'SUCCESS');

      expect(result.status).toBe('pending_verification');
      const pending = await intentOf(fixture, intent.id);
      expect(pending.status).toBe('PENDING');
      const view = await verifyAsClient(fixture, intent.id);
      expect(view).toMatchObject({
        state: 'PENDING_VERIFICATION',
        paid: false,
      });
      expect((await counts(fixture)).payments).toBe(0);
    });

    it('does not let a forged failed callback fail an intent the provider still holds', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture, { status: 'PENDING' });

      await callback(intent, 'FAILED');

      expect((await intentOf(fixture, intent.id)).status).not.toBe('FAILED');
    });

    it('rejects a callback with a bad signature before any provider call', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);

      await expect(
        service.handleOnlinePaymentWebhook(
          providerName,
          { reference: intent.id, status: 'SUCCESS' },
          { [`${providerName.toLowerCase()}-signature`]: 'sha256=deadbeef' },
        ),
      ).rejects.toThrow('Invalid signature.');
      expect(providerCalls).toEqual([]);
      expect((await counts(fixture)).payments).toBe(0);
    });

    it('parks verified money the invoice can no longer take', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);
      // The invoice is settled another way before the provider answer lands.
      await scope(fixture.tenantId, async () => {
        const payment = await prisma.payment.create({
          data: {
            tenantId: fixture.tenantId,
            studentId: fixture.studentId,
            invoiceId: fixture.invoiceId,
            method: 'CASH',
            amount: 1500,
            paidAt: new Date(),
            collectedById: fixture.userId,
          },
        });
        await prisma.paymentAllocation.create({
          data: {
            tenantId: fixture.tenantId,
            paymentId: payment.id,
            invoiceId: fixture.invoiceId,
            amount: 1500,
          },
        });
      });

      const result = await callback(intent, 'SUCCESS');

      expect(result).toMatchObject({
        status: 'exception',
        code: 'EXCEPTION_INVOICE_ALREADY_PAID',
      });
      expect((await counts(fixture)).payments).toBe(1);
      expect((await intentOf(fixture, intent.id)).status).toBe('PENDING');
    });
  });

  describe('stale-intent reconciler', () => {
    it('settles a lost-response intent exactly once, even when swept concurrently', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture, { ageMinutes: 45 });
      providerSays(intent, fixture);

      const summaries = await Promise.all([
        service.reconcileStaleOnlinePaymentIntents(),
        service.reconcileStaleOnlinePaymentIntents(),
        service.reconcileStaleOnlinePaymentIntents(),
      ]);

      expect(summaries.reduce((n, s) => n + s.errors, 0)).toBe(0);
      expect(await counts(fixture)).toEqual({
        payments: 1,
        receipts: 1,
        journals: 1,
        allocations: 1,
      });
      expect((await intentOf(fixture, intent.id)).status).toBe('SUCCEEDED');
      // A further sweep finds nothing to do.
      const again = await service.reconcileStaleOnlinePaymentIntents();
      expect(again.settled).toBe(0);
      expect((await counts(fixture)).payments).toBe(1);
    });

    it('verifies with the school’s own merchant and keeps tenants apart', async () => {
      const schoolA = await makeFixture();
      const schoolB = await makeFixture();
      const a = await makeIntent(schoolA);
      const b = await makeIntent(schoolB);
      providerSays(a, schoolA);
      // The provider answers school B's intent with school A's merchant.
      providerSays(b, schoolB, {
        status: 'SUCCESS',
        merchantId: schoolA.merchantId,
      });

      const summary = await service.reconcileStaleOnlinePaymentIntents();

      expect(summary.settled).toBeGreaterThanOrEqual(1);
      expect(providerCalls).toEqual(
        expect.arrayContaining([
          { reference: a.id, merchantId: schoolA.merchantId },
          { reference: b.id, merchantId: schoolB.merchantId },
        ]),
      );
      expect((await counts(schoolA)).payments).toBe(1);
      expect((await counts(schoolB)).payments).toBe(0);
      expect((await intentOf(schoolB, b.id)).failureCode).toBe(
        'EXCEPTION_MERCHANT_MISMATCH',
      );
    });

    it('leaves fresh intents alone and retries when the provider is down', async () => {
      const fixture = await makeFixture();
      const fresh = await makeIntent(fixture, { ageMinutes: 1 });
      const stale = await makeIntent(fixture, { ageMinutes: 60 });
      providerSays(fresh, fixture);
      providerSays(stale, fixture, 'DOWN');

      const summary = await service.reconcileStaleOnlinePaymentIntents();

      expect(providerCalls.map((c) => c.reference)).toEqual([stale.id]);
      expect(summary.pending).toBeGreaterThanOrEqual(1);
      expect((await counts(fixture)).payments).toBe(0);
      const after = await intentOf(fixture, stale.id);
      expect(after.verifyAttempts).toBe(1);
      expect(after.status).toBe('READY');
    });

    it('expires an intent the provider never completed, but a late success still settles', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture, {
        ageMinutes: 600,
        createdAgeHours: 72,
      });
      providerSays(intent, fixture, 'NOT_FOUND');

      const summary = await service.reconcileStaleOnlinePaymentIntents();

      expect(summary.expired).toBe(1);
      expect((await intentOf(fixture, intent.id)).status).toBe('EXPIRED');
      expect((await counts(fixture)).payments).toBe(0);

      // The customer actually paid late: money must never be lost.
      providerSays(intent, fixture, { status: 'SUCCESS' });
      const late = await callback(intent, 'SUCCESS');
      expect(late.status).toBe('verified');
      expect((await counts(fixture)).payments).toBe(1);
      expect((await intentOf(fixture, intent.id)).status).toBe('SUCCEEDED');
    });

    it('resolves an intent whose provider reference was never stored (provider success, our write failed)', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture, {
        status: 'CREATED',
        providerReference: null,
        ageMinutes: 30,
      });
      providerSays(intent, fixture, {
        status: 'SUCCESS',
        providerReference: 'PR-LATE-1',
      });

      await service.reconcileStaleOnlinePaymentIntents();

      const settled = await intentOf(fixture, intent.id);
      expect(settled.status).toBe('SUCCEEDED');
      expect(settled.providerReference).toBe('PR-LATE-1');
      expect((await counts(fixture)).payments).toBe(1);
    });

    it('fails an intent that never reached the provider', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture, {
        status: 'CREATED',
        providerReference: null,
        ageMinutes: 30,
      });
      providerSays(intent, fixture, 'NOT_FOUND');

      const summary = await service.reconcileStaleOnlinePaymentIntents();

      expect(summary.failed).toBe(1);
      const failed = await intentOf(fixture, intent.id);
      expect(failed.status).toBe('FAILED');
      expect(failed.failureCode).toBe('PROVIDER_INITIATION_LOST');
    });
  });

  describe('collect-payment replay (pin)', () => {
    it('returns the original payment and receipt for the same idempotency key, even concurrently', async () => {
      const fixture = await makeFixture();
      const dto = {
        invoiceId: fixture.invoiceId,
        amount: '600.00',
        method: 'TRANSFER' as const,
        referenceNumber: 'TRF-REPLAY-1',
        idempotencyKey: `replay-${randomUUID()}`,
      };

      const first = await scope(fixture.tenantId, () =>
        service.collectPayment(dto as never, fixture.actor),
      );
      const replays = await scope(fixture.tenantId, () =>
        Promise.all([
          service.collectPayment(dto as never, fixture.actor),
          service.collectPayment(dto as never, fixture.actor),
          service.collectPayment(dto as never, fixture.actor),
        ]),
      );

      expect(first.receiptNumber).toEqual(expect.any(String));
      for (const replay of replays) {
        expect(replay.paymentId).toBe(first.paymentId);
        expect(replay.receiptNumber).toBe(first.receiptNumber);
        expect(['SUCCEEDED', 'REPLAYED']).toContain(replay.disposition);
      }
      expect(first.disposition).toBe('SUCCEEDED');
      expect(replays.filter((r) => r.disposition === 'REPLAYED').length).toBe(
        replays.length,
      );
      expect(await counts(fixture)).toMatchObject({
        payments: 1,
        receipts: 1,
        journals: 1,
      });
    });
  });

  describe('database guards', () => {
    const sql = (
      fixture: Fixture,
      text: string,
      params: unknown[] = [],
    ): Promise<unknown> =>
      prisma.runWithoutTenantScope('Phase 7.4 raw guard probe', () =>
        prisma.$executeRawUnsafe(text, ...params),
      );

    it('keeps the requested payment details immutable', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);

      await expect(
        sql(
          fixture,
          'UPDATE "OnlinePaymentIntent" SET "amount" = 1 WHERE "id" = $1',
          [intent.id],
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        sql(
          fixture,
          'UPDATE "OnlinePaymentIntent" SET "providerReference" = \'OTHER\' WHERE "id" = $1',
          [intent.id],
        ),
      ).rejects.toThrow(/write-once/);
    });

    it('rejects a non-positive amount and a settled intent without a payment', async () => {
      const fixture = await makeFixture();

      await expect(
        scope(fixture.tenantId, () =>
          prisma.onlinePaymentIntent.create({
            data: {
              tenantId: fixture.tenantId,
              studentId: fixture.studentId,
              invoiceId: fixture.invoiceId,
              requestedByUserId: fixture.userId,
              provider: providerName,
              idempotencyKey: randomUUID(),
              amount: '0.00',
            },
          }),
        ),
      ).rejects.toThrow(/OnlinePaymentIntent_amount_positive/);
      await expect(
        scope(fixture.tenantId, () =>
          prisma.onlinePaymentIntent.create({
            data: {
              tenantId: fixture.tenantId,
              studentId: fixture.studentId,
              invoiceId: fixture.invoiceId,
              requestedByUserId: fixture.userId,
              provider: providerName,
              idempotencyKey: randomUUID(),
              amount: '10.00',
              status: 'SUCCEEDED',
            },
          }),
        ),
      ).rejects.toThrow(/OnlinePaymentIntent_succeeded_has_payment/);
    });

    it('never lets a settled intent leave SUCCEEDED or change its payment', async () => {
      const fixture = await makeFixture();
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);
      await callback(intent, 'SUCCESS');

      await expect(
        sql(
          fixture,
          'UPDATE "OnlinePaymentIntent" SET "status" = \'PENDING\' WHERE "id" = $1',
          [intent.id],
        ),
      ).rejects.toThrow(/cannot leave SUCCEEDED/);
      await expect(
        sql(
          fixture,
          'UPDATE "OnlinePaymentIntent" SET "paymentId" = NULL WHERE "id" = $1',
          [intent.id],
        ),
      ).rejects.toThrow();
    });

    it('allows one merchant account to belong to one school only', async () => {
      const schoolA = await makeFixture();
      const schoolB = await makeFixture();

      await expect(
        prisma.runWithoutTenantScope('Phase 7.4 duplicate merchant', () =>
          prisma.tenantPaymentMerchant.create({
            data: {
              tenantId: schoolB.tenantId,
              provider: providerName,
              environment: 'PRODUCTION',
              merchantId: schoolA.merchantId,
            },
          }),
        ),
      ).resolves.toBeDefined();
      await expect(
        prisma.runWithoutTenantScope('Phase 7.4 duplicate merchant', () =>
          prisma.tenantPaymentMerchant.create({
            data: {
              tenantId: schoolA.tenantId,
              provider: providerName,
              environment: 'PRODUCTION',
              merchantId: schoolA.merchantId,
            },
          }),
        ),
      ).rejects.toThrow(/Unique constraint/);
    });
  });

  describe('merchant gate', () => {
    it('fails closed when the school has no merchant account', async () => {
      const fixture = await makeFixture();
      await prisma.runWithoutTenantScope('Phase 7.4 remove merchant', () =>
        prisma.tenantPaymentMerchant.deleteMany({
          where: { tenantId: fixture.tenantId },
        }),
      );
      const intent = await makeIntent(fixture);
      providerSays(intent, fixture);

      const result = await callback(intent, 'SUCCESS');

      expect(result.status).toBe('pending_verification');
      expect(providerCalls).toEqual([]);
      expect((await counts(fixture)).payments).toBe(0);
      const readiness = await scope(fixture.tenantId, () =>
        service.getPaymentGatewayReadiness(fixture.actor),
      );
      expect(readiness.merchantConfigured).toBe(false);
      expect(readiness.enabled).toBe(false);
    });
  });
});
