import {
  AuthMethod,
  PrismaClient,
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

const PLATFORM_EMAIL =
  process.env.SCHOOLOS_E2E_PLATFORM_EMAIL ??
  process.env.PLATFORM_SEED_EMAIL ??
  'admin@schoolos.io';
const PLATFORM_PASSWORD =
  process.env.SCHOOLOS_E2E_PLATFORM_PASSWORD ??
  process.env.PLATFORM_SEED_PASSWORD ??
  'SchoolOS@2026';
const PLATFORM_TENANT_SLUG = 'platform';
const PLATFORM_ROLE = 'platform_super_admin';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed M0 platform onboard fixtures in production.',
    );
  }
  if (process.env.SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES=true to seed the dedicated M0 platform onboard fixture.',
    );
  }
}

async function syncRolePermissions(roleId: string, roleName: string) {
  const permissionKeys = PLATFORM_ROLE_PERMISSIONS[roleName] ?? [];
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  for (const key of permissionKeys) {
    const parts = key.split(':');
    const action = parts.pop();
    const resource = parts.join(':');
    if (!resource || !action) {
      throw new Error(`Invalid Platform permission key: ${key}`);
    }
    const permission = await prisma.permission.findUnique({
      where: {
        resource_action: { resource, action },
      },
    });
    if (!permission) {
      throw new Error(`Platform permission ${key} was not seeded.`);
    }
    await prisma.rolePermission.create({
      data: { roleId, permissionId: permission.id },
    });
  }
}

async function seedPermissions() {
  for (const entry of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: entry.resource,
          action: entry.action,
        },
      },
      update: { description: entry.description },
      create: entry,
    });
  }
}

async function main() {
  assertE2eFixtureAllowed();

  await seedPermissions();

  let platformTenant = await prisma.tenant.findUnique({
    where: { slug: PLATFORM_TENANT_SLUG },
  });
  if (!platformTenant) {
    platformTenant = await prisma.tenant.create({
      data: {
        name: 'SchoolOS Platform',
        slug: PLATFORM_TENANT_SLUG,
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
      'Existing platform fixture tenant is not in the PLATFORM security domain.',
    );
  }

  const passwordHash = await bcrypt.hash(PLATFORM_PASSWORD, 12);
  const operator = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: PLATFORM_EMAIL,
      },
    },
    update: {
      passwordHash,
      mustChangePassword: false,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId: platformTenant.id,
      email: PLATFORM_EMAIL,
      passwordHash,
      mustChangePassword: false,
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

  const adminRole = platformRoles.get(PLATFORM_ROLE);
  if (!adminRole) {
    throw new Error(`Platform role ${PLATFORM_ROLE} was not provisioned.`);
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId_scopeId: {
        userId: operator.id,
        roleId: adminRole.id,
        scopeId: 'global',
      },
    },
    update: {
      tenantId: platformTenant.id,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      expiresAt: null,
    },
    create: {
      userId: operator.id,
      roleId: adminRole.id,
      tenantId: platformTenant.id,
      scopeId: 'global',
    },
  });

  console.log('M0 platform onboard E2E fixture ready:');
  console.log(`  tenant: ${PLATFORM_TENANT_SLUG}`);
  console.log(`  email: ${PLATFORM_EMAIL}`);
  console.log(`  password: ${PLATFORM_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
