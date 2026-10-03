import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AccountingService } from '../src/accounting/accounting.service';
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
 * Phase 7.11d — fiscal-close preview on real PostgreSQL:
 * - one inventory: reviewed journals, failed posting batches, open cashier
 *   sessions, submitted and draft vendor bills, period order and lock state;
 *   counts hidden (never zero) from viewers who cannot act on them;
 * - the close presents the reviewed fingerprint, acknowledges every warning,
 *   and is refused when anything changed since the preview;
 * - the year preview's closing lines are exactly what the close posts;
 *   an income account with a debit balance closes cleanly;
 * - a reopened year closes again with a supplementary closing entry for the
 *   change only (previously it failed on the closing entry's unique key);
 * - lock and unlock re-check the live grant and audit atomically.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

const PERMISSIONS = [
  'accounting:fiscal:manage',
  'accounting:reports:read',
  'accounting:read',
  'accounting:journals:read',
  'accounting:posting-batches:read',
  'accounting:expenses:read',
  'payments:close',
];

interface School {
  tenantId: string;
  actor: AuthContext;
  fiscalYearId: string;
  period: Record<string, string>;
  account: Record<string, string>;
  vendorId: string;
}

describeDatabase('Phase 7.11d fiscal-close preview', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let audit: AuditService;
  let posting: AccountingPostingService;
  let accounting: AccountingService;
  const schools: School[] = [];

  const scope = <T>(school: School, work: () => Promise<T>) =>
    prisma.runWithTenantScope(school.tenantId, work);
  const raw = <T>(work: () => Promise<T>) =>
    prisma.runWithoutTenantScope('Phase 7.11d fixtures', work);
  const code = (value: string) =>
    expect.objectContaining({
      response: expect.objectContaining({ code: value }),
    });
  const codes = (items: { code: string }[]) =>
    items.map((item) => item.code).sort();

  async function makeSchool(name: string): Promise<School> {
    return raw(async () => {
      const tenant = await prisma.tenant.create({
        data: { name, slug: `p711d-${randomUUID()}` },
      });
      const grants = await Promise.all(
        PERMISSIONS.map((key) => {
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
          tenantId: tenant.id,
          email: `controller-${randomUUID()}@p711d.test`,
          status: 'ACTIVE',
        },
      });
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: `p711d-controller-${randomUUID().slice(0, 6)}`,
          rolePermissions: {
            create: grants.map((grant) => ({ permissionId: grant.id })),
          },
        },
      });
      await prisma.userRole.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
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
      const year = await prisma.fiscalYear.create({
        data: {
          tenantId: tenant.id,
          name: 'FY 2030',
          startDate: new Date(Date.UTC(2030, 0, 1)),
          endDate: new Date(Date.UTC(2030, 11, 31)),
        },
      });
      const period: Record<string, string> = {};
      for (let month = 1; month <= 12; month += 1) {
        const label = `2030-${String(month).padStart(2, '0')}`;
        period[label] = (
          await prisma.fiscalPeriod.create({
            data: {
              tenantId: tenant.id,
              fiscalYearId: year.id,
              label,
              periodNumber: month,
              startDate: new Date(Date.UTC(2030, month - 1, 1)),
              endDate: new Date(Date.UTC(2030, month, 0)),
            },
          })
        ).id;
      }
      const account: Record<string, string> = {};
      const chart: [string, string, Prisma.ChartAccountCreateInput['type']][] =
        [
          ['1000', 'Cash', 'ASSET'],
          ['3100', 'Retained surplus', 'EQUITY'],
          ['4000', 'Tuition', 'REVENUE'],
          ['4100', 'Other income', 'INCOME'],
          ['5000', 'Salaries', 'EXPENSE'],
          ['5200', 'Stationery', 'EXPENSE'],
        ];
      for (const [accountCode, accountName, type] of chart) {
        account[accountCode] = (
          await prisma.chartAccount.create({
            data: {
              tenantId: tenant.id,
              code: accountCode,
              name: accountName,
              type,
            },
          })
        ).id;
      }
      const vendor = await prisma.financeVendor.create({
        data: {
          tenantId: tenant.id,
          vendorCode: 'VEN-0001',
          legalName: 'Close Test Supplies',
          displayName: 'Close Test Supplies',
        },
      });
      const school: School = {
        tenantId: tenant.id,
        fiscalYearId: year.id,
        period,
        account,
        vendorId: vendor.id,
        actor: {
          userId: user.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          email: user.email,
          sessionFamilyId: familyId,
          authMethod: 'PASSWORD',
          roles: [role.name],
          permissions: PERMISSIONS,
        } as AuthContext,
      };
      schools.push(school);
      return school;
    });
  }

  const post = (
    school: School,
    date: string,
    lines: [string, 'D' | 'C', number][],
  ) =>
    scope(school, () =>
      posting.postManualJournal(
        {
          tenantId: school.tenantId,
          entryDate: new Date(`${date}T00:00:00.000Z`),
          narration: `Synthetic ${date}`,
          lines: lines.map(([accountCode, side, amount]) => ({
            chartAccountId: school.account[accountCode],
            ...(side === 'D' ? { debit: amount } : { credit: amount }),
          })),
        },
        school.actor,
      ),
    );

  const draftBill = (school: School, date: string, total: string) =>
    raw(() =>
      prisma.financeExpense.create({
        data: {
          tenantId: school.tenantId,
          expenseNumber: `BILL-${randomUUID().slice(0, 8)}`,
          vendorId: school.vendorId,
          fiscalYearId: school.fiscalYearId,
          expenseDate: new Date(`${date}T00:00:00.000Z`),
          description: 'Synthetic bill',
          expenseAccountId: school.account['5200'],
          amount: total,
          totalAmount: total,
          createdById: school.actor.userId,
        },
      }),
    );

  const setStatus = (
    school: School,
    label: string,
    status: 'OPEN' | 'LOCKED' | 'CLOSED',
  ) =>
    raw(() =>
      prisma.fiscalPeriod.update({
        where: { id: school.period[label] },
        data: { status },
      }),
    );

  const previewPeriod = (school: School, label: string, actor = school.actor) =>
    scope(school, () =>
      accounting.getFiscalPeriodClosePreview(school.period[label], actor),
    );
  const previewYear = (school: School) =>
    scope(school, () =>
      accounting.getFiscalYearClosePreview(school.fiscalYearId, school.actor),
    );
  const closeYear = async (school: School) => {
    const preview = await previewYear(school);
    return scope(school, () =>
      accounting.closeFiscalYear(
        school.fiscalYearId,
        {
          reason: 'Year-end close after review',
          expectedPreviewFingerprint: preview.previewFingerprint,
          acknowledgedWarningCodes: preview.requiredAcknowledgements,
        },
        school.actor,
      ),
    );
  };

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    audit = new AuditService(prisma, cls);
    posting = new AccountingPostingService(prisma, audit);
    accounting = new AccountingService(prisma, audit, posting);
  });

  afterAll(async () => {
    for (const school of schools.splice(0)) {
      await withLedgerGuardsOff(async (query) => {
        await query(
          `DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "tenantId" = $1)`,
          [school.tenantId],
        );
        await query(
          `DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "tenantId" = $1)`,
          [school.tenantId],
        );
        const tables = await query(
          `SELECT DISTINCT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'tenantId'`,
        );
        for (const row of tables.rows as { table_name: string }[]) {
          await query(`DELETE FROM "${row.table_name}" WHERE "tenantId" = $1`, [
            school.tenantId,
          ]);
        }
        await query('DELETE FROM "Tenant" WHERE "id" = $1', [school.tenantId]);
      });
    }
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('lists unfinished work as blockers and warnings and hides counts the viewer cannot act on', async () => {
    const school = await makeSchool('Phase 7.11d inventory school');
    await raw(async () => {
      await prisma.journalEntry.create({
        data: {
          tenantId: school.tenantId,
          fiscalYearId: school.fiscalYearId,
          fiscalPeriodId: school.period['2030-03'],
          entryNumber: `REV-${randomUUID().slice(0, 8)}`,
          entryDate: new Date('2030-03-10T00:00:00.000Z'),
          narration: 'Reviewed, awaiting approval',
          status: 'REVIEWED',
          sourceType: 'MANUAL',
        },
      });
      await prisma.accountingPostingBatch.create({
        data: {
          tenantId: school.tenantId,
          fiscalYearId: school.fiscalYearId,
          fiscalPeriodId: school.period['2030-03'],
          sourceModule: 'M3',
          sourceType: 'FEE_PAYMENT',
          sourceBatchId: randomUUID(),
          status: 'FAILED',
          sourceTotal: 100,
          idempotencyKey: randomUUID(),
        },
      });
      await prisma.cashierClose.create({
        data: {
          tenantId: school.tenantId,
          closeNumber: `CC-${randomUUID().slice(0, 6)}`,
          openedAt: new Date('2030-03-20T03:00:00.000Z'),
          status: 'OPEN',
          grossCollected: 0,
          totalRefunded: 0,
          netCollected: 0,
          paymentCount: 0,
          refundCount: 0,
        },
      });
    });
    const submitted = await draftBill(school, '2030-03-15', '500.00');
    await raw(() =>
      prisma.financeExpense.update({
        where: { id: submitted.id },
        data: {
          status: 'SUBMITTED',
          submittedById: school.actor.userId,
          submittedAt: new Date(),
        },
      }),
    );
    await draftBill(school, '2030-03-16', '200.00');
    // Outside March: must not appear.
    await draftBill(school, '2030-04-02', '999.00');

    const preview = await previewPeriod(school, '2030-03');
    expect(codes(preview.blockers)).toEqual(
      [
        'CASHIER_SESSIONS_OPEN',
        'PERIOD_NOT_LOCKED',
        'POSTING_BATCHES_INCOMPLETE',
        'PREVIOUS_PERIOD_NOT_CLOSED',
        'REVIEWED_JOURNALS',
        'VENDOR_BILLS_SUBMITTED',
      ].sort(),
    );
    expect(
      preview.blockers.find((b) => b.code === 'VENDOR_BILLS_SUBMITTED'),
    ).toMatchObject({ count: 1, amount: '500.00', restricted: false });
    expect(preview.warnings).toEqual([
      expect.objectContaining({
        code: 'VENDOR_BILLS_DRAFT',
        count: 1,
        amount: '200.00',
      }),
    ]);
    expect(preview.requiredAcknowledgements).toEqual(['VENDOR_BILLS_DRAFT']);
    expect(preview.readyToClose).toBe(false);
    expect(preview.authorization.capabilities.close).toBe(false);
    expect(preview.previewFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(preview.consequences.join(' ')).toMatch(/nothing dated/);

    // A reports-only viewer sees every item, with hidden counts, never zero.
    const auditor = {
      ...school.actor,
      permissions: ['accounting:reports:read'],
    } as AuthContext;
    const restricted = await previewPeriod(school, '2030-03', auditor);
    expect(codes(restricted.blockers)).toEqual(codes(preview.blockers));
    for (const hidden of [
      'REVIEWED_JOURNALS',
      'POSTING_BATCHES_INCOMPLETE',
      'CASHIER_SESSIONS_OPEN',
      'VENDOR_BILLS_SUBMITTED',
    ]) {
      expect(restricted.blockers.find((b) => b.code === hidden)).toMatchObject({
        count: null,
        amount: null,
        restricted: true,
      });
    }

    // Period readiness reads the same inventory (new: reviewed journals).
    const readiness = await scope(school, () =>
      accounting.getFiscalPeriodCloseReadiness(
        school.period['2030-03'],
        school.actor,
      ),
    );
    expect(readiness.journals.reviewed).toBe(1);
    expect(codes(readiness.blockers)).toEqual(
      expect.arrayContaining(['REVIEWED_JOURNALS', 'VENDOR_BILLS_SUBMITTED']),
    );
    // Year readiness sees the same work across the year.
    const year = await scope(school, () =>
      accounting.getFiscalYearCloseReadiness(school.fiscalYearId, school.actor),
    );
    expect(codes(year.issues)).toEqual(
      expect.arrayContaining([
        'CASHIER_SESSIONS_OPEN',
        'OPEN_PERIODS',
        'POSTING_BATCHES_INCOMPLETE',
        'REVIEWED_JOURNALS',
        'VENDOR_BILLS_SUBMITTED',
      ]),
    );
  });

  it('closes a period only with the reviewed fingerprint and every warning acknowledged', async () => {
    const school = await makeSchool('Phase 7.11d period school');
    await post(school, '2030-01-05', [
      ['1000', 'D', 100],
      ['4000', 'C', 100],
    ]);
    await draftBill(school, '2030-01-20', '75.00');
    const periodId = school.period['2030-01'];
    await scope(school, () =>
      accounting.lockFiscalPeriod(
        periodId,
        { reason: 'Month-end review' },
        school.actor,
      ),
    );
    const preview = await previewPeriod(school, '2030-01');
    expect(preview.blockers).toEqual([]);
    expect(preview.requiredAcknowledgements).toEqual(['VENDOR_BILLS_DRAFT']);
    expect(preview.authorization.capabilities.close).toBe(true);
    const close = (body: Record<string, unknown>) =>
      scope(school, () =>
        accounting.closeFiscalPeriod(
          periodId,
          { reason: 'Month-end close', ...body },
          school.actor,
        ),
      );

    await expect(close({})).rejects.toEqual(code('CLOSE_PREVIEW_REQUIRED'));
    await expect(
      close({ expectedPreviewFingerprint: preview.previewFingerprint }),
    ).rejects.toEqual(code('CLOSE_WARNINGS_NOT_ACKNOWLEDGED'));

    // Something changes after the preview was reviewed.
    await draftBill(school, '2030-01-21', '25.00');
    await expect(
      close({
        expectedPreviewFingerprint: preview.previewFingerprint,
        acknowledgedWarningCodes: preview.requiredAcknowledgements,
      }),
    ).rejects.toEqual(code('CLOSE_PREVIEW_STALE'));
    expect(
      (
        await raw(() =>
          prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: periodId } }),
        )
      ).status,
    ).toBe('LOCKED');

    const fresh = await previewPeriod(school, '2030-01');
    expect(fresh.warnings[0]).toMatchObject({ count: 2, amount: '100.00' });
    const closed = await close({
      expectedPreviewFingerprint: fresh.previewFingerprint,
      acknowledgedWarningCodes: fresh.requiredAcknowledgements,
    });
    expect(closed.status).toBe('CLOSED');
    const record = await raw(() =>
      prisma.auditLog.findFirstOrThrow({
        where: {
          tenantId: school.tenantId,
          resource: 'fiscal_period',
          action: 'close',
          resourceId: periodId,
        },
      }),
    );
    expect(JSON.stringify(record)).toContain(fresh.previewFingerprint);
    expect(JSON.stringify(record)).toContain('VENDOR_BILLS_DRAFT');

    // February now only waits on its own lock.
    const feb = await previewPeriod(school, '2030-02');
    expect(codes(feb.blockers)).toEqual(['PERIOD_NOT_LOCKED']);
  });

  it('posts exactly the previewed closing lines and closes a reopened year with a supplementary entry', async () => {
    const school = await makeSchool('Phase 7.11d year school');
    await post(school, '2030-02-10', [
      ['1000', 'D', 1000],
      ['4000', 'C', 1000],
    ]);
    // An income account with a net debit balance (e.g. a refund of hall hire).
    await post(school, '2030-03-10', [
      ['4100', 'D', 80],
      ['1000', 'C', 80],
    ]);
    await post(school, '2030-04-10', [
      ['5000', 'D', 300],
      ['1000', 'C', 300],
    ]);
    await raw(() =>
      prisma.fiscalPeriod.updateMany({
        where: { tenantId: school.tenantId },
        data: { status: 'CLOSED', closedAt: new Date() },
      }),
    );

    const preview = await previewYear(school);
    expect(preview.blockers).toEqual([]);
    expect(preview.requiredAcknowledgements).toEqual([
      'OPENING_BALANCE_INCOMPLETE',
    ]);
    expect(preview.closing).toMatchObject({
      postingType: 'FISCAL_YEAR_CLOSE',
      supplementary: false,
      entryDate: '2030-12-31',
      netResult: '620.00',
      resultType: 'SURPLUS',
    });
    expect(
      preview.closing.lines.map((l) => [l.code, l.debit, l.credit]),
    ).toEqual([
      ['4000', '1000.00', '0.00'],
      ['4100', '0.00', '80.00'],
      ['5000', '0.00', '300.00'],
      ['3100', '0.00', '620.00'],
    ]);

    // An old client that skips the preview is refused.
    await expect(
      scope(school, () =>
        accounting.closeFiscalYear(
          school.fiscalYearId,
          { reason: 'Year-end close after review' },
          school.actor,
        ),
      ),
    ).rejects.toEqual(code('CLOSE_PREVIEW_REQUIRED'));

    const first = await closeYear(school);
    expect(first.fiscalYear.status).toBe('CLOSED');
    const firstLines = await raw(() =>
      prisma.journalLine.findMany({
        where: { journalEntryId: first.closingEntry?.id ?? '' },
        orderBy: { lineNumber: 'asc' },
      }),
    );
    expect(
      firstLines.map((l) => [
        l.chartAccountId,
        l.debit.toFixed(2),
        l.credit.toFixed(2),
      ]),
    ).toEqual(
      preview.closing.lines.map((l) => [l.chartAccountId, l.debit, l.credit]),
    );

    // Reopen (the approval workflow is covered by fiscal-reopen tests) and
    // post a late adjustment in December.
    await raw(async () => {
      await prisma.fiscalYear.update({
        where: { id: school.fiscalYearId },
        data: { status: 'OPEN' },
      });
    });
    await setStatus(school, '2030-12', 'OPEN');
    await post(school, '2030-12-15', [
      ['1000', 'D', 30],
      ['4000', 'C', 30],
    ]);
    await setStatus(school, '2030-12', 'CLOSED');

    const second = await previewYear(school);
    expect(second.closing).toMatchObject({
      postingType: 'FISCAL_YEAR_CLOSE:2',
      supplementary: true,
      netResult: '30.00',
    });
    expect(second.closing.previousClosingEntries).toHaveLength(1);
    expect(
      second.closing.lines.map((l) => [l.code, l.debit, l.credit]),
    ).toEqual([
      ['4000', '30.00', '0.00'],
      ['3100', '0.00', '30.00'],
    ]);
    const reclosed = await closeYear(school);
    expect(reclosed.fiscalYear.status).toBe('CLOSED');
    expect(reclosed.closingEntry?.postingType).toBe('FISCAL_YEAR_CLOSE:2');

    // Every income and expense account is now zero after closing entries,
    // and retained surplus holds the whole result.
    const pnl = await raw(() =>
      prisma.journalLine.groupBy({
        by: ['chartAccountId'],
        where: {
          tenantId: school.tenantId,
          journalEntry: { status: { in: ['POSTED', 'REVERSED'] } },
        },
        _sum: { debit: true, credit: true },
      }),
    );
    const net = (accountCode: string) => {
      const row = pnl.find(
        (r) => r.chartAccountId === school.account[accountCode],
      );
      return new Prisma.Decimal(row?._sum.credit ?? 0)
        .sub(row?._sum.debit ?? 0)
        .toFixed(2);
    };
    expect(['4000', '4100', '5000'].map(net)).toEqual(['0.00', '0.00', '0.00']);
    expect(net('3100')).toBe('650.00');

    // Reopened again with no change: closes with no new closing entry.
    await raw(() =>
      prisma.fiscalYear.update({
        where: { id: school.fiscalYearId },
        data: { status: 'OPEN' },
      }),
    );
    const third = await previewYear(school);
    expect(third.blockers).toEqual([]);
    expect(third.closing.lines).toEqual([]);
    const unchanged = await closeYear(school);
    expect(unchanged.fiscalYear.status).toBe('CLOSED');
    expect(unchanged.closingEntry).toBeNull();
    expect(
      await raw(() =>
        prisma.journalEntry.count({
          where: { tenantId: school.tenantId, sourceType: 'CLOSING_ENTRY' },
        }),
      ),
    ).toBe(2);
  });

  it('re-checks the live grant on lock and keeps the lock and its audit atomic', async () => {
    const school = await makeSchool('Phase 7.11d lock school');
    const periodId = school.period['2030-06'];
    const lock = () =>
      scope(school, () =>
        accounting.lockFiscalPeriod(
          periodId,
          { reason: 'Month-end review' },
          school.actor,
        ),
      );
    await raw(() =>
      prisma.userRole.updateMany({
        where: { tenantId: school.tenantId, userId: school.actor.userId },
        data: { revokedAt: new Date() },
      }),
    );
    try {
      await expect(lock()).rejects.toThrow(/Insufficient permissions/);
    } finally {
      await raw(() =>
        prisma.userRole.updateMany({
          where: { tenantId: school.tenantId, userId: school.actor.userId },
          data: { revokedAt: null },
        }),
      );
    }
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic lock audit failure'));
    await expect(lock()).rejects.toThrow('Synthetic lock audit failure');
    spy.mockRestore();
    const status = async () =>
      (
        await raw(() =>
          prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: periodId } }),
        )
      ).status;
    expect(await status()).toBe('OPEN');
    expect((await lock()).status).toBe('LOCKED');
    const unlocked = await scope(school, () =>
      accounting.unlockFiscalPeriod(
        periodId,
        { reason: 'Correction needed' },
        school.actor,
      ),
    );
    expect(unlocked.status).toBe('OPEN');
  });
});
