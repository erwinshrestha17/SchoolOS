import {
  AssessmentType,
  AuthMethod,
  ExamTermStatus,
  HomeworkAssignmentStatus,
  Mode,
  Prisma,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
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

type SeedSubject = {
  name: string;
  code: string;
  type: string;
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
  await seedPlatformUser(tenant.id);
  const student = await seedStudentAndEnrollment(tenant.id, academicYear.id);
  if (student) {
    await seedFinanceData(tenant.id, academicYear.id, student.id);
  }
  await seedLibraryData(tenant.id);
  await seedTransportData(tenant.id);
  await seedCanteenData(tenant.id);

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

  await prisma.user.deleteMany({
    where: {
      tenantId,
      email: 'superadmin@schoolos.com',
    },
  });

  await prisma.role.deleteMany({
    where: {
      tenantId,
      name: 'super_admin',
    },
  });
}

async function seedTenantSettings(tenantId: string) {
  console.log('Seeding default tenant settings...');

  const defaults: Array<{ key: string; value: Prisma.InputJsonValue }> = [
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

  const subjects: SeedSubject[] = [
    { name: 'Mathematics', code: 'MATH', type: 'CORE' },
    { name: 'Science', code: 'SCI', type: 'CORE' },
    { name: 'English', code: 'ENG', type: 'CORE' },
    { name: 'Social Studies', code: 'SOC', type: 'CORE' },
    { name: 'Nepali', code: 'NEP', type: 'CORE' },
  ];

  const classes = await prisma.class.findMany({ where: { tenantId } });

  for (const cls of classes) {
    for (const subject of subjects) {
      const code = `${cls.name.replace(/\s+/g, '')}-${subject.code}`;

      await prisma.subject.upsert({
        where: {
          tenantId_classId_code: {
            tenantId,
            classId: cls.id,
            code,
          },
        },
        update: {
          name: subject.name,
          type: subject.type,
        },
        create: {
          tenantId,
          classId: cls.id,
          name: subject.name,
          code,
          type: subject.type,
        },
      });
    }
  }
}

async function seedAcademicData(tenantId: string, academicYearId: string) {
  console.log('Seeding academic sample data...');

  const examTermName = 'First Terminal Exam';
  const startsOn = new Date();
  const endsOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const existingExamTerm = await prisma.examTerm.findFirst({
    where: {
      tenantId,
      academicYearId,
      name: examTermName,
    },
  });

  const examTerm = existingExamTerm
    ? await prisma.examTerm.update({
        where: { id: existingExamTerm.id },
        data: {
          startsOn,
          endsOn,
          weightPercent: new Prisma.Decimal(20),
          status: ExamTermStatus.ACTIVE,
        },
      })
    : await prisma.examTerm.create({
        data: {
          tenantId,
          academicYearId,
          name: examTermName,
          startsOn,
          endsOn,
          weightPercent: new Prisma.Decimal(20),
          status: ExamTermStatus.ACTIVE,
        },
      });

  const class1 = await prisma.class.findFirst({
    where: { tenantId, name: 'Class 1' },
  });

  if (!class1) {
    return;
  }

  const math = await prisma.subject.findFirst({
    where: {
      tenantId,
      classId: class1.id,
      code: 'Class1-MATH',
    },
  });

  if (!math) {
    return;
  }

  await prisma.assessmentComponent.upsert({
    where: {
      tenantId_examTermId_subjectId_name: {
        tenantId,
        examTermId: examTerm.id,
        subjectId: math.id,
        name: 'Theory',
      },
    },
    update: {
      type: AssessmentType.THEORY,
      maxMarks: new Prisma.Decimal(100),
      passMarks: new Prisma.Decimal(40),
      weightPercent: new Prisma.Decimal(100),
    },
    create: {
      tenantId,
      examTermId: examTerm.id,
      subjectId: math.id,
      name: 'Theory',
      type: AssessmentType.THEORY,
      maxMarks: new Prisma.Decimal(100),
      passMarks: new Prisma.Decimal(40),
      weightPercent: new Prisma.Decimal(100),
    },
  });

  const homeworkTitle = 'Algebra Worksheet #1';
  const homeworkDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  const existingHomework = await prisma.homeworkAssignment.findFirst({
    where: {
      tenantId,
      academicYearId,
      classId: class1.id,
      subjectId: math.id,
      title: homeworkTitle,
    },
  });

  if (existingHomework) {
    await prisma.homeworkAssignment.update({
      where: { id: existingHomework.id },
      data: {
        instructions: 'Complete the exercises on page 42 of the textbook.',
        dueDate: homeworkDueDate,
        dueAt: homeworkDueDate,
        assignedDate: new Date(),
        status: HomeworkAssignmentStatus.ASSIGNED,
        maxScore: new Prisma.Decimal(10),
        submissionRequired: true,
      },
    });

    return;
  }

  await prisma.homeworkAssignment.create({
    data: {
      tenantId,
      academicYearId,
      classId: class1.id,
      subjectId: math.id,
      title: homeworkTitle,
      instructions: 'Complete the exercises on page 42 of the textbook.',
      dueDate: homeworkDueDate,
      dueAt: homeworkDueDate,
      assignedDate: new Date(),
      status: HomeworkAssignmentStatus.ASSIGNED,
      maxScore: new Prisma.Decimal(10),
      submissionRequired: true,
    },
  });
}

async function seedPlatformUser(tenantId: string) {
  console.log('Seeding platform operator user...');
  const platformEmail = process.env.PLATFORM_SEED_EMAIL ?? 'platform@schoolos.com';
  const platformPassword =
    process.env.PLATFORM_SEED_PASSWORD ?? 'platform123';
  const roleName = 'platform_super_admin';

  const role = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId,
        name: roleName,
      },
    },
  });

  if (!role) {
    console.warn(`Role ${roleName} not found, skipping platform user seed.`);
    return;
  }

  await ensureSeedUserWithRole({
    tenantId,
    email: platformEmail,
    password: platformPassword,
    roleId: role.id,
  });
}

async function seedStudentAndEnrollment(
  tenantId: string,
  academicYearId: string,
) {
  console.log('Seeding sample student and enrollment...');

  const class1 = await prisma.class.findFirst({
    where: { tenantId, name: 'Class 1' },
  });
  const sectionA = class1
    ? await prisma.section.findFirst({
        where: { tenantId, classId: class1.id, name: 'A' },
      })
    : null;

  if (!class1 || !sectionA) {
    return null;
  }

  const studentEmail = 'student.sample@schoolos.com';
  const student = await prisma.student.upsert({
    where: { studentIdentityCode: 'STU001' },
    update: {
      firstNameEn: 'Aryan',
      lastNameEn: 'Sharma',
      gender: 'MALE',
      dateOfBirth: new Date('2015-05-15T00:00:00.000Z'),
      admissionDate: new Date(),
      classId: class1.id,
      sectionId: sectionA.id,
    },
    create: {
      tenantId,
      studentSystemId: 'S2024-001',
      studentIdentityCode: 'STU001',
      firstNameEn: 'Aryan',
      lastNameEn: 'Sharma',
      gender: 'MALE',
      dateOfBirth: new Date('2015-05-15T00:00:00.000Z'),
      admissionDate: new Date(),
      classId: class1.id,
      sectionId: sectionA.id,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      tenantId_academicYearId_studentId: {
        tenantId,
        academicYearId,
        studentId: student.id,
      },
    },
    update: {
      status: EnrollmentStatus.ACTIVE,
    },
    create: {
      tenantId,
      academicYearId,
      studentId: student.id,
      classId: class1.id,
      sectionId: sectionA.id,
      status: EnrollmentStatus.ACTIVE,
      enrolledAt: new Date(),
    },
  });

  return student;
}

async function seedFinanceData(
  tenantId: string,
  academicYearId: string,
  studentId: string,
) {
  console.log('Seeding sample finance data...');

  const tuitionFee = await prisma.feeHead.findFirst({
    where: { tenantId, code: 'TUITION' },
  });

  if (!tuitionFee) return;

  const invoiceNumber = 'INV-2024-001';
  await prisma.invoice.upsert({
    where: {
      tenantId_invoiceNumber: {
        tenantId,
        invoiceNumber,
      },
    },
    update: {
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(5000),
      subtotal: new Prisma.Decimal(5000),
      vatAmount: new Prisma.Decimal(0),
    },
    create: {
      tenantId,
      studentId,
      academicYearId,
      invoiceNumber,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(5000),
      subtotal: new Prisma.Decimal(5000),
      vatAmount: new Prisma.Decimal(0),
      lines: {
        create: [
          {
            tenantId,
            feeHeadId: tuitionFee.id,
            description: 'Monthly Tuition Fee - April',
            unitAmount: new Prisma.Decimal(5000),
            totalAmount: new Prisma.Decimal(5000),
            vatAmount: new Prisma.Decimal(0),
          },
        ],
      },
    },
  });
}

async function seedLibraryData(tenantId: string) {
  console.log('Seeding sample library data...');

  const isbn = '978-0132350884';
  const book = await prisma.libraryBook.upsert({
    where: {
      tenantId_isbn: {
        tenantId,
        isbn,
      },
    },
    update: {
      title: 'Clean Code',
      author: 'Robert C. Martin',
    },
    create: {
      tenantId,
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn,
      subjectCategory: 'Computer Science',
    },
  });

  await prisma.libraryCopy.upsert({
    where: {
      id: 'copy-clean-code-001',
    },
    update: {},
    create: {
      id: 'copy-clean-code-001',
      tenantId,
      bookId: book.id,
      barcode: 'LIB-CC-001',
      status: 'AVAILABLE',
      shelfLocation: 'Shelf A1',
    },
  });
}

async function seedTransportData(tenantId: string) {
  console.log('Seeding sample transport data...');

  const routeCode = 'R01';
  await prisma.transportRoute.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: routeCode,
      },
    },
    update: {
      name: 'North Route',
    },
    create: {
      tenantId,
      name: 'North Route',
      code: routeCode,
      isActive: true,
    },
  });
}

async function seedCanteenData(tenantId: string) {
  console.log('Seeding sample canteen data...');

  const itemName = 'Veg Lunch Set';
  await prisma.canteenMenuItem.upsert({
    where: {
      id: 'canteen-veg-lunch',
    },
    update: {
      name: itemName,
      category: 'Lunch',
      unitPrice: new Prisma.Decimal(150),
    },
    create: {
      id: 'canteen-veg-lunch',
      tenantId,
      name: itemName,
      category: 'Lunch',
      unitPrice: new Prisma.Decimal(150),
      isMealItem: true,
    },
  });
}

import { EnrollmentStatus } from '@prisma/client';

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
