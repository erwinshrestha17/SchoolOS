import {
  PrismaClient,
  AuthMethod,
  SecurityDomain,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  PERMISSION_CATALOG,
  PLATFORM_ROLE_DEFINITIONS,
  PLATFORM_ROLE_PERMISSIONS,
} from '../src/rbac/rbac.defaults';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const platformEmail = requirePlatformSeedValue('PLATFORM_SEED_EMAIL')
  .trim()
  .toLowerCase();
const platformPassword = requirePlatformSeedValue('PLATFORM_SEED_PASSWORD');
const platformSeedMustChangePassword =
  process.env.PLATFORM_SEED_PASSWORD_REQUIRE_CHANGE !== 'false';
const resetPlatformCredentialsOnSeed =
  process.env.PLATFORM_SEED_RESET_CREDENTIALS_ON_SEED === 'true';
const platformRole = 'platform_super_admin';

if (
  platformPassword.length < 12 ||
  !/[A-Z]/.test(platformPassword) ||
  !/[a-z]/.test(platformPassword) ||
  !/\d/.test(platformPassword) ||
  !/[^A-Za-z0-9]/.test(platformPassword)
) {
  throw new Error(
    'PLATFORM_SEED_PASSWORD must be at least 12 characters and include upper-case, lower-case, numeric, and special characters.',
  );
}

function requirePlatformSeedValue(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(
      `${name} is required for the explicit Platform operator bootstrap. No default Platform credentials are provided.`,
    );
  }
  return value;
}

async function main() {
  console.log('--- M0 Platform Core Seed: Starting ---');

  await seedPermissions();

  // 1. Ensure Platform Super Admin Role exists globally (system role)
  // Note: system roles are typically managed via migration or startup logic,
  // but we ensure it here for the seed.

  // 2. Create/Update Platform Operator
  const passwordHash = await bcrypt.hash(platformPassword, 12);

  // We need a "platform" tenant context for the operator if they are global
  // In our schema, users belong to tenants.
  let platformTenant = await prisma.tenant.findUnique({
    where: { slug: 'platform' },
  });
  if (!platformTenant) {
    platformTenant = await prisma.tenant.create({
      data: {
        name: 'SchoolOS Platform',
        slug: 'platform',
        plan: 'platform',
        securityDomain: SecurityDomain.PLATFORM,
        isActive: true,
      },
    });
  } else if (
    platformTenant.securityDomain !== SecurityDomain.PLATFORM ||
    platformTenant.plan !== 'platform'
  ) {
    throw new Error(
      'Refusing to promote an existing non-Platform tenant. Review the `platform` tenant and migration state before bootstrapping operators.',
    );
  }

  const existingOperator = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: platformEmail,
      },
    },
  });
  const operator = existingOperator
    ? resetPlatformCredentialsOnSeed
      ? await prisma.user.update({
          where: { id: existingOperator.id },
          data: {
            passwordHash,
            mustChangePassword: platformSeedMustChangePassword,
          },
        })
      : existingOperator
    : await prisma.user.create({
        data: {
          tenantId: platformTenant.id,
          email: platformEmail,
          passwordHash,
          mustChangePassword: platformSeedMustChangePassword,
          authMethod: AuthMethod.PASSWORD,
          status: UserStatus.ACTIVE,
        },
      });

  const platformRoles = new Map<string, { id: string }>();
  for (const roleDefinition of PLATFORM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: platformTenant.id,
          name: roleDefinition.name,
        },
      },
      update: {
        description: roleDefinition.description,
        isSystem: true,
      },
      create: {
        tenantId: platformTenant.id,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
      },
    });
    await syncRolePermissions(role.id, roleDefinition.name);
    platformRoles.set(roleDefinition.name, role);
  }

  const adminRole = platformRoles.get(platformRole);
  if (!adminRole) {
    throw new Error(`Platform role ${platformRole} was not provisioned.`);
  }

  const existingAdminGrant = await prisma.userRole.findUnique({
    where: {
      userId_roleId_scopeId: {
        userId: operator.id,
        roleId: adminRole.id,
        scopeId: 'global',
      },
    },
  });
  if (!existingAdminGrant) {
    await prisma.userRole.create({
      data: {
        tenantId: platformTenant.id,
        userId: operator.id,
        roleId: adminRole.id,
        scopeId: 'global',
      },
    });
  }

  console.log('✅ Platform operator seeded.');

  // 3. Seed Platform Plans
  const standardPlan = await (prisma as any).platformPlan.upsert({
    where: { key: 'standard' },
    update: {
      name: 'Standard Plan',
      priceNpr: 5000,
      billingCycle: 'MONTHLY',
    },
    create: {
      key: 'standard',
      name: 'Standard Plan',
      description: 'Comprehensive school management for growing institutions',
      priceNpr: 5000,
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      features: {
        create: [
          { featureKey: 'module.students', enabled: true },
          { featureKey: 'module.attendance', enabled: true },
          { featureKey: 'module.fees', enabled: true },
          { featureKey: 'module.exams', enabled: true },
          { featureKey: 'feature.report_card_pdf', enabled: true },
        ],
      },
      usageLimits: {
        create: [
          { usageKey: 'students.count', limit: 500, period: 'LIFETIME' },
          { usageKey: 'sms.sent', limit: 1000, period: 'MONTHLY' },
        ],
      },
    },
  });

  console.log('✅ Platform plans seeded.');

  console.log('--- M0 Platform Core Seed: Completed ---');
}

async function seedPermissions() {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }
}

async function syncRolePermissions(roleId: string, roleName: string) {
  const permissionKeys = PLATFORM_ROLE_PERMISSIONS[roleName];

  if (!permissionKeys?.length) {
    throw new Error(`No default permissions configured for role ${roleName}.`);
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  for (const permissionKey of Array.from(new Set(permissionKeys))) {
    const parts = permissionKey.split(':');
    const action = parts.pop();
    const resource = parts.join(':');

    if (!resource || !action) {
      throw new Error(`Invalid permission key: ${permissionKey}`);
    }

    const permission = await prisma.permission.findUnique({
      where: {
        resource_action: {
          resource,
          action,
        },
      },
    });

    if (!permission) {
      throw new Error(`Permission ${permissionKey} was not created.`);
    }

    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: permission.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
