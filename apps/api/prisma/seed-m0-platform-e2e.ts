import {
  AuthMethod,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_PERMISSIONS,
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
    throw new Error('Refusing to seed M0 platform onboard fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES=true to seed the dedicated M0 platform onboard fixture.',
    );
  }
}

async function syncRolePermissions(roleId: string, roleName: string) {
  const permissionKeys = SYSTEM_ROLE_PERMISSIONS[roleName] ?? [];
  for (const key of permissionKeys) {
    const [resource, action] = key.split(':');
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: { resource, action, description: key },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId: permission.id,
      },
    });
  }

  for (const entry of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: entry.resource,
          action: entry.action,
        },
      },
      update: {},
      create: {
        resource: entry.resource,
        action: entry.action,
        description: entry.description,
      },
    });
  }
}

async function main() {
  assertE2eFixtureAllowed();

  let platformTenant = await prisma.tenant.findUnique({
    where: { slug: PLATFORM_TENANT_SLUG },
  });
  if (!platformTenant) {
    platformTenant = await prisma.tenant.create({
      data: {
        name: 'SchoolOS Platform',
        slug: PLATFORM_TENANT_SLUG,
        plan: 'platform',
        isActive: true,
      },
    });
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

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: platformTenant.id,
        name: PLATFORM_ROLE,
      },
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      name: PLATFORM_ROLE,
      description: 'Global platform administrator',
      isSystem: true,
    },
  });

  await syncRolePermissions(adminRole.id, PLATFORM_ROLE);

  await prisma.userRole.upsert({
    where: {
      userId_roleId_scopeId: {
        userId: operator.id,
        roleId: adminRole.id,
        scopeId: 'global',
      },
    },
    update: {},
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
