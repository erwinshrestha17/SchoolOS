import {
  AssessmentType,
  AuthMethod,
  ExamTermStatus,
  HomeworkAssignmentStatus,
  Mode,
  Prisma,
  PrismaClient,
  UserStatus,
  EnrollmentStatus,
  TenantSubscriptionStatus,
  UsagePeriod,
  PlatformPlanStatus,
  ProviderType,
  ProviderEnvironment,
  SaaSInvoiceStatus,
  SaaSInvoiceLineType,
  AccountingReportMappingType,
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
  await seedAccountingReportMappings(tenant.id);
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
  await seedPlatformInfrastructure();

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
        isSystem: true,
        isActive: true,
      },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
        isSystem: true,
      },
    });
  }
}

async function seedAccountingReportMappings(tenantId: string) {
  console.log('Seeding default accounting report mappings...');

  const mappingCodes: Array<{
    mappingType: AccountingReportMappingType;
    code: string;
  }> = [
    { mappingType: AccountingReportMappingType.CASH, code: '1000' },
    { mappingType: AccountingReportMappingType.BANK, code: '1010' },
    { mappingType: AccountingReportMappingType.VAT_OUTPUT, code: '2230' },
    { mappingType: AccountingReportMappingType.VAT_INPUT, code: '2230' },
    { mappingType: AccountingReportMappingType.TDS_PAYABLE, code: '2220' },
    {
      mappingType: AccountingReportMappingType.PF_EMPLOYEE_PAYABLE,
      code: '2210',
    },
    {
      mappingType: AccountingReportMappingType.PF_EMPLOYER_PAYABLE,
      code: '2210',
    },
    { mappingType: AccountingReportMappingType.PF_PAYABLE, code: '2210' },
    {
      mappingType: AccountingReportMappingType.RETAINED_EARNINGS,
      code: '3100',
    },
  ];

  const accounts = await prisma.chartAccount.findMany({
    where: {
      tenantId,
      code: { in: mappingCodes.map((item) => item.code) },
    },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));

  for (const item of mappingCodes) {
    const account = accountByCode.get(item.code);
    if (!account) {
      throw new Error(
        `Default accounting report mapping ${item.mappingType} references missing account ${item.code}.`,
      );
    }

    await prisma.accountingReportAccountMapping.upsert({
      where: {
        tenantId_mappingType_accountId: {
          tenantId,
          mappingType: item.mappingType,
          accountId: account.id,
        },
      },
      update: {
        updatedById: null,
      },
      create: {
        tenantId,
        mappingType: item.mappingType,
        accountId: account.id,
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

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId,
      academicYearId,
      studentId: student.id,
    },
  });

  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        classId: class1.id,
        sectionId: sectionA.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        tenantId,
        academicYearId,
        studentId: student.id,
        classId: class1.id,
        sectionId: sectionA.id,
        status: EnrollmentStatus.ACTIVE,
        admissionDate: new Date(),
        mediumOfInstruction: 'English',
      },
    });
  }

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

async function seedPlatformInfrastructure() {
  console.log('Seeding platform infrastructure...');

  // 1. Create a few more tenants
  const trialTenant = await prisma.tenant.upsert({
    where: { slug: 'trial-school' },
    update: {
      name: 'Trial Academy',
      plan: 'free',
      isActive: true,
    },
    create: {
      name: 'Trial Academy',
      slug: 'trial-school',
      plan: 'free',
      isActive: true,
    },
  });

  const suspendedTenant = await prisma.tenant.upsert({
    where: { slug: 'suspended-school' },
    update: {
      name: 'Suspended Academy',
      plan: 'standard',
      isActive: false,
    },
    create: {
      name: 'Suspended Academy',
      slug: 'suspended-school',
      plan: 'standard',
      isActive: false,
    },
  });

  // 2. Create Platform Plans
  const plans = [
    { key: 'free', name: 'Free Tier', priceNpr: 0, billingCycle: 'ANNUAL' },
    { key: 'standard', name: 'Standard Tier', priceNpr: 50000, billingCycle: 'ANNUAL' },
    { key: 'premium', name: 'Premium Tier', priceNpr: 150000, billingCycle: 'ANNUAL' },
    { key: 'enterprise', name: 'Enterprise Tier', priceNpr: 300000, billingCycle: 'ANNUAL' },
  ];

  const createdPlans: any[] = [];
  for (const planData of plans) {
    const plan = await prisma.platformPlan.upsert({
      where: { key: planData.key },
      update: {
        name: planData.name,
        priceNpr: new Prisma.Decimal(planData.priceNpr),
        billingCycle: planData.billingCycle,
        status: PlatformPlanStatus.ACTIVE,
      },
      create: {
        key: planData.key,
        name: planData.name,
        priceNpr: new Prisma.Decimal(planData.priceNpr),
        billingCycle: planData.billingCycle,
        status: PlatformPlanStatus.ACTIVE,
      },
    });
    createdPlans.push(plan);

    // Seed features for each plan
    const features = ['academics', 'finance', 'hr', 'communications', 'library', 'transport', 'canteen'];
    for (const featureKey of features) {
      await prisma.platformPlanFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: { enabled: planData.key !== 'free' || featureKey === 'academics' },
        create: { planId: plan.id, featureKey, enabled: planData.key !== 'free' || featureKey === 'academics' },
      });
    }

    // Seed limits
    const limits = [
      { usageKey: 'students', limit: planData.key === 'free' ? 50 : planData.key === 'standard' ? 500 : planData.key === 'premium' ? 5000 : 50000 },
      { usageKey: 'storage', limit: planData.key === 'free' ? 1 : planData.key === 'standard' ? 10 : planData.key === 'premium' ? 100 : 1000 },
    ];
    for (const limitData of limits) {
      await prisma.usageLimit.upsert({
        where: { planId_usageKey_period: { planId: plan.id, usageKey: limitData.usageKey, period: UsagePeriod.MONTHLY } },
        update: { limit: limitData.limit },
        create: { planId: plan.id, usageKey: limitData.usageKey, limit: limitData.limit, period: UsagePeriod.MONTHLY },
      });
    }
  }

  // 3. Assign Subscriptions
  const defaultTenant = await prisma.tenant.findUnique({ where: { slug: 'default-school' } });
  if (defaultTenant) {
    const standardPlan = createdPlans.find(p => p.key === 'standard');
    if (standardPlan) {
      const subId = `sub-${defaultTenant.slug}`;
      await prisma.tenantSubscription.upsert({
        where: { id: subId },
        update: { planId: standardPlan.id, status: TenantSubscriptionStatus.ACTIVE },
        create: { id: subId, tenantId: defaultTenant.id, planId: standardPlan.id, status: TenantSubscriptionStatus.ACTIVE },
      });

      // Seed some usage counters
      await prisma.usageCounter.upsert({
        where: {
          tenantId_usageKey_period_periodStart: {
            tenantId: defaultTenant.id,
            usageKey: 'students',
            period: UsagePeriod.MONTHLY,
            periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        update: { value: 120 },
        create: {
          tenantId: defaultTenant.id,
          usageKey: 'students',
          period: UsagePeriod.MONTHLY,
          periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          value: 120,
        },
      });
    }
  }

  // 4. Seed Provider Configs
  const providers = [
    { type: ProviderType.SMS, name: 'sparrow', environment: ProviderEnvironment.PRODUCTION, enabled: true },
    { type: ProviderType.EMAIL, name: 'sendgrid', environment: ProviderEnvironment.PRODUCTION, enabled: true },
    { type: ProviderType.OBJECT_STORAGE, name: 'r2', environment: ProviderEnvironment.PRODUCTION, enabled: true },
  ];

  for (const p of providers) {
    await prisma.providerConfig.upsert({
      where: { type_name_environment: { type: p.type, name: p.name, environment: p.environment } },
      update: { enabled: p.enabled },
      create: {
        type: p.type,
        name: p.name,
        enabled: p.enabled,
        environment: p.environment,
        configEncrypted: { apiToken: '••••••••', secret: '••••••••' },
        secretKeys: ['apiToken', 'secret'],
      },
    });
  }

  if (defaultTenant) {
    // 5. Seed SaaS Invoices
    const invoiceId = `inv-${defaultTenant.slug}-001`;
    await prisma.saaSInvoice.upsert({
      where: { id: invoiceId },
      update: { status: SaaSInvoiceStatus.PAID },
      create: {
        id: invoiceId,
        tenantId: defaultTenant.id,
        invoiceNumber: 'SO-2024-00001',
        amount: new Prisma.Decimal(50000),
        currency: 'NPR',
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15'),
        status: SaaSInvoiceStatus.PAID,
        lines: {
          create: [
            {
              lineType: SaaSInvoiceLineType.SUBSCRIPTION,
              description: 'Standard Tier Annual Subscription',
              quantity: 1,
              unitAmount: new Prisma.Decimal(50000),
              totalAmount: new Prisma.Decimal(50000),
            }
          ]
        }
      },
    });

    const overdueInvoiceId = `inv-${defaultTenant.slug}-002`;
    await prisma.saaSInvoice.upsert({
      where: { id: overdueInvoiceId },
      update: { status: SaaSInvoiceStatus.ISSUED },
      create: {
        id: overdueInvoiceId,
        tenantId: defaultTenant.id,
        invoiceNumber: 'SO-2024-00002',
        amount: new Prisma.Decimal(12000),
        currency: 'NPR',
        issueDate: new Date('2024-04-01'),
        dueDate: new Date('2024-04-15'), // Overdue
        status: SaaSInvoiceStatus.ISSUED,
        lines: {
          create: [
            {
              lineType: SaaSInvoiceLineType.SMS_BUNDLE,
              description: 'SMS Bundle Add-on (10k)',
              quantity: 1,
              unitAmount: new Prisma.Decimal(12000),
              totalAmount: new Prisma.Decimal(12000),
            }
          ]
        }
      },
    });

    // 6. Seed Audit Logs
    const auditActions = [
      { action: 'TENANT_STATUS_CHANGE', resource: 'tenant', resourceId: trialTenant.id, reason: 'Trial period review' },
      { action: 'SUBSCRIPTION_ASSIGN', resource: 'subscription', resourceId: defaultTenant.id, reason: 'Migration to Standard' },
      { action: 'PROVIDER_UPDATE', resource: 'provider', resourceId: 'sms-sparrow', reason: 'Update production tokens' },
      { action: 'FEATURE_OVERRIDE', resource: 'tenant', resourceId: defaultTenant.id, reason: 'Enabling Transport for pilot' },
      { action: 'QUEUE_RETRY', resource: 'queue', resourceId: 'communications', reason: 'Retrying failed SMS batch' },
      { action: 'SUPPORT_OVERRIDE_START', resource: 'tenant', resourceId: defaultTenant.id, reason: 'Debugging billing issue' },
    ];

    for (const a of auditActions) {
      await prisma.auditLog.create({
        data: {
          tenantId: defaultTenant.id,
          action: a.action,
          resource: a.resource,
          resourceId: a.resourceId,
          after: { reason: a.reason },
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
