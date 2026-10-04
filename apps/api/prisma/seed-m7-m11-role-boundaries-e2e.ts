import {
  AuthMethod,
  ContractType,
  Gender,
  Mode,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  findPayrollPeriodContaining,
  getNepalSchoolDay,
  nextPayrollPeriod,
  shiftGregorianDateOnly,
} from '@schoolos/core';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const PRIMARY_TENANT_SLUG = 'default-school';
const FIXTURE_PASSWORD =
  process.env.SCHOOLOS_E2E_PASSWORD ?? 'schoolos-local-demo-only';

const roleSeeds = [
  {
    name: 'e2e_payroll_officer',
    email: 'e2e.payroll-officer@schoolos.test',
    permissions: [
      'staff:read',
      'hr:staff:read',
      'payroll:read',
      'payroll:salary:read',
      'payroll:salary:write',
      'payroll:run:create',
      'payroll:run:validate',
      'payroll:run:read',
      'payroll:payslip:read',
      'payroll:payslip:generate',
      'payroll:reports:read',
      'payroll:exports:create',
      'payroll:hold:create',
    ],
  },
  {
    name: 'e2e_payroll_reviewer',
    email: 'e2e.payroll-reviewer@schoolos.test',
    permissions: [
      'payroll:read',
      'payroll:run:read',
      'payroll:run:review',
      'payroll:payslip:read',
    ],
  },
  {
    name: 'e2e_payroll_approver',
    email: 'e2e.payroll-approver@schoolos.test',
    permissions: [
      'payroll:read',
      'payroll:run:read',
      'payroll:run:approve',
      'payroll:run:finalize',
      'payroll:hold:release',
      'payroll:bank-advice:export',
      'payroll:payslip:read',
    ],
  },
  {
    name: 'e2e_payroll_poster',
    email: 'e2e.payroll-poster@schoolos.test',
    permissions: [
      'payroll:read',
      'payroll:run:read',
      'payroll:run:post',
      // Fixture only: no system template holds payroll:run:reverse.
      'payroll:run:reverse',
      'accounting:journals:read',
    ],
  },
  {
    name: 'e2e_accountant',
    email: 'e2e.accountant@schoolos.test',
    permissions: [
      'accounting:read',
      'accounting:accounts:read',
      'accounting:accounts:write',
      'accounting:journals:create',
      'accounting:journals:read',
      'accounting:journals:submit',
      'accounting:reconciliation:read',
      'accounting:reconciliation:manage',
      'accounting:reports:read',
      'accounting:settings:read',
      'accounting:settings:update',
      'accounting:exports:create',
      // Payables preparer duties, as in the accountant template (7.11c).
      'accounting:vendors:read',
      'accounting:vendors:write',
      'accounting:expenses:read',
      'accounting:expenses:write',
      'accounting:payables:read',
    ],
  },
  {
    name: 'e2e_accounting_reviewer',
    email: 'e2e.accounting-reviewer@schoolos.test',
    permissions: [
      'accounting:accounts:read',
      'accounting:journals:read',
      'accounting:journals:review',
      'accounting:journals:reject',
      'accounting:reports:read',
      'accounting:settings:read',
    ],
  },
  {
    name: 'e2e_accounting_approver',
    email: 'e2e.accounting-approver@schoolos.test',
    permissions: [
      'accounting:accounts:read',
      'accounting:journals:read',
      'accounting:journals:approve',
      'accounting:reports:read',
      'accounting:expenses:read',
      'accounting:expenses:approve',
      'accounting:payables:read',
    ],
  },
  {
    name: 'e2e_accounting_poster',
    email: 'e2e.accounting-poster@schoolos.test',
    permissions: [
      'accounting:accounts:read',
      'accounting:journals:read',
      'accounting:journals:post',
      'accounting:journals:reverse',
      'accounting:reports:read',
      'accounting:payables:read',
      'accounting:payables:settle',
    ],
  },
  {
    name: 'e2e_principal_read_only',
    email: 'e2e.principal-read-only@schoolos.test',
    permissions: [
      'staff:read',
      'hr:read',
      'hr:staff:read',
      'payroll:read',
      'payroll:run:read',
      'payroll:reports:read',
      'accounting:accounts:read',
      'accounting:journals:read',
      'accounting:reports:read',
      'accounting:settings:read',
    ],
  },
  {
    name: 'e2e_auditor_read_only',
    email: 'e2e.auditor-read-only@schoolos.test',
    permissions: [
      'payroll:read',
      'payroll:run:read',
      'payroll:reports:read',
      'accounting:accounts:read',
      'accounting:journals:read',
      'accounting:reports:read',
      'accounting:settings:read',
      'reports:read',
      'reports:export',
    ],
  },
  {
    name: 'e2e_staff_self_service',
    email: 'e2e.staff-self-service@schoolos.test',
    permissions: ['staff:read'],
  },
  {
    name: 'e2e_unauthorized_school_user',
    email: 'e2e.unauthorized@schoolos.test',
    permissions: ['settings:read_public'],
  },
] as const;

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M7/M11 browser fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M7_M11_ROLE_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M7_M11_ROLE_FIXTURES=true to seed the dedicated M7/M11 role fixtures.',
    );
  }
  if (FIXTURE_PASSWORD.length < 12) {
    throw new Error(
      'The M7/M11 fixture password must be at least 12 characters.',
    );
  }
}

async function seedRoleUser(
  tenantId: string,
  seed: { name: string; email: string; permissions: readonly string[] },
  passwordHash: string,
) {
  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId, name: seed.name } },
    update: {
      description: 'Dedicated local E2E role-boundary fixture',
      isSystem: false,
    },
    create: {
      tenantId,
      name: seed.name,
      description: 'Dedicated local E2E role-boundary fixture',
      isSystem: false,
    },
  });

  const permissions = await Promise.all(
    [
      ...new Set(['roles:read', 'settings:read_public', ...seed.permissions]),
    ].map(async (key) => {
      const parts = key.split(':');
      const action = parts.pop();
      const resource = parts.join(':');
      if (!resource || !action) throw new Error(`Invalid permission ${key}.`);
      const permission = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (!permission) throw new Error(`Missing permission ${key}.`);
      return permission;
    }),
  );

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: seed.email } },
    update: {
      passwordHash,
      mustChangePassword: false,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
      failedLoginCount: 0,
      lockedUntil: null,
    },
    create: {
      tenantId,
      email: seed.email,
      passwordHash,
      mustChangePassword: false,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    ...permissions.map((permission) =>
      prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      }),
    ),
    prisma.userRole.deleteMany({ where: { tenantId, userId: user.id } }),
    prisma.userRole.create({
      data: { tenantId, userId: user.id, roleId: role.id },
    }),
  ]);

  return user;
}

async function seedBoundaryTenant(input: {
  slug: string;
  isActive: boolean;
  email: string;
  passwordHash: string;
}) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: input.slug },
    update: {
      name: input.slug,
      mode: Mode.SINGLE,
      plan: 'Enterprise',
      isActive: input.isActive,
    },
    create: {
      slug: input.slug,
      name: input.slug,
      mode: Mode.SINGLE,
      plan: 'Enterprise',
      isActive: input.isActive,
    },
  });
  await seedRoleUser(
    tenant.id,
    {
      name: 'e2e_boundary_reader',
      email: input.email,
      permissions: [
        'payroll:read',
        'payroll:run:read',
        'accounting:journals:read',
        'accounting:reports:read',
      ],
    },
    input.passwordHash,
  );
}

/**
 * Phase 7.12: since 7.6 a paid-leave request is checked against the canonical
 * balance when it is filed, so the leave browser spec's teacher needs a
 * CASUAL balance for the year its (30–230 days ahead) request falls in.
 * Allocation only; `used` is never reset, so re-runs keep real debits.
 */
async function seedLeaveTeacherBalances(tenantId: string) {
  const email =
    process.env.SCHOOLOS_E2E_LEAVE_TEACHER_EMAIL ??
    'classteacher.1a@schoolos.com';
  const staff = await prisma.staff.findFirst({
    where: { tenantId, user: { email } },
    select: { id: true },
  });
  if (!staff) {
    console.warn(`No staff record for ${email}; leave balances not seeded.`);
    return;
  }
  const thisYear = new Date().getUTCFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    await prisma.staffLeaveBalance.upsert({
      where: {
        tenantId_staffId_leaveType_year: {
          tenantId,
          staffId: staff.id,
          leaveType: 'CASUAL',
          year,
        },
      },
      update: { allocated: 30 },
      create: {
        tenantId,
        staffId: staff.id,
        leaveType: 'CASUAL',
        year,
        allocated: 30,
        used: 0,
      },
    });
  }
}

/**
 * Phase 7.12: the payroll lifecycle browser spec prepares a fresh future BS
 * month. Pay is prorated by recorded attendance (7.9), so with no attendance
 * the seeded payroll staff member's fixed deductions give a negative net,
 * which correctly blocks the draft. This fixture records PRESENT days for the
 * next twelve BS months, for that one staff member only. Existing rows are
 * never changed, and finalized payroll months are left alone.
 */
async function seedPayrollLifecycleAttendance(tenantId: string) {
  const staff = await prisma.staff.findFirst({
    where: { tenantId, employeeId: 'EA-STF-001' },
    select: { id: true },
  });
  if (!staff) {
    console.warn('No EA-STF-001 staff; payroll lifecycle attendance skipped.');
    return;
  }
  let period = findPayrollPeriodContaining(getNepalSchoolDay().gregorianDate);
  const rows: { tenantId: string; staffId: string; attendanceDate: Date }[] =
    [];
  for (let month = 0; month < 12; month += 1) {
    period = nextPayrollPeriod(period);
    for (
      let day = period.startsOn;
      day <= period.endsOn;
      day = shiftGregorianDateOnly(day, 1)
    ) {
      rows.push({
        tenantId,
        staffId: staff.id,
        attendanceDate: new Date(`${day}T00:00:00.000Z`),
      });
    }
  }
  // Insert only missing days: the attendance payroll lock (7.7) refuses any
  // insert attempt in a finalized month, even one that would be a no-op.
  const existing = await prisma.staffAttendance.findMany({
    where: {
      tenantId,
      staffId: staff.id,
      attendanceDate: { gte: rows[0].attendanceDate },
    },
    select: { attendanceDate: true },
  });
  const recorded = new Set(
    existing.map((row) => row.attendanceDate.toISOString()),
  );
  const missing = rows.filter(
    (row) => !recorded.has(row.attendanceDate.toISOString()),
  );
  if (missing.length === 0) return;
  await prisma.staffAttendance.createMany({
    data: missing.map((row) => ({ ...row, status: 'PRESENT' as const })),
    skipDuplicates: true,
  });
}

async function main() {
  assertE2eFixtureAllowed();
  const tenant = await prisma.tenant.findUnique({
    where: { slug: PRIMARY_TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) throw new Error(`Seed ${PRIMARY_TENANT_SLUG} first.`);

  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  const users = new Map<string, { id: string }>();
  for (const seed of roleSeeds) {
    users.set(seed.email, await seedRoleUser(tenant.id, seed, passwordHash));
  }

  const selfService = users.get('e2e.staff-self-service@schoolos.test');
  if (!selfService)
    throw new Error('Staff self-service fixture was not created.');
  await prisma.staff.upsert({
    where: { userId: selfService.id },
    update: { tenantId: tenant.id, status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      userId: selfService.id,
      employeeId: 'EA-E2E-SELF-001',
      firstName: 'E2E',
      lastName: 'Self Service',
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      gender: Gender.OTHER,
      address: 'Lalitpur, Nepal',
      joiningDate: new Date('2024-01-01T00:00:00.000Z'),
      contractType: ContractType.PERMANENT,
      status: 'ACTIVE',
    },
  });

  await seedLeaveTeacherBalances(tenant.id);
  await seedPayrollLifecycleAttendance(tenant.id);

  await seedBoundaryTenant({
    slug: 'e2e-other-school',
    isActive: true,
    email: 'e2e.other-tenant@schoolos.test',
    passwordHash,
  });
  await seedBoundaryTenant({
    slug: 'e2e-suspended-school',
    isActive: false,
    email: 'e2e.suspended-tenant@schoolos.test',
    passwordHash,
  });

  console.log('Seeded dedicated M7/M11 role and tenant-boundary fixtures.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
