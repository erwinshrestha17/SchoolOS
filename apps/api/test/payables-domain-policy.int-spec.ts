import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { Pool } from 'pg';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AccountingSourceResolverService } from '../src/accounting/accounting-source-resolver.service';
import { PayablesService } from '../src/accounting/payables.service';
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
 * Phase 7.11c — payables on real PostgreSQL through the real service:
 * lifecycle and posting, three independent duties, idempotent replay,
 * concurrent payments (one wins), closed/locked periods, missing mappings,
 * reversals, aging = AP ledger, the source resolver, live session/grant
 * re-checks, tenant isolation and direct-SQL database guards.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

const ACCOUNTANT = [
  'accounting:read',
  'accounting:vendors:read',
  'accounting:vendors:write',
  'accounting:expenses:read',
  'accounting:expenses:write',
  'accounting:payables:read',
  'accounting:journals:reverse',
];
const APPROVER = [
  'accounting:read',
  'accounting:expenses:read',
  'accounting:expenses:approve',
  'accounting:payables:read',
];
const PAYER = [
  'accounting:read',
  'accounting:expenses:read',
  'accounting:payables:read',
  'accounting:payables:settle',
];

interface School {
  tenantId: string;
  accountant: AuthContext;
  approver: AuthContext;
  payer: AuthContext;
  /** Holds every payables duty: proves the service still separates them. */
  allDuties: AuthContext;
  account: Record<string, string>;
  periodIds: Record<string, string>;
}

describeDatabase('Phase 7.11c payables domain policy', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let payables: PayablesService;
  let reports: AccountingReportsService;
  let resolver: AccountingSourceResolverService;
  let pool: Pool;
  const schools: School[] = [];
  let school: School;
  let other: School;

  const scope = <T>(target: School, work: () => Promise<T>) =>
    prisma.runWithTenantScope(target.tenantId, work);
  const money = (value: Prisma.Decimal.Value | null | undefined) =>
    new Prisma.Decimal(value ?? 0).toFixed(2);

  async function grant(keys: string[]) {
    return Promise.all(
      keys.map((key) => {
        const split = key.lastIndexOf(':');
        return prisma.permission.upsert({
          where: {
            resource_action: {
              resource: key.slice(0, split),
              action: key.slice(split + 1),
            },
          },
          create: {
            resource: key.slice(0, split),
            action: key.slice(split + 1),
          },
          update: {},
        });
      }),
    );
  }

  async function makeActor(
    tenantId: string,
    slug: string,
    label: string,
    permissions: string[],
  ): Promise<AuthContext> {
    const grants = await grant(permissions);
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `${label}-${randomUUID()}@p711c.test`,
        status: 'ACTIVE',
      },
    });
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: `p711c-${label}-${randomUUID().slice(0, 6)}`,
        rolePermissions: {
          create: grants.map((row) => ({ permissionId: row.id })),
        },
      },
    });
    await prisma.userRole.create({
      data: { tenantId, userId: user.id, roleId: role.id },
    });
    const familyId = randomUUID();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    return {
      userId: user.id,
      tenantId,
      tenantSlug: slug,
      email: user.email,
      sessionFamilyId: familyId,
      authMethod: 'PASSWORD',
      roles: [role.name],
      permissions,
    } as AuthContext;
  }

  async function makeSchool(name: string): Promise<School> {
    return prisma.runWithoutTenantScope('Phase 7.11c fixtures', async () => {
      const tenant = await prisma.tenant.create({
        data: { name, slug: `p711c-${randomUUID()}` },
      });
      const accountant = await makeActor(
        tenant.id,
        tenant.slug,
        'accountant',
        ACCOUNTANT,
      );
      const approver = await makeActor(
        tenant.id,
        tenant.slug,
        'approver',
        APPROVER,
      );
      const payer = await makeActor(tenant.id, tenant.slug, 'payer', PAYER);
      const allDuties = await makeActor(tenant.id, tenant.slug, 'all', [
        ...new Set([...ACCOUNTANT, ...APPROVER, ...PAYER]),
      ]);
      const year = await prisma.fiscalYear.create({
        data: {
          tenantId: tenant.id,
          name: 'FY 2030',
          startDate: new Date(Date.UTC(2030, 0, 1)),
          endDate: new Date(Date.UTC(2030, 11, 31)),
        },
      });
      const periodIds: Record<string, string> = {};
      for (let month = 1; month <= 12; month += 1) {
        const label = `2030-${String(month).padStart(2, '0')}`;
        const period = await prisma.fiscalPeriod.create({
          data: {
            tenantId: tenant.id,
            fiscalYearId: year.id,
            label,
            periodNumber: month,
            startDate: new Date(Date.UTC(2030, month - 1, 1)),
            endDate: new Date(Date.UTC(2030, month, 0)),
          },
        });
        periodIds[label] = period.id;
      }
      const account: Record<string, string> = {};
      const chart: [string, string, 'ASSET' | 'LIABILITY' | 'EXPENSE'][] = [
        ['1000', 'Cash', 'ASSET'],
        ['1010', 'Bank', 'ASSET'],
        ['1300', 'VAT receivable', 'ASSET'],
        ['1500', 'Furniture', 'ASSET'],
        ['2000', 'Accounts payable', 'LIABILITY'],
        ['2220', 'TDS payable', 'LIABILITY'],
        ['5200', 'Stationery', 'EXPENSE'],
      ];
      for (const [code, accountName, type] of chart) {
        account[code] = (
          await prisma.chartAccount.create({
            data: { tenantId: tenant.id, code, name: accountName, type },
          })
        ).id;
      }
      const mappings: [
        Prisma.AccountingReportAccountMappingCreateManyInput['mappingType'],
        string,
      ][] = [
        ['CASH', '1000'],
        ['BANK', '1010'],
        ['VAT_INPUT', '1300'],
        ['ACCOUNTS_PAYABLE', '2000'],
        ['TDS_PAYABLE', '2220'],
      ];
      await prisma.accountingReportAccountMapping.createMany({
        data: mappings.map(([mappingType, code]) => ({
          tenantId: tenant.id,
          mappingType,
          accountId: account[code],
        })),
      });
      const created: School = {
        tenantId: tenant.id,
        accountant,
        approver,
        payer,
        allDuties,
        account,
        periodIds,
      };
      schools.push(created);
      return created;
    });
  }

  const createVendor = (
    target: School,
    legalName: string,
    panNumber?: string,
  ) =>
    scope(target, () =>
      payables.createVendor(target.accountant, { legalName, panNumber }),
    );

  async function draftBill(
    target: School,
    vendorId: string,
    overrides: Partial<{
      expenseDate: string;
      dueDate: string;
      amount: string;
      taxAmount: string;
      vendorBillNumber: string;
      idempotencyKey: string;
      expenseAccountId: string;
    }> = {},
  ) {
    return scope(target, () =>
      payables.createBill(target.accountant, {
        idempotencyKey: overrides.idempotencyKey ?? randomUUID(),
        vendorId,
        vendorBillNumber: overrides.vendorBillNumber,
        expenseDate: overrides.expenseDate ?? '2030-02-01',
        dueDate: overrides.dueDate ?? '2030-02-15',
        description: 'Exercise books for term 1',
        expenseAccountId: overrides.expenseAccountId ?? target.account['5200'],
        amount: overrides.amount ?? '10000.00',
        taxAmount: overrides.taxAmount ?? '1300.00',
      }),
    );
  }

  async function postedBill(
    target: School,
    vendorId: string,
    overrides: Parameters<typeof draftBill>[2] = {},
  ) {
    const draft = await draftBill(target, vendorId, overrides);
    const submitted = await scope(target, () =>
      payables.submitBill(target.accountant, draft.id),
    );
    return scope(target, () =>
      payables.approveBill(target.approver, draft.id, {
        expectedFingerprint: submitted.contentFingerprint,
      }),
    );
  }

  const settle = (
    target: School,
    payableId: string,
    body: Partial<{
      amount: string;
      withheldTaxAmount: string;
      settledAt: string;
      idempotencyKey: string;
      paymentAccountId: string;
    }>,
    actor: AuthContext = target.payer,
  ) =>
    scope(target, () =>
      payables.settle(actor, payableId, {
        idempotencyKey: body.idempotencyKey ?? randomUUID(),
        amount: body.amount ?? '1000.00',
        withheldTaxAmount: body.withheldTaxAmount,
        paymentAccountId: body.paymentAccountId ?? target.account['1000'],
        settledAt: body.settledAt ?? '2030-02-10',
      }),
    );

  async function balance(target: School, code: string, toExclusive?: Date) {
    const totals = await prisma.runWithoutTenantScope('ledger check', () =>
      prisma.journalLine.aggregate({
        where: {
          tenantId: target.tenantId,
          chartAccountId: target.account[code],
          journalEntry: {
            status: { in: ['POSTED', 'REVERSED'] },
            ...(toExclusive ? { entryDate: { lt: toExclusive } } : {}),
          },
        },
        _sum: { debit: true, credit: true },
      }),
    );
    return new Prisma.Decimal(totals._sum.debit ?? 0)
      .sub(totals._sum.credit ?? 0)
      .toFixed(2);
  }

  const payableOf = (bill: { payable: { id: string } | null }): string => {
    if (!bill.payable) throw new Error('Expected the bill to have a payable');
    return bill.payable.id;
  };

  const code = (value: string) =>
    expect.objectContaining({
      response: expect.objectContaining({ code: value }),
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    const audit = new AuditService(prisma, cls);
    const posting = new AccountingPostingService(prisma, audit);
    payables = new PayablesService(prisma, audit, posting);
    reports = new AccountingReportsService(prisma, audit);
    resolver = new AccountingSourceResolverService(prisma);
    pool = new Pool({ connectionString: authTestDatabaseUrl, max: 2 });
    school = await makeSchool('Phase 7.11c school');
    other = await makeSchool('Phase 7.11c other school');
  });

  afterAll(async () => {
    for (const target of schools.splice(0)) {
      await withLedgerGuardsOff(async (query) => {
        await query(
          `DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "tenantId" = $1)`,
          [target.tenantId],
        );
        await query(
          `DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "tenantId" = $1)`,
          [target.tenantId],
        );
        const tables = await query(
          `SELECT DISTINCT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'tenantId'`,
        );
        for (const row of tables.rows as { table_name: string }[]) {
          await query(`DELETE FROM "${row.table_name}" WHERE "tenantId" = $1`, [
            target.tenantId,
          ]);
        }
        await query('DELETE FROM "Tenant" WHERE "id" = $1', [target.tenantId]);
      });
    }
    await pool?.end();
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('posts an approved bill to AP, pays it in parts with withheld tax, and ages it against the ledger', async () => {
    const vendor = await createVendor(
      school,
      'Sagarmatha Stationers Pvt. Ltd.',
      '600123456',
    );
    expect(vendor.vendorCode).toMatch(/^VEN-\d{4}$/);

    const key = randomUUID();
    const draft = await draftBill(school, vendor.id, {
      idempotencyKey: key,
      vendorBillNumber: 'SS-1001',
    });
    expect(draft.status).toBe('DRAFT');
    expect(draft.totalAmount).toBe('11300.00');
    // A retried create returns the same draft.
    const again = await draftBill(school, vendor.id, {
      idempotencyKey: key,
      vendorBillNumber: 'SS-1001',
    });
    expect(again.id).toBe(draft.id);

    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    expect(submitted.authorization.capabilities.approve).toBe(false);

    // A stale fingerprint is refused.
    await expect(
      scope(school, () =>
        payables.approveBill(school.approver, draft.id, {
          expectedFingerprint: '0'.repeat(64),
        }),
      ),
    ).rejects.toEqual(code('EXPENSE_CHANGED'));

    const posted = await scope(school, () =>
      payables.approveBill(school.approver, draft.id, {
        expectedFingerprint: submitted.contentFingerprint,
      }),
    );
    expect(posted.status).toBe('POSTED');
    expect(posted.payable).toMatchObject({
      status: 'OPEN',
      originalAmount: '11300.00',
      outstandingAmount: '11300.00',
    });
    expect(posted.events.map((e) => e.duty)).toEqual([
      'PREPARE',
      'SUBMIT',
      'APPROVE',
    ]);

    const journal = await prisma.runWithoutTenantScope('check', () =>
      prisma.journalEntry.findFirstOrThrow({
        where: {
          tenantId: school.tenantId,
          sourceModule: 'PAYABLES',
          sourceId: draft.id,
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      }),
    );
    expect(journal.entryDate.toISOString().slice(0, 10)).toBe('2030-02-01');
    expect(
      journal.lines.map((l) => [
        l.chartAccountId,
        money(l.debit),
        money(l.credit),
      ]),
    ).toEqual([
      [school.account['5200'], '10000.00', '0.00'],
      [school.account['1300'], '1300.00', '0.00'],
      [school.account['2000'], '0.00', '11300.00'],
    ]);
    const batch = await prisma.runWithoutTenantScope('check', () =>
      prisma.accountingPostingBatch.findFirstOrThrow({
        where: { tenantId: school.tenantId, journalEntryId: journal.id },
      }),
    );
    expect(batch).toMatchObject({ sourceModule: 'M11', status: 'POSTED' });

    // The resolver shows the bill and its approval chain; others see "restricted".
    const sources = await scope(school, () =>
      resolver.resolve(school.payer, [journal]),
    );
    expect(sources.get(journal.id)).toMatchObject({
      kind: 'VENDOR_BILL',
      restricted: false,
      status: 'POSTED',
    });
    expect(sources.get(journal.id)?.approvals.map((a) => a.duty)).toEqual([
      'PREPARE',
      'SUBMIT',
      'APPROVE',
    ]);
    const outsider = {
      ...school.payer,
      permissions: ['accounting:read'],
    } as AuthContext;
    const hidden = await scope(school, () =>
      resolver.resolve(outsider, [journal]),
    );
    expect(hidden.get(journal.id)).toMatchObject({
      kind: 'VENDOR_BILL',
      restricted: true,
    });

    const payableId = payableOf(posted);

    const payKey = randomUUID();
    const partial = await settle(school, payableId, {
      idempotencyKey: payKey,
      amount: '5000.00',
      withheldTaxAmount: '150.00',
      settledAt: '2030-02-10',
    });
    expect(partial).toMatchObject({
      status: 'PARTIALLY_PAID',
      outstandingAmount: '6300.00',
    });
    expect(partial.settlements[0]).toMatchObject({
      amount: '5000.00',
      withheldTaxAmount: '150.00',
      cashAmount: '4850.00',
    });
    // Replay: no second payment.
    const replay = await settle(school, payableId, {
      idempotencyKey: payKey,
      amount: '5000.00',
      withheldTaxAmount: '150.00',
      settledAt: '2030-02-10',
    });
    expect(replay.settlements).toHaveLength(1);
    await expect(
      settle(school, payableId, { idempotencyKey: payKey, amount: '4000.00' }),
    ).rejects.toEqual(code('IDEMPOTENCY_KEY_REUSED'));
    await expect(
      settle(school, payableId, { amount: '7000.00', settledAt: '2030-03-05' }),
    ).rejects.toEqual(code('SETTLEMENT_EXCEEDS_OUTSTANDING'));
    await expect(
      settle(school, payableId, { amount: '100.00', settledAt: '2030-01-20' }),
    ).rejects.toEqual(code('SETTLEMENT_BEFORE_BILL'));
    await expect(
      settle(school, payableId, {
        amount: '100.00',
        paymentAccountId: school.account['1500'],
      }),
    ).rejects.toEqual(code('PAYMENT_ACCOUNT_INVALID'));

    const paid = await settle(school, payableId, {
      amount: '6300.00',
      settledAt: '2030-03-05',
      paymentAccountId: school.account['1010'],
    });
    expect(paid).toMatchObject({ status: 'PAID', outstandingAmount: '0.00' });

    // Aging is as of a day and matches the AP ledger on that day.
    const mid = await scope(school, () =>
      payables.getPayablesAging(school.payer, { asOfDate: '2030-02-20' }),
    );
    expect(mid.totals.totalOutstanding).toBe('6300.00');
    expect(mid.rows[0]).toMatchObject({ bucket: '0-30', daysOverdue: 5 });
    expect(mid.ledger).toMatchObject({ balance: '6300.00', matches: true });
    const before = await scope(school, () =>
      payables.getPayablesAging(school.payer, { asOfDate: '2030-02-05' }),
    );
    expect(before.totals.totalOutstanding).toBe('11300.00');
    expect(before.rows[0].bucket).toBe('CURRENT');
    expect(before.ledger?.matches).toBe(true);
    const after = await scope(school, () =>
      payables.getPayablesAging(school.payer, { asOfDate: '2030-03-31' }),
    );
    expect(after.totals.totalOutstanding).toBe('0.00');
    expect(after.ledger).toMatchObject({ balance: '0.00', matches: true });

    expect(await balance(school, '2000')).toBe('0.00');
    expect(await balance(school, '2220')).toBe('-150.00');
    expect(await balance(school, '1000')).toBe('-4850.00');
    expect(await balance(school, '1010')).toBe('-6300.00');
    expect(await balance(school, '1300')).toBe('1300.00');
  });

  it('reverses payments, then the bill; the payable becomes void and AP returns to zero', async () => {
    const vendor = await createVendor(school, 'Annapurna Furniture Udhyog');
    const posted = await postedBill(school, vendor.id, {
      amount: '4000.00',
      taxAmount: '0',
      vendorBillNumber: 'AF-77',
    });
    const payableId = payableOf(posted);
    const paid = await settle(school, payableId, { amount: '4000.00' });
    expect(paid.status).toBe('PAID');
    const settlementId = paid.settlements[0].id;

    await expect(
      scope(school, () =>
        payables.reverseBill(school.accountant, posted.id, {
          reason: 'Wrong vendor',
          reversalDate: '2030-02-20',
        }),
      ),
    ).rejects.toEqual(code('PAYABLE_HAS_PAYMENTS'));

    const restored = await scope(school, () =>
      payables.reverseSettlement(school.accountant, settlementId, {
        reason: 'Cheque bounced',
        reversalDate: '2030-02-20',
      }),
    );
    expect(restored).toMatchObject({
      status: 'OPEN',
      outstandingAmount: '4000.00',
    });
    expect(restored.settlements).toHaveLength(2);
    expect(restored.settlements[1]).toMatchObject({
      amount: '-4000.00',
      reversalOfId: settlementId,
    });
    await expect(
      scope(school, () =>
        payables.reverseSettlement(school.accountant, settlementId, {
          reason: 'Again',
          reversalDate: '2030-02-21',
        }),
      ),
    ).rejects.toEqual(code('SETTLEMENT_ALREADY_REVERSED'));

    const reversed = await scope(school, () =>
      payables.reverseBill(school.accountant, posted.id, {
        reason: 'Wrong vendor',
        reversalDate: '2030-02-21',
      }),
    );
    expect(reversed.status).toBe('REVERSED');
    expect(reversed.payable?.status).toBe('VOID');
    await expect(
      settle(school, payableId, { amount: '10.00', settledAt: '2030-02-22' }),
    ).rejects.toEqual(code('PAYABLE_NOT_OPEN'));

    // Aging before the reversal still shows the bill; after, nothing.
    const asOfBefore = await scope(school, () =>
      payables.getPayablesAging(school.payer, {
        asOfDate: '2030-02-20',
        vendorId: vendor.id,
      }),
    );
    expect(asOfBefore.totals.totalOutstanding).toBe('4000.00');
    const asOfAfter = await scope(school, () =>
      payables.getPayablesAging(school.payer, {
        asOfDate: '2030-02-21',
        vendorId: vendor.id,
      }),
    );
    expect(asOfAfter.totals.totalOutstanding).toBe('0.00');
    expect(asOfAfter.ledger?.matches).toBe(true);

    // The bill number can be recorded again after a reversal.
    const replacement = await draftBill(school, vendor.id, {
      vendorBillNumber: 'AF-77',
    });
    expect(replacement.status).toBe('DRAFT');
  });

  it('keeps preparer, approver, payer and reverser apart even for a user holding every duty', async () => {
    const all = school.allDuties;
    const vendor = await createVendor(school, 'Separation of Duties Mart');
    // 1. The preparer cannot approve their own bill.
    const own = await scope(school, () =>
      payables.createBill(all, {
        idempotencyKey: randomUUID(),
        vendorId: vendor.id,
        expenseDate: '2030-02-01',
        description: 'Prepared by the all-duties user',
        expenseAccountId: school.account['5200'],
        amount: '200.00',
      }),
    );
    const ownSubmitted = await scope(school, () =>
      payables.submitBill(all, own.id),
    );
    expect(ownSubmitted.authorization.capabilities.approve).toBe(false);
    await expect(
      scope(school, () =>
        payables.approveBill(all, own.id, {
          expectedFingerprint: ownSubmitted.contentFingerprint,
        }),
      ),
    ).rejects.toEqual(code('SELF_APPROVAL_PROHIBITED'));
    await expect(
      scope(school, () =>
        payables.rejectBill(all, own.id, { reason: 'Self review' }),
      ),
    ).rejects.toEqual(code('SELF_APPROVAL_PROHIBITED'));

    // 2. The approver cannot pay or reverse what they approved.
    const draft = await draftBill(school, vendor.id, {
      amount: '300.00',
      taxAmount: '0',
    });
    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    const approved = await scope(school, () =>
      payables.approveBill(all, draft.id, {
        expectedFingerprint: submitted.contentFingerprint,
      }),
    );
    expect(approved.authorization.capabilities.reverse).toBe(false);
    const payable = await scope(school, () =>
      payables.getPayable(all, payableOf(approved)),
    );
    expect(payable.authorization.capabilities.settle).toBe(false);
    await expect(
      settle(school, payableOf(approved), { amount: '300.00' }, all),
    ).rejects.toEqual(code('SELF_APPROVAL_PROHIBITED'));
    await expect(
      scope(school, () =>
        payables.reverseBill(all, draft.id, {
          reason: 'Self reversal',
          reversalDate: '2030-02-20',
        }),
      ),
    ).rejects.toEqual(code('SELF_APPROVAL_PROHIBITED'));

    // 3. The payer cannot reverse their own payment.
    const other = await postedBill(school, vendor.id, {
      amount: '150.00',
      taxAmount: '0',
    });
    const paid = await settle(
      school,
      payableOf(other),
      { amount: '150.00' },
      all,
    );
    expect(paid.settlements[0].authorization.capabilities.reverse).toBe(false);
    await expect(
      scope(school, () =>
        payables.reverseSettlement(all, paid.settlements[0].id, {
          reason: 'Self reversal',
          reversalDate: '2030-02-20',
        }),
      ),
    ).rejects.toEqual(code('SELF_APPROVAL_PROHIBITED'));
  });

  it('rejects with a reason back to draft, and refuses duplicates and bad input with stable codes', async () => {
    const vendor = await createVendor(
      school,
      'Kathmandu Printers',
      '600999888',
    );
    await expect(createVendor(school, 'KATHMANDU   printers')).rejects.toEqual(
      code('VENDOR_DUPLICATE'),
    );
    await expect(
      createVendor(school, 'Another Printer', '600999888'),
    ).rejects.toEqual(code('VENDOR_PAN_DUPLICATE'));

    const draft = await draftBill(school, vendor.id, {
      vendorBillNumber: 'KP-1',
    });
    await expect(
      draftBill(school, vendor.id, { vendorBillNumber: 'kp-1 ' }),
    ).rejects.toEqual(code('VENDOR_BILL_DUPLICATE'));
    await expect(
      draftBill(school, vendor.id, {
        expenseAccountId: school.account['1500'],
      }),
    ).rejects.toEqual(code('EXPENSE_ACCOUNT_INVALID'));
    await expect(
      draftBill(school, vendor.id, {
        expenseDate: '2031-06-01',
        dueDate: '2031-06-30',
      }),
    ).rejects.toEqual(code('FISCAL_PERIOD_NOT_FOUND'));

    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    await expect(
      scope(school, () =>
        payables.updateBill(school.accountant, draft.id, { amount: '1.00' }),
      ),
    ).rejects.toEqual(code('EXPENSE_STATE_CONFLICT'));
    const rejected = await scope(school, () =>
      payables.rejectBill(school.approver, draft.id, {
        reason: 'Attach the bill copy',
      }),
    );
    expect(rejected.status).toBe('DRAFT');
    expect(rejected.rejection?.reason).toBe('Attach the bill copy');
    const edited = await scope(school, () =>
      payables.updateBill(school.accountant, draft.id, { amount: '9000.00' }),
    );
    expect(edited.totalAmount).toBe('10300.00');
    expect(edited.contentFingerprint).not.toBe(submitted.contentFingerprint);
    const resubmitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    // The approver's old view is stale.
    await expect(
      scope(school, () =>
        payables.approveBill(school.approver, draft.id, {
          expectedFingerprint: submitted.contentFingerprint,
        }),
      ),
    ).rejects.toEqual(code('EXPENSE_CHANGED'));
    const posted = await scope(school, () =>
      payables.approveBill(school.approver, draft.id, {
        expectedFingerprint: resubmitted.contentFingerprint,
      }),
    );
    expect(posted.status).toBe('POSTED');
  });

  it('refuses to post without the AP or TDS mapping and never creates accounts', async () => {
    const vendor = await createVendor(school, 'Mapping Test Traders');
    const draft = await draftBill(school, vendor.id, {
      amount: '500.00',
      taxAmount: '0',
    });
    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    const accountCount = () =>
      prisma.runWithoutTenantScope('count', () =>
        prisma.chartAccount.count({ where: { tenantId: school.tenantId } }),
      );
    const accountsBefore = await accountCount();
    const removeMapping = (mappingType: 'ACCOUNTS_PAYABLE' | 'TDS_PAYABLE') =>
      prisma.runWithoutTenantScope('remove mapping', () =>
        prisma.accountingReportAccountMapping.deleteMany({
          where: { tenantId: school.tenantId, mappingType },
        }),
      );
    const restoreMapping = (
      mappingType: 'ACCOUNTS_PAYABLE' | 'TDS_PAYABLE',
      accountCode: string,
    ) =>
      prisma.runWithoutTenantScope('restore mapping', () =>
        prisma.accountingReportAccountMapping.create({
          data: {
            tenantId: school.tenantId,
            mappingType,
            accountId: school.account[accountCode],
          },
        }),
      );

    await removeMapping('ACCOUNTS_PAYABLE');
    try {
      await expect(
        scope(school, () =>
          payables.approveBill(school.approver, draft.id, {
            expectedFingerprint: submitted.contentFingerprint,
          }),
        ),
      ).rejects.toEqual(code('PAYABLES_MAPPING_MISSING'));
      const setup = await scope(school, () => payables.getSetup(school.payer));
      expect(setup).toMatchObject({
        ready: false,
        accountsPayable: { state: 'MISSING' },
      });
    } finally {
      await restoreMapping('ACCOUNTS_PAYABLE', '2000');
    }
    expect(await accountCount()).toBe(accountsBefore);
    const posted = await scope(school, () =>
      payables.approveBill(school.approver, draft.id, {
        expectedFingerprint: submitted.contentFingerprint,
      }),
    );

    await removeMapping('TDS_PAYABLE');
    try {
      await expect(
        settle(school, payableOf(posted), {
          amount: '500.00',
          withheldTaxAmount: '7.50',
        }),
      ).rejects.toEqual(code('PAYABLES_MAPPING_MISSING'));
    } finally {
      await restoreMapping('TDS_PAYABLE', '2220');
    }
    expect(await accountCount()).toBe(accountsBefore);
  });

  it('refuses posting and paying into a locked period', async () => {
    const vendor = await createVendor(school, 'Locked Period Suppliers');
    const posted = await postedBill(school, vendor.id, {
      expenseDate: '2030-04-02',
      dueDate: '2030-04-30',
      amount: '800.00',
      taxAmount: '0',
    });
    const draft = await draftBill(school, vendor.id, {
      expenseDate: '2030-05-03',
      dueDate: '2030-05-30',
      amount: '300.00',
      taxAmount: '0',
    });
    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    await prisma.runWithoutTenantScope('lock May', () =>
      prisma.fiscalPeriod.update({
        where: { id: school.periodIds['2030-05'] },
        data: { status: 'LOCKED' },
      }),
    );
    try {
      await expect(
        scope(school, () =>
          payables.approveBill(school.approver, draft.id, {
            expectedFingerprint: submitted.contentFingerprint,
          }),
        ),
      ).rejects.toThrow(/locked/i);
      await expect(
        settle(school, payableOf(posted), {
          amount: '800.00',
          settledAt: '2030-05-10',
        }),
      ).rejects.toThrow(/locked/i);
      const still = await scope(school, () =>
        payables.getBill(school.payer, draft.id),
      );
      expect(still.status).toBe('SUBMITTED');
      const payable = await scope(school, () =>
        payables.getPayable(school.payer, payableOf(posted)),
      );
      expect(payable).toMatchObject({ status: 'OPEN', settlements: [] });
    } finally {
      await prisma.runWithoutTenantScope('unlock May', () =>
        prisma.fiscalPeriod.update({
          where: { id: school.periodIds['2030-05'] },
          data: { status: 'OPEN' },
        }),
      );
    }
  });

  it('lets exactly one of two concurrent payments for the full balance win', async () => {
    const vendor = await createVendor(school, 'Concurrency Paper House');
    const posted = await postedBill(school, vendor.id, {
      amount: '2500.00',
      taxAmount: '0',
    });
    const payableId = payableOf(posted);
    const results = await Promise.allSettled([
      settle(school, payableId, { amount: '2500.00' }),
      settle(school, payableId, { amount: '2500.00' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      (rejected[0].reason as { getStatus?: () => number }).getStatus?.(),
    ).toBe(409);
    const payable = await scope(school, () =>
      payables.getPayable(school.payer, payableId),
    );
    expect(payable).toMatchObject({
      status: 'PAID',
      outstandingAmount: '0.00',
    });
    expect(payable.settlements).toHaveLength(1);
  });

  it('re-checks the live session and role grant on approve and pay', async () => {
    const vendor = await createVendor(school, 'Session Check Store');
    const draft = await draftBill(school, vendor.id, {
      amount: '100.00',
      taxAmount: '0',
    });
    const submitted = await scope(school, () =>
      payables.submitBill(school.accountant, draft.id),
    );
    await prisma.runWithoutTenantScope('revoke approver grant', () =>
      prisma.userRole.updateMany({
        where: { tenantId: school.tenantId, userId: school.approver.userId },
        data: { revokedAt: new Date() },
      }),
    );
    try {
      await expect(
        scope(school, () =>
          payables.approveBill(school.approver, draft.id, {
            expectedFingerprint: submitted.contentFingerprint,
          }),
        ),
      ).rejects.toThrow(/Insufficient permissions/);
    } finally {
      await prisma.runWithoutTenantScope('restore approver grant', () =>
        prisma.userRole.updateMany({
          where: { tenantId: school.tenantId, userId: school.approver.userId },
          data: { revokedAt: null },
        }),
      );
    }
    const posted = await scope(school, () =>
      payables.approveBill(school.approver, draft.id, {
        expectedFingerprint: submitted.contentFingerprint,
      }),
    );
    await prisma.runWithoutTenantScope('end payer session', () =>
      prisma.refreshToken.updateMany({
        where: { userId: school.payer.userId },
        data: { revokedAt: new Date() },
      }),
    );
    try {
      await expect(
        settle(school, payableOf(posted), { amount: '100.00' }),
      ).rejects.toThrow(/Session has ended/);
    } finally {
      await prisma.runWithoutTenantScope('restore payer session', () =>
        prisma.refreshToken.updateMany({
          where: { userId: school.payer.userId },
          data: { revokedAt: null },
        }),
      );
    }
  });

  it('keeps schools apart', async () => {
    const vendor = await createVendor(school, 'Isolation Supplies');
    const draft = await draftBill(school, vendor.id, {
      amount: '50.00',
      taxAmount: '0',
    });
    await expect(
      scope(other, () => payables.getBill(other.approver, draft.id)),
    ).rejects.toThrow(/not found/i);
    await expect(
      scope(other, () => payables.submitBill(other.accountant, draft.id)),
    ).rejects.toThrow(/not found/i);
    // Another school's vendor and account cannot be used on a bill.
    await expect(
      scope(other, () =>
        payables.createBill(other.accountant, {
          idempotencyKey: randomUUID(),
          vendorId: vendor.id,
          expenseDate: '2030-02-01',
          description: 'Cross-school attempt',
          expenseAccountId: other.account['5200'],
          amount: '10.00',
        }),
      ),
    ).rejects.toThrow(/not found/i);
    const list = await scope(other, () =>
      payables.listBills(other.approver, { page: 1, limit: 50 }),
    );
    expect(list.items.map((item) => item.id)).not.toContain(draft.id);
  });

  it('Phase 7.12: saves account mappings only live-authorized, validated and audited in one transaction', async () => {
    const admin = await prisma.runWithoutTenantScope('settings actor', () =>
      makeActor(other.tenantId, 'p711c', 'settings', [
        'accounting:settings:update',
        'accounting:settings:read',
      ]),
    );
    const current = await scope(other, () =>
      prisma.accountingReportAccountMapping.findMany({
        where: { tenantId: other.tenantId },
        select: { mappingType: true, accountId: true },
      }),
    );
    const save = (
      mappings: { mappingType: string; accountId: string }[],
      actor: AuthContext = admin,
    ) =>
      scope(other, () =>
        reports.updateReportMappings(actor, { mappings } as never),
      );
    // No settings duty: refused before anything is read.
    await expect(save(current, other.accountant)).rejects.toThrow(
      /not authorized/i,
    );
    await expect(
      save([
        ...current.filter((m) => m.mappingType !== 'ACCOUNTS_PAYABLE'),
        { mappingType: 'ACCOUNTS_PAYABLE', accountId: other.account['5200'] },
      ]),
    ).rejects.toThrow(/ACCOUNTS_PAYABLE must map to LIABILITY/);
    await expect(
      save([
        ...current,
        { mappingType: 'CASH', accountId: other.account['2000'] },
      ]),
    ).rejects.toThrow(/CASH must map to ASSET/);
    await expect(
      save([
        ...current,
        { mappingType: 'ACCOUNTS_PAYABLE', accountId: other.account['2220'] },
      ]),
    ).rejects.toThrow(/exactly one Accounts Payable/);
    await expect(
      save([
        ...current,
        { mappingType: 'CASH', accountId: other.account['1000'] },
      ]),
    ).rejects.toThrow(/mapped twice/);
    // Nothing changed after the refusals.
    expect(
      await scope(other, () =>
        prisma.accountingReportAccountMapping.count({
          where: { tenantId: other.tenantId },
        }),
      ),
    ).toBe(current.length);
    // A revoked session cannot save.
    await prisma.runWithoutTenantScope('end session', () =>
      prisma.refreshToken.updateMany({
        where: { userId: admin.userId },
        data: { revokedAt: new Date() },
      }),
    );
    await expect(save(current)).rejects.toThrow(/Session has ended/);
    await prisma.runWithoutTenantScope('restore session', () =>
      prisma.refreshToken.updateMany({
        where: { userId: admin.userId },
        data: { revokedAt: null },
      }),
    );
    // A valid save records before and after in the same transaction.
    const bank = current.filter((m) => m.mappingType !== 'BANK');
    await save(bank);
    const record = await scope(other, () =>
      prisma.auditLog.findFirstOrThrow({
        where: {
          tenantId: other.tenantId,
          resource: 'accounting_report_mapping',
          userId: admin.userId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(JSON.stringify(record.before)).toContain('BANK');
    expect(JSON.stringify(record.after)).not.toContain('BANK');
    await save(current);
  });

  describe('database guards (direct SQL)', () => {
    let billId: string;
    let payableId: string;
    let settlementId: string;

    beforeAll(async () => {
      const vendor = await createVendor(school, 'Guard Test Vendor');
      const posted = await postedBill(school, vendor.id, {
        amount: '1000.00',
        taxAmount: '0',
      });
      billId = posted.id;
      payableId = payableOf(posted);
      const paid = await settle(school, payableId, { amount: '400.00' });
      settlementId = paid.settlements[0].id;
    });

    const sql = (text: string, values: unknown[] = []) =>
      pool.query(text, values);

    it('makes a posted bill immutable and keeps the state machine', async () => {
      await expect(
        sql(
          `UPDATE "FinanceExpense" SET "amount" = 1, "totalAmount" = 1 WHERE "id" = $1`,
          [billId],
        ),
      ).rejects.toThrow(/FinanceExpense_guard/);
      await expect(
        sql(`UPDATE "FinanceExpense" SET "status" = 'DRAFT' WHERE "id" = $1`, [
          billId,
        ]),
      ).rejects.toThrow(/FinanceExpense_guard/);
      await expect(
        sql(`DELETE FROM "FinanceExpense" WHERE "id" = $1`, [billId]),
      ).rejects.toThrow(/FinanceExpense_guard/);
      await expect(
        sql(
          `INSERT INTO "FinanceExpense" ("id","tenantId","expenseNumber","fiscalYearId","expenseDate","description","expenseAccountId","amount","totalAmount","status","updatedAt")
           SELECT gen_random_uuid()::text, "tenantId", 'X-1', "fiscalYearId", "expenseDate", 'x', "expenseAccountId", 1, 1, 'POSTED', now()
             FROM "FinanceExpense" WHERE "id" = $1`,
          [billId],
        ),
      ).rejects.toThrow(/FinanceExpense_guard/);
      // A paid bill cannot be reversed even by SQL.
      await expect(
        sql(
          `UPDATE "FinanceExpense" SET "status" = 'REVERSED', "reversedAt" = now(), "reversedById" = 'x', "correctionReason" = 'x' WHERE "id" = $1`,
          [billId],
        ),
      ).rejects.toThrow(/FinanceExpense_guard/);
    });

    it('lets only settlements move a payable balance', async () => {
      await expect(
        sql(
          `UPDATE "FinancePayable" SET "outstandingAmount" = 0, "status" = 'PAID' WHERE "id" = $1`,
          [payableId],
        ),
      ).rejects.toThrow(/FinancePayable_guard/);
      await expect(
        sql(
          `UPDATE "FinancePayable" SET "status" = 'VOID', "voidedAt" = now(), "voidReason" = 'x', "outstandingAmount" = "originalAmount" WHERE "id" = $1`,
          [payableId],
        ),
      ).rejects.toThrow(/FinancePayable_guard/);
      await expect(
        sql(`DELETE FROM "FinancePayable" WHERE "id" = $1`, [payableId]),
      ).rejects.toThrow(/FinancePayable_guard/);
    });

    it('keeps settlements append-only, within the balance and by an independent payer', async () => {
      await expect(
        sql(
          `UPDATE "FinancePayableSettlement" SET "amount" = 1 WHERE "id" = $1`,
          [settlementId],
        ),
      ).rejects.toThrow(/FinancePayableSettlement_guard/);
      await expect(
        sql(`DELETE FROM "FinancePayableSettlement" WHERE "id" = $1`, [
          settlementId,
        ]),
      ).rejects.toThrow(/FinancePayableSettlement_guard/);
      const insert = (amount: string, withheld: string, createdBy: string) =>
        sql(
          `INSERT INTO "FinancePayableSettlement" ("id","tenantId","payableId","amount","withheldTaxAmount","cashAmount","paymentAccountId","settledAt","idempotencyKey","createdById")
           VALUES (gen_random_uuid()::text, $1, $2, $3::numeric, $4::numeric, $3::numeric - $4::numeric, $5, '2030-02-11', gen_random_uuid()::text, $6)`,
          [
            school.tenantId,
            payableId,
            amount,
            withheld,
            school.account['1000'],
            createdBy,
          ],
        );
      await expect(
        insert('100.00', '150.00', school.payer.userId),
      ).rejects.toThrow(/FinancePayableSettlement_amounts/);
      await expect(insert('700.00', '0', school.payer.userId)).rejects.toThrow(
        /FinancePayableSettlement_guard/,
      );
      await expect(
        insert('10.00', '0', school.approver.userId),
      ).rejects.toThrow(/payer must differ/);
      await expect(insert('-10.00', '0', school.payer.userId)).rejects.toThrow(
        /FinancePayableSettlement_amounts/,
      );
    });

    it('enforces vendor PAN format and an independent approver', async () => {
      await expect(
        sql(
          `UPDATE "FinanceVendor" SET "panNumber" = 'ABC' WHERE "tenantId" = $1`,
          [school.tenantId],
        ),
      ).rejects.toThrow(/FinanceVendor_pan_format/);
      const vendor = await createVendor(school, 'Approver Check Vendor');
      const draft = await draftBill(school, vendor.id, {
        amount: '10.00',
        taxAmount: '0',
      });
      await expect(
        sql(
          `UPDATE "FinanceExpense" SET "approvedById" = "createdById" WHERE "id" = $1`,
          [draft.id],
        ),
      ).rejects.toThrow(/FinanceExpense_independent_approver/);
      await expect(
        sql(`UPDATE "FinanceExpense" SET "taxAmount" = 5 WHERE "id" = $1`, [
          draft.id,
        ]),
      ).rejects.toThrow(/FinanceExpense_amounts/);
    });
  });
});
