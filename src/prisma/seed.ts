// prisma/seed.ts
import { PrismaClient, AuthMethod, UserStatus, Mode } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  // 3. Create Super Admin User
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'admin' } },
  });

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
          roleId: adminRole!.id,
          tenantId: tenant.id,
        },
      },
    },
  });

  console.log('✅ Seeding complete!');
  console.log(`Admin login: admin@schoolos.com / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
