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
    roleName: 'principal',
    email: 'principal@schoolos.com',
    password: 'principal123',
  },
  {
    roleName: 'admin',
    email: 'admin@schoolos.com',
    password: 'admin123',
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

  await cleanupLegacyData(tenant.id);

  await seedChartAccounts(tenant.id);
  await seedFeeHeads(tenant.id);

  await seedUsersWithRoles(tenant.id);
  await seedClassesAndSections(tenant.id);
  await seedSubjects(tenant.id);
  await seedAcademicData(tenant.id, academicYear.id);
  await seedTenantSettings(tenant.id);

  console.log('');
  console.log('✅ SchoolOS seed completed successfully.');
  console.log('');
  console.log('Demo tenant:');
  console.log(`- Name: ${tenant.name}`);
  console.log(`- Slug: ${tenant.slug}`);
  console.log(`- Academic Year: ${academicYear.name}`);
  console.log('');
  console.log('Local/dev test logins:');
  console.log('- School Code: default-school');

  for (const seedUser of seedUsers) {
    console.log(
      `- ${seedUser.roleName}: ${seedUser.email} / ${seedUser.password}`,
    );
  }
}

async function cleanupLegacyData(tenantId: string) {
  console.log('Cleaning up legacy seed data...');

  // Delete legacy superadmin user
  await prisma.user.deleteMany({
    where: {
      tenantId,
      email: 'superadmin@schoolos.com',
    },
  });

  // Delete legacy super_admin role if it exists as a tenant role
  await prisma.role.deleteMany({
    where: {
      tenantId,
      name: 'super_admin',
    },
  });
}

async function seedTenantSettings(tenantId: string) {
  console.log('Seeding default tenant settings...');

  const defaults: Array<{ key: string; value: any }> = [
    { key: 'school_name', value: 'Everest Academy Secondary School' },
    { key: 'school_address', value: 'Bakhundole, Lalitpur, Nepal' },
    { key: 'school_phone', value: '+977-1-5555555' },
    { key: 'school_email', value: 'info@everest.edu.np' },
    { key: 'school_pan_number', value: '601234567' },
    { key: 'branding_primary_color', value: '#6366f1' },
    { key: 'timezone', value: 'Asia/Kathmandu' },
    { key: 'currency', value: 'NPR' },
    { key: 'date_format', value: 'YYYY-MM-DD' },
    { key: 'attendance_lock_hours', value: 24 },
    { key: 'payroll_month_day', value: 25 },
    { key: 'default_working_days_per_month', value: 26 },
    { key: 'pf_enabled', value: true },
    { key: 'tds_enabled', value: true },
    { key: 'active_academic_year_label', value: '2081/82' },
    { key: 'active_fiscal_year_label', value: 'FY 2081/82' },
    { key: 'chat_sunday_to_thursday_hours', value: '4:00 PM–7:00 PM' },
    { key: 'chat_friday_hours', value: '2:00 PM–5:00 PM' },
    { key: 'chat_saturday_enabled', value: false },
  ];

  for (const item of defaults) {
    await prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: item.key,
        },
      },
      update: {
        value: item.value,
      },
      create: {
        tenantId,
        key: item.key,
        value: item.value,
      },
    });
  }
}

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { slug: 'default-school' },
    update: {
      name: 'Everest Academy Secondary School',
      mode: Mode.SINGLE,
      plan: 'Standard',
      isActive: true,
    },
    create: {
      name: 'Everest Academy Secondary School',
      slug: 'default-school',
      mode: Mode.SINGLE,
      plan: 'Standard',
      isActive: true,
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
        scopeId: null,
      },
    });
  }
}

async function seedSubjects(tenantId: string) {
  console.log('Seeding basic subjects...');
  const subjects = ['Mathematics', 'Science', 'English', 'Social Studies', 'Nepali'];
  const classes = await prisma.class.findMany({ where: { tenantId } });

  for (const cls of classes) {
    for (const subjectName of subjects) {
      await prisma.subject.upsert({
        where: {
          tenantId_classId_name: {
            tenantId,
            classId: cls.id,
            name: subjectName,
          },
        },
        update: {},
        create: {
          tenantId,
          classId: cls.id,
          name: subjectName,
          code: `${cls.name.replace(/\s+/g, '')}-${subjectName.substring(0, 3).toUpperCase()}`,
        },
      });
    }
  }
}

async function seedAcademicData(tenantId: string, academicYearId: string) {
  console.log('Seeding academic sample data...');

  // 1. Exam Term
  const examTerm = await prisma.examTerm.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'First Terminal Exam',
      },
    },
    update: {},
    create: {
      tenantId,
      academicYearId,
      name: 'First Terminal Exam',
      startsOn: new Date(),
      endsOn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      weightPercent: 20,
      status: 'ACTIVE',
    },
  });

  // 2. Assessment Components for Math in Class 1
  const class1 = await prisma.class.findFirst({ where: { tenantId, name: 'Class 1' } });
  if (class1) {
    const math = await prisma.subject.findFirst({ where: { tenantId, classId: class1.id, name: 'Mathematics' } });
    if (math) {
      await prisma.assessmentComponent.upsert({
        where: {
          tenantId_examTermId_subjectId_name: {
            tenantId,
            examTermId: examTerm.id,
            subjectId: math.id,
            name: 'Theory',
          },
        },
        update: {},
        create: {
          tenantId,
          examTermId: examTerm.id,
          subjectId: math.id,
          name: 'Theory',
          maxMarks: 100,
          passMarks: 40,
          weightPercent: 100,
        },
      });

      // 3. Homework
      await prisma.homework.create({
        data: {
          tenantId,
          academicYearId,
          classId: class1.id,
          subjectId: math.id,
          title: 'Algebra Worksheet #1',
          instructions: 'Complete the exercises on page 42 of the textbook.',
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          status: 'ASSIGNED',
          maxScore: 10,
        },
      });
    }
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