// seed.ts
import { PrismaClient, AuthMethod, UserStatus, Mode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from './src/rbac/rbac.defaults';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create the default School Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default-school' },
    update: {},
    create: {
      name: 'Everest Academy (Main Branch)',
      slug: 'default-school',
      mode: Mode.SINGLE,
      plan: 'Standard',
    },
  });

  // 2. Define SchoolOS Role Presets
  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: role.name,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: role.name,
        isSystem: true,
        description: role.description,
      },
    });
  }

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

  for (const [roleName, permissionKeys] of Object.entries(
    SYSTEM_ROLE_PERMISSIONS,
  )) {
    const role = await prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: roleName,
        },
      },
    });

    if (!role) {
      throw new Error(`Role ${roleName} was not created successfully.`);
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
      },
    });

    for (const permissionKey of permissionKeys) {
      const [resource, action] = permissionKey.split(':');
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
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // 3. Create Super Admin User
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'admin' } },
  });

  if (!adminRole) {
    throw new Error('Admin role was not created successfully.');
  }

  const adminPassword = await bcrypt.hash('admin123', 12);

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@schoolos.com' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@schoolos.com',
      passwordHash: adminPassword,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: {
          roleId: adminRole.id,
          tenantId: tenant.id,
        },
      },
    },
  });

  console.log('✅ Seeding complete!');
  console.log('Admin login: admin@schoolos.com / admin123');
}

main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
