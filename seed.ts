// seed.ts
import { PrismaClient, AuthMethod, UserStatus, Mode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: 'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const permissionCatalog = [
  ['users', 'create', 'Create users inside a tenant'],
  ['roles', 'read', 'Read roles and permission catalog'],
  ['roles', 'create', 'Create custom roles'],
  ['roles', 'assign', 'Assign roles to users'],
  ['roles', 'manage_permissions', 'Attach permissions to roles'],
];

const systemRolePermissions: Record<string, string[]> = {
  admin: [
    'users:create',
    'roles:read',
    'roles:create',
    'roles:assign',
    'roles:manage_permissions',
  ],
  teacher: ['roles:read'],
  student: [],
  parent: [],
  accountant: ['roles:read'],
  librarian: ['roles:read'],
  driver: [],
};

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
  const schoolRoles = [
    'admin',
    'teacher',
    'student',
    'parent',
    'accountant',
    'librarian',
    'driver',
  ];

  for (const roleName of schoolRoles) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: roleName,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: roleName,
        isSystem: true,
        description: `System preset role for ${roleName}`,
      },
    });
  }

  for (const [resource, action, description] of permissionCatalog) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource,
          action,
        },
      },
      update: {
        description,
      },
      create: {
        resource,
        action,
        description,
      },
    });
  }

  for (const [roleName, permissionKeys] of Object.entries(systemRolePermissions)) {
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
