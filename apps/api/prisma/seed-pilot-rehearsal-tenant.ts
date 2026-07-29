/**
 * Provisions the Wave 1 controlled-pilot rehearsal tenant on staging.
 * Idempotent: safe to re-run; refreshes entitlement overrides and subscription.
 */
import {
  AuthMethod,
  Mode,
  Prisma,
  PrismaClient,
  TenantSubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { SCHOOL_CONFIG_OWNER_ROLE } from '@schoolos/core';
import {
  DEFAULT_ACCOUNTING_SOURCE_MAPPINGS,
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FEE_HEADS,
} from '../src/finance/finance.defaults';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/rbac/rbac.defaults';

const PILOT_SLUG = process.env.PILOT_REHEARSAL_TENANT_SLUG ?? 'pilot-rehearsal-1';
const PILOT_NAME = process.env.PILOT_REHEARSAL_TENANT_NAME ?? 'Pilot Rehearsal School';
const PILOT_ADMIN_EMAIL =
  process.env.PILOT_REHEARSAL_ADMIN_EMAIL ?? 'admin@pilot-rehearsal.schoolos.test';
const PILOT_ADMIN_PASSWORD =
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ?? 'PilotRehearsal1!';

const WAVE1_DISABLED_MODULES = [
  'module.fees',
  'module.exams',
  'module.hr',
  'module.payroll',
  'module.library',
  'module.transport',
  'module.canteen',
  'module.accounting',
  'module.learning',
  'module.intelligence',
] as const;

const WAVE1_DISABLED_FEATURES = [
  'feature.hr.staff_records',
  'feature.accounting.basic_finance',
] as const;

const OVERRIDE_REASON =
  'Wave 1 controlled pilot — disabled until wave exit';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public',
});

const prisma = new PrismaClient({ adapter });

async function provisionTenantDefaults(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  for (const permission of PERMISSION_CATALOG) {
    await tx.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await tx.role.upsert({
      where: { tenantId_name: { tenantId, name: role.name } },
      update: { description: role.description, isSystem: true },
      create: {
        tenantId,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }

  for (const [roleName, permissionKeys] of Object.entries(
    SYSTEM_ROLE_PERMISSIONS,
  )) {
    const role = await tx.role.findUnique({
      where: { tenantId_name: { tenantId, name: roleName } },
    });
    if (!role) continue;

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permissionKey of permissionKeys) {
      const [resource, action] = permissionKey.split(':');
      const permission = await tx.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (!permission) continue;
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const yearStart = new Date(`${new Date().getFullYear()}-04-01T00:00:00.000Z`);
  const yearEnd = new Date(
    `${new Date().getFullYear() + 1}-03-31T23:59:59.999Z`,
  );
  const yearName = `${yearStart.getUTCFullYear()}-${yearEnd.getUTCFullYear()}`;

  await tx.academicYear.upsert({
    where: { tenantId_name: { tenantId, name: yearName } },
    update: { startsOn: yearStart, endsOn: yearEnd, isCurrent: true },
    create: {
      tenantId,
      name: yearName,
      startsOn: yearStart,
      endsOn: yearEnd,
      isCurrent: true,
    },
  });

  for (const account of DEFAULT_CHART_ACCOUNTS) {
    await tx.chartAccount.upsert({
      where: { tenantId_code: { tenantId, code: account.code } },
      update: { name: account.name, type: account.type, isSystem: true },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
        isSystem: true,
      },
    });
  }

  for (const feeHead of DEFAULT_FEE_HEADS) {
    await tx.feeHead.upsert({
      where: { tenantId_code: { tenantId, code: feeHead.code } },
      update: {
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
        vatApplicable: feeHead.vatApplicable,
      },
      create: {
        tenantId,
        code: feeHead.code,
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
        vatApplicable: feeHead.vatApplicable,
      },
    });
  }

  for (const mapping of DEFAULT_ACCOUNTING_SOURCE_MAPPINGS) {
    const debitAccount = await tx.chartAccount.findUnique({
      where: { tenantId_code: { tenantId, code: mapping.debitCode } },
    });
    const creditAccount = await tx.chartAccount.findUnique({
      where: { tenantId_code: { tenantId, code: mapping.creditCode } },
    });
    if (!debitAccount || !creditAccount) continue;

    const existing = await tx.accountingSourceMapping.findFirst({
      where: {
        tenantId,
        sourceModule: mapping.sourceModule,
        sourceType: mapping.sourceType,
        postingType: mapping.postingType,
        isActive: true,
      },
    });
    if (existing) continue;

    await tx.accountingSourceMapping.create({
      data: {
        tenantId,
        sourceModule: mapping.sourceModule,
        sourceType: mapping.sourceType,
        postingType: mapping.postingType,
        debitAccountId: debitAccount.id,
        creditAccountId: creditAccount.id,
        description: mapping.description,
      },
    });
  }
}

async function ensureAdminUser(tenantId: string, tx: Prisma.TransactionClient) {
  const adminRole = await tx.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'admin' } },
  });
  const configOwnerRole = await tx.role.findUnique({
    where: { tenantId_name: { tenantId, name: SCHOOL_CONFIG_OWNER_ROLE } },
  });

  if (!adminRole || !configOwnerRole) {
    throw new Error('Default admin roles were not provisioned');
  }

  const passwordHash = await bcrypt.hash(PILOT_ADMIN_PASSWORD, 12);
  const user = await tx.user.upsert({
    where: { tenantId_email: { tenantId, email: PILOT_ADMIN_EMAIL } },
    update: {
      passwordHash,
      mustChangePassword: true,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId,
      email: PILOT_ADMIN_EMAIL,
      passwordHash,
      mustChangePassword: true,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  for (const roleId of [adminRole.id, configOwnerRole.id]) {
    const existing = await tx.userRole.findFirst({
      where: { tenantId, userId: user.id, roleId, scopeId: null },
    });
    if (!existing) {
      await tx.userRole.create({
        data: { tenantId, userId: user.id, roleId, scopeId: null },
      });
    }
  }

  return user;
}

async function ensureMinimalAcademicStructure(tenantId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId, isCurrent: true },
  });
  if (!academicYear) return;

  const schoolClass = await prisma.class.upsert({
    where: {
      tenantId_name: { tenantId, name: 'Class 1' },
    },
    update: { level: 1 },
    create: {
      tenantId,
      name: 'Class 1',
      level: 1,
    },
  });

  await prisma.section.upsert({
    where: {
      tenantId_classId_name: {
        tenantId,
        classId: schoolClass.id,
        name: 'A',
      },
    },
    update: {},
    create: {
      tenantId,
      classId: schoolClass.id,
      name: 'A',
    },
  });
}

async function applyWave1Overrides(tenantId: string) {
  for (const featureKey of [
    ...WAVE1_DISABLED_MODULES,
    ...WAVE1_DISABLED_FEATURES,
  ]) {
    await prisma.tenantFeatureOverride.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      update: { enabled: false, reason: OVERRIDE_REASON },
      create: {
        tenantId,
        featureKey,
        enabled: false,
        reason: OVERRIDE_REASON,
      },
    });
  }
}

async function assignStandardSubscription(tenantId: string) {
  const standardPlan = await prisma.platformPlan.findUnique({
    where: { key: 'standard' },
  });
  if (!standardPlan) {
    throw new Error(
      'Standard platform plan not found. Run pnpm db:seed:platform first.',
    );
  }

  const subscriptionId = `sub-${PILOT_SLUG}`;
  await prisma.tenantSubscription.upsert({
    where: { id: subscriptionId },
    update: {
      planId: standardPlan.id,
      status: TenantSubscriptionStatus.ACTIVE,
      addOns: [],
    },
    create: {
      id: subscriptionId,
      tenantId,
      planId: standardPlan.id,
      status: TenantSubscriptionStatus.ACTIVE,
      addOns: [],
    },
  });
}

async function main() {
  let tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });

  if (!tenant) {
    tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: PILOT_NAME,
          slug: PILOT_SLUG,
          mode: Mode.MULTI,
          plan: 'standard',
          isActive: true,
        },
      });
      await provisionTenantDefaults(created.id, tx);
      await ensureAdminUser(created.id, tx);
      return created;
    });
    console.log(`Created pilot rehearsal tenant "${PILOT_SLUG}".`);
  } else {
    await prisma.$transaction(async (tx) => {
      await provisionTenantDefaults(tenant!.id, tx);
      await ensureAdminUser(tenant!.id, tx);
    });
    console.log(`Refreshed pilot rehearsal tenant "${PILOT_SLUG}".`);
  }

  await assignStandardSubscription(tenant.id);
  await applyWave1Overrides(tenant.id);
  await ensureMinimalAcademicStructure(tenant.id);

  console.log('');
  console.log('--- Pilot Rehearsal Tenant Ready ---');
  console.log(`Tenant ID:   ${tenant.id}`);
  console.log(`Slug:        ${PILOT_SLUG}`);
  console.log(`Admin email: ${PILOT_ADMIN_EMAIL}`);
  if (!process.env.PILOT_REHEARSAL_ADMIN_PASSWORD) {
    console.log(`Admin password (default): ${PILOT_ADMIN_PASSWORD}`);
    console.log('Set PILOT_REHEARSAL_ADMIN_PASSWORD to override.');
  } else {
    console.log('Admin password: (from PILOT_REHEARSAL_ADMIN_PASSWORD env)');
  }
  console.log('');
  console.log('Wave 1 modules enabled; wave-gated modules forced OFF via overrides.');
  console.log('Next: complete Day-0 setup at /dashboard/settings/onboarding');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
