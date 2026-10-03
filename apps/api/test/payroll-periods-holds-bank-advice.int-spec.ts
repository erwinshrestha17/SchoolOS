import { randomUUID } from 'node:crypto';
import { resolvePayrollPeriod } from '@schoolos/core';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';
import { PayrollBankAdviceService } from '../src/payroll/payroll-bank-advice.service';
import { PayrollHoldService } from '../src/payroll/payroll-hold.service';
import { PayrollReadinessService } from '../src/payroll/payroll-readiness.service';
import { PayrollService } from '../src/payroll/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

/**
 * Phase 7.9 — Nepali payroll periods, deterministic proration, 7.7 adjustment
 * consumption, payment holds and generic bank payment advice, against real
 * PostgreSQL (the 7.9 migration applied to a fresh database).
 *
 * Every amount here is a FIXTURE number; none is a Nepal salary scale or a
 * statutory rate. The database is the disposable test database named by
 * SCHOOLOS_AUTH_TEST_DATABASE_URL: tenants use unique slugs and the append-only
 * history tables are, by design, never deleted.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

const PERMISSIONS = [
  'staff:read',
  'hr:tax:read',
  'payroll:read',
  'payroll:salary:read',
  'payroll:salary:write',
  'payroll:run:create',
  'payroll:run:read',
  'payroll:run:validate',
  'payroll:run:review',
  'payroll:run:approve',
  'payroll:run:finalize',
  'payroll:hold:create',
  'payroll:hold:release',
  'payroll:bank-advice:export',
];

const KARTIK_2083 = resolvePayrollPeriod(2083, 7); // 2026-10-18 .. 2026-11-16
const MANGSIR_2083 = resolvePayrollPeriod(2083, 8); // 2026-11-17 ..

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const datesBetween = (from: string, to: string) => {
  const out: Date[] = [];
  for (
    let at = Date.parse(`${from}T00:00:00.000Z`);
    at <= Date.parse(`${to}T00:00:00.000Z`);
    at += 86_400_000
  )
    out.push(new Date(at));
  return out;
};

interface StaffSpec {
  code: string;
  payment?: 'BANK' | 'CASH';
  bankAccount?: string | null;
  bankName?: string | null;
  basic?: string;
  allowances?: string;
  deductions?: string;
  structureFrom?: string;
  structureTo?: string | null;
  employedFrom?: string;
  employedTo?: string | null;
  noStructure?: boolean;
}

interface World {
  tenantId: string;
  slug: string;
  preparer: AuthContext;
  reviewer: AuthContext;
  approver: AuthContext;
  finalizer: AuthContext;
  nobody: AuthContext;
  staff: Record<string, string>;
}

describeDatabase(
  'Phase 7.9 payroll periods, holds and bank advice (PostgreSQL)',
  () => {
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    const previousUrl = process.env.DATABASE_URL;
    const readinessDouble = {
      assertActionAllowed: jest.fn().mockResolvedValue(undefined),
    };
    let prisma: PrismaService;
    let audit: AuditService;
    let payroll: PayrollService;
    let holds: PayrollHoldService;
    let bankAdvice: PayrollBankAdviceService;
    let readiness: PayrollReadinessService;

    const scope = <T>(world: Pick<World, 'tenantId'>, work: () => Promise<T>) =>
      prisma.runWithTenantScope(world.tenantId, work);

    async function actor(
      tenantId: string,
      slug: string,
      name: string,
      permissions: string[],
    ): Promise<AuthContext> {
      const user = await prisma.user.create({
        data: {
          tenantId,
          email: `${name}-${slug}@example.test`,
          status: 'ACTIVE',
        },
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
      const grants = await Promise.all(
        permissions.map((key) => {
          const split = key.lastIndexOf(':');
          const resource = key.slice(0, split);
          const action = key.slice(split + 1);
          return prisma.permission.upsert({
            where: { resource_action: { resource, action } },
            create: { resource, action },
            update: {},
          });
        }),
      );
      const role = await prisma.role.create({
        data: {
          tenantId,
          name: `p79-${name}-${slug}`,
          rolePermissions: {
            create: grants.map((grant) => ({ permissionId: grant.id })),
          },
        },
      });
      await prisma.userRole.create({
        data: { tenantId, userId: user.id, roleId: role.id },
      });
      return {
        userId: user.id,
        tenantId,
        tenantSlug: slug,
        sessionFamilyId: familyId,
        email: user.email,
        authMethod: 'PASSWORD',
        roles: [role.name],
        permissions,
      };
    }

    async function world(
      specs: StaffSpec[] = [{ code: 'EMP-A' }],
    ): Promise<World> {
      return prisma.runWithoutTenantScope('Phase 7.9 fixture', async () => {
        const slug = `p79-${randomUUID().slice(0, 12)}`;
        const tenant = await prisma.tenant.create({
          data: { name: 'Synthetic Phase 7.9', slug },
        });
        const [preparer, reviewer, approver, finalizer, nobody] =
          await Promise.all([
            actor(tenant.id, slug, 'preparer', PERMISSIONS),
            actor(tenant.id, slug, 'reviewer', PERMISSIONS),
            actor(tenant.id, slug, 'approver', PERMISSIONS),
            actor(tenant.id, slug, 'finalizer', PERMISSIONS),
            actor(tenant.id, slug, 'nobody', ['staff:read']),
          ]);
        const staff: Record<string, string> = {};
        for (const spec of specs) {
          staff[spec.code] = await addStaff(
            tenant.id,
            preparer,
            reviewer,
            spec,
          );
        }
        return {
          tenantId: tenant.id,
          slug,
          preparer,
          reviewer,
          approver,
          finalizer,
          nobody,
          staff,
        };
      });
    }

    async function addStaff(
      tenantId: string,
      maker: AuthContext,
      verifier: AuthContext,
      spec: StaffSpec,
    ) {
      const user = await prisma.user.create({
        data: {
          tenantId,
          email: `${spec.code.toLowerCase()}-${randomUUID().slice(0, 6)}@example.test`,
          status: 'ACTIVE',
        },
      });
      const staff = await prisma.staff.create({
        data: {
          tenantId,
          userId: user.id,
          employeeId: spec.code,
          firstName: 'Synthetic',
          lastName: spec.code,
          dateOfBirth: new Date('1990-01-01'),
          gender: 'FEMALE',
          address: 'Test',
          joiningDate: new Date('2024-01-01'),
          contractType: 'PERMANENT',
          status: 'ACTIVE',
          bankAccount:
            spec.bankAccount === undefined ? '0123456789012' : spec.bankAccount,
          bankName:
            spec.bankName === undefined ? 'Fixture Bank' : spec.bankName,
          panNumber: 'synthetic-pan',
        },
      });
      const employment = await prisma.staffEmployment.create({
        data: {
          tenantId,
          staffId: staff.id,
          employmentType: 'PERMANENT',
          postCategoryCode: 'TEACHER',
          schoolTypeCode: 'INSTITUTIONAL',
          effectiveFrom: day(spec.employedFrom ?? '2024-01-01'),
          effectiveTo: spec.employedTo ? day(spec.employedTo) : null,
          submittedById: maker.userId,
        },
      });
      await prisma.staffEmployment.update({
        where: { id: employment.id },
        data: {
          status: 'VERIFIED',
          verifiedById: verifier.userId,
          verifiedAt: new Date(),
        },
      });
      if (!spec.noStructure) {
        await prisma.salaryStructure.create({
          data: {
            tenantId,
            staffId: staff.id,
            effectiveFrom: day(spec.structureFrom ?? '2024-01-01'),
            effectiveTo: spec.structureTo ? day(spec.structureTo) : null,
            basicSalary: spec.basic ?? '30000',
            allowances: spec.allowances ?? '3000',
            deductions: spec.deductions ?? '0',
            status: 'ACTIVE',
            paymentMethod: spec.payment ?? 'BANK',
          },
        });
      }
      return staff.id;
    }

    const present = (
      w: World,
      code: string,
      from: string,
      to: string,
      skip: string[] = [],
    ) =>
      prisma.staffAttendance.createMany({
        data: datesBetween(from, to)
          .filter((date) => !skip.includes(date.toISOString().slice(0, 10)))
          .map((attendanceDate) => ({
            tenantId: w.tenantId,
            staffId: w.staff[code],
            attendanceDate,
            status: 'PRESENT' as const,
          })),
      });

    const createRun = (
      w: World,
      period: { year: number; month: number },
      extra: { workingDays?: number } = {},
    ) =>
      scope(w, () =>
        payroll.createPayrollRun(
          { periodYear: period.year, periodMonth: period.month, ...extra },
          w.preparer,
        ),
      );

    const finalize = async (w: World, runId: string) => {
      await scope(w, async () => {
        await payroll.validatePayrollRun(runId, w.preparer);
        await payroll.submitPayrollRunForReview(runId, w.preparer);
        await payroll.reviewPayrollRun(runId, w.reviewer);
        await payroll.approvePayrollRun(runId, w.approver);
        await payroll.finalizePayrollRun(runId, w.finalizer);
      });
    };

    const dbRun = (w: World, runId: string) =>
      scope(w, () =>
        prisma.payrollRun.findFirstOrThrow({
          where: { id: runId, tenantId: w.tenantId },
          include: { lines: true },
        }),
      );

    const lineOf = (
      run: Awaited<ReturnType<typeof dbRun>>,
      staffId: string,
    ) => {
      const line = run.lines.find((candidate) => candidate.staffId === staffId);
      if (!line) throw new Error('payroll line not found');
      return line;
    };

    beforeAll(() => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      audit = new AuditService(prisma, cls);
      payroll = new PayrollService(
        prisma,
        audit,
        { postPayrollAccrual: jest.fn() } as never,
        undefined,
        undefined,
        readinessDouble as never,
      );
      holds = new PayrollHoldService(prisma, audit);
      bankAdvice = new PayrollBankAdviceService(prisma, audit, payroll);
      readiness = new PayrollReadinessService(prisma, audit);
    });

    afterAll(async () => {
      await prisma.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('Nepali (BS) payroll periods', () => {
      it('stores the authoritative Gregorian bounds, divisor and basis of a BS month', async () => {
        const w = await world();
        await scope(w, () =>
          present(w, 'EMP-A', KARTIK_2083.startsOn, KARTIK_2083.endsOn),
        );
        const created = await createRun(w, { year: 2083, month: 7 });
        const run = await dbRun(w, created.id);
        expect(run.periodYear).toBe(2083);
        expect(run.periodMonth).toBe(7);
        expect(run.periodStart.toISOString()).toBe('2026-10-18T00:00:00.000Z');
        expect(run.periodEnd.toISOString()).toBe('2026-11-16T23:59:59.999Z');
        expect(run.divisorDays).toBe(30);
        expect(run.divisorBasis).toBe('CALENDAR_DAYS_OF_PERIOD');
        const line = lineOf(run, w.staff['EMP-A']);
        expect(line.grossSalary.toFixed(2)).toBe('33000.00');
        expect(line.paidDays.toFixed(2)).toBe('30.00');
        expect(created).toMatchObject({
          periodLabel: 'Kartik 2083',
          periodStartsOn: '2026-10-18',
          periodEndsOn: '2026-11-16',
          divisorDays: 30,
          divisorBasis: 'CALENDAR_DAYS_OF_PERIOD',
        });
      });

      it('resolves the BS year boundary: Chaitra 2083 ends the day before Baisakh 2084 starts', async () => {
        const w = await world();
        await scope(w, async () => {
          await present(w, 'EMP-A', '2027-04-13', '2027-04-14');
        });
        const chaitra = await createRun(w, { year: 2083, month: 12 });
        const baisakh = await createRun(w, { year: 2084, month: 1 });
        const a = await dbRun(w, chaitra.id);
        const b = await dbRun(w, baisakh.id);
        expect(a.periodEnd.toISOString()).toBe('2027-04-13T23:59:59.999Z');
        expect(b.periodStart.toISOString()).toBe('2027-04-14T00:00:00.000Z');
        // One present day lands in each period and is counted exactly once.
        expect(lineOf(a, w.staff['EMP-A']).paidDays.toFixed(2)).toBe('1.00');
        expect(lineOf(b, w.staff['EMP-A']).paidDays.toFixed(2)).toBe('1.00');
      });

      it('rejects a month, a year or a divisor that is not valid', async () => {
        const w = await world();
        await expect(
          createRun(w, { year: 2083, month: 13 }),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_PERIOD_INVALID_MONTH' },
        });
        await expect(
          createRun(w, { year: 2026, month: 5 }),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_PERIOD_YEAR_OUT_OF_RANGE' },
        });
        await expect(
          createRun(w, { year: 2083, month: 7 }, { workingDays: 33 }),
        ).rejects.toBeDefined();
        expect(
          await scope(w, () =>
            prisma.payrollRun.count({ where: { tenantId: w.tenantId } }),
          ),
        ).toBe(0);
      });

      it('refuses two live runs for overlapping dates in the service and in the database', async () => {
        const w = await world();
        await scope(w, () =>
          present(w, 'EMP-A', KARTIK_2083.startsOn, KARTIK_2083.endsOn),
        );
        await createRun(w, { year: 2083, month: 7 });
        await expect(
          createRun(w, { year: 2083, month: 7 }),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_PERIOD_OVERLAP' },
        });
        // A direct insert with a different (legacy Gregorian) label but
        // overlapping dates is refused by the database itself.
        await expect(
          scope(w, () =>
            prisma.payrollRun.create({
              data: {
                tenantId: w.tenantId,
                periodYear: 2026,
                periodMonth: 10,
                periodStart: day('2026-10-10'),
                periodEnd: new Date('2026-10-20T23:59:59.999Z'),
                revision: 5,
              },
            }),
          ),
        ).rejects.toThrow(/PayrollRun_no_overlapping_live_period/);
        // Other tenants are unaffected by this tenant's runs.
        const other = await world();
        await scope(other, () =>
          present(other, 'EMP-A', KARTIK_2083.startsOn, KARTIK_2083.endsOn),
        );
        await expect(
          createRun(other, { year: 2083, month: 7 }),
        ).resolves.toBeDefined();
      });

      it('refuses a BS-labelled run whose bounds are not whole days of that month length', async () => {
        const w = await world();
        await expect(
          scope(w, () =>
            prisma.payrollRun.create({
              data: {
                tenantId: w.tenantId,
                periodYear: 2083,
                periodMonth: 7,
                periodStart: day('2026-10-18'),
                periodEnd: new Date('2026-11-16T12:00:00.000Z'),
              },
            }),
          ),
        ).rejects.toThrow(/PayrollRun_period_bounds/);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('proration', () => {
      it('uses an operator-supplied divisor and records it', async () => {
        const w = await world();
        await scope(w, () =>
          present(w, 'EMP-A', KARTIK_2083.startsOn, '2026-11-12'),
        );
        const created = await createRun(
          w,
          { year: 2083, month: 7 },
          { workingDays: 26 },
        );
        const run = await dbRun(w, created.id);
        expect(run.divisorDays).toBe(26);
        expect(run.divisorBasis).toBe('OPERATOR_SUPPLIED');
        // 26 present days against a divisor of 26 pays the full month.
        expect(lineOf(run, w.staff['EMP-A']).grossSalary.toFixed(2)).toBe(
          '33000.00',
        );
      });

      it('prorates a mid-period joiner exactly, including fixed deductions', async () => {
        const w = await world([
          {
            code: 'EMP-J',
            employedFrom: '2026-11-02',
            deductions: '1000',
          },
        ]);
        await scope(w, () => present(w, 'EMP-J', '2026-10-18', '2026-11-16'));
        const created = await createRun(w, { year: 2083, month: 7 });
        const line = lineOf(await dbRun(w, created.id), w.staff['EMP-J']);
        expect(line.grossSalary.toFixed(2)).toBe('16500.00');
        expect(line.paidDays.toFixed(2)).toBe('15.00');
        expect(line.otherDeductions.toFixed(2)).toBe('500.00');
        expect(line.netSalary.toFixed(2)).toBe('16000.00');
      });

      it('prices a salary change mid-period at each structure and stores a day ledger', async () => {
        const w = await world([
          {
            code: 'EMP-S',
            structureTo: '2026-11-01',
            basic: '30000',
            allowances: '3000',
          },
        ]);
        await scope(w, async () => {
          await prisma.salaryStructure.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-S'],
              effectiveFrom: day('2026-11-02'),
              basicSalary: '36000',
              allowances: '0',
              status: 'ACTIVE',
              paymentMethod: 'BANK',
            },
          });
          await present(w, 'EMP-S', '2026-10-18', '2026-11-16');
        });
        const created = await createRun(w, { year: 2083, month: 7 });
        const run = await dbRun(w, created.id);
        const line = lineOf(run, w.staff['EMP-S']);
        expect(line.grossSalary.toFixed(2)).toBe('34500.00');
        const breakdown = line.prorationBreakdown as {
          segments: unknown[];
          ledger: { d: string; s: number }[];
        };
        expect(breakdown.segments).toHaveLength(2);
        expect(breakdown.ledger).toHaveLength(30);
        expect(breakdown.ledger[0]).toMatchObject({ d: '2026-10-18', s: 0 });
        expect(breakdown.ledger[29]).toMatchObject({ d: '2026-11-16', s: 1 });
        // The public API shape never leaks the ledger.
        const detail = await scope(w, () =>
          payroll.getPayrollRun(created.id, w.preparer),
        );
        expect(JSON.stringify(detail)).not.toContain('"ledger"');
      });

      it('refuses to generate when employed days have no salary structure or contract', async () => {
        const w = await world([{ code: 'EMP-U', structureFrom: '2026-11-02' }]);
        await scope(w, () => present(w, 'EMP-U', '2026-10-18', '2026-11-16'));
        await expect(
          createRun(w, { year: 2083, month: 7 }),
        ).rejects.toMatchObject({
          response: { code: 'PRORATION_INPUT_UNRESOLVED' },
        });
        expect(
          await scope(w, () =>
            prisma.payrollRun.count({ where: { tenantId: w.tenantId } }),
          ),
        ).toBe(0);
        const summary = await scope(w, () =>
          readiness.getReadiness(
            { year: 2083, month: 7, page: 1, limit: 25 } as never,
            w.preparer,
          ),
        );
        expect(summary.readinessStatus).toBe('BLOCKED');
        expect(summary.exceptionsByCategory.PRORATION_INPUT_UNRESOLVED).toBe(1);
      });

      it('regenerates to identical lines and totals (idempotent) and never duplicates lines', async () => {
        const w = await world();
        await scope(w, () =>
          present(w, 'EMP-A', KARTIK_2083.startsOn, '2026-11-10'),
        );
        const created = await createRun(w, { year: 2083, month: 7 });
        const before = await dbRun(w, created.id);
        await scope(w, () =>
          payroll.regeneratePayrollLines(created.id, w.preparer),
        );
        await scope(w, () =>
          payroll.regeneratePayrollLines(created.id, w.preparer),
        );
        const after = await dbRun(w, created.id);
        expect(after.lines).toHaveLength(1);
        const pick = (run: typeof before) => {
          const line = lineOf(run, w.staff['EMP-A']);
          return {
            gross: line.grossSalary.toFixed(2),
            net: line.netSalary.toFixed(2),
            paid: line.paidDays.toFixed(2),
            breakdown: line.prorationBreakdown,
            run: [
              run.grossAmount.toFixed(2),
              run.netAmount.toFixed(2),
              run.divisorDays,
            ],
          };
        };
        expect(pick(after)).toEqual(pick(before));
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('negative net pay', () => {
      it('keeps the true negative net, blocks readiness and refuses to advance in the service and the database', async () => {
        const w = await world([{ code: 'EMP-N', deductions: '40000' }]);
        await scope(w, () => present(w, 'EMP-N', '2026-10-18', '2026-11-16'));
        const created = await createRun(w, { year: 2083, month: 7 });
        const run = await dbRun(w, created.id);
        const line = lineOf(run, w.staff['EMP-N']);
        expect(line.grossSalary.toFixed(2)).toBe('33000.00');
        expect(line.netSalary.toFixed(2)).toBe('-7000.00');
        expect(line.otherDeductions.toFixed(2)).toBe('40000.00');
        const detail = await scope(w, () =>
          payroll.getPayrollRun(created.id, w.preparer),
        );
        expect(detail.lines[0]).toMatchObject({ netNegative: true });

        const summary = await scope(w, () =>
          readiness.getReadiness(
            { year: 2083, month: 7, page: 1, limit: 25 } as never,
            w.preparer,
          ),
        );
        expect(summary.readinessStatus).toBe('BLOCKED');
        expect(summary.exceptionsByCategory.NEGATIVE_NET_PAY).toBe(1);

        await expect(
          scope(w, () => payroll.validatePayrollRun(created.id, w.preparer)),
        ).rejects.toMatchObject({ response: { code: 'PAYROLL_NEGATIVE_NET' } });
        // Even bypassing the service, the database refuses to advance the run.
        await expect(
          scope(w, () =>
            prisma.payrollRun.update({
              where: { id: created.id },
              data: { status: 'VALIDATED' },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_NEGATIVE_NET/);
        expect((await dbRun(w, created.id)).status).toBe('GENERATED');
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('7.7 attendance corrections consumed by payroll', () => {
      /** Kartik run for EMP-A, absent on its last day, finalized (the source). */
      async function lockedSource() {
        const w = await world();
        await scope(w, async () => {
          await present(w, 'EMP-A', '2026-10-18', '2026-11-15');
          await prisma.staffAttendance.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceDate: day('2026-11-16'),
              status: 'ABSENT',
            },
          });
          await present(w, 'EMP-A', MANGSIR_2083.startsOn, MANGSIR_2083.endsOn);
        });
        const source = await createRun(w, { year: 2083, month: 7 });
        expect(
          lineOf(await dbRun(w, source.id), w.staff['EMP-A']).paidDays.toFixed(
            2,
          ),
        ).toBe('29.00');
        await finalize(w, source.id);
        const attendance = await scope(w, () =>
          prisma.staffAttendance.findFirstOrThrow({
            where: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceDate: day('2026-11-16'),
            },
          }),
        );
        const correction = await scope(w, () =>
          prisma.staffAttendanceCorrection.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceId: attendance.id,
              attendanceDate: day('2026-11-16'),
              originalStatus: 'ABSENT',
              requestedStatus: 'PRESENT',
              originalUpdatedAt: attendance.updatedAt,
              reason: 'Fixture correction after payroll lock',
              requesterId: w.preparer.userId,
              approverId: w.approver.userId,
              decidedAt: new Date(),
              decisionReason: 'Approved after lock',
              status: 'PENDING_PAYROLL_ADJUSTMENT',
            },
          }),
        );
        return { w, source, correction };
      }

      it('prices the correction against the source line and consumes it exactly once', async () => {
        const { w, source, correction } = await lockedSource();
        const next = await createRun(w, { year: 2083, month: 8 });
        const run = await dbRun(w, next.id);
        const line = lineOf(run, w.staff['EMP-A']);
        // 1.00 day at 33000 / 30 = 1100.00 arrears, on top of the regular pay.
        expect(line.adjustmentEarnings.toFixed(2)).toBe('1100.00');
        expect(line.adjustmentDeductions.toFixed(2)).toBe('0.00');
        expect(line.grossSalary.toFixed(2)).toBe('34100.00');
        const rows = await scope(w, () =>
          prisma.payrollAdjustment.findMany({
            where: { tenantId: w.tenantId, correctionId: correction.id },
          }),
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          status: 'APPLIED',
          kind: 'ARREARS',
          payrollRunId: next.id,
          sourcePayrollRunId: source.id,
        });
        expect(rows[0].amount.toFixed(2)).toBe('1100.00');
        expect(rows[0].deltaDays.toFixed(2)).toBe('1.00');

        // A concurrent second run could not consume it again: one APPLIED row.
        await expect(
          scope(w, () =>
            prisma.payrollAdjustment.create({
              data: {
                tenantId: w.tenantId,
                payrollRunId: source.id,
                staffId: w.staff['EMP-A'],
                correctionId: correction.id,
                sourcePayrollRunId: source.id,
                attendanceDate: day('2026-11-16'),
                kind: 'ARREARS',
                deltaDays: '1.00',
                dailyRate: '1100.0000',
                amount: '1100.00',
                pricing: {},
                createdById: w.preparer.userId,
              },
            }),
          ),
        ).rejects.toThrow();
      });

      it('releases and re-applies the adjustment on regeneration without duplicating it', async () => {
        const { w, correction } = await lockedSource();
        const next = await createRun(w, { year: 2083, month: 8 });
        await scope(w, () =>
          payroll.regeneratePayrollLines(next.id, w.preparer),
        );
        await scope(w, () =>
          payroll.regeneratePayrollLines(next.id, w.preparer),
        );
        const rows = await scope(w, () =>
          prisma.payrollAdjustment.findMany({
            where: { tenantId: w.tenantId, correctionId: correction.id },
            orderBy: { createdAt: 'asc' },
          }),
        );
        expect(rows.filter((row) => row.status === 'APPLIED')).toHaveLength(1);
        expect(rows.filter((row) => row.status === 'RELEASED').length).toBe(2);
        expect(
          lineOf(
            await dbRun(w, next.id),
            w.staff['EMP-A'],
          ).adjustmentEarnings.toFixed(2),
        ).toBe('1100.00');
      });

      it('releases the adjustment when the run is cancelled so a replacement can consume it', async () => {
        const { w, correction } = await lockedSource();
        const next = await createRun(w, { year: 2083, month: 8 });
        await scope(w, () =>
          prisma.payrollRun.update({
            where: { id: next.id },
            data: { status: 'CANCELLED' },
          }),
        );
        const rows = await scope(w, () =>
          prisma.payrollAdjustment.findMany({
            where: { tenantId: w.tenantId, correctionId: correction.id },
          }),
        );
        expect(rows.map((row) => row.status)).toEqual(['RELEASED']);
        const replacement = await createRun(w, { year: 2083, month: 8 });
        expect(
          lineOf(
            await dbRun(w, replacement.id),
            w.staff['EMP-A'],
          ).adjustmentEarnings.toFixed(2),
        ).toBe('1100.00');
      });

      it('freezes consumption once the target run is approved or finalized', async () => {
        const { w, correction } = await lockedSource();
        const next = await createRun(w, { year: 2083, month: 8 });
        await finalize(w, next.id);
        await expect(
          scope(w, () =>
            prisma.payrollAdjustment.updateMany({
              where: { tenantId: w.tenantId, correctionId: correction.id },
              data: {
                status: 'RELEASED',
                releasedAt: new Date(),
                releaseReason: 'x',
              },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_ADJUSTMENT_RUN_LOCKED/);
        await expect(
          scope(w, () => payroll.regeneratePayrollLines(next.id, w.preparer)),
        ).rejects.toBeDefined();
      });

      it('reports a correction that cannot be priced as a warning and leaves it pending', async () => {
        const w = await world();
        await scope(w, async () => {
          await present(w, 'EMP-A', MANGSIR_2083.startsOn, MANGSIR_2083.endsOn);
          const attendance = await prisma.staffAttendance.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceDate: day('2026-10-20'),
              status: 'ABSENT',
            },
          });
          await prisma.staffAttendanceCorrection.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceId: attendance.id,
              attendanceDate: day('2026-10-20'),
              originalStatus: 'ABSENT',
              requestedStatus: 'PRESENT',
              originalUpdatedAt: attendance.updatedAt,
              reason: 'No payroll line ever paid this date',
              requesterId: w.preparer.userId,
              approverId: w.approver.userId,
              decidedAt: new Date(),
              decisionReason: 'Approved',
              status: 'PENDING_PAYROLL_ADJUSTMENT',
            },
          });
        });
        const next = await createRun(w, { year: 2083, month: 8 });
        expect(
          lineOf(
            await dbRun(w, next.id),
            w.staff['EMP-A'],
          ).adjustmentEarnings.toFixed(2),
        ).toBe('0.00');
        const summary = await scope(w, () =>
          readiness.getReadiness(
            {
              year: 2083,
              month: 8,
              page: 1,
              limit: 25,
              payrollRunId: next.id,
            } as never,
            w.preparer,
          ),
        );
        expect(summary.exceptionsByCategory.PAYROLL_ADJUSTMENT_UNRESOLVED).toBe(
          1,
        );
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('attendance lock window', () => {
      it('locks exactly the finalized period: neither the day before nor the day after', async () => {
        const w = await world();
        await scope(w, () =>
          present(w, 'EMP-A', KARTIK_2083.startsOn, KARTIK_2083.endsOn),
        );
        const run = await createRun(w, { year: 2083, month: 7 });
        await finalize(w, run.id);
        const locked = async (iso: string) => {
          const rows = await prisma.runWithoutTenantScope(
            'Phase 7.9 lock window probe',
            () =>
              prisma.$queryRaw<{ locked: boolean }[]>`
              SELECT staff_attendance_payroll_locked(${w.tenantId}, ${iso}::timestamp) AS locked`,
          );
          return rows[0].locked;
        };
        expect(await locked('2026-10-17')).toBe(false);
        expect(await locked('2026-10-18')).toBe(true);
        expect(await locked('2026-11-16')).toBe(true);
        // Regression: the first day of the next period was locked too (off by one).
        expect(await locked('2026-11-17')).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('payment holds', () => {
      async function finalizedRun(specs?: StaffSpec[]) {
        const w = await world(specs ?? [{ code: 'EMP-A' }, { code: 'EMP-B' }]);
        await scope(w, async () => {
          for (const code of Object.keys(w.staff))
            await present(w, code, KARTIK_2083.startsOn, KARTIK_2083.endsOn);
        });
        const run = await createRun(w, { year: 2083, month: 7 });
        await finalize(w, run.id);
        return { w, run };
      }

      it('places, lists and releases a hold with separation of duties, reason and audit', async () => {
        const { w, run } = await finalizedRun();
        const hold = await scope(w, () =>
          holds.create(
            run.id,
            { staffId: w.staff['EMP-A'], reason: 'Bank query pending' },
            w.preparer,
          ),
        );
        expect(hold).toMatchObject({
          status: 'ACTIVE',
          createdById: w.preparer.userId,
        });
        await expect(
          scope(w, () =>
            holds.create(
              run.id,
              { staffId: w.staff['EMP-A'], reason: 'Again' },
              w.preparer,
            ),
          ),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_HOLD_ALREADY_ACTIVE' },
        });
        // The creator cannot release their own hold.
        await expect(
          scope(w, () =>
            holds.release(run.id, hold.id, { reason: 'Cleared' }, w.preparer),
          ),
        ).rejects.toMatchObject({
          response: { code: 'SELF_APPROVAL_PROHIBITED' },
        });
        // A user without the release permission cannot either.
        await expect(
          scope(w, () =>
            holds.release(run.id, hold.id, { reason: 'Cleared' }, w.nobody),
          ),
        ).rejects.toMatchObject({ status: 403 });
        const released = await scope(w, () =>
          holds.release(run.id, hold.id, { reason: 'Cleared' }, w.approver),
        );
        expect(released).toMatchObject({
          status: 'RELEASED',
          releasedById: w.approver.userId,
          releaseReason: 'Cleared',
        });
        await expect(
          scope(w, () =>
            holds.release(run.id, hold.id, { reason: 'Twice' }, w.approver),
          ),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_HOLD_NOT_ACTIVE' },
        });
        const listed = await scope(w, () => holds.list(run.id, w.preparer));
        expect(listed).toHaveLength(1);
        const actions = await scope(w, () =>
          prisma.auditLog.findMany({
            where: { tenantId: w.tenantId, resource: 'payroll_hold' },
            select: { action: true },
          }),
        );
        expect(actions.map((row) => row.action).sort()).toEqual([
          'create',
          'release',
        ]);
        // After release a new hold is allowed again (history is kept).
        await expect(
          scope(w, () =>
            holds.create(
              run.id,
              { staffId: w.staff['EMP-A'], reason: 'New concern' },
              w.preparer,
            ),
          ),
        ).resolves.toMatchObject({ status: 'ACTIVE' });
      });

      it('keeps hold history immutable in the database', async () => {
        const { w, run } = await finalizedRun();
        const hold = await scope(w, () =>
          holds.create(
            run.id,
            { staffId: w.staff['EMP-A'], reason: 'Bank query pending' },
            w.preparer,
          ),
        );
        await expect(
          scope(w, () =>
            prisma.payrollHold.update({
              where: { id: hold.id },
              data: { reason: 'Rewritten' },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_HOLD_HISTORY_IMMUTABLE/);
        await expect(
          scope(w, () => prisma.payrollHold.delete({ where: { id: hold.id } })),
        ).rejects.toThrow(/PAYROLL_HOLD_HISTORY_IMMUTABLE/);
        // Self-release is refused by a CHECK even if the service were bypassed.
        await expect(
          scope(w, () =>
            prisma.payrollHold.update({
              where: { id: hold.id },
              data: {
                status: 'RELEASED',
                releasedById: w.preparer.userId,
                releasedAt: new Date(),
                releaseReason: 'self',
              },
            }),
          ),
        ).rejects.toThrow(/PayrollHold_independent_release/);
      });

      it('refuses holds for another tenant, an unknown staff member or an unpermitted actor', async () => {
        const { w, run } = await finalizedRun();
        const other = await world();
        await expect(
          scope(other, () =>
            holds.create(
              run.id,
              { staffId: w.staff['EMP-A'], reason: 'Cross tenant' },
              other.preparer,
            ),
          ),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          scope(other, () => holds.list(run.id, other.preparer)),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          scope(w, () =>
            holds.create(
              run.id,
              { staffId: randomUUID(), reason: 'No such staff' },
              w.preparer,
            ),
          ),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          scope(w, () =>
            holds.create(
              run.id,
              { staffId: w.staff['EMP-A'], reason: 'Not allowed' },
              w.nobody,
            ),
          ),
        ).rejects.toMatchObject({ status: 403 });
        // A direct insert naming another tenant's staff is refused by the guard.
        await expect(
          scope(w, () =>
            prisma.payrollHold.create({
              data: {
                tenantId: w.tenantId,
                payrollRunId: run.id,
                staffId: other.staff['EMP-A'],
                reason: 'Cross tenant direct',
                createdById: w.preparer.userId,
              },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_HOLD_TENANT_MISMATCH/);
      });

      it('blocks payment while a hold is active in readiness, without exposing the reason', async () => {
        const { w, run } = await finalizedRun();
        await scope(w, () =>
          holds.create(
            run.id,
            { staffId: w.staff['EMP-A'], reason: 'Bank query pending' },
            w.preparer,
          ),
        );
        const summary = await scope(w, () =>
          readiness.getReadiness(
            {
              year: 2083,
              month: 7,
              page: 1,
              limit: 25,
              payrollRunId: run.id,
            } as never,
            w.preparer,
          ),
        );
        expect(summary.exceptionsByCategory.PAYROLL_HOLD_ACTIVE).toBe(1);
        const exception = await scope(w, () =>
          prisma.payrollException.findFirstOrThrow({
            where: { tenantId: w.tenantId, code: 'PAYROLL_HOLD_ACTIVE' },
          }),
        );
        expect(exception.blockedActions).toEqual(['MARK_PAID']);
        expect(exception.safeMessage).not.toContain('Bank query pending');
      });

      it('refuses to mark a run PAID while a hold is active (database trigger)', async () => {
        const w = await world();
        const periodStart = day('2026-12-17');
        const periodEnd = new Date('2027-01-14T23:59:59.999Z');
        const syntheticRun = await scope(w, () =>
          prisma.payrollRun.create({
            data: {
              tenantId: w.tenantId,
              periodYear: 2083,
              periodMonth: 9,
              periodStart,
              periodEnd,
              status: 'POSTED',
            },
          }),
        );
        const line = await scope(w, () =>
          prisma.payrollLine.create({
            data: {
              tenantId: w.tenantId,
              payrollRunId: syntheticRun.id,
              staffId: w.staff['EMP-A'],
              grossSalary: '100',
              netSalary: '100',
            },
          }),
        );
        expect(line.id).toBeTruthy();
        await scope(w, () =>
          holds.create(
            syntheticRun.id,
            { staffId: w.staff['EMP-A'], reason: 'Dispute' },
            w.preparer,
          ),
        );
        await expect(
          scope(w, () =>
            prisma.payrollRun.update({
              where: { id: syntheticRun.id },
              data: { status: 'PAID' },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_HOLD_ACTIVE/);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('generic bank payment advice', () => {
      async function finalizedRun(specs: StaffSpec[]) {
        const w = await world(specs);
        await scope(w, async () => {
          for (const code of Object.keys(w.staff))
            await present(w, code, KARTIK_2083.startsOn, KARTIK_2083.endsOn);
        });
        const run = await createRun(w, { year: 2083, month: 7 });
        await finalize(w, run.id);
        return { w, run };
      }

      it('exports bank-paid, un-held lines only from Staff bank details and logs every export', async () => {
        const { w, run } = await finalizedRun([
          { code: 'EMP-A', payment: 'BANK' },
          { code: 'EMP-B', payment: 'CASH' },
          { code: 'EMP-C', payment: 'BANK', bankAccount: '9876543210' },
        ]);
        await scope(w, () =>
          holds.create(
            run.id,
            { staffId: w.staff['EMP-C'], reason: 'Payment query' },
            w.preparer,
          ),
        );
        const status = await scope(w, () =>
          bankAdvice.status(run.id, w.preparer),
        );
        expect(status).toMatchObject({
          exportable: true,
          payableLineCount: 1,
          heldLineCount: 1,
          exports: [],
        });
        const first = await scope(w, () =>
          bankAdvice.export(run.id, {}, w.approver),
        );
        const rows = first.csv.trim().split('\r\n');
        expect(rows[0]).toBe(
          'Sequence,Employee ID,Beneficiary Name,Bank Name,Account Number,Amount,Currency,Reference',
        );
        expect(rows).toHaveLength(2);
        expect(rows[1]).toBe(
          '1,EMP-A,Synthetic EMP-A,Fixture Bank,0123456789012,33000.00,NPR,PAYROLL-2083-07-EMP-A',
        );
        expect(first.csv).not.toContain('EMP-B');
        expect(first.csv).not.toContain('EMP-C');
        expect(first.csv).not.toContain('9876543210');
        expect(first.sequence).toBe(1);

        // A re-export needs a reason and is logged as the next sequence.
        await expect(
          scope(w, () => bankAdvice.export(run.id, {}, w.approver)),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_BANK_ADVICE_REEXPORT_REASON_REQUIRED' },
        });
        // Releasing the hold (by another actor) puts the line into the next file.
        const [hold] = await scope(w, () => holds.list(run.id, w.preparer));
        await scope(w, () =>
          holds.release(
            run.id,
            hold.id,
            { reason: 'Query settled' },
            w.approver,
          ),
        );
        const second = await scope(w, () =>
          bankAdvice.export(
            run.id,
            { reExportReason: 'Held line released after the first file' },
            w.approver,
          ),
        );
        expect(second.sequence).toBe(2);
        expect(second.csv).toContain('EMP-C');
        const logged = await scope(w, () =>
          prisma.payrollBankAdviceExport.findMany({
            where: { tenantId: w.tenantId, payrollRunId: run.id },
            orderBy: { sequence: 'asc' },
          }),
        );
        expect(
          logged.map((row) => [row.sequence, row.lineCount, row.heldLineCount]),
        ).toEqual([
          [1, 1, 1],
          [2, 2, 0],
        ]);
        expect(logged[1].reExportReason).toBe(
          'Held line released after the first file',
        );
        const approved = await scope(w, () =>
          prisma.payrollRun.findFirstOrThrow({
            where: { id: run.id },
            select: { approvedSourceFingerprint: true },
          }),
        );
        expect(logged[0].sourceFingerprint).toBe(
          approved.approvedSourceFingerprint,
        );
        expect(logged[0].contentSha256).toMatch(/^[0-9a-f]{64}$/);
        // The audit trail carries counts and hashes, never bank details.
        const auditText = JSON.stringify(
          await scope(w, () =>
            prisma.auditLog.findMany({
              where: { tenantId: w.tenantId, resource: 'payroll_bank_advice' },
            }),
          ),
        );
        expect(auditText).not.toContain('0123456789012');
        expect(auditText).not.toContain('9876543210');

        // The export log is append-only.
        await expect(
          scope(w, () =>
            prisma.payrollBankAdviceExport.update({
              where: { id: logged[0].id },
              data: { lineCount: 99 },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_BANK_ADVICE_EXPORT_IMMUTABLE/);
        await expect(
          scope(w, () =>
            prisma.payrollBankAdviceExport.delete({
              where: { id: logged[0].id },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_BANK_ADVICE_EXPORT_IMMUTABLE/);
      });

      it('refuses invalid or missing bank details with masked machine-readable issues', async () => {
        const { w, run } = await finalizedRun([
          { code: 'EMP-A' },
          { code: 'EMP-X', bankAccount: '=cmd|calc', bankName: null },
        ]);
        let failure: {
          response?: { code: string; issues: Record<string, unknown>[] };
        } = {};
        try {
          await scope(w, () => bankAdvice.export(run.id, {}, w.approver));
        } catch (error) {
          failure = error as typeof failure;
        }
        expect(failure.response?.code).toBe(
          'PAYROLL_BANK_ADVICE_INVALID_BANK_DETAILS',
        );
        expect(
          failure.response?.issues.map((issue) => issue.problem).sort(),
        ).toEqual(['BANK_ACCOUNT_INVALID', 'BANK_NAME_MISSING']);
        expect(JSON.stringify(failure.response)).not.toContain('=cmd|calc');
        expect(
          await scope(w, () =>
            prisma.payrollBankAdviceExport.count({
              where: { tenantId: w.tenantId },
            }),
          ),
        ).toBe(0);
      });

      it('refuses once the approved source data changed, and for runs that are not finalized', async () => {
        const { w, run } = await finalizedRun([{ code: 'EMP-A' }]);
        await scope(w, () =>
          prisma.staff.update({
            where: { id: w.staff['EMP-A'] },
            data: { bankAccount: '5555555555' },
          }),
        );
        await expect(
          scope(w, () => bankAdvice.export(run.id, {}, w.approver)),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_BANK_ADVICE_SOURCE_CHANGED' },
        });

        const draft = await world();
        await scope(draft, () =>
          present(draft, 'EMP-A', KARTIK_2083.startsOn, KARTIK_2083.endsOn),
        );
        const generated = await createRun(draft, { year: 2083, month: 7 });
        await expect(
          scope(draft, () =>
            bankAdvice.export(generated.id, {}, draft.approver),
          ),
        ).rejects.toMatchObject({
          response: { code: 'PAYROLL_BANK_ADVICE_RUN_STATE' },
        });
        // The database refuses an export row for a run that is not finalized.
        await expect(
          scope(draft, () =>
            prisma.payrollBankAdviceExport.create({
              data: {
                tenantId: draft.tenantId,
                payrollRunId: generated.id,
                sequence: 1,
                exportedById: draft.approver.userId,
                lineCount: 1,
                heldLineCount: 0,
                totalAmount: '1.00',
                sourceFingerprint: 'x',
                contentSha256: 'a'.repeat(64),
              },
            }),
          ),
        ).rejects.toThrow(/PAYROLL_BANK_ADVICE_RUN_STATE/);
      });

      it('enforces permission and tenant isolation', async () => {
        const { w, run } = await finalizedRun([{ code: 'EMP-A' }]);
        await expect(
          scope(w, () => bankAdvice.export(run.id, {}, w.nobody)),
        ).rejects.toMatchObject({ status: 403 });
        const other = await world();
        await expect(
          scope(other, () => bankAdvice.export(run.id, {}, other.approver)),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          scope(other, () => bankAdvice.status(run.id, other.approver)),
        ).rejects.toMatchObject({ status: 404 });
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe('end to end', () => {
      it('period → proration → adjustment → approval → finalization → hold → bank advice', async () => {
        const w = await world([
          { code: 'EMP-A' },
          {
            code: 'EMP-B',
            employedFrom: '2026-11-02',
            payment: 'BANK',
            bankAccount: '2222222222',
          },
        ]);
        await scope(w, async () => {
          // Kartik: A is absent on its last day; B joined mid-period.
          await present(w, 'EMP-A', '2026-10-18', '2026-11-15');
          await prisma.staffAttendance.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceDate: day('2026-11-16'),
              status: 'ABSENT',
            },
          });
          await present(w, 'EMP-B', '2026-11-02', '2026-11-16');
          // Mangsir: everyone is present.
          for (const code of ['EMP-A', 'EMP-B'])
            await present(w, code, MANGSIR_2083.startsOn, MANGSIR_2083.endsOn);
        });
        const kartik = await createRun(w, { year: 2083, month: 7 });
        const kartikRun = await dbRun(w, kartik.id);
        expect(lineOf(kartikRun, w.staff['EMP-A']).paidDays.toFixed(2)).toBe(
          '29.00',
        );
        expect(lineOf(kartikRun, w.staff['EMP-B']).paidDays.toFixed(2)).toBe(
          '15.00',
        );
        await finalize(w, kartik.id);

        // The 7.7 correction approved after the lock becomes arrears in Mangsir.
        const attendance = await scope(w, () =>
          prisma.staffAttendance.findFirstOrThrow({
            where: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceDate: day('2026-11-16'),
            },
          }),
        );
        await scope(w, () =>
          prisma.staffAttendanceCorrection.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staff['EMP-A'],
              attendanceId: attendance.id,
              attendanceDate: day('2026-11-16'),
              originalStatus: 'ABSENT',
              requestedStatus: 'PRESENT',
              originalUpdatedAt: attendance.updatedAt,
              reason: 'Fixture correction',
              requesterId: w.preparer.userId,
              approverId: w.approver.userId,
              decidedAt: new Date(),
              decisionReason: 'Approved',
              status: 'PENDING_PAYROLL_ADJUSTMENT',
            },
          }),
        );
        const mangsir = await createRun(w, { year: 2083, month: 8 });
        const mangsirRun = await dbRun(w, mangsir.id);
        expect(
          lineOf(mangsirRun, w.staff['EMP-A']).adjustmentEarnings.toFixed(2),
        ).toBe('1100.00');

        // Readiness is clear of blockers before approval.
        const clear = await scope(w, () =>
          readiness.getReadiness(
            {
              year: 2083,
              month: 8,
              page: 1,
              limit: 25,
              payrollRunId: mangsir.id,
            } as never,
            w.preparer,
          ),
        );
        expect(clear.blockingExceptionCount).toBe(0);

        await finalize(w, mangsir.id);
        const exportedFirst = await scope(w, () =>
          bankAdvice.export(mangsir.id, {}, w.approver),
        );
        expect(exportedFirst.csv).toContain('EMP-A');
        expect(exportedFirst.csv).toContain('EMP-B');
        // EMP-A carries the arrears: 33000.00 regular + 1100.00 = 34100.00.
        expect(exportedFirst.csv).toContain('34100.00');

        const hold = await scope(w, () =>
          holds.create(
            mangsir.id,
            { staffId: w.staff['EMP-B'], reason: 'Account verification' },
            w.preparer,
          ),
        );
        const withHold = await scope(w, () =>
          bankAdvice.export(
            mangsir.id,
            { reExportReason: 'Regenerate with the hold in place' },
            w.approver,
          ),
        );
        expect(withHold.csv).toContain('EMP-A');
        expect(withHold.csv).not.toContain('EMP-B');
        await scope(w, () =>
          holds.release(
            mangsir.id,
            hold.id,
            { reason: 'Verified' },
            w.approver,
          ),
        );
        const final = await scope(w, () =>
          bankAdvice.export(
            mangsir.id,
            { reExportReason: 'Hold released' },
            w.approver,
          ),
        );
        expect(final.csv).toContain('EMP-B');
        expect(final.sequence).toBe(3);
      });
    });
  },
);
