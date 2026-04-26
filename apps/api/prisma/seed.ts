import { PrismaClient, AuthMethod, UserStatus, Mode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/rbac/rbac.defaults';
import {
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FEE_HEADS,
} from '../src/finance/finance.defaults';

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

  const academicYear = await prisma.academicYear.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: `${new Date().getUTCFullYear()}-${new Date().getUTCFullYear() + 1}`,
      },
    },
    update: {
      isCurrent: true,
    },
    create: {
      tenantId: tenant.id,
      name: `${new Date().getUTCFullYear()}-${new Date().getUTCFullYear() + 1}`,
      startsOn: new Date(`${new Date().getUTCFullYear()}-04-01T00:00:00.000Z`),
      endsOn: new Date(`${new Date().getUTCFullYear() + 1}-03-31T23:59:59.999Z`),
      isCurrent: true,
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

  for (const account of DEFAULT_CHART_ACCOUNTS) {
    await prisma.chartAccount.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        type: account.type,
      },
      create: {
        tenantId: tenant.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
    });
  }

  for (const feeHead of DEFAULT_FEE_HEADS) {
    await prisma.feeHead.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: feeHead.code,
        },
      },
      update: {
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: feeHead.defaultAmount,
        vatApplicable: feeHead.vatApplicable,
      },
      create: {
        tenantId: tenant.id,
        code: feeHead.code,
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: feeHead.defaultAmount,
        vatApplicable: feeHead.vatApplicable,
      },
    });
  }

  // 3. Create Default Admin Users
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'admin' } },
  });
  const superAdminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'super_admin' } },
  });

  if (!adminRole) {
    throw new Error('Admin role was not created successfully.');
  }

  if (!superAdminRole) {
    throw new Error('Super admin role was not created successfully.');
  }

  await ensureSeedUserWithRole({
    tenantId: tenant.id,
    email: 'admin@schoolos.com',
    password: 'admin123',
    roleId: adminRole.id,
  });

  await ensureSeedUserWithRole({
    tenantId: tenant.id,
    email: 'superadmin@schoolos.com',
    password: 'superadmin123',
    roleId: superAdminRole.id,
  });

  // 4. Create Classes
  console.log('Seeding classes and sections...');

  const classDefinitions = [
    { name: 'Nursery',  level: 0 },
    { name: 'LKG',      level: 1 },
    { name: 'UKG',      level: 2 },
    { name: 'Class 1',  level: 3 },
    { name: 'Class 2',  level: 4 },
    { name: 'Class 3',  level: 5 },
    { name: 'Class 4',  level: 6 },
    { name: 'Class 5',  level: 7 },
    { name: 'Class 6',  level: 8 },
    { name: 'Class 7',  level: 9 },
    { name: 'Class 8',  level: 10 },
    { name: 'Class 9',  level: 11 },
    { name: 'Class 10', level: 12 },
  ];

  const createdClasses: { id: string; name: string }[] = [];

  for (const classDef of classDefinitions) {
    const cls = await prisma.class.upsert({
      where: {
        tenantId_name: { tenantId: tenant.id, name: classDef.name },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: classDef.name,
        level: classDef.level,
      },
    });
    createdClasses.push(cls);
  }

  // 5. Create Sections A and B for each class
  const sectionNames = ['A', 'B'];

  for (const cls of createdClasses) {
    for (const sectionName of sectionNames) {
      await prisma.section.upsert({
        where: {
          tenantId_classId_name: {
            tenantId: tenant.id,
            classId: cls.id,
            name: sectionName,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          classId: cls.id,
          name: sectionName,
        },
      });
    }
  }

  console.log(`✅ Created ${createdClasses.length} classes with sections A & B each.`);
  console.log('✅ Seeding complete!');
  console.log('Admin login: admin@schoolos.com / admin123');
  console.log('Super admin login: superadmin@schoolos.com / superadmin123');
  console.log(`Academic year ready: ${academicYear.name}`);
}

async function ensureSeedUserWithRole({
  tenantId,
  email,
  password,
  roleId,
}: {
  tenantId: string;
  email: string;
  password: string;
  roleId: string;
}) {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId, email },
    },
    update: {
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId,
      email,
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: {
      tenantId,
      userId: user.id,
      roleId,
      scopeId: null,
    },
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        tenantId,
        userId: user.id,
        roleId,
      },
    });
  }
}

main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
