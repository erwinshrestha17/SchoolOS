import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { JournalLineSide, JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AccountingService } from '../src/accounting/accounting.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AccountingReportsService } from '../src/accounting/accounting-reports.service';
import { AccountingSourceResolverService } from '../src/accounting/accounting-source-resolver.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import {
  closeLedgerFixturePool,
  purgeGuardedLedgerRows,
} from './helpers/ledger-fixture';

/**
 * Phase 7.11a — every statement equals an independent aggregation of the
 * ledger, on real PostgreSQL, for a scenario that exercises the defects the
 * audit found: a reversed journal, a closed prior year, an INCOME-type
 * account, a late-in-the-day entry on a report end date, cross-year opening
 * balances and general-ledger pagination.
 *
 * Expected figures are written out by hand so the test does not grade the
 * reports against themselves.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

describeDatabase('Accounting reports equal the ledger (Phase 7.11a)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let posting: AccountingPostingService;
  let accounting: AccountingService;
  let reports: AccountingReportsService;
  let tenantId: string;
  let actor: AuthContext;
  let fy1: string;
  let fy2: string;
  const account: Record<string, string> = {};
  let wrongSalaryEntryId: string;
  let reversalEntryId: string;

  const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
  const scope = <T>(work: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, work);
  const dec = (value: Prisma.Decimal.Value | null | undefined) =>
    D(value ?? 0).toFixed(2);

  async function post(
    date: string,
    narration: string,
    lines: [string, 'D' | 'C', number][],
    source: { sourceType?: JournalSourceType; sourceId?: string } = {},
  ) {
    return posting.postManualJournal(
      {
        tenantId,
        entryDate: new Date(date),
        narration,
        sourceModule: 'ACCOUNTING',
        sourceType: source.sourceType ?? JournalSourceType.MANUAL,
        sourceId: source.sourceId ?? null,
        lines: lines.map(([code, side, amount]) => ({
          chartAccountId: account[code],
          debit: side === 'D' ? amount : 0,
          credit: side === 'C' ? amount : 0,
        })),
      },
      actor,
    );
  }

  async function ledgerSigned(
    accountCode: string,
    where: Prisma.Sql = Prisma.sql`TRUE`,
  ): Promise<string> {
    const rows = await scope(() =>
      prisma.$queryRaw<{ signed: string | null }[]>(
        Prisma.sql`
        SELECT SUM(l."debit" - l."credit")::text AS "signed"
        FROM "JournalLine" l
        JOIN "JournalEntry" e ON e."id" = l."journalEntryId"
        WHERE l."tenantId" = ${tenantId}
          AND l."chartAccountId" = ${account[accountCode]}
          AND e."status" IN ('POSTED', 'REVERSED')
          AND ${where}`,
      ),
    );
    return dec(rows[0]?.signed);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    const audit = new AuditService(prisma, cls);
    posting = new AccountingPostingService(prisma, audit);
    accounting = new AccountingService(
      prisma,
      audit,
      posting,
      undefined,
      new AccountingSourceResolverService(prisma),
    );
    reports = new AccountingReportsService(prisma, audit);

    await prisma.runWithoutTenantScope(
      'isolated Phase 7.11a report conformance fixtures',
      async () => {
        const tenant = await prisma.tenant.create({
          data: {
            name: 'Phase 7.11a report conformance',
            slug: `p711a-${randomUUID()}`,
          },
        });
        tenantId = tenant.id;
        const permissions = [
          'accounting:fiscal:manage',
          'accounting:reports:read',
          'accounting:read',
          'accounting:journals:read',
        ];
        const grants = await Promise.all(
          permissions.map((key) => {
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
        const user = await prisma.user.create({
          data: {
            tenantId,
            email: 'accountant@p711a.test',
            status: 'ACTIVE',
          },
        });
        const role = await prisma.role.create({
          data: {
            tenantId,
            name: 'p711a-accountant',
            rolePermissions: {
              create: grants.map((grant) => ({ permissionId: grant.id })),
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
            expiresAt: new Date(Date.now() + 600_000),
          },
        });
        actor = {
          userId: user.id,
          tenantId,
          tenantSlug: tenant.slug,
          email: user.email,
          sessionFamilyId: familyId,
          authMethod: 'PASSWORD',
          roles: [role.name],
          permissions,
        } as AuthContext;

        const years: [string, number][] = [
          ['FY 2030', 2030],
          ['FY 2031', 2031],
        ];
        const ids: string[] = [];
        for (const [name, year] of years) {
          const fy = await prisma.fiscalYear.create({
            data: {
              tenantId,
              name,
              startDate: new Date(Date.UTC(year, 0, 1)),
              endDate: new Date(Date.UTC(year, 11, 31)),
            },
          });
          ids.push(fy.id);
          for (let month = 1; month <= 12; month += 1) {
            const start = new Date(Date.UTC(year, month - 1, 1));
            const end = new Date(Date.UTC(year, month, 0));
            await prisma.fiscalPeriod.create({
              data: {
                tenantId,
                fiscalYearId: fy.id,
                label: `${String(year)}-${String(month).padStart(2, '0')}`,
                periodNumber: month,
                startDate: start,
                endDate: end,
              },
            });
          }
        }
        [fy1, fy2] = ids;

        const chart: [
          string,
          string,
          Prisma.ChartAccountCreateInput['type'],
        ][] = [
          ['1000', 'Cash', 'ASSET'],
          ['1200', 'Student receivables', 'ASSET'],
          ['3000', 'Capital', 'EQUITY'],
          ['3100', 'Retained surplus', 'EQUITY'],
          ['4000', 'Tuition fees', 'REVENUE'],
          ['4100', 'Other income', 'INCOME'],
          ['5000', 'Salaries', 'EXPENSE'],
        ];
        for (const [code, name, type] of chart) {
          account[code] = (
            await prisma.chartAccount.create({
              data: { tenantId, code, name, type },
            })
          ).id;
        }
        await prisma.accountingReportAccountMapping.create({
          data: {
            tenantId,
            mappingType: 'CASH',
            accountId: account['1000'],
          },
        });
      },
    );

    await scope(async () => {
      // FY 2030
      await post(
        '2030-01-05T04:00:00.000Z',
        'Opening capital',
        [
          ['1000', 'D', 10000],
          ['3000', 'C', 10000],
        ],
        { sourceType: JournalSourceType.OPENING_BALANCE, sourceId: fy1 },
      );
      await post('2030-02-10T04:00:00.000Z', 'Tuition billed', [
        ['1200', 'D', 5000],
        ['4000', 'C', 5000],
      ]);
      // Late in the UTC day on a report end date.
      await post('2030-02-20T23:30:00.000Z', 'Fees received', [
        ['1000', 'D', 3000],
        ['1200', 'C', 3000],
      ]);
      await post('2030-03-01T04:00:00.000Z', 'Hall hire', [
        ['1000', 'D', 200],
        ['4100', 'C', 200],
      ]);
      await post('2030-03-15T04:00:00.000Z', 'Salaries paid', [
        ['5000', 'D', 2500],
        ['1000', 'C', 2500],
      ]);
      const wrong = await post('2030-03-20T04:00:00.000Z', 'Duplicate salary', [
        ['5000', 'D', 999],
        ['1000', 'C', 999],
      ]);
      wrongSalaryEntryId = wrong.id;
      const reversal = await posting.postReversal(
        {
          tenantId,
          originalEntryId: wrong.id,
          reversalDate: new Date('2030-03-21T04:00:00.000Z'),
          narration: 'Reverse duplicate salary',
          reason: 'Posted twice',
          lines: [
            {
              chartAccountId: account['1000'],
              side: JournalLineSide.DEBIT,
              amount: D(999),
              description: 'Reverse',
            },
            {
              chartAccountId: account['5000'],
              side: JournalLineSide.CREDIT,
              amount: D(999),
              description: 'Reverse',
            },
          ],
        },
        actor,
      );
      reversalEntryId = reversal.id;
    });

    // Close FY 2030 through the real service (all periods closed first).
    await prisma.runWithoutTenantScope('close fixture periods', () =>
      prisma.fiscalPeriod.updateMany({
        where: { tenantId, fiscalYearId: fy1 },
        data: { status: 'CLOSED', closedAt: new Date() },
      }),
    );
    await scope(() =>
      accounting.closeFiscalYear(fy1, { reason: 'Year end 2030' }, actor),
    );

    // FY 2031
    await scope(async () => {
      await post('2031-01-10T04:00:00.000Z', 'Tuition received', [
        ['1000', 'D', 1000],
        ['4000', 'C', 1000],
      ]);
      await post('2031-01-25T04:00:00.000Z', 'Salaries paid', [
        ['5000', 'D', 400],
        ['1000', 'C', 400],
      ]);
    });
  });

  afterAll(async () => {
    await prisma.runWithoutTenantScope(
      'remove only isolated Phase 7.11a fixtures',
      async () => {
        await purgeGuardedLedgerRows(tenantId);
        await prisma.auditLog.deleteMany({ where: { tenantId } });
        await prisma.journalEntrySequence.deleteMany({ where: { tenantId } });
        await prisma.accountingReportAccountMapping.deleteMany({
          where: { tenantId },
        });
        await prisma.chartAccount.deleteMany({ where: { tenantId } });
        await prisma.fiscalPeriod.deleteMany({ where: { tenantId } });
        await prisma.fiscalYear.deleteMany({ where: { tenantId } });
        await prisma.refreshToken.deleteMany({
          where: { user: { tenantId } },
        });
        await prisma.rolePermission.deleteMany({
          where: { role: { tenantId } },
        });
        await prisma.userRole.deleteMany({ where: { tenantId } });
        await prisma.role.deleteMany({ where: { tenantId } });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
      },
    );
    await closeLedgerFixturePool();
    await prisma.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('closes the year including INCOME accounts and the reversed journal', async () => {
    const closing = await scope(() =>
      prisma.journalEntry.findFirstOrThrow({
        where: { tenantId, sourceType: 'CLOSING_ENTRY', sourceId: fy1 },
        include: { lines: true },
      }),
    );
    const byAccount = Object.fromEntries(
      closing.lines.map((line) => [
        line.chartAccountId,
        `${dec(line.debit)}/${dec(line.credit)}`,
      ]),
    );
    expect(byAccount).toEqual({
      [account['4000']]: '5000.00/0.00',
      [account['4100']]: '200.00/0.00',
      [account['5000']]: '0.00/2500.00',
      [account['3100']]: '0.00/2700.00',
    });
  });

  it('reports a reversed journal as zero, not as minus itself', async () => {
    const statement = await scope(() =>
      reports.getIncomeStatement(tenantId, { fiscalYearId: fy1 }),
    );
    expect(dec(statement.totalExpense)).toBe('2500.00');
    expect(dec(statement.totalIncome)).toBe('5200.00');
    expect(statement.resultType).toBe('SURPLUS');
    expect(dec(statement.netSurplusOrDeficit)).toBe('2700.00');
    // INCOME-type account is present.
    const income = statement.sections.find((s) => s.section === 'INCOME');
    expect(income?.accounts.map((a) => a.accountCode)).toEqual([
      '4000',
      '4100',
    ]);
  });

  it('excludes closing entries from the pre-closing trial balance and matches the ledger', async () => {
    const tb = await scope(() =>
      reports.getTrialBalance(tenantId, { fiscalYearId: fy1 }),
    );
    expect(tb.isBalanced).toBe(true);
    expect(tb.stage).toBe('PRE_CLOSING');
    const row = (code: string) =>
      tb.rows.find((r) => r.accountId === account[code]);
    expect(dec(row('1000')?.closingDebit)).toBe('10700.00');
    expect(dec(row('1200')?.closingDebit)).toBe('2000.00');
    expect(dec(row('4000')?.closingCredit)).toBe('5000.00');
    expect(dec(row('4100')?.closingCredit)).toBe('200.00');
    expect(dec(row('5000')?.closingDebit)).toBe('2500.00');
    expect(row('3100')).toBeUndefined();

    // Independent ledger aggregation (excluding the closing entry).
    for (const code of ['1000', '1200', '3000', '4000', '4100', '5000']) {
      const r = row(code);
      const signed = D(String(r?.closingDebit ?? 0)).minus(
        D(String(r?.closingCredit ?? 0)),
      );
      expect({ code, signed: signed.toFixed(2) }).toEqual({
        code,
        signed: await ledgerSigned(
          code,
          Prisma.sql`e."fiscalYearId" = ${fy1} AND e."sourceType" <> 'CLOSING_ENTRY'`,
        ),
      });
    }
  });

  it('carries closed-year balances into the next year and stays balanced', async () => {
    const tb = await scope(() =>
      reports.getTrialBalance(tenantId, { fiscalYearId: fy2 }),
    );
    const row = (code: string) =>
      tb.rows.find((r) => r.accountId === account[code]);
    expect(tb.isBalanced).toBe(true);
    expect(dec(row('1000')?.openingDebit)).toBe('10700.00');
    expect(dec(row('1000')?.closingDebit)).toBe('11300.00');
    expect(dec(row('3100')?.openingCredit)).toBe('2700.00');
    // Income and expense open at zero because the earlier year was closed.
    expect(dec(row('4000')?.openingCredit)).toBe('0.00');
    expect(dec(row('5000')?.openingDebit)).toBe('0.00');
    expect(dec(row('4000')?.closingCredit)).toBe('1000.00');
    expect(dec(tb.totalClosingDebit)).toBe('13700.00');
    expect(dec(tb.totalClosingCredit)).toBe('13700.00');
    expect(tb.setupWarnings).toEqual([]);
  });

  it('builds a cumulative balance sheet across fiscal years', async () => {
    const atYearOneEnd = await scope(() =>
      reports.getBalanceSheet(tenantId, { fiscalYearId: fy1 }),
    );
    expect(atYearOneEnd.isBalanced).toBe(true);
    expect(dec(atYearOneEnd.totalAssets)).toBe('12700.00');
    expect(dec(atYearOneEnd.totalEquity)).toBe('12700.00');
    expect(
      atYearOneEnd.sections
        .find((s) => s.section === 'EQUITY')
        ?.accounts.map((a) => a.accountCode),
    ).toEqual(['3000', '3100']);

    const atYearTwoEnd = await scope(() =>
      reports.getBalanceSheet(tenantId, { fiscalYearId: fy2 }),
    );
    expect(atYearTwoEnd.isBalanced).toBe(true);
    expect(dec(atYearTwoEnd.totalAssets)).toBe('13300.00');
    const equity = atYearTwoEnd.sections.find((s) => s.section === 'EQUITY');
    expect(equity?.accounts.map((a) => [a.accountCode, dec(a.amount)])).toEqual(
      [
        ['3000', '10000.00'],
        ['3100', '2700.00'],
        ['CURRENT_YEAR_RESULT', '600.00'],
      ],
    );
    // Assets equal the ledger up to the as-of date, across years.
    expect(dec(atYearTwoEnd.totalAssets)).toBe(
      D(await ledgerSigned('1000'))
        .plus(await ledgerSigned('1200'))
        .toFixed(2),
    );
  });

  it('includes a late entry on a date-only end bound', async () => {
    const tb = await scope(() =>
      reports.getTrialBalance(tenantId, {
        fiscalYearId: fy1,
        fromDate: '2030-01-01',
        toDate: '2030-02-20',
      }),
    );
    const cash = tb.rows.find((r) => r.accountId === account['1000']);
    expect(dec(cash?.periodDebit)).toBe('13000.00');
  });

  it('keeps general-ledger running balances continuous across pages', async () => {
    const all = await scope(() =>
      reports.getGeneralLedger(tenantId, {
        fiscalYearId: fy1,
        accountId: account['1000'],
        limit: 200,
      }),
    );
    expect(dec(all.closingBalance)).toBe('10700.00');
    expect(dec(all.totals.debit)).toBe('14199.00');
    expect(dec(all.totals.credit)).toBe('3499.00');
    expect(all.rows.map((r) => r.journalEntryId)).toContain(wrongSalaryEntryId);
    expect(
      all.rows.find((r) => r.journalEntryId === wrongSalaryEntryId)
        ?.entryStatus,
    ).toBe('REVERSED');

    const paged: typeof all.rows = [];
    let page = 1;
    let previousClosing: string | null = null;
    for (;;) {
      const result = await scope(() =>
        reports.getGeneralLedger(tenantId, {
          fiscalYearId: fy1,
          accountId: account['1000'],
          limit: 2,
          page,
        }),
      );
      // Same totals and closing on every page.
      expect(dec(result.totals.debit)).toBe('14199.00');
      expect(dec(result.closingBalance)).toBe('10700.00');
      if (previousClosing !== null) {
        expect(dec(result.pageOpeningBalance)).toBe(previousClosing);
      }
      paged.push(...result.rows);
      if (result.rows.length === 0 || page >= result.pagination.totalPages)
        break;
      previousClosing = dec(result.rows[result.rows.length - 1].runningBalance);
      page += 1;
    }
    expect(paged.map((r) => r.journalLineId)).toEqual(
      all.rows.map((r) => r.journalLineId),
    );
    expect(paged.map((r) => dec(r.runningBalance))).toEqual(
      all.rows.map((r) => dec(r.runningBalance)),
    );
  });

  it('agrees between cash book and trial balance', async () => {
    const book = await scope(() =>
      reports.getCashBook(tenantId, {
        fiscalYearId: fy2,
        accountId: account['1000'],
      }),
    );
    expect(dec(book.openingBalance)).toBe('10700.00');
    expect(dec(book.totalReceipts)).toBe('1000.00');
    expect(dec(book.totalPayments)).toBe('400.00');
    expect(dec(book.closingBalance)).toBe('11300.00');
  });

  it('drills from the reversal journal to its original with resolved actors', async () => {
    const detail = await scope(() =>
      accounting.getJournalEntry(reversalEntryId, actor),
    );
    expect(detail.source).toMatchObject({
      kind: 'REVERSAL',
      relatedJournalId: wrongSalaryEntryId,
      restricted: false,
    });
    expect(detail.actors.find((a) => a.duty === 'CREATE')?.actor?.name).toBe(
      'accountant@p711a.test',
    );
    expect(detail.lines.map((l) => l.accountCode)).toEqual(['1000', '5000']);

    const original = await scope(() =>
      accounting.getJournalEntry(wrongSalaryEntryId, actor),
    );
    expect(original.reversedBy?.id).toBe(reversalEntryId);
    expect(original.actors.map((a) => a.duty)).toContain('REVERSE');
  });

  it('does not resolve another tenant journal', async () => {
    const foreign = { ...actor, tenantId: randomUUID() } as AuthContext;
    await expect(
      prisma.runWithTenantScope(foreign.tenantId, () =>
        accounting.getJournalEntry(reversalEntryId, foreign),
      ),
    ).rejects.toThrow('Journal entry not found');
  });
});
