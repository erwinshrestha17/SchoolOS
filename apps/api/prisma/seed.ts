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

type SeedUser = {
  roleName: string;
  email: string;
  password: string;
};

const seedUsers: SeedUser[] = [
  {
    roleName: 'super_admin',
    email: 'superadmin@schoolos.com',
    password: 'superadmin123',
  },
  {
    roleName: 'admin',
    email: 'admin@schoolos.com',
    password: 'admin123',
  },
  {
    roleName: 'principal',
    email: 'principal@schoolos.com',
    password: 'principal123',
  },
  {
    roleName: 'accountant',
    email: 'accountant@schoolos.com',
    password: 'accountant123',
  },
  {
    roleName: 'teacher',
    email: 'classteacher@schoolos.com',
    password: 'classteacher123',
  },
  {
    roleName: 'subject_teacher',
    email: 'subjectteacher@schoolos.com',
    password: 'subjectteacher123',
  },
  {
    roleName: 'parent',
    email: 'guardian@schoolos.com',
    password: 'guardian123',
  },
  {
    roleName: 'student',
    email: 'student@schoolos.com',
    password: 'student123',
  },
];

const classDefinitions = [
  { name: 'Nursery', level: 0 },
  { name: 'LKG', level: 1 },
  { name: 'UKG', level: 2 },
  { name: 'Class 1', level: 3 },
  { name: 'Class 2', level: 4 },
  { name: 'Class 3', level: 5 },
  { name: 'Class 4', level: 6 },
  { name: 'Class 5', level: 7 },
  { name: 'Class 6', level: 8 },
  { name: 'Class 7', level: 9 },
  { name: 'Class 8', level: 10 },
  { name: 'Class 9', level: 11 },
  { name: 'Class 10', level: 12 },
];

const sectionNames = ['A', 'B'];

async function main() {
  console.log('🌱 Seeding SchoolOS database...');

  const tenant = await seedTenant();
  const academicYear = await seedAcademicYear(tenant.id);

  await seedRoles(tenant.id);
  await seedPermissions();
  await seedRolePermissions(tenant.id);

  await seedChartAccounts(tenant.id);
  await seedFeeHeads(tenant.id);

  await seedUsersWithRoles(tenant.id);
  await seedClassesAndSections(tenant.id);

  console.log('');
  console.log('✅ SchoolOS seed completed successfully.');
  console.log('');
  console.log('Demo tenant:');
  console.log(`- Name: ${tenant.name}`);
  console.log(`- Slug: ${tenant.slug}`);
  console.log(`- Academic Year: ${academicYear.name}`);
  console.log('');
  console.log('Local/dev test logins:');

  for (const seedUser of seedUsers) {
    console.log(
      `- ${seedUser.roleName}: ${seedUser.email} / ${seedUser.password}`,
    );
  }

  console.log('');
  console.log('Next recommended seed upgrade:');
  console.log(
    '- Add real demo students, guardians, admissions, invoices, attendance records, and payments once the exact Prisma model fields are confirmed.',
  );
}

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { slug: 'default-school' },
    update: {
      name: 'Everest Academy Secondary School',
      mode: Mode.SINGLE,
      plan: 'Standard',
    },
    create: {
      name: 'Everest Academy Secondary School',
      slug: 'default-school',
      mode: Mode.SINGLE,
      plan: 'Standard',
    },
  });
}

async function seedAcademicYear(tenantId: string) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  return prisma.academicYear.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: `${currentYear}-${currentYear + 1}`,
      },
    },
    update: {
      startsOn: new Date(`${currentYear}-04-01T00:00:00.000Z`),
      endsOn: new Date(`${currentYear + 1}-03-31T23:59:59.999Z`),
      isCurrent: true,
    },
    create: {
      tenantId,
      name: `${currentYear}-${currentYear + 1}`,
      startsOn: new Date(`${currentYear}-04-01T00:00:00.000Z`),
      endsOn: new Date(`${currentYear + 1}-03-31T23:59:59.999Z`),
      isCurrent: true,
    },
  });
}

async function seedRoles(tenantId: string) {
  console.log('Seeding system roles...');

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: role.name,
        },
      },
      update: {
        description: role.description,
        isSystem: true,
      },
      create: {
        tenantId,
        name: role.name,
        isSystem: true,
        description: role.description,
      },
    });
  }
}

async function seedPermissions() {
  console.log('Seeding permissions...');

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

async function seedRolePermissions(tenantId: string) {
  console.log('Seeding role permissions...');

  for (const [roleName, permissionKeys] of Object.entries(
    SYSTEM_ROLE_PERMISSIONS,
  )) {
    const role = await prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
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
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedChartAccounts(tenantId: string) {
  console.log('Seeding default chart of accounts...');

  for (const account of DEFAULT_CHART_ACCOUNTS) {
    await prisma.chartAccount.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        type: account.type,
      },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
      },
    });
  }
}

async function seedFeeHeads(tenantId: string) {
  console.log('Seeding default fee heads...');

  for (const feeHead of DEFAULT_FEE_HEADS) {
    await prisma.feeHead.upsert({
      where: {
        tenantId_code: {
          tenantId,
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
        tenantId,
        code: feeHead.code,
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: feeHead.defaultAmount,
        vatApplicable: feeHead.vatApplicable,
      },
    });
  }
}

async function seedUsersWithRoles(tenantId: string) {
  console.log('Seeding local/dev test users...');

  for (const seedUser of seedUsers) {
    const role = await prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: seedUser.roleName,
        },
      },
    });

    if (!role) {
      throw new Error(`Role ${seedUser.roleName} was not created successfully.`);
    }

    await ensureSeedUserWithRole({
      tenantId,
      email: seedUser.email,
      password: seedUser.password,
      roleId: role.id,
    });
  }
}

async function seedClassesAndSections(tenantId: string) {
  console.log('Seeding classes and sections...');

  const createdClasses: { id: string; name: string }[] = [];

  for (const classDef of classDefinitions) {
    const cls = await prisma.class.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: classDef.name,
        },
      },
      update: {
        level: classDef.level,
      },
      create: {
        tenantId,
        name: classDef.name,
        level: classDef.level,
      },
    });

    createdClasses.push(cls);
  }

  for (const cls of createdClasses) {
    for (const sectionName of sectionNames) {
      await prisma.section.upsert({
        where: {
          tenantId_classId_name: {
            tenantId,
            classId: cls.id,
            name: sectionName,
          },
        },
        update: {},
        create: {
          tenantId,
          classId: cls.id,
          name: sectionName,
        },
      });
    }
  }

  console.log(
    `✅ Created ${createdClasses.length} classes with ${sectionNames.length} sections each.`,
  );
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
      tenantId_email: {
        tenantId,
        email,
      },
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

  await prisma.userRole.deleteMany({
    where: {
      tenantId,
      userId: user.id,
      roleId,
      scopeId: null,
    },
  });

  await prisma.userRole.create({
    data: {
      tenantId,
      userId: user.id,
      roleId,
      scopeId: null,
    },
  });
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });