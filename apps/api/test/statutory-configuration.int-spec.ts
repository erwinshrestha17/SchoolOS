import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { PayrollService } from '../src/payroll/payroll.service';
import { PayrollReadinessService } from '../src/payroll/payroll-readiness.service';
import { StatutoryMembershipService } from '../src/payroll/statutory-membership.service';
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
 * Phase 7.8 — statutory configuration against real PostgreSQL.
 *
 * Every rate in this file is a FIXTURE number, labelled as such in the policy
 * source title. None of them is Nepal law. Dates sit in 2031 so the national
 * fixture policy cannot affect any other suite sharing the database.
 */
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

const FIXTURE_FROM = '2031-01-01';
const SECOND_VERSION_FROM = '2031-07-01';

const PERMISSIONS = [
  'hr:tax:read',
  'hr:tax:write',
  'payroll:run:create',
  'payroll:run:read',
  'payroll:salary:read',
  'payroll:salary:write',
];

function fixturePayload(pfEmployeeRate: string) {
  return {
    schemes: [
      {
        code: 'SSF',
        base: 'BASIC',
        employeeRate: '0.11',
        employerRate: '0.20',
        requiresIdentifier: true,
      },
      {
        code: 'PF',
        base: 'BASIC',
        employeeRate: pfEmployeeRate,
        employerRate: '0.10',
      },
      { code: 'REMUNERATION_TAX', base: 'GROSS', employeeRate: '0.01' },
    ],
  };
}

describeDatabase('Phase 7.8 statutory configuration (PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  const suffix = randomUUID().slice(0, 8);
  const tenantIds: string[] = [];
  const policyIds: string[] = [];
  const platformTenantIds: string[] = [];
  let prisma: PrismaService;
  let audit: AuditService;
  let payroll: PayrollService;
  let memberships: StatutoryMembershipService;
  let reviewerId: string;
  let approverId: string;
  const readinessDouble = {
    assertActionAllowed: jest.fn().mockResolvedValue(undefined),
  };

  interface World {
    tenantId: string;
    staffId: string;
    salaryId: string;
    actor: AuthContext;
    reader: AuthContext;
    unprivileged: AuthContext;
  }

  const scope = <T>(world: World, work: () => Promise<T>) =>
    prisma.runWithTenantScope(world.tenantId, work);

  const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  async function createAuthContext(
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
        expiresAt: new Date(Date.now() + 60_000),
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
        name: `stat-${name}-${slug}`,
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

  async function addStaff(
    world: Pick<World, 'tenantId' | 'actor'> & { verifierId: string },
    code: string,
    options: { structure?: boolean; pfEnabled?: boolean } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        tenantId: world.tenantId,
        email: `${code.toLowerCase()}-${suffix}@example.test`,
        status: 'ACTIVE',
      },
    });
    const staff = await prisma.staff.create({
      data: {
        tenantId: world.tenantId,
        userId: user.id,
        employeeId: code,
        firstName: 'Synthetic',
        lastName: code,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'FEMALE',
        address: 'Test',
        joiningDate: new Date('2024-01-01'),
        contractType: 'PERMANENT',
        status: 'ACTIVE',
        bankAccount: 'synthetic-account',
        bankName: 'Synthetic Bank',
        panNumber: 'synthetic-pan',
      },
    });
    const employment = await prisma.staffEmployment.create({
      data: {
        tenantId: world.tenantId,
        staffId: staff.id,
        employmentType: 'PERMANENT',
        postCategoryCode: 'TEACHER',
        schoolTypeCode: 'INSTITUTIONAL',
        effectiveFrom: new Date('2024-01-01'),
        submittedById: world.actor.userId,
      },
    });
    await prisma.staffEmployment.update({
      where: { id: employment.id },
      data: {
        status: 'VERIFIED',
        verifiedById: world.verifierId,
        verifiedAt: new Date(),
      },
    });
    let salaryId = '';
    if (options.structure !== false) {
      const salary = await prisma.salaryStructure.create({
        data: {
          tenantId: world.tenantId,
          staffId: staff.id,
          effectiveFrom: new Date('2024-01-01'),
          basicSalary: '50000',
          status: 'ACTIVE',
          paymentMethod: 'BANK',
          pfEnabled: options.pfEnabled ?? true,
          tdsEnabled: true,
        },
      });
      salaryId = salary.id;
    }
    return { staffId: staff.id, salaryId };
  }

  async function attend(
    tenantId: string,
    staffId: string,
    year: number,
    month: number,
    days = 30,
  ) {
    await prisma.staffAttendance.createMany({
      data: Array.from({ length: days }, (_, index) => ({
        tenantId,
        staffId,
        attendanceDate: new Date(Date.UTC(year, month - 1, index + 1)),
        status: 'PRESENT' as const,
      })),
    });
  }

  async function world(
    options: { pfEnabled?: boolean; structure?: boolean } = {},
  ): Promise<World> {
    return prisma.runWithoutTenantScope('Phase 7.8 fixture', async () => {
      const slug = `p78-${randomUUID().slice(0, 12)}`;
      const tenant = await prisma.tenant.create({
        data: { name: 'Synthetic Phase 7.8', slug },
      });
      tenantIds.push(tenant.id);
      const actor = await createAuthContext(
        tenant.id,
        slug,
        'maker',
        PERMISSIONS,
      );
      const reader = await createAuthContext(tenant.id, slug, 'reader', [
        'hr:tax:read',
      ]);
      const unprivileged = await createAuthContext(tenant.id, slug, 'nobody', [
        'staff:read',
      ]);
      const verifier = await createAuthContext(tenant.id, slug, 'verifier', [
        'staff:read',
      ]);
      const { staffId, salaryId } = await addStaff(
        { tenantId: tenant.id, actor, verifierId: verifier.userId },
        'EMP-78',
        options,
      );
      return {
        tenantId: tenant.id,
        staffId,
        salaryId,
        actor,
        reader,
        unprivileged,
      };
    });
  }

  /** DRAFT → IN_REVIEW → REVIEWED → APPROVED through the production guards. */
  async function approvePolicy(input: {
    policyKey: string;
    version: number;
    effectiveFrom: string;
    payload: unknown;
    supersedesId?: string;
    checksum?: string | null;
  }) {
    return prisma.runWithoutTenantScope(
      'Phase 7.8 policy fixture',
      async () => {
        const policy = await prisma.nepalHrPolicyVersion.create({
          data: {
            policyKey: input.policyKey,
            version: input.version,
            kind: 'STATUTORY_SCHEME_TAX',
            scope: 'NATIONAL',
            payload: input.payload as never,
            effectiveFrom: dateOnly(input.effectiveFrom),
            supersedesId: input.supersedesId ?? null,
            sourceTitle: 'FIXTURE statutory policy (not Nepal law)',
            sourceUri: 'https://example.test/fixture-statutory-policy',
            sourceChecksumSha256:
              input.checksum === undefined ? 'a'.repeat(64) : input.checksum,
          },
          select: { id: true },
        });
        policyIds.push(policy.id);
        await prisma.nepalHrPolicyVersion.update({
          where: { id: policy.id },
          data: { reviewStatus: 'IN_REVIEW' },
        });
        await prisma.nepalHrPolicyVersion.update({
          where: { id: policy.id },
          data: {
            reviewStatus: 'REVIEWED',
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        });
        await prisma.nepalHrPolicyVersion.update({
          where: { id: policy.id },
          data: {
            reviewStatus: 'APPROVED',
            approvedById: approverId,
            approvedAt: new Date(),
          },
        });
        return policy.id;
      },
    );
  }

  const rejection = (promise: Promise<unknown>, pattern: RegExp | string) =>
    expect(promise).rejects.toThrow(pattern);

  beforeAll(async () => {
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
    memberships = new StatutoryMembershipService(prisma, audit);

    await prisma.runWithoutTenantScope(
      'Phase 7.8 platform fixture',
      async () => {
        const platform = await prisma.tenant.create({
          data: {
            name: 'Synthetic platform authority',
            slug: `p78-platform-${suffix}`,
            securityDomain: 'PLATFORM',
          },
        });
        platformTenantIds.push(platform.id);
        const [reviewer, approver] = await Promise.all(
          ['reviewer', 'approver'].map((role) =>
            prisma.user.create({
              data: {
                tenantId: platform.id,
                email: `statutory-${role}-${suffix}@example.test`,
                status: 'ACTIVE',
              },
              select: { id: true },
            }),
          ),
        );
        reviewerId = reviewer.id;
        approverId = approver.id;
      },
    );
  });

  afterAll(async () => {
    try {
      await withLedgerGuardsOff(async (query) => {
        const tenants = [...tenantIds];
        if (tenants.length) {
          await query(
            'DELETE FROM "PayrollException" WHERE "tenantId" = ANY($1)',
            [tenants],
          );
          await query('DELETE FROM "AuditLog" WHERE "tenantId" = ANY($1)', [
            tenants,
          ]);
          await query('DELETE FROM "Payslip" WHERE "tenantId" = ANY($1)', [
            tenants,
          ]);
          await query('DELETE FROM "PayrollLine" WHERE "tenantId" = ANY($1)', [
            tenants,
          ]);
          await query('DELETE FROM "PayrollRun" WHERE "tenantId" = ANY($1)', [
            tenants,
          ]);
          await query(
            'DELETE FROM "StaffStatutoryMembership" WHERE "tenantId" = ANY($1)',
            [tenants],
          );
          await query(
            'DELETE FROM "SalaryStructure" WHERE "tenantId" = ANY($1)',
            [tenants],
          );
        }
        if (policyIds.length) {
          await query(
            'DELETE FROM "NepalHrPolicyVersion" WHERE "id" = ANY($1)',
            [policyIds],
          );
        }
      });
    } finally {
      await closeLedgerFixturePool();
      await prisma?.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  });

  beforeEach(() => jest.clearAllMocks());

  describe('statutory policy versions', () => {
    it('refuses an approved statutory version without a source checksum', async () => {
      await rejection(
        approvePolicy({
          policyKey: `fixture.nochecksum.${suffix}`,
          version: 1,
          effectiveFrom: '2032-01-01',
          payload: fixturePayload('0.10'),
          checksum: null,
        }),
        /NepalHrPolicyVersion_statutory_approved/,
      );
    });

    it('refuses an approved statutory version with no schemes', async () => {
      await rejection(
        approvePolicy({
          policyKey: `fixture.empty.${suffix}`,
          version: 1,
          effectiveFrom: '2032-01-01',
          payload: { schemes: [] },
        }),
        /NepalHrPolicyVersion_statutory_approved/,
      );
    });
  });

  describe('membership database guards', () => {
    const insert = (
      w: World,
      scheme: 'SSF' | 'PF',
      from: string,
      to: string | null,
      identifier: string | null = 'M-1',
    ) =>
      scope(w, () =>
        prisma.staffStatutoryMembership.create({
          data: {
            tenantId: w.tenantId,
            staffId: w.staffId,
            scheme,
            memberIdentifier: identifier,
            effectiveFrom: dateOnly(from),
            effectiveTo: to ? dateOnly(to) : null,
            createdById: w.actor.userId,
          },
        }),
      );

    it('allows adjacent windows and refuses overlapping ones, whatever the scheme', async () => {
      const w = await world();
      await scope(w, async () => {
        await insert(w, 'SSF', '2031-01-01', '2031-04-01');
        await insert(w, 'PF', '2031-04-01', '2031-07-01');
        await rejection(
          insert(w, 'SSF', '2031-06-30', '2031-09-01'),
          /StaffStatutoryMembership_one_scheme_at_a_time/,
        );
        await rejection(
          insert(w, 'PF', '2031-02-01', null),
          /StaffStatutoryMembership_one_scheme_at_a_time/,
        );
      });
    });

    it('rejects blank or padded identifiers and inverted windows', async () => {
      const w = await world();
      await scope(w, async () => {
        await rejection(
          insert(w, 'SSF', '2031-01-01', null, '   '),
          /StaffStatutoryMembership_identifier/,
        );
        await rejection(
          insert(w, 'SSF', '2031-01-01', null, ' padded'),
          /StaffStatutoryMembership_identifier/,
        );
        await rejection(
          insert(w, 'SSF', '2031-02-01', '2031-01-01'),
          /StaffStatutoryMembership_dates/,
        );
      });
    });

    it('never deletes history and never edits scheme, identifier or start', async () => {
      const w = await world();
      await scope(w, async () => {
        const row = await insert(w, 'SSF', '2031-01-01', null);
        await rejection(
          scope(w, () =>
            prisma.staffStatutoryMembership.delete({ where: { id: row.id } }),
          ),
          /STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE/,
        );
        for (const data of [
          { scheme: 'PF' as const },
          { memberIdentifier: 'CHANGED' },
          { effectiveFrom: dateOnly('2030-12-01') },
        ]) {
          await rejection(
            scope(w, () =>
              prisma.staffStatutoryMembership.update({
                where: { id: row.id },
                data,
              }),
            ),
            /STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE/,
          );
        }
      });
    });

    it('refuses staff or actors from another tenant', async () => {
      const w = await world();
      await scope(w, async () => {
        const other = await world();
        await rejection(
          scope(w, () =>
            prisma.staffStatutoryMembership.create({
              data: {
                tenantId: w.tenantId,
                staffId: other.staffId,
                scheme: 'SSF',
                effectiveFrom: dateOnly('2031-01-01'),
                createdById: w.actor.userId,
              },
            }),
          ),
          /STATUTORY_MEMBERSHIP_TENANT_MISMATCH/,
        );
        await rejection(
          scope(w, () =>
            prisma.staffStatutoryMembership.create({
              data: {
                tenantId: w.tenantId,
                staffId: w.staffId,
                scheme: 'SSF',
                effectiveFrom: dateOnly('2031-01-01'),
                createdById: other.actor.userId,
              },
            }),
          ),
          /STATUTORY_MEMBERSHIP_TENANT_MISMATCH/,
        );
      });
    });
  });

  describe('StatutoryMembershipService', () => {
    it('creates, lists and ends a membership with audit that never contains the identifier', async () => {
      const w = await world();
      await scope(w, async () => {
        const created = await memberships.create(
          w.staffId,
          {
            scheme: 'SSF',
            memberIdentifier: 'SECRET-123',
            effectiveFrom: '2031-01-01',
          },
          w.actor,
        );
        expect(created).toMatchObject({
          scheme: 'SSF',
          memberIdentifier: 'SECRET-123',
          effectiveFrom: '2031-01-01',
          effectiveTo: null,
        });
        const listed = await memberships.list(w.staffId, w.reader);
        expect(listed.map((row) => row.id)).toEqual([created.id]);

        const ended = await memberships.end(
          created.id,
          { effectiveTo: '2031-06-01', reason: 'Moved to PF' },
          w.actor,
        );
        expect(ended).toMatchObject({
          effectiveTo: '2031-06-01',
          endReason: 'Moved to PF',
          endedById: w.actor.userId,
        });
        await expect(
          memberships.end(
            created.id,
            { effectiveTo: '2031-07-01', reason: 'Again' },
            w.actor,
          ),
        ).rejects.toThrow(ConflictException);

        const logs = await prisma.runWithTenantScope(w.tenantId, () =>
          prisma.auditLog.findMany({
            where: {
              tenantId: w.tenantId,
              resource: 'staff_statutory_membership',
            },
          }),
        );
        expect(logs.map((log) => log.action).sort()).toEqual(['create', 'end']);
        expect(JSON.stringify(logs)).not.toContain('SECRET-123');
      });
    });

    it('denies without hr:tax permissions and hides other tenants staff', async () => {
      const w = await world();
      await scope(w, async () => {
        const other = await world();
        await expect(
          memberships.list(w.staffId, w.unprivileged),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.reader,
          ),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          memberships.create(
            other.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        ).rejects.toThrow(NotFoundException);
        await expect(memberships.list(other.staffId, w.actor)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    it('translates an overlap into a stable 409 and validates the window', async () => {
      const w = await world();
      await scope(w, async () => {
        await memberships.create(
          w.staffId,
          { scheme: 'PF', effectiveFrom: '2031-01-01' },
          w.actor,
        );
        await expect(
          memberships.create(
            w.staffId,
            {
              scheme: 'SSF',
              memberIdentifier: 'X',
              effectiveFrom: '2031-03-01',
            },
            w.actor,
          ),
        ).rejects.toMatchObject({
          response: { code: 'STATUTORY_MEMBERSHIP_OVERLAP' },
        });
        await expect(
          memberships.create(
            w.staffId,
            {
              scheme: 'SSF',
              memberIdentifier: 'X',
              effectiveFrom: '2032-03-01',
              effectiveTo: '2032-03-01',
            },
            w.actor,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('salary structure overlap', () => {
    it('allows one ACTIVE structure at a time, adjacent windows, and overlapping drafts', async () => {
      const w = await world({ structure: false });
      await scope(w, async () => {
        const make = (
          status: 'ACTIVE' | 'DRAFT',
          from: string,
          to: string | null,
        ) =>
          scope(w, () =>
            prisma.salaryStructure.create({
              data: {
                tenantId: w.tenantId,
                staffId: w.staffId,
                effectiveFrom: dateOnly(from),
                effectiveTo: to ? dateOnly(to) : null,
                basicSalary: '40000',
                status,
                paymentMethod: 'BANK',
              },
            }),
          );
        await make('ACTIVE', '2031-01-01', '2031-06-30');
        await make('ACTIVE', '2031-07-01', null);
        await make('DRAFT', '2031-03-01', null);
        await rejection(
          make('ACTIVE', '2031-06-30', '2031-09-01'),
          /SalaryStructure_no_active_overlap/,
        );
      });
    });
  });

  describe('payroll runs and the policy they used', () => {
    let firstVersionId: string;
    let secondVersionId: string;

    beforeAll(async () => {
      const policyKey = `fixture.statutory.${suffix}`;
      firstVersionId = await approvePolicy({
        policyKey,
        version: 1,
        effectiveFrom: FIXTURE_FROM,
        payload: fixturePayload('0.10'),
      });
      secondVersionId = await approvePolicy({
        policyKey,
        version: 2,
        effectiveFrom: SECOND_VERSION_FROM,
        payload: fixturePayload('0.05'),
        supersedesId: firstVersionId,
      });
    });

    const createRun = (w: World, month: number) =>
      payroll.createPayrollRun(
        { periodMonth: month, periodYear: 2031, workingDays: 30 },
        w.actor,
      );

    it('refuses to generate when a staff member owes a scheme but no policy covers the period', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2030, 5);
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2030-01-01' },
            w.actor,
          ),
        );
        await expect(
          scope(w, () =>
            payroll.createPayrollRun(
              { periodMonth: 5, periodYear: 2030, workingDays: 30 },
              w.actor,
            ),
          ),
        ).rejects.toMatchObject({
          response: { code: 'MISSING_STATUTORY_CONFIGURATION' },
        });
        expect(
          await prisma.payrollRun.count({ where: { tenantId: w.tenantId } }),
        ).toBe(0);
      });
    });

    it('refuses to generate when an enrolled staff member has no membership', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        await expect(scope(w, () => createRun(w, 5))).rejects.toMatchObject({
          response: { code: 'MISSING_STATUTORY_CONFIGURATION' },
        });
      });
    });

    it('refuses an SSF member with no identifier because the policy requires one', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'SSF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        );
        await expect(scope(w, () => createRun(w, 5))).rejects.toMatchObject({
          response: { code: 'MISSING_STATUTORY_CONFIGURATION' },
        });
      });
    });

    it('computes PF and tax from the policy, pins the version and stores a breakdown', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        );
        await scope(w, () => createRun(w, 5));
        const run = await prisma.payrollRun.findFirstOrThrow({
          where: { tenantId: w.tenantId, periodMonth: 5, periodYear: 2031 },
          include: { lines: true },
        });
        expect(run.statutoryPolicyVersionId).toBe(firstVersionId);
        expect(run.lines).toHaveLength(1);
        const line = run.lines[0];
        expect(line.grossSalary.toFixed(2)).toBe('50000.00');
        expect(line.pfEmployee.toFixed(2)).toBe('5000.00');
        expect(line.pfEmployer.toFixed(2)).toBe('5000.00');
        expect(line.tds.toFixed(2)).toBe('500.00');
        expect(line.netSalary.toFixed(2)).toBe('44500.00');
        expect(run.pfEmployeeAmount.toFixed(2)).toBe('5000.00');
        expect(run.pfEmployerAmount.toFixed(2)).toBe('5000.00');
        expect(run.tdsAmount.toFixed(2)).toBe('500.00');
        const breakdown = JSON.stringify(line.statutoryBreakdown);
        expect(breakdown).toContain('PF');
        expect(breakdown).toContain('REMUNERATION_TAX');
      });
    });

    it('uses the new version for later periods and never touches earlier runs', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        await attend(w.tenantId, w.staffId, 2031, 8);
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        );
        await scope(w, () => createRun(w, 5));
        await scope(w, () => createRun(w, 8));
        const runs = await prisma.payrollRun.findMany({
          where: { tenantId: w.tenantId },
          include: { lines: true },
          orderBy: { periodMonth: 'asc' },
        });
        expect(runs.map((run) => run.statutoryPolicyVersionId)).toEqual([
          firstVersionId,
          secondVersionId,
        ]);
        expect(runs[0].lines[0].pfEmployee.toFixed(2)).toBe('5000.00');
        expect(runs[1].lines[0].pfEmployee.toFixed(2)).toBe('2500.00');
      });
    });

    it('exposes the policy in force for a date through the service', async () => {
      const w = await world();
      await scope(w, async () => {
        const may = await payroll.getStatutoryPolicy('2031-05-15', w.actor);
        expect(may.policy?.versionId).toBe(firstVersionId);
        const august = await payroll.getStatutoryPolicy('2031-08-15', w.actor);
        expect(august.policy?.versionId).toBe(secondVersionId);
        expect(
          august.policy?.schemes.find((scheme) => scheme.code === 'PF')
            ?.employeeRate,
        ).toBe('0.05');
        const none = await payroll.getStatutoryPolicy('2030-05-15', w.actor);
        expect(none.policy).toBeNull();
      });
    });

    it('treats two approved lineages covering one period as ambiguous', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2033, 5);
        const a = await approvePolicy({
          policyKey: `fixture.amb-a.${suffix}`,
          version: 1,
          effectiveFrom: '2033-01-01',
          payload: fixturePayload('0.10'),
        });
        await approvePolicy({
          policyKey: `fixture.amb-b.${suffix}`,
          version: 1,
          effectiveFrom: '2033-02-01',
          payload: fixturePayload('0.10'),
        });
        expect(a).toBeTruthy();
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2033-01-01' },
            w.actor,
          ),
        );
        await expect(
          scope(w, () =>
            payroll.createPayrollRun(
              { periodMonth: 5, periodYear: 2033, workingDays: 30 },
              w.actor,
            ),
          ),
        ).rejects.toMatchObject({
          response: { code: 'STATUTORY_POLICY_AMBIGUOUS' },
        });
      });
    });

    it('does not need a policy when nobody owes a scheme', async () => {
      const w = await world({ pfEnabled: false });
      await scope(w, async () => {
        await prisma.salaryStructure.update({
          where: { id: w.salaryId },
          data: { tdsEnabled: false },
        });
        await attend(w.tenantId, w.staffId, 2030, 5);
        await scope(w, () =>
          payroll.createPayrollRun(
            { periodMonth: 5, periodYear: 2030, workingDays: 30 },
            w.actor,
          ),
        );
        const run = await prisma.payrollRun.findFirstOrThrow({
          where: { tenantId: w.tenantId },
        });
        expect(run.statutoryPolicyVersionId).toBeNull();
        expect(run.pfEmployeeAmount.toFixed(2)).toBe('0.00');
        expect(run.tdsAmount.toFixed(2)).toBe('0.00');
      });
    });

    it('pins a run to a policy that applies, then freezes it once approved', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        );
        await scope(w, () => createRun(w, 5));
        const run = await prisma.payrollRun.findFirstOrThrow({
          where: { tenantId: w.tenantId },
        });
        // A version that starts after the period end does not apply.
        await rejection(
          prisma.runWithoutTenantScope('guard probe', () =>
            prisma.payrollRun.update({
              where: { id: run.id },
              data: { statutoryPolicyVersionId: secondVersionId },
            }),
          ),
          /PAYROLL_STATUTORY_POLICY_NOT_APPLICABLE/,
        );
        await prisma.runWithoutTenantScope('approve probe', () =>
          prisma.payrollRun.update({
            where: { id: run.id },
            data: { status: 'APPROVED', approvedAt: new Date() },
          }),
        );
        await rejection(
          prisma.runWithoutTenantScope('freeze probe', () =>
            prisma.payrollRun.update({
              where: { id: run.id },
              data: { statutoryPolicyVersionId: null },
            }),
          ),
          /PAYROLL_STATUTORY_POLICY_FROZEN/,
        );
      });
    });

    it('blocks membership changes underneath an approved run', async () => {
      const w = await world();
      await scope(w, async () => {
        await attend(w.tenantId, w.staffId, 2031, 5);
        const open = await scope(w, () =>
          memberships.create(
            w.staffId,
            { scheme: 'PF', effectiveFrom: '2031-01-01' },
            w.actor,
          ),
        );
        await scope(w, () => createRun(w, 5));
        const run = await prisma.payrollRun.findFirstOrThrow({
          where: { tenantId: w.tenantId },
        });
        await prisma.runWithoutTenantScope('approve probe', () =>
          prisma.payrollRun.update({
            where: { id: run.id },
            data: { status: 'APPROVED', approvedAt: new Date() },
          }),
        );
        // Ending the membership before the covered period would rewrite history.
        await expect(
          memberships.end(
            open.id,
            { effectiveTo: '2031-03-01', reason: 'Back-dated' },
            w.actor,
          ),
        ).rejects.toMatchObject({
          response: { code: 'STATUTORY_MEMBERSHIP_PAYROLL_LOCKED' },
        });
        // A new membership for an uncovered window is still fine.
        await expect(
          memberships.end(
            open.id,
            { effectiveTo: '2031-12-01', reason: 'Left scheme' },
            w.actor,
          ),
        ).resolves.toMatchObject({ effectiveTo: '2031-12-01' });
      });
    });
  });

  describe('payroll readiness', () => {
    it('reports MISSING_STATUTORY_CONFIGURATION until a policy and membership exist', async () => {
      const w = await world();
      await scope(w, async () => {
        const readiness = new PayrollReadinessService(prisma, audit);
        const summary = await readiness.getReadiness(
          { year: 2030, month: 5 } as never,
          {
            ...w.actor,
            permissions: [...w.actor.permissions, 'payroll:run:read'],
          },
        );
        const codes = JSON.stringify(summary);
        expect(codes).toContain('MISSING_STATUTORY_CONFIGURATION');
      });
    });
  });
});
