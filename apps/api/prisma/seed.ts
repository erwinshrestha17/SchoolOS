import {
  AssessmentType,
  AuthMethod,
  ExamTermStatus,
  AttendanceStatus,
  AudienceType,
  ContractType,
  Gender,
  HomeworkAssignmentStatus,
  InvoiceStatus,
  LeaveRequestStatus,
  Mode,
  NoticePriority,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  PayrollLineStatus,
  PayrollPaymentStatus,
  PayrollRunStatus,
  PayslipStatus,
  Prisma,
  PrismaClient,
  SalaryComponentType,
  SalaryStructureStatus,
  StaffEmploymentType,
  StaffStatus,
  StudentLifecycleStatus,
  HomeworkSubmissionStatus,
  TimetableVersionStatus,
  TransportEnrollmentStatus,
  TransportStudentTripStatus,
  TransportTripDirection,
  TransportTripStatus,
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
const passwordHashCache = new Map<string, string>();

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

type CanonicalStudent = {
  id: string;
  className: string;
  sectionName: string;
  rollNumber: number;
  admissionNumber: string;
  guardianUserId: string;
  guardianId: string;
};

type CanonicalTeacher = {
  id: string;
  userId: string;
  email: string;
  name: string;
};

type CanonicalSubject = {
  id: string;
  name: string;
  code: string;
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
  {
    roleName: 'driver',
    email: 'driver@schoolos.com',
    password: 'driver123',
  },
];

const classDefinitions = Array.from({ length: 10 }, (_, index) => ({
  name: `Class ${index + 1}`,
  level: index + 1,
}));

const sectionNames = ['A', 'B'];

const canonicalSectionCounts: Record<string, Record<string, number>> = {
  'Class 1': { A: 28, B: 30 },
  'Class 2': { A: 29, B: 32 },
  'Class 3': { A: 27, B: 30 },
  'Class 4': { A: 31, B: 28 },
  'Class 5': { A: 30, B: 33 },
  'Class 6': { A: 29, B: 31 },
  'Class 7': { A: 27, B: 34 },
  'Class 8': { A: 32, B: 28 },
  'Class 9': { A: 31, B: 30 },
  'Class 10': { A: 29, B: 32 },
};

const expectedCanonicalStudentCount = 601;
const canonicalAdmissionPrefix = 'EA-2083';
const canonicalGuardianPassword =
  process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ?? 'guardian123';
const canonicalTeacherPassword =
  process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ?? 'teacher123';
const canonicalDriverPassword =
  process.env.SCHOOLOS_DEMO_DRIVER_PASSWORD ?? 'driver123';
const canonicalStaffPassword =
  process.env.SCHOOLOS_DEMO_STAFF_PASSWORD ?? 'staff123';

const firstNames = [
  'Aarav',
  'Aarya',
  'Anish',
  'Asmita',
  'Bibek',
  'Bina',
  'Deepak',
  'Diksha',
  'Ishan',
  'Karuna',
  'Kiran',
  'Manisha',
  'Nabin',
  'Nisha',
  'Prabin',
  'Prakriti',
  'Rabin',
  'Ritu',
  'Sagar',
  'Sanjana',
  'Saurav',
  'Shristi',
  'Suman',
  'Sunita',
  'Ujjwal',
  'Yogita',
];

const lastNames = [
  'Adhikari',
  'Bhandari',
  'Gautam',
  'Gurung',
  'Karki',
  'Khadka',
  'Koirala',
  'Lama',
  'Maharjan',
  'Poudel',
  'Rai',
  'Rana',
  'Sharma',
  'Shrestha',
  'Tamang',
  'Thapa',
  'Yadav',
];

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  assertDevelopmentSeedAllowed();
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
  await seedCanonicalSchoolDataset(tenant.id, academicYear.id);
  await seedAcademicData(tenant.id, academicYear.id);
  await seedTenantSettings(tenant.id);
  await seedPlatformUser(tenant.id);
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

  printRepresentativeCredentials();
}

function assertDevelopmentSeedAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run development seed with NODE_ENV=production.',
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

  const legacyStudents = await prisma.student.findMany({
    where: {
      tenantId,
      OR: [
        { studentSystemId: { startsWith: 'S2024-' } },
        { studentSystemId: { startsWith: 'SCH-2026-' } },
      ],
      lifecycleStatus: 'ACTIVE',
    },
    select: { id: true },
  });

  if (legacyStudents.length > 0) {
    const legacyStudentIds = legacyStudents.map((student) => student.id);
    await prisma.enrollment.updateMany({
      where: {
        tenantId,
        studentId: { in: legacyStudentIds },
        status: EnrollmentStatus.ACTIVE,
      },
      data: { status: EnrollmentStatus.EXITED },
    });
    await prisma.student.updateMany({
      where: { tenantId, id: { in: legacyStudentIds } },
      data: {
        lifecycleStatus: 'ARCHIVED',
        exitedAt: new Date(),
        exitReason: 'Retired by canonical development seed',
      },
    });
  }
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
    { key: 'chat_sunday_to_thursday_start', value: '16:00' },
    { key: 'chat_sunday_to_thursday_end', value: '19:00' },
    { key: 'chat_friday_start', value: '14:00' },
    { key: 'chat_friday_end', value: '17:00' },
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
  const accountByCode = new Map(
    accounts.map((account) => [account.code, account]),
  );

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
      throw new Error(
        `Role ${seedUser.roleName} was not created successfully.`,
      );
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
  let passwordHash = passwordHashCache.get(password);
  if (!passwordHash) {
    passwordHash = await bcrypt.hash(password, 12);
    passwordHashCache.set(password, passwordHash);
  }

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

  return user;
}

async function seedSubjects(tenantId: string) {
  console.log('Seeding canonical Class 1-10 subjects...');

  const classes = await prisma.class.findMany({ where: { tenantId } });

  for (const cls of classes) {
    const grade = classGrade(cls.name);
    if (!grade) continue;

    for (const subject of subjectDefinitionsForGrade(grade)) {
      const existingByName = await prisma.subject.findFirst({
        where: { tenantId, classId: cls.id, name: subject.name },
      });

      if (existingByName) {
        await prisma.subject.update({
          where: { id: existingByName.id },
          data: {
            code: existingByName.code,
            type: subject.type,
            hasPractical: subject.name.toLowerCase().includes('science'),
            theoryMarks: subject.name.toLowerCase().includes('science')
              ? 75
              : 100,
            practicalMarks: subject.name.toLowerCase().includes('science')
              ? 25
              : null,
            passMarks: 35,
          },
        });
        continue;
      }

      await prisma.subject.upsert({
        where: {
          tenantId_classId_code: {
            tenantId,
            classId: cls.id,
            code: `C${grade.toString().padStart(2, '0')}-${subject.code}`,
          },
        },
        update: {
          name: subject.name,
          type: subject.type,
          hasPractical: subject.name.toLowerCase().includes('science'),
          theoryMarks: subject.name.toLowerCase().includes('science')
            ? 75
            : 100,
          practicalMarks: subject.name.toLowerCase().includes('science')
            ? 25
            : null,
          passMarks: 35,
        },
        create: {
          tenantId,
          classId: cls.id,
          name: subject.name,
          code: `C${grade.toString().padStart(2, '0')}-${subject.code}`,
          type: subject.type,
          hasPractical: subject.name.toLowerCase().includes('science'),
          theoryMarks: subject.name.toLowerCase().includes('science')
            ? 75
            : 100,
          practicalMarks: subject.name.toLowerCase().includes('science')
            ? 25
            : null,
          passMarks: 35,
        },
      });
    }
  }
}

function subjectDefinitionsForGrade(grade: number): SeedSubject[] {
  if (grade <= 3) {
    return [
      { name: 'Nepali', code: 'NEP', type: 'CORE' },
      { name: 'English', code: 'ENG', type: 'CORE' },
      { name: 'Mathematics', code: 'MATH', type: 'CORE' },
      { name: 'Science and Health', code: 'SCIHLT', type: 'CORE' },
      { name: 'Social Studies and Human Values', code: 'SOCHV', type: 'CORE' },
      { name: 'Computer and Digital Literacy', code: 'CDL', type: 'CORE' },
      { name: 'Creative Arts', code: 'ART', type: 'CORE' },
      {
        name: 'Moral Education and Local Curriculum',
        code: 'MORLOC',
        type: 'CORE',
      },
    ];
  }

  if (grade <= 5) {
    return [
      { name: 'Nepali', code: 'NEP', type: 'CORE' },
      { name: 'English', code: 'ENG', type: 'CORE' },
      { name: 'Mathematics', code: 'MATH', type: 'CORE' },
      { name: 'Science and Technology', code: 'SCITECH', type: 'CORE' },
      { name: 'Social Studies and Human Values', code: 'SOCHV', type: 'CORE' },
      { name: 'Computer and ICT', code: 'ICT', type: 'CORE' },
      { name: 'Health and Physical Education', code: 'HPE', type: 'CORE' },
      {
        name: 'Creative Arts and Local Curriculum',
        code: 'ARTLOC',
        type: 'CORE',
      },
    ];
  }

  if (grade <= 8) {
    return [
      { name: 'Nepali', code: 'NEP', type: 'CORE' },
      { name: 'English', code: 'ENG', type: 'CORE' },
      { name: 'Mathematics', code: 'MATH', type: 'CORE' },
      { name: 'Science and Technology', code: 'SCITECH', type: 'CORE' },
      { name: 'Social Studies and Human Values', code: 'SOCHV', type: 'CORE' },
      { name: 'Computer and ICT', code: 'ICT', type: 'CORE' },
      { name: 'Health and Physical Education', code: 'HPE', type: 'CORE' },
      {
        name: 'Optional Mathematics and Local Curriculum',
        code: 'OPTMATH',
        type: 'OPTIONAL',
      },
    ];
  }

  return [
    { name: 'Nepali', code: 'NEP', type: 'CORE' },
    { name: 'English', code: 'ENG', type: 'CORE' },
    { name: 'Mathematics', code: 'MATH', type: 'CORE' },
    { name: 'Science and Technology', code: 'SCITECH', type: 'CORE' },
    { name: 'Social Studies', code: 'SOC', type: 'CORE' },
    { name: 'Computer and ICT', code: 'ICT', type: 'CORE' },
    { name: 'Health and Physical Education', code: 'HPE', type: 'CORE' },
    {
      name: 'Account Economics and Optional Mathematics',
      code: 'ACCECO',
      type: 'OPTIONAL',
    },
  ];
}

async function seedCanonicalSchoolDataset(
  tenantId: string,
  academicYearId: string,
) {
  console.log('Seeding canonical Everest Academy Class 1-10 dataset...');

  const roles = await getRoleIds(tenantId);
  const classes = await prisma.class.findMany({
    where: {
      tenantId,
      name: { in: classDefinitions.map((item) => item.name) },
    },
    include: { sections: true, subjects: true },
    orderBy: { level: 'asc' },
  });
  const principalUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: 'principal@schoolos.com' } },
    select: { id: true },
  });
  const accountantUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: 'accountant@schoolos.com' } },
    select: { id: true },
  });

  await retireCanonicalOverflowStudents(tenantId, academicYearId);

  const classTeachers = await seedCanonicalClassTeachers(
    tenantId,
    roles.teacher,
  );
  const subjectTeacherPools = await seedCanonicalSubjectTeachers(
    tenantId,
    roles.subject_teacher,
  );
  const students = await seedCanonicalStudents(
    tenantId,
    academicYearId,
    roles.parent,
    classes,
  );
  await seedCanonicalTeacherAssignments(
    tenantId,
    academicYearId,
    classes,
    classTeachers,
    subjectTeacherPools,
  );
  await seedCanonicalTimetable(
    tenantId,
    academicYearId,
    classes,
    classTeachers,
    subjectTeacherPools,
    principalUser?.id ?? null,
  );
  await seedCanonicalAttendance(
    tenantId,
    academicYearId,
    classes,
    students,
    classTeachers,
  );
  await seedCanonicalHomework(
    tenantId,
    academicYearId,
    classes,
    students,
    classTeachers,
    subjectTeacherPools,
  );
  await seedCanonicalNotices(
    tenantId,
    classes,
    students,
    principalUser?.id ?? null,
  );
  await seedCanonicalFinance(
    tenantId,
    academicYearId,
    students,
    accountantUser?.id ?? null,
  );
  await seedCanonicalStaffSelfService(
    tenantId,
    accountantUser?.id ?? null,
    principalUser?.id ?? null,
  );
  await seedCanonicalTransport(
    tenantId,
    students,
    roles.driver,
    principalUser?.id ?? null,
  );
  await validateCanonicalSeed(tenantId, academicYearId);
}

async function getRoleIds(tenantId: string) {
  const roles = await prisma.role.findMany({
    where: {
      tenantId,
      name: { in: ['parent', 'teacher', 'subject_teacher', 'driver'] },
    },
  });
  const byName = new Map(roles.map((role) => [role.name, role.id]));
  for (const name of ['parent', 'teacher', 'subject_teacher', 'driver']) {
    if (!byName.get(name))
      throw new Error(`Missing role for canonical seed: ${name}`);
  }
  return {
    parent: byName.get('parent')!,
    teacher: byName.get('teacher')!,
    subject_teacher: byName.get('subject_teacher')!,
    driver: byName.get('driver')!,
  };
}

async function retireCanonicalOverflowStudents(
  tenantId: string,
  academicYearId: string,
) {
  const canonicalStudents = await prisma.student.findMany({
    where: {
      tenantId,
      studentSystemId: { startsWith: `${canonicalAdmissionPrefix}-` },
    },
    select: {
      id: true,
      class: { select: { name: true } },
      sectionRef: { select: { name: true } },
      rollNumber: true,
    },
  });
  const expectedIds = new Set<string>();
  for (const student of canonicalStudents) {
    const sectionName = student.sectionRef?.name;
    const max = sectionName
      ? canonicalSectionCounts[student.class.name]?.[sectionName]
      : undefined;
    if (max && student.rollNumber && student.rollNumber <= max) {
      expectedIds.add(student.id);
    }
  }
  const overflowIds = canonicalStudents
    .map((student) => student.id)
    .filter((id) => !expectedIds.has(id));
  if (overflowIds.length === 0) return;

  await prisma.enrollment.updateMany({
    where: {
      tenantId,
      academicYearId,
      studentId: { in: overflowIds },
      status: EnrollmentStatus.ACTIVE,
    },
    data: { status: EnrollmentStatus.EXITED },
  });
  await prisma.student.updateMany({
    where: { tenantId, id: { in: overflowIds } },
    data: {
      lifecycleStatus: 'ARCHIVED',
      exitedAt: new Date(),
      exitReason: 'Canonical seed count changed',
    },
  });
}

async function seedCanonicalClassTeachers(tenantId: string, roleId: string) {
  const teachers = new Map<string, CanonicalTeacher>();
  for (let grade = 1; grade <= 10; grade += 1) {
    for (const section of sectionNames) {
      const email = `classteacher.${grade}${section.toLowerCase()}@schoolos.com`;
      const user = await ensureSeedUserWithRole({
        tenantId,
        email,
        password: canonicalTeacherPassword,
        roleId,
      });
      const staff = await upsertStaffProfile({
        tenantId,
        userId: user.id,
        employeeId: `EA-CT-${grade.toString().padStart(2, '0')}${section}`,
        firstName: teacherFirstName(grade, section),
        lastName: teacherLastName(grade, section),
        gender: section === 'A' ? Gender.FEMALE : Gender.MALE,
        designation: `Class ${grade}-${section} Teacher`,
        department: grade <= 5 ? 'Primary' : 'Secondary',
      });
      teachers.set(sectionKey(`Class ${grade}`, section), {
        id: staff.id,
        userId: user.id,
        email,
        name: `${staff.firstName} ${staff.lastName}`,
      });
    }
  }
  return teachers;
}

async function seedCanonicalSubjectTeachers(tenantId: string, roleId: string) {
  const subjectKeys = [
    'nepali',
    'english',
    'mathematics',
    'science',
    'social',
    'computer',
    'hpe',
    'optional',
  ];
  const pools = new Map<string, CanonicalTeacher[]>();
  for (const subjectKey of subjectKeys) {
    const poolSize =
      subjectKey === 'mathematics' || subjectKey === 'english' ? 10 : 8;
    const pool: CanonicalTeacher[] = [];
    for (let index = 1; index <= poolSize; index += 1) {
      const representativeEmail =
        subjectKey === 'mathematics' && index === 1
          ? 'subjectteacher.math@schoolos.com'
          : subjectKey === 'english' && index === 1
            ? 'subjectteacher.english@schoolos.com'
            : `subjectteacher.${subjectKey}${index}@schoolos.com`;
      const user = await ensureSeedUserWithRole({
        tenantId,
        email: representativeEmail,
        password: canonicalTeacherPassword,
        roleId,
      });
      const staff = await upsertStaffProfile({
        tenantId,
        userId: user.id,
        employeeId: `EA-ST-${subjectKey.toUpperCase()}-${index.toString().padStart(2, '0')}`,
        firstName: subjectTeacherFirstName(subjectKey, index),
        lastName: subjectTeacherLastName(subjectKey, index),
        gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        designation: `${titleCase(subjectKey)} Teacher`,
        department: 'Academics',
      });
      pool.push({
        id: staff.id,
        userId: user.id,
        email: representativeEmail,
        name: `${staff.firstName} ${staff.lastName}`,
      });
    }
    pools.set(subjectKey, pool);
  }
  return pools;
}

async function seedCanonicalStudents(
  tenantId: string,
  academicYearId: string,
  parentRoleId: string,
  classes: Array<{
    id: string;
    name: string;
    level: number;
    sections: Array<{ id: string; name: string }>;
  }>,
) {
  const students: CanonicalStudent[] = [];
  for (const cls of classes) {
    const grade = classGrade(cls.name);
    if (!grade) continue;
    for (const sectionName of sectionNames) {
      const section = cls.sections.find((item) => item.name === sectionName);
      if (!section)
        throw new Error(`Missing section ${cls.name}-${sectionName}`);
      const count = canonicalSectionCounts[cls.name][sectionName];
      for (let roll = 1; roll <= count; roll += 1) {
        const code = canonicalStudentCode(grade, sectionName, roll);
        const gender = (grade + roll) % 2 === 0 ? Gender.FEMALE : Gender.MALE;
        const guardianEmail = `guardian.${guardianEmailCode(grade, sectionName, roll)}@schoolos.test`;
        const guardianUser = await ensureSeedUserWithRole({
          tenantId,
          email: guardianEmail,
          password: canonicalGuardianPassword,
          roleId: parentRoleId,
        });
        const guardian = await prisma.guardian.upsert({
          where: {
            tenantId_primaryPhone: {
              tenantId,
              primaryPhone: guardianPhone(grade, sectionName, roll),
            },
          },
          update: {
            userId: guardianUser.id,
            fullName: `${guardianName(grade, roll)} ${studentLastName(grade, roll)}`,
            relation: 'Guardian',
            email: guardianEmail,
            homeAddress: 'Lalitpur, Nepal',
            receivesAlerts: true,
            privacyConsentAt: new Date(),
          },
          create: {
            tenantId,
            userId: guardianUser.id,
            fullName: `${guardianName(grade, roll)} ${studentLastName(grade, roll)}`,
            relation: 'Guardian',
            primaryPhone: guardianPhone(grade, sectionName, roll),
            email: guardianEmail,
            homeAddress: 'Lalitpur, Nepal',
            receivesAlerts: true,
            privacyConsentAt: new Date(),
          },
        });

        const student = await prisma.student.upsert({
          where: {
            tenantId_studentSystemId: { tenantId, studentSystemId: code },
          },
          update: {
            firstNameEn: studentFirstName(grade, roll),
            lastNameEn: studentLastName(grade, roll),
            dateOfBirth: studentDob(grade, roll),
            gender,
            nationality: 'Nepali',
            motherTongue: 'Nepali',
            disabilityFlag: 'No known disability',
            admissionDate: date('2026-04-10'),
            admissionNumber: code,
            mediumOfInstruct: 'English',
            classId: cls.id,
            sectionId: section.id,
            section: sectionName,
            rollNumber: roll,
            lifecycleStatus: 'ACTIVE',
            exitedAt: null,
            exitReason: null,
            privacyConsentAt: new Date(),
            dataProcessingConsentedAt: new Date(),
            medicalConsentAt: new Date(),
            photoUsageConsentAt: new Date(),
          },
          create: {
            tenantId,
            studentSystemId: code,
            firstNameEn: studentFirstName(grade, roll),
            lastNameEn: studentLastName(grade, roll),
            dateOfBirth: studentDob(grade, roll),
            gender,
            nationality: 'Nepali',
            motherTongue: 'Nepali',
            disabilityFlag: 'No known disability',
            admissionDate: date('2026-04-10'),
            admissionNumber: code,
            mediumOfInstruct: 'English',
            classId: cls.id,
            sectionId: section.id,
            section: sectionName,
            rollNumber: roll,
            privacyConsentAt: new Date(),
            dataProcessingConsentedAt: new Date(),
            medicalConsentAt: new Date(),
            photoUsageConsentAt: new Date(),
          },
        });

        await prisma.studentGuardian.upsert({
          where: {
            studentId_guardianId: {
              studentId: student.id,
              guardianId: guardian.id,
            },
          },
          update: {
            relation: 'Guardian',
            isPrimary: true,
            appLoginLinked: true,
          },
          create: {
            tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: 'Guardian',
            isPrimary: true,
            appLoginLinked: true,
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
            classId: cls.id,
            sectionId: section.id,
            rollNumber: roll,
            admissionNumber: code,
            admissionDate: date('2026-04-10'),
            mediumOfInstruction: 'English',
            status: EnrollmentStatus.ACTIVE,
          },
          create: {
            tenantId,
            academicYearId,
            studentId: student.id,
            classId: cls.id,
            sectionId: section.id,
            rollNumber: roll,
            admissionNumber: code,
            admissionDate: date('2026-04-10'),
            mediumOfInstruction: 'English',
            status: EnrollmentStatus.ACTIVE,
          },
        });

        students.push({
          id: student.id,
          className: cls.name,
          sectionName,
          rollNumber: roll,
          admissionNumber: code,
          guardianUserId: guardianUser.id,
          guardianId: guardian.id,
        });
      }
    }
  }
  return students;
}

async function seedCanonicalTeacherAssignments(
  tenantId: string,
  academicYearId: string,
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
    subjects: Array<CanonicalSubject>;
  }>,
  classTeachers: Map<string, CanonicalTeacher>,
  subjectTeacherPools: Map<string, CanonicalTeacher[]>,
) {
  for (const cls of classes) {
    const grade = classGrade(cls.name);
    if (!grade) continue;
    for (const sectionName of sectionNames) {
      const section = cls.sections.find((item) => item.name === sectionName);
      if (!section) continue;
      const classTeacher = classTeachers.get(sectionKey(cls.name, sectionName));
      if (!classTeacher)
        throw new Error(`Missing class teacher ${cls.name}-${sectionName}`);
      await prisma.section.update({
        where: { id: section.id },
        data: { classTeacherId: classTeacher.id, capacity: 40 },
      });

      for (const subject of canonicalSubjectsForClass(cls)) {
        const teacher = pickSubjectTeacher(
          subjectTeacherPools,
          subject.name,
          grade,
          sectionName,
        );
        const existingAssignments =
          await prisma.subjectTeacherAssignment.findMany({
            where: {
              tenantId,
              academicYearId,
              classId: cls.id,
              sectionId: section.id,
              subjectId: subject.id,
            },
          });
        const preferredAssignment =
          existingAssignments.find((item) => item.staffId === teacher.id) ??
          existingAssignments[0];
        const assignment = preferredAssignment
          ? preferredAssignment.staffId === teacher.id
            ? preferredAssignment
            : await prisma.subjectTeacherAssignment.update({
                where: { id: preferredAssignment.id },
                data: { staffId: teacher.id },
              })
          : await prisma.subjectTeacherAssignment.create({
              data: {
                tenantId,
                academicYearId,
                classId: cls.id,
                sectionId: section.id,
                subjectId: subject.id,
                staffId: teacher.id,
              },
            });
        await prisma.subjectTeacherAssignment.deleteMany({
          where: {
            tenantId,
            academicYearId,
            classId: cls.id,
            sectionId: section.id,
            subjectId: subject.id,
            id: { not: assignment.id },
          },
        });
      }
    }
  }
}

async function seedCanonicalTimetable(
  tenantId: string,
  academicYearId: string,
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
    subjects: Array<CanonicalSubject>;
  }>,
  classTeachers: Map<string, CanonicalTeacher>,
  subjectTeacherPools: Map<string, CanonicalTeacher[]>,
  publishedById: string | null,
) {
  const periods = await seedCanonicalPeriods(tenantId, academicYearId);
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();

  for (const cls of classes) {
    const grade = classGrade(cls.name);
    if (!grade) continue;
    for (const sectionName of sectionNames) {
      const section = cls.sections.find((item) => item.name === sectionName);
      if (!section) continue;
      const versionName = `Canonical ${cls.name}-${sectionName} Weekly Timetable`;
      const existingVersion = await prisma.timetableVersion.findFirst({
        where: {
          tenantId,
          academicYearId,
          classId: cls.id,
          sectionId: section.id,
          versionName,
        },
      });
      const version = existingVersion
        ? await prisma.timetableVersion.update({
            where: { id: existingVersion.id },
            data: {
              status: 'PUBLISHED',
              effectiveFrom: date('2026-04-01'),
              effectiveTo: date('2027-03-31'),
              publishedAt: new Date(),
              publishedById,
            },
          })
        : await prisma.timetableVersion.create({
            data: {
              tenantId,
              academicYearId,
              classId: cls.id,
              sectionId: section.id,
              versionName,
              status: 'PUBLISHED',
              effectiveFrom: date('2026-04-01'),
              effectiveTo: date('2027-03-31'),
              publishedAt: new Date(),
              publishedById,
            },
          });
      const room = await prisma.room.upsert({
        where: {
          tenantId_name: { tenantId, name: `${cls.name}-${sectionName} Room` },
        },
        update: {
          code: `C${grade}${sectionName}`,
          capacity: 40,
          isActive: true,
        },
        create: {
          tenantId,
          name: `${cls.name}-${sectionName} Room`,
          code: `C${grade}${sectionName}`,
          capacity: 40,
          isActive: true,
        },
      });

      await prisma.timetableSlot.deleteMany({
        where: { tenantId, versionId: version.id },
      });

      const subjects = canonicalSubjectsForClass(cls);
      for (let day = 1; day <= 5; day += 1) {
        for (
          let periodIndex = 0;
          periodIndex < subjects.length;
          periodIndex += 1
        ) {
          const subject =
            subjects[(periodIndex + day + grade) % subjects.length];
          const period = periods[periodIndex];
          const teacher =
            periodIndex === 0
              ? classTeachers.get(sectionKey(cls.name, sectionName))!
              : pickAvailableSubjectTeacher(
                  subjectTeacherPools,
                  subject.name,
                  grade,
                  sectionName,
                  teacherBusy,
                  day,
                  period.sortOrder,
                );
          const teacherKey = `${teacher.id}:${day}:${period.sortOrder}`;
          const roomKey = `${room.id}:${day}:${period.sortOrder}`;
          if (teacherBusy.has(teacherKey)) {
            throw new Error(
              `Teacher timetable conflict for ${teacher.email} day ${day} period ${period.sortOrder}`,
            );
          }
          if (roomBusy.has(roomKey)) {
            throw new Error(
              `Room timetable conflict for ${room.name} day ${day} period ${period.sortOrder}`,
            );
          }
          teacherBusy.add(teacherKey);
          roomBusy.add(roomKey);
          const existing = await prisma.timetableSlot.findFirst({
            where: {
              tenantId,
              versionId: version.id,
              classId: cls.id,
              sectionId: section.id,
              dayOfWeek: day,
              periodId: period.id,
            },
          });
          const data = {
            academicYearId,
            classId: cls.id,
            sectionId: section.id,
            subjectId: subject.id,
            staffId: teacher.id,
            periodId: period.id,
            roomId: room.id,
            dayOfWeek: day,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            room: room.name,
          };
          if (existing) {
            await prisma.timetableSlot.update({
              where: { id: existing.id },
              data,
            });
          } else {
            await prisma.timetableSlot.create({
              data: { tenantId, versionId: version.id, ...data },
            });
          }
        }
      }
    }
  }
}

async function seedCanonicalPeriods(tenantId: string, academicYearId: string) {
  const periodDefs = [
    ['Period 1', '09:00', '09:40'],
    ['Period 2', '09:45', '10:25'],
    ['Period 3', '10:30', '11:10'],
    ['Period 4', '11:15', '11:55'],
    ['Period 5', '12:35', '13:15'],
    ['Period 6', '13:20', '14:00'],
    ['Period 7', '14:05', '14:45'],
    ['Period 8', '14:50', '15:30'],
  ] as const;
  const periods: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    sortOrder: number;
  }> = [];
  for (const [index, [name, startsAt, endsAt]] of periodDefs.entries()) {
    const period = await prisma.timetablePeriod.upsert({
      where: {
        tenantId_academicYearId_name: { tenantId, academicYearId, name },
      },
      update: { startsAt, endsAt, sortOrder: index + 1, isActive: true },
      create: {
        tenantId,
        academicYearId,
        name,
        startsAt,
        endsAt,
        sortOrder: index + 1,
        isActive: true,
      },
    });
    periods.push(period);
  }
  return periods;
}

async function seedCanonicalAttendance(
  tenantId: string,
  academicYearId: string,
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
  }>,
  students: CanonicalStudent[],
  classTeachers: Map<string, CanonicalTeacher>,
) {
  const studentsBySection = groupStudentsBySection(students);
  for (const attendanceDate of lastSchoolDays(10)) {
    for (const cls of classes) {
      for (const sectionName of sectionNames) {
        const section = cls.sections.find((item) => item.name === sectionName);
        if (!section) continue;
        const teacher = classTeachers.get(sectionKey(cls.name, sectionName));
        const sectionStudents =
          studentsBySection.get(sectionKey(cls.name, sectionName)) ?? [];
        const session = await prisma.attendanceSession.upsert({
          where: {
            tenantId_attendanceDate_classId_sectionId: {
              tenantId,
              attendanceDate,
              classId: cls.id,
              sectionId: section.id,
            },
          },
          update: {
            submittedById: teacher?.userId ?? null,
            submittedAt: new Date(),
            lockAt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
          },
          create: {
            tenantId,
            academicYearId,
            classId: cls.id,
            sectionId: section.id,
            attendanceDate,
            submittedById: teacher?.userId ?? null,
            submittedAt: new Date(),
            lockAt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        for (const student of sectionStudents) {
          await prisma.attendanceRecord.upsert({
            where: {
              attendanceSessionId_studentId: {
                attendanceSessionId: session.id,
                studentId: student.id,
              },
            },
            update: {
              status: attendanceStatusFor(student.rollNumber, attendanceDate),
              remark: attendanceRemarkFor(student.rollNumber, attendanceDate),
            },
            create: {
              tenantId,
              attendanceSessionId: session.id,
              studentId: student.id,
              status: attendanceStatusFor(student.rollNumber, attendanceDate),
              remark: attendanceRemarkFor(student.rollNumber, attendanceDate),
            },
          });
        }
      }
    }
  }
}

async function seedCanonicalHomework(
  tenantId: string,
  academicYearId: string,
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
    subjects: Array<CanonicalSubject>;
  }>,
  students: CanonicalStudent[],
  classTeachers: Map<string, CanonicalTeacher>,
  subjectTeacherPools: Map<string, CanonicalTeacher[]>,
) {
  const studentsBySection = groupStudentsBySection(students);
  for (const cls of classes) {
    const grade = classGrade(cls.name);
    if (!grade) continue;
    for (const sectionName of sectionNames) {
      const section = cls.sections.find((item) => item.name === sectionName);
      if (!section) continue;
      const sectionStudents =
        studentsBySection.get(sectionKey(cls.name, sectionName)) ?? [];
      await prisma.homeworkAssignment.deleteMany({
        where: {
          tenantId,
          academicYearId,
          classId: cls.id,
          sectionId: section.id,
          title: { startsWith: `${cls.name}-${sectionName} ` },
        },
      });
      const subjects = canonicalSubjectsForClass(cls).slice(0, 3);
      for (const [index, subject] of subjects.entries()) {
        const active = index < 2;
        const teacher = active
          ? index === 0
            ? classTeachers.get(sectionKey(cls.name, sectionName))!
            : pickSubjectTeacher(
                subjectTeacherPools,
                subject.name,
                grade,
                sectionName,
              )
          : pickSubjectTeacher(
              subjectTeacherPools,
              subject.name,
              grade,
              sectionName,
            );
        const title = `${cls.name}-${sectionName} ${subject.name} ${active ? 'Practice' : 'Review'} ${index + 1}`;
        const dueAt = addDays(dateOnly(new Date()), active ? 3 + index : -4);
        const existing = await prisma.homeworkAssignment.findFirst({
          where: {
            tenantId,
            academicYearId,
            classId: cls.id,
            sectionId: section.id,
            title,
          },
        });
        const homework = existing
          ? await prisma.homeworkAssignment.update({
              where: { id: existing.id },
              data: {
                subjectId: subject.id,
                assignedByStaffId: teacher.id,
                instructions: `Complete the ${subject.name} work for ${cls.name}-${sectionName}.`,
                dueDate: dueAt,
                dueAt,
                assignedDate: new Date(),
                status: active
                  ? HomeworkAssignmentStatus.ASSIGNED
                  : HomeworkAssignmentStatus.CLOSED,
                submissionRequired: true,
                maxScore: new Prisma.Decimal(10),
              },
            })
          : await prisma.homeworkAssignment.create({
              data: {
                tenantId,
                academicYearId,
                classId: cls.id,
                sectionId: section.id,
                subjectId: subject.id,
                assignedByStaffId: teacher.id,
                title,
                instructions: `Complete the ${subject.name} work for ${cls.name}-${sectionName}.`,
                dueDate: dueAt,
                dueAt,
                assignedDate: new Date(),
                status: active
                  ? HomeworkAssignmentStatus.ASSIGNED
                  : HomeworkAssignmentStatus.CLOSED,
                submissionRequired: true,
                maxScore: new Prisma.Decimal(10),
              },
            });

        if (!active) {
          for (const student of sectionStudents.slice(0, 5)) {
            await prisma.homeworkSubmission.upsert({
              where: {
                tenantId_homeworkId_studentId: {
                  tenantId,
                  homeworkId: homework.id,
                  studentId: student.id,
                },
              },
              update: {
                status: 'REVIEWED',
                submittedAt: addDays(dueAt, -1),
                score: new Prisma.Decimal(8 + (student.rollNumber % 3)),
                feedback: 'Reviewed in class.',
                reviewedById: teacher.id,
                reviewedAt: new Date(),
                returnedAt: new Date(),
              },
              create: {
                tenantId,
                homeworkId: homework.id,
                studentId: student.id,
                status: 'REVIEWED',
                submittedAt: addDays(dueAt, -1),
                score: new Prisma.Decimal(8 + (student.rollNumber % 3)),
                feedback: 'Reviewed in class.',
                reviewedById: teacher.id,
                reviewedAt: new Date(),
                returnedAt: new Date(),
              },
            });
          }
        }
      }
    }
  }
}

async function seedCanonicalNotices(
  tenantId: string,
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{ id: string; name: string }>;
  }>,
  students: CanonicalStudent[],
  createdById: string | null,
) {
  const notices: Array<{
    title: string;
    body: string;
    audienceType: AudienceType;
    classId: string | null;
    sectionId: string | null;
    priority: NoticePriority;
  }> = [
    {
      title: 'Welcome to Everest Academy 2083',
      body: 'Welcome to the new academic year.',
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      priority: NoticePriority.NORMAL,
    },
    {
      title: 'Parent Teacher Meeting',
      body: 'Parent teacher meeting is scheduled for Friday.',
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      priority: NoticePriority.URGENT,
    },
  ];
  const class5 = classes.find((item) => item.name === 'Class 5');
  const section5a = class5?.sections.find((item) => item.name === 'A');
  if (class5 && section5a) {
    notices.push({
      title: 'Class 5-A Homework Review',
      body: 'Class 5-A homework review will happen in the first period.',
      audienceType: AudienceType.SECTION,
      classId: class5.id,
      sectionId: section5a.id,
      priority: NoticePriority.NORMAL,
    });
  }

  for (const noticeData of notices) {
    const existing = await prisma.notice.findFirst({
      where: { tenantId, title: noticeData.title },
    });
    const notice = existing
      ? await prisma.notice.update({
          where: { id: existing.id },
          data: {
            body: noticeData.body,
            audienceType: noticeData.audienceType,
            classId: noticeData.classId,
            sectionId: noticeData.sectionId,
            priority: noticeData.priority,
            createdById,
            publishedAt: new Date(),
          },
        })
      : await prisma.notice.create({
          data: {
            tenantId,
            title: noticeData.title,
            body: noticeData.body,
            audienceType: noticeData.audienceType,
            classId: noticeData.classId,
            sectionId: noticeData.sectionId,
            priority: noticeData.priority,
            createdById,
            publishedAt: new Date(),
          },
        });

    await prisma.notificationDelivery.deleteMany({
      where: { tenantId, sourceType: 'notice', sourceId: notice.id },
    });
    const targets = students.filter((student) => {
      if (noticeData.audienceType === AudienceType.SECTION) {
        return student.className === 'Class 5' && student.sectionName === 'A';
      }
      return true;
    });
    await prisma.notificationDelivery.createMany({
      data: targets.map((student) => ({
        tenantId,
        channel: NotificationChannel.PUSH,
        status: NotificationStatus.SENT,
        sourceType: 'notice',
        sourceId: notice.id,
        audienceType: noticeData.audienceType,
        guardianId: student.guardianId,
        studentId: student.id,
        noticeId: notice.id,
        destination: `guardian:${student.admissionNumber}`,
        title: notice.title,
        body: notice.body,
        sentAt: new Date(),
      })),
    });
  }
}

async function seedCanonicalFinance(
  tenantId: string,
  academicYearId: string,
  students: CanonicalStudent[],
  collectedById: string | null,
) {
  const tuition = await prisma.feeHead.findFirst({
    where: { tenantId, code: 'TUITION' },
  });
  if (!tuition) return;
  const representatives = students.filter(
    (student) => student.rollNumber === 1,
  );
  for (const [index, student] of representatives.entries()) {
    const invoiceNumber = `INV-${student.admissionNumber}`;
    const amount = new Prisma.Decimal(
      3500 + (classGrade(student.className) ?? 1) * 200,
    );
    const status =
      index % 3 === 0
        ? InvoiceStatus.PAID
        : index % 3 === 1
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.ISSUED;
    const invoice = await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      update: {
        studentId: student.id,
        academicYearId,
        dueDate: addDays(dateOnly(new Date()), index % 3 === 2 ? -10 : 15),
        status,
        subtotal: amount,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: amount,
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
      create: {
        tenantId,
        studentId: student.id,
        academicYearId,
        invoiceNumber,
        dueDate: addDays(dateOnly(new Date()), index % 3 === 2 ? -10 : 15),
        status,
        subtotal: amount,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: amount,
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
    });
    await prisma.invoiceLine.deleteMany({
      where: { tenantId, invoiceId: invoice.id },
    });
    await prisma.invoiceLine.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        feeHeadId: tuition.id,
        description: `${student.className} monthly tuition`,
        quantity: 1,
        unitAmount: amount,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: amount,
      },
    });
    if (status !== InvoiceStatus.ISSUED) {
      const paidAmount = status === InvoiceStatus.PAID ? amount : amount.div(2);
      const referenceNumber = `PAY-${invoiceNumber}`;
      const existingPayment = await prisma.payment.findFirst({
        where: { tenantId, referenceNumber },
      });
      const payment = existingPayment
        ? await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              studentId: student.id,
              invoiceId: invoice.id,
              collectedById,
              method: PaymentMethod.CASH,
              amount: paidAmount,
              paidAt: new Date(),
            },
          })
        : await prisma.payment.create({
            data: {
              tenantId,
              studentId: student.id,
              invoiceId: invoice.id,
              collectedById,
              method: PaymentMethod.CASH,
              referenceNumber,
              amount: paidAmount,
              paidAt: new Date(),
              narration: 'Canonical development seed payment',
            },
          });
      await prisma.receipt.upsert({
        where: {
          tenantId_receiptNumber: {
            tenantId,
            receiptNumber: `RCPT-${invoiceNumber}`,
          },
        },
        update: { paymentId: payment.id, pdfUrl: null },
        create: {
          tenantId,
          paymentId: payment.id,
          receiptNumber: `RCPT-${invoiceNumber}`,
          pdfUrl: null,
        },
      });
    }
  }
}

async function seedCanonicalStaffSelfService(
  tenantId: string,
  accountantUserId: string | null,
  principalUserId: string | null,
) {
  if (!accountantUserId) return;
  const accountant = await prisma.staff.findFirst({
    where: { tenantId, userId: accountantUserId },
  });
  if (!accountant) return;

  for (const attendanceDate of lastSchoolDays(10)) {
    const day = attendanceDate.getUTCDate();
    const status =
      day % 7 === 0
        ? AttendanceStatus.LATE
        : day % 11 === 0
          ? AttendanceStatus.EXCUSED_LEAVE
          : AttendanceStatus.PRESENT;
    await prisma.staffAttendance.upsert({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId,
          staffId: accountant.id,
          attendanceDate,
        },
      },
      update: {
        status,
        leaveType: status === AttendanceStatus.EXCUSED_LEAVE ? 'CASUAL' : null,
        note: status === AttendanceStatus.LATE ? 'Traffic delay' : null,
        checkInAt:
          status === AttendanceStatus.EXCUSED_LEAVE
            ? null
            : withTime(
                attendanceDate,
                9,
                status === AttendanceStatus.LATE ? 25 : 0,
              ),
        checkOutAt:
          status === AttendanceStatus.EXCUSED_LEAVE
            ? null
            : withTime(attendanceDate, 16, 30),
        approvedById: principalUserId,
      },
      create: {
        tenantId,
        staffId: accountant.id,
        attendanceDate,
        status,
        leaveType: status === AttendanceStatus.EXCUSED_LEAVE ? 'CASUAL' : null,
        note: status === AttendanceStatus.LATE ? 'Traffic delay' : null,
        checkInAt:
          status === AttendanceStatus.EXCUSED_LEAVE
            ? null
            : withTime(
                attendanceDate,
                9,
                status === AttendanceStatus.LATE ? 25 : 0,
              ),
        checkOutAt:
          status === AttendanceStatus.EXCUSED_LEAVE
            ? null
            : withTime(attendanceDate, 16, 30),
        approvedById: principalUserId,
      },
    });
  }

  const year = new Date().getUTCFullYear();
  for (const [leaveType, allocated, used] of [
    ['CASUAL', 12, 2],
    ['SICK', 10, 1],
  ] as const) {
    await prisma.staffLeaveBalance.upsert({
      where: {
        tenantId_staffId_leaveType_year: {
          tenantId,
          staffId: accountant.id,
          leaveType,
          year,
        },
      },
      update: {
        allocated: new Prisma.Decimal(allocated),
        used: new Prisma.Decimal(used),
      },
      create: {
        tenantId,
        staffId: accountant.id,
        leaveType,
        year,
        allocated: new Prisma.Decimal(allocated),
        used: new Prisma.Decimal(used),
      },
    });
  }

  for (const [leaveType, startsOn, status, reason] of [
    [
      'CASUAL',
      addDays(dateOnly(new Date()), -14),
      LeaveRequestStatus.APPROVED,
      'Family ceremony',
    ],
    [
      'SICK',
      addDays(dateOnly(new Date()), 7),
      LeaveRequestStatus.PENDING,
      'Medical appointment',
    ],
  ] as const) {
    const existing = await prisma.staffLeaveRequest.findFirst({
      where: { tenantId, staffId: accountant.id, leaveType, startsOn },
    });
    const data = {
      endsOn: startsOn,
      days: new Prisma.Decimal(1),
      reason,
      isPaid: true,
      status,
      reviewedById:
        status === LeaveRequestStatus.APPROVED ? principalUserId : null,
      reviewedAt: status === LeaveRequestStatus.APPROVED ? new Date() : null,
      reviewNote:
        status === LeaveRequestStatus.APPROVED
          ? 'Approved for canonical demo.'
          : null,
    };
    if (existing) {
      await prisma.staffLeaveRequest.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.staffLeaveRequest.create({
        data: {
          tenantId,
          staffId: accountant.id,
          leaveType,
          startsOn,
          ...data,
        },
      });
    }
  }

  await seedCanonicalPayslip(tenantId, accountant, principalUserId);
}

async function seedCanonicalPayslip(
  tenantId: string,
  staff: {
    id: string;
    employeeId: string;
    bankAccount: string | null;
    bankName: string | null;
  },
  principalUserId: string | null,
) {
  const period = previousMonthPeriod();
  const structure = await upsertCanonicalSalaryStructure(tenantId, staff);
  const contract = await prisma.staffContract.upsert({
    where: {
      tenantId_contractNumber: {
        tenantId,
        contractNumber: `CON-${staff.employeeId}`,
      },
    },
    update: {
      position: 'Accountant',
      startDate: date('2026-04-01'),
      baseSalary: new Prisma.Decimal(45000),
      allowances: new Prisma.Decimal(5000),
      deductions: new Prisma.Decimal(1500),
      status: 'ACTIVE',
    },
    create: {
      tenantId,
      staffId: staff.id,
      contractNumber: `CON-${staff.employeeId}`,
      position: 'Accountant',
      startDate: date('2026-04-01'),
      baseSalary: new Prisma.Decimal(45000),
      allowances: new Prisma.Decimal(5000),
      deductions: new Prisma.Decimal(1500),
      status: 'ACTIVE',
    },
  });
  const run = await prisma.payrollRun.upsert({
    where: {
      tenantId_periodMonth_periodYear: {
        tenantId,
        periodMonth: period.month,
        periodYear: period.year,
      },
    },
    update: {
      status: PayrollRunStatus.PAID,
      grossAmount: new Prisma.Decimal(50000),
      deductionAmount: new Prisma.Decimal(4500),
      netAmount: new Prisma.Decimal(45500),
      approvedById: principalUserId,
      paidById: principalUserId,
      approvedAt: new Date(),
      paidAt: new Date(),
    },
    create: {
      tenantId,
      periodMonth: period.month,
      periodYear: period.year,
      periodStart: period.start,
      periodEnd: period.end,
      status: PayrollRunStatus.PAID,
      grossAmount: new Prisma.Decimal(50000),
      deductionAmount: new Prisma.Decimal(4500),
      netAmount: new Prisma.Decimal(45500),
      approvedById: principalUserId,
      paidById: principalUserId,
      approvedAt: new Date(),
      paidAt: new Date(),
    },
  });
  const line = await prisma.payrollLine.upsert({
    where: {
      tenantId_payrollRunId_staffId: {
        tenantId,
        payrollRunId: run.id,
        staffId: staff.id,
      },
    },
    update: {
      contractId: contract.id,
      salaryStructureId: structure.id,
      basicSalary: new Prisma.Decimal(45000),
      earnings: new Prisma.Decimal(5000),
      grossSalary: new Prisma.Decimal(50000),
      allowances: new Prisma.Decimal(5000),
      deductions: new Prisma.Decimal(4500),
      netSalary: new Prisma.Decimal(45500),
      paidDays: new Prisma.Decimal(26),
      attendanceDays: 25,
      workingDays: 26,
      paymentStatus: PayrollPaymentStatus.PAID,
      status: PayrollLineStatus.POSTED,
    },
    create: {
      tenantId,
      payrollRunId: run.id,
      staffId: staff.id,
      contractId: contract.id,
      salaryStructureId: structure.id,
      basicSalary: new Prisma.Decimal(45000),
      earnings: new Prisma.Decimal(5000),
      grossSalary: new Prisma.Decimal(50000),
      allowances: new Prisma.Decimal(5000),
      deductions: new Prisma.Decimal(4500),
      netSalary: new Prisma.Decimal(45500),
      paidDays: new Prisma.Decimal(26),
      attendanceDays: 25,
      workingDays: 26,
      paymentStatus: PayrollPaymentStatus.PAID,
      status: PayrollLineStatus.POSTED,
    },
  });
  await prisma.payslip.upsert({
    where: {
      tenantId_payslipNumber: {
        tenantId,
        payslipNumber: `PAYSLIP-${period.year}-${String(period.month).padStart(2, '0')}-${staff.employeeId}`,
      },
    },
    update: {
      payrollRunId: run.id,
      payrollLineId: line.id,
      staffId: staff.id,
      status: PayslipStatus.ISSUED,
      grossSalary: new Prisma.Decimal(50000),
      deductionAmount: new Prisma.Decimal(4500),
      netSalary: new Prisma.Decimal(45500),
      paymentStatus: PayrollPaymentStatus.PAID,
      issuedAt: new Date(),
    },
    create: {
      tenantId,
      payrollRunId: run.id,
      payrollLineId: line.id,
      staffId: staff.id,
      payslipNumber: `PAYSLIP-${period.year}-${String(period.month).padStart(2, '0')}-${staff.employeeId}`,
      status: PayslipStatus.ISSUED,
      grossSalary: new Prisma.Decimal(50000),
      deductionAmount: new Prisma.Decimal(4500),
      netSalary: new Prisma.Decimal(45500),
      paymentStatus: PayrollPaymentStatus.PAID,
      issuedAt: new Date(),
    },
  });
}

async function seedCanonicalTransport(
  tenantId: string,
  students: CanonicalStudent[],
  driverRoleId: string,
  createdById: string | null,
) {
  const driverUser = await ensureSeedUserWithRole({
    tenantId,
    email: 'driver@schoolos.com',
    password: canonicalDriverPassword,
    roleId: driverRoleId,
  });
  const driver = await upsertStaffProfile({
    tenantId,
    userId: driverUser.id,
    employeeId: 'EA-DRV-001',
    firstName: 'Bikash',
    lastName: 'Tamang',
    gender: Gender.MALE,
    designation: 'Driver',
    department: 'Transport',
  });
  const vehicle = await prisma.transportVehicle.upsert({
    where: {
      tenantId_registrationNumber: {
        tenantId,
        registrationNumber: 'BA-2-KHA-2045',
      },
    },
    update: { capacity: 36, status: 'ACTIVE', model: 'Tata Starbus' },
    create: {
      tenantId,
      registrationNumber: 'BA-2-KHA-2045',
      capacity: 36,
      status: 'ACTIVE',
      model: 'Tata Starbus',
    },
  });
  const route = await prisma.transportRoute.upsert({
    where: { tenantId_code: { tenantId, code: 'EA-R01' } },
    update: {
      name: 'Lalitpur Ring Road Route',
      vehicleId: vehicle.id,
      isActive: true,
    },
    create: {
      tenantId,
      name: 'Lalitpur Ring Road Route',
      code: 'EA-R01',
      vehicleId: vehicle.id,
      isActive: true,
    },
  });
  const stops: Array<{ id: string }> = [];
  for (const [index, name] of [
    'Kumaripati',
    'Jawalakhel',
    'Pulchowk',
    'Balkumari',
  ].entries()) {
    stops.push(
      await prisma.transportStop.upsert({
        where: {
          tenantId_routeId_sequence: {
            tenantId,
            routeId: route.id,
            sequence: index + 1,
          },
        },
        update: {
          name,
          estimatedPickup: `07:${30 + index * 5}`,
          estimatedDrop: `16:${10 + index * 5}`,
        },
        create: {
          tenantId,
          routeId: route.id,
          name,
          sequence: index + 1,
          estimatedPickup: `07:${30 + index * 5}`,
          estimatedDrop: `16:${10 + index * 5}`,
        },
      }),
    );
  }
  const existingDriverAssignment =
    await prisma.transportDriverAssignment.findFirst({
      where: {
        tenantId,
        staffId: driver.id,
        vehicleId: vehicle.id,
        routeId: route.id,
      },
    });
  const driverAssignment = existingDriverAssignment
    ? await prisma.transportDriverAssignment.update({
        where: { id: existingDriverAssignment.id },
        data: {
          startsAt: date('2026-04-01'),
          endsAt: null,
          licenseNumber: 'DL-EA-001',
          licenseExpires: date('2028-04-01'),
        },
      })
    : await prisma.transportDriverAssignment.create({
        data: {
          tenantId,
          staffId: driver.id,
          vehicleId: vehicle.id,
          routeId: route.id,
          startsAt: date('2026-04-01'),
          licenseNumber: 'DL-EA-001',
          licenseExpires: date('2028-04-01'),
        },
      });
  const transportStudents = students.filter(
    (student) => student.rollNumber <= 2,
  );
  for (const [index, student] of transportStudents.entries()) {
    const stop = stops[index % stops.length];
    const existing = await prisma.transportStudentAssignment.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        routeId: route.id,
        stopId: stop.id,
      },
    });
    if (existing) {
      await prisma.transportStudentAssignment.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          endedAt: null,
          pickupDirection: TransportTripDirection.PICKUP,
        },
      });
    } else {
      await prisma.transportStudentAssignment.create({
        data: {
          tenantId,
          studentId: student.id,
          routeId: route.id,
          stopId: stop.id,
          status: 'ACTIVE',
          pickupDirection: TransportTripDirection.PICKUP,
        },
      });
    }
  }
  const trip = await upsertActiveTransportTrip(
    tenantId,
    route.id,
    vehicle.id,
    driverAssignment.id,
    createdById,
  );
  const tripStudents = await prisma.transportStudentAssignment.findMany({
    where: { tenantId, routeId: route.id, status: 'ACTIVE' },
    take: 40,
  });
  for (const assignment of tripStudents) {
    await prisma.transportTripStudentStatus.upsert({
      where: {
        tripId_studentId: { tripId: trip.id, studentId: assignment.studentId },
      },
      update: {
        studentAssignmentId: assignment.id,
        stopId: assignment.stopId,
        status: TransportStudentTripStatus.PENDING,
      },
      create: {
        tenantId,
        tripId: trip.id,
        studentAssignmentId: assignment.id,
        studentId: assignment.studentId,
        stopId: assignment.stopId,
        status: TransportStudentTripStatus.PENDING,
      },
    });
  }
}

function classGrade(className: string) {
  const match = className.match(/^Class\s+(\d+)$/);
  return match ? Number(match[1]) : null;
}

function sectionKey(className: string, sectionName: string) {
  return `${className}-${sectionName}`;
}

function teacherFirstName(grade: number, sectionName: string) {
  const names = [
    'Sabina',
    'Ramesh',
    'Anita',
    'Bishal',
    'Mina',
    'Prakash',
    'Srijana',
    'Dipesh',
    'Kamala',
    'Niraj',
  ];
  return names[(grade + (sectionName === 'A' ? 0 : 4)) % names.length];
}

function teacherLastName(grade: number, sectionName: string) {
  return lastNames[
    (grade * 2 + (sectionName === 'A' ? 1 : 5)) % lastNames.length
  ];
}

function subjectTeacherFirstName(subjectKey: string, index: number) {
  const bySubject: Record<string, string[]> = {
    nepali: ['Madhav', 'Sushila', 'Keshav', 'Binita'],
    english: ['Roshan', 'Alina', 'Suraj', 'Pramila', 'Nirmal'],
    mathematics: ['Hari', 'Sangita', 'Bikram', 'Puja', 'Manoj'],
    science: ['Rajendra', 'Sarita', 'Dipak', 'Namrata'],
    social: ['Gopal', 'Menuka', 'Ashok', 'Sunita'],
    computer: ['Sudeep', 'Rojina', 'Bibek', 'Anju'],
    hpe: ['Kamal', 'Nisha', 'Sanjay', 'Laxmi'],
    optional: ['Rajan', 'Sabita', 'Umesh', 'Kalpana'],
  };
  return (
    bySubject[subjectKey]?.[(index - 1) % bySubject[subjectKey].length] ??
    'Demo'
  );
}

function subjectTeacherLastName(subjectKey: string, index: number) {
  return lastNames[(subjectKey.length + index * 3) % lastNames.length];
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function subjectPoolKey(subjectName: string) {
  const lower = subjectName.toLowerCase();
  if (lower.includes('nepali')) return 'nepali';
  if (lower.includes('english')) return 'english';
  if (lower.includes('math')) return 'mathematics';
  if (lower.includes('science')) return 'science';
  if (lower.includes('social') || lower.includes('moral')) return 'social';
  if (
    lower.includes('computer') ||
    lower.includes('ict') ||
    lower.includes('digital')
  )
    return 'computer';
  if (lower.includes('health') || lower.includes('physical')) return 'hpe';
  return 'optional';
}

function canonicalSubjectsForClass(cls: {
  name: string;
  subjects: Array<CanonicalSubject>;
}) {
  const grade = classGrade(cls.name);
  if (!grade) return [];
  return subjectDefinitionsForGrade(grade).map((definition) => {
    const subject = cls.subjects.find((item) => item.name === definition.name);
    if (!subject) {
      throw new Error(
        `Missing canonical subject ${definition.name} for ${cls.name}`,
      );
    }
    return subject;
  });
}

function pickSubjectTeacher(
  pools: Map<string, CanonicalTeacher[]>,
  subjectName: string,
  grade: number,
  sectionName: string,
) {
  const pool = pools.get(subjectPoolKey(subjectName));
  if (!pool?.length)
    throw new Error(`Missing subject teacher pool for ${subjectName}`);
  const sectionOffset = sectionName === 'A' ? 0 : 1;
  return pool[(grade + sectionOffset) % pool.length];
}

function pickAvailableSubjectTeacher(
  pools: Map<string, CanonicalTeacher[]>,
  subjectName: string,
  grade: number,
  sectionName: string,
  teacherBusy: Set<string>,
  dayOfWeek: number,
  periodOrder: number,
) {
  const pool = pools.get(subjectPoolKey(subjectName));
  if (!pool?.length)
    throw new Error(`Missing subject teacher pool for ${subjectName}`);
  const sectionOffset = sectionName === 'A' ? 0 : 1;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const teacher = pool[(grade + sectionOffset + offset) % pool.length];
    if (!teacherBusy.has(`${teacher.id}:${dayOfWeek}:${periodOrder}`)) {
      return teacher;
    }
  }
  throw new Error(
    `No available teacher for ${subjectName} day ${dayOfWeek} period ${periodOrder}`,
  );
}

async function upsertStaffProfile({
  tenantId,
  userId,
  employeeId,
  firstName,
  lastName,
  gender,
  designation,
  department,
}: {
  tenantId: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  designation: string;
  department: string;
}) {
  const base = {
    userId,
    firstName,
    lastName,
    dateOfBirth: date('1988-01-15'),
    gender,
    address: 'Lalitpur, Nepal',
    teacherRegistryId: designation.includes('Teacher')
      ? `TR-${employeeId}`
      : null,
    citizenshipNo: `CTZ-${employeeId}`,
    panNumber: `PAN-${employeeId}`,
    bankAccount: `000${employeeId.replace(/\D/g, '').padStart(8, '0')}`,
    bankName: 'Nepal Bank Limited',
    department,
    designation,
    employmentType: StaffEmploymentType.PERMANENT,
    status: StaffStatus.ACTIVE,
    contractStatus: 'ACTIVE',
    emergencyContactName: `${firstName} Contact`,
    emergencyContactPhone: '9800000000',
    emergencyContactRelation: 'Family',
    qualifications: designation.includes('Teacher')
      ? 'Bachelor in Education'
      : 'Relevant professional training',
    experience: '5 years',
    joiningDate: date('2026-04-01'),
    contractType: ContractType.PERMANENT,
    privacyConsentAt: new Date(),
  };

  return prisma.staff.upsert({
    where: { tenantId_employeeId: { tenantId, employeeId } },
    update: base,
    create: {
      tenantId,
      employeeId,
      staffCode: employeeId,
      ...base,
    },
  });
}

function canonicalStudentCode(
  grade: number,
  sectionName: string,
  roll: number,
) {
  return `${canonicalAdmissionPrefix}-${String(grade).padStart(2, '0')}-${sectionName}-${String(roll).padStart(3, '0')}`;
}

function guardianEmailCode(grade: number, sectionName: string, roll: number) {
  return `c${String(grade).padStart(2, '0')}${sectionName.toLowerCase()}${String(roll).padStart(3, '0')}`;
}

function guardianPhone(grade: number, sectionName: string, roll: number) {
  const sectionDigit = sectionName === 'A' ? 1 : 2;
  return `98${String(grade).padStart(2, '0')}${sectionDigit}${String(roll).padStart(5, '0')}`;
}

function guardianName(grade: number, roll: number) {
  const names = [
    'Maya',
    'Ram',
    'Sita',
    'Krishna',
    'Gita',
    'Narayan',
    'Laxmi',
    'Dinesh',
  ];
  return names[(grade + roll) % names.length];
}

function studentFirstName(grade: number, roll: number) {
  return firstNames[(grade * 3 + roll) % firstNames.length];
}

function studentLastName(grade: number, roll: number) {
  return lastNames[(grade * 5 + roll) % lastNames.length];
}

function studentDob(grade: number, roll: number) {
  const birthYear = 2026 - (grade + 5);
  const month = ((grade + roll) % 12) + 1;
  const day = ((roll * 3) % 26) + 1;
  return date(
    `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
}

function groupStudentsBySection(students: CanonicalStudent[]) {
  const grouped = new Map<string, CanonicalStudent[]>();
  for (const student of students) {
    const key = sectionKey(student.className, student.sectionName);
    grouped.set(key, [...(grouped.get(key) ?? []), student]);
  }
  return grouped;
}

function lastSchoolDays(count: number) {
  const days: Date[] = [];
  const cursor = dateOnly(new Date());
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.length < count) {
    if (cursor.getUTCDay() !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

function attendanceStatusFor(rollNumber: number, attendanceDate: Date) {
  const day = attendanceDate.getUTCDate();
  if ((rollNumber + day) % 31 === 0) return AttendanceStatus.EXCUSED_LEAVE;
  if ((rollNumber + day) % 29 === 0) return AttendanceStatus.ABSENT;
  if ((rollNumber + day) % 23 === 0) return AttendanceStatus.LATE;
  return AttendanceStatus.PRESENT;
}

function attendanceRemarkFor(rollNumber: number, attendanceDate: Date) {
  const status = attendanceStatusFor(rollNumber, attendanceDate);
  if (status === AttendanceStatus.LATE) return 'Arrived after assembly';
  if (status === AttendanceStatus.ABSENT) return 'Absent without prior note';
  if (status === AttendanceStatus.EXCUSED_LEAVE) return 'Approved family leave';
  return null;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function withTime(value: Date, hour: number, minute: number) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      hour,
      minute,
    ),
  );
}

function previousMonthPeriod() {
  const now = new Date();
  const monthDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const month = monthDate.getUTCMonth() + 1;
  const year = monthDate.getUTCFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { month, year, start, end };
}

async function upsertCanonicalSalaryStructure(
  tenantId: string,
  staff: { id: string; bankAccount: string | null; bankName: string | null },
) {
  const effectiveFrom = date('2026-04-01');
  const existing = await prisma.salaryStructure.findFirst({
    where: { tenantId, staffId: staff.id, effectiveFrom },
  });
  const data = {
    basicSalary: new Prisma.Decimal(45000),
    allowances: new Prisma.Decimal(5000),
    deductions: new Prisma.Decimal(1500),
    pfEnabled: true,
    tdsEnabled: true,
    paymentMethod: PaymentMethod.BANK,
    bankAccount: staff.bankAccount,
    bankName: staff.bankName,
    status: SalaryStructureStatus.ACTIVE,
    notes: 'Canonical development seed salary structure',
    activatedAt: new Date(),
    archivedAt: null,
  };
  const structure = existing
    ? await prisma.salaryStructure.update({ where: { id: existing.id }, data })
    : await prisma.salaryStructure.create({
        data: { tenantId, staffId: staff.id, effectiveFrom, ...data },
      });

  await prisma.salaryComponent.deleteMany({
    where: { tenantId, salaryStructureId: structure.id },
  });
  await prisma.salaryComponent.createMany({
    data: [
      {
        tenantId,
        salaryStructureId: structure.id,
        name: 'Basic Salary',
        componentType: SalaryComponentType.EARNING,
        amount: new Prisma.Decimal(45000),
        taxable: true,
      },
      {
        tenantId,
        salaryStructureId: structure.id,
        name: 'Dearness Allowance',
        componentType: SalaryComponentType.EARNING,
        amount: new Prisma.Decimal(5000),
        taxable: true,
      },
      {
        tenantId,
        salaryStructureId: structure.id,
        name: 'Provident Fund',
        componentType: SalaryComponentType.DEDUCTION,
        amount: new Prisma.Decimal(3000),
        taxable: false,
      },
      {
        tenantId,
        salaryStructureId: structure.id,
        name: 'Tax Deduction',
        componentType: SalaryComponentType.DEDUCTION,
        amount: new Prisma.Decimal(1500),
        taxable: false,
      },
    ],
  });
  return structure;
}

async function upsertActiveTransportTrip(
  tenantId: string,
  routeId: string,
  vehicleId: string,
  driverAssignmentId: string,
  createdById: string | null,
) {
  const existing = await prisma.transportTrip.findFirst({
    where: {
      tenantId,
      routeId,
      vehicleId,
      driverAssignmentId,
      direction: TransportTripDirection.PICKUP,
      status: TransportTripStatus.ACTIVE,
    },
  });
  if (existing) {
    return prisma.transportTrip.update({
      where: { id: existing.id },
      data: {
        startedAt: withTime(dateOnly(new Date()), 7, 15),
        completedAt: null,
        isDelayed: false,
        delayMinutes: null,
        delayReason: null,
        notes: 'Canonical development pickup trip',
        createdById,
      },
    });
  }
  return prisma.transportTrip.create({
    data: {
      tenantId,
      routeId,
      vehicleId,
      driverAssignmentId,
      direction: TransportTripDirection.PICKUP,
      status: TransportTripStatus.ACTIVE,
      startedAt: withTime(dateOnly(new Date()), 7, 15),
      notes: 'Canonical development pickup trip',
      createdById,
    },
  });
}

async function validateCanonicalSeed(tenantId: string, academicYearId: string) {
  const classRows = await prisma.class.findMany({
    where: {
      tenantId,
      name: { in: classDefinitions.map((item) => item.name) },
    },
    include: { sections: true, subjects: true },
  });
  const classIds = classRows.map((item) => item.id);
  const sectionIds = classRows.flatMap((item) =>
    item.sections.map((section) => section.id),
  );
  const canonicalHomeworkFilters = classRows.flatMap((cls) =>
    cls.sections.map((section) => ({
      classId: cls.id,
      sectionId: section.id,
      title: { startsWith: `${cls.name}-${section.name} ` },
    })),
  );
  const canonicalStudents = await prisma.student.findMany({
    where: {
      tenantId,
      studentSystemId: { startsWith: `${canonicalAdmissionPrefix}-` },
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      enrollments: {
        some: { tenantId, academicYearId, status: EnrollmentStatus.ACTIVE },
      },
    },
    select: { id: true },
  });
  const studentIds = canonicalStudents.map((student) => student.id);
  const canonicalSubjectIds = classRows.flatMap((cls) =>
    canonicalSubjectsForClass(cls).map((subject) => subject.id),
  );
  const [
    guardianLinks,
    subjectAssignments,
    attendanceRecords,
    homeworkRecords,
    noticeRecords,
    transportAssignments,
  ] = await Promise.all([
    prisma.studentGuardian.count({
      where: { tenantId, studentId: { in: studentIds }, appLoginLinked: true },
    }),
    prisma.subjectTeacherAssignment.count({
      where: {
        tenantId,
        academicYearId,
        classId: { in: classIds },
        sectionId: { in: sectionIds },
        subjectId: { in: canonicalSubjectIds },
      },
    }),
    prisma.attendanceRecord.count({
      where: { tenantId, studentId: { in: studentIds } },
    }),
    prisma.homeworkAssignment.count({
      where: {
        tenantId,
        academicYearId,
        OR: canonicalHomeworkFilters,
      },
    }),
    prisma.notice.count({
      where: {
        tenantId,
        title: {
          in: [
            'Welcome to Everest Academy 2083',
            'Parent Teacher Meeting',
            'Class 5-A Homework Review',
          ],
        },
      },
    }),
    prisma.transportStudentAssignment.count({
      where: {
        tenantId,
        studentId: { in: studentIds },
        status: TransportEnrollmentStatus.ACTIVE,
      },
    }),
  ]);

  const activeSectionCount = await prisma.section.count({
    where: { tenantId, classId: { in: classIds } },
  });
  const classTeacherSectionCount = await prisma.section.count({
    where: {
      tenantId,
      classId: { in: classIds },
      classTeacherId: { not: null },
    },
  });
  const expectedSubjectAssignments = classRows.reduce(
    (sum, cls) =>
      sum + cls.sections.length * canonicalSubjectsForClass(cls).length,
    0,
  );

  if (classRows.length !== 10)
    throw new Error(
      `Canonical seed expected 10 classes, found ${classRows.length}`,
    );
  if (activeSectionCount !== 20)
    throw new Error(
      `Canonical seed expected 20 sections, found ${activeSectionCount}`,
    );
  if (canonicalStudents.length !== expectedCanonicalStudentCount) {
    throw new Error(
      `Canonical seed expected ${expectedCanonicalStudentCount} students, found ${canonicalStudents.length}`,
    );
  }
  if (guardianLinks !== expectedCanonicalStudentCount) {
    throw new Error(
      `Canonical seed expected ${expectedCanonicalStudentCount} guardian links, found ${guardianLinks}`,
    );
  }
  if (classTeacherSectionCount !== 20) {
    throw new Error(
      `Canonical seed expected 20 class teacher assignments, found ${classTeacherSectionCount}`,
    );
  }
  if (subjectAssignments < expectedSubjectAssignments) {
    throw new Error(
      `Canonical seed expected at least ${expectedSubjectAssignments} subject assignments, found ${subjectAssignments}`,
    );
  }
  if (attendanceRecords < expectedCanonicalStudentCount * 10) {
    throw new Error(
      `Canonical seed expected at least ${expectedCanonicalStudentCount * 10} attendance records, found ${attendanceRecords}`,
    );
  }
  if (homeworkRecords < 40)
    throw new Error(
      `Canonical seed expected at least 40 homework records, found ${homeworkRecords}`,
    );
  if (noticeRecords < 3)
    throw new Error(
      `Canonical seed expected at least 3 notices, found ${noticeRecords}`,
    );
  if (transportAssignments < 40) {
    throw new Error(
      `Canonical seed expected at least 40 transport assignments, found ${transportAssignments}`,
    );
  }

  await validateNoTimetableConflicts(
    tenantId,
    academicYearId,
    classIds,
    sectionIds,
  );

  console.log('Canonical seed counts:');
  console.log(`- Classes: ${classRows.length}`);
  console.log(`- Sections: ${activeSectionCount}`);
  console.log(`- Students: ${canonicalStudents.length}`);
  console.log(`- Guardians: ${guardianLinks}`);
  console.log(`- Class teachers: ${classTeacherSectionCount}`);
  console.log(`- Subject assignments: ${subjectAssignments}`);
  console.log(`- Attendance records: ${attendanceRecords}`);
  console.log(`- Homework records: ${homeworkRecords}`);
  console.log(`- Notices: ${noticeRecords}`);
  console.log(`- Transport assignments: ${transportAssignments}`);
}

async function validateNoTimetableConflicts(
  tenantId: string,
  academicYearId: string,
  classIds: string[],
  sectionIds: string[],
) {
  const slots = await prisma.timetableSlot.findMany({
    where: {
      tenantId,
      academicYearId,
      classId: { in: classIds },
      sectionId: { in: sectionIds },
      version: {
        status: TimetableVersionStatus.PUBLISHED,
        versionName: { startsWith: 'Canonical Class ' },
      },
    },
    select: {
      id: true,
      staffId: true,
      roomId: true,
      sectionId: true,
      dayOfWeek: true,
      periodId: true,
      startsAt: true,
    },
  });
  const seen = new Map<string, string>();
  const assertUnique = (key: string, slotId: string, label: string) => {
    const existing = seen.get(key);
    if (existing && existing !== slotId) {
      throw new Error(`Canonical seed timetable ${label} conflict: ${key}`);
    }
    seen.set(key, slotId);
  };
  for (const slot of slots) {
    const periodKey = slot.periodId ?? slot.startsAt;
    assertUnique(
      `teacher:${slot.staffId}:${slot.dayOfWeek}:${periodKey}`,
      slot.id,
      'teacher',
    );
    if (slot.roomId) {
      assertUnique(
        `room:${slot.roomId}:${slot.dayOfWeek}:${periodKey}`,
        slot.id,
        'room',
      );
    }
    if (slot.sectionId) {
      assertUnique(
        `section:${slot.sectionId}:${slot.dayOfWeek}:${periodKey}`,
        slot.id,
        'section',
      );
    }
  }
}

function printRepresentativeCredentials() {
  console.log('- principal@schoolos.com / principal123');
  console.log('- admin@schoolos.com / admin123');
  console.log('- accountant@schoolos.com / accountant123');
  console.log(
    '- classteacher.1a@schoolos.com / teacher password from SCHOOLOS_DEMO_TEACHER_PASSWORD or local fallback teacher123',
  );
  console.log(
    '- classteacher.10b@schoolos.com / teacher password from SCHOOLOS_DEMO_TEACHER_PASSWORD or local fallback teacher123',
  );
  console.log(
    '- subjectteacher.math@schoolos.com / teacher password from SCHOOLOS_DEMO_TEACHER_PASSWORD or local fallback teacher123',
  );
  console.log(
    '- subjectteacher.english@schoolos.com / teacher password from SCHOOLOS_DEMO_TEACHER_PASSWORD or local fallback teacher123',
  );
  console.log(
    '- guardian.c01a001@schoolos.test / guardian password from SCHOOLOS_DEMO_GUARDIAN_PASSWORD or local fallback guardian123',
  );
  console.log(
    '- guardian.c10b032@schoolos.test / guardian password from SCHOOLOS_DEMO_GUARDIAN_PASSWORD or local fallback guardian123',
  );
  console.log(
    '- driver@schoolos.com / driver password from SCHOOLOS_DEMO_DRIVER_PASSWORD or local fallback driver123',
  );
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
      code: 'C01-MATH',
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
  const platformEmail =
    process.env.PLATFORM_SEED_EMAIL ?? 'platform@schoolos.com';
  const platformPassword = process.env.PLATFORM_SEED_PASSWORD ?? 'platform123';
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
    {
      key: 'standard',
      name: 'Standard Tier',
      priceNpr: 50000,
      billingCycle: 'ANNUAL',
    },
    {
      key: 'premium',
      name: 'Premium Tier',
      priceNpr: 150000,
      billingCycle: 'ANNUAL',
    },
    {
      key: 'enterprise',
      name: 'Enterprise Tier',
      priceNpr: 300000,
      billingCycle: 'ANNUAL',
    },
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
    const features = [
      'academics',
      'finance',
      'hr',
      'communications',
      'library',
      'transport',
      'canteen',
    ];
    for (const featureKey of features) {
      await prisma.platformPlanFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: {
          enabled: planData.key !== 'free' || featureKey === 'academics',
        },
        create: {
          planId: plan.id,
          featureKey,
          enabled: planData.key !== 'free' || featureKey === 'academics',
        },
      });
    }

    // Seed limits
    const limits = [
      {
        usageKey: 'students',
        limit:
          planData.key === 'free'
            ? 50
            : planData.key === 'standard'
              ? 500
              : planData.key === 'premium'
                ? 5000
                : 50000,
      },
      {
        usageKey: 'storage',
        limit:
          planData.key === 'free'
            ? 1
            : planData.key === 'standard'
              ? 10
              : planData.key === 'premium'
                ? 100
                : 1000,
      },
    ];
    for (const limitData of limits) {
      await prisma.usageLimit.upsert({
        where: {
          planId_usageKey_period: {
            planId: plan.id,
            usageKey: limitData.usageKey,
            period: UsagePeriod.MONTHLY,
          },
        },
        update: { limit: limitData.limit },
        create: {
          planId: plan.id,
          usageKey: limitData.usageKey,
          limit: limitData.limit,
          period: UsagePeriod.MONTHLY,
        },
      });
    }
  }

  // 3. Assign Subscriptions
  const defaultTenant = await prisma.tenant.findUnique({
    where: { slug: 'default-school' },
  });
  if (defaultTenant) {
    const standardPlan = createdPlans.find((p) => p.key === 'standard');
    if (standardPlan) {
      const subId = `sub-${defaultTenant.slug}`;
      await prisma.tenantSubscription.upsert({
        where: { id: subId },
        update: {
          planId: standardPlan.id,
          status: TenantSubscriptionStatus.ACTIVE,
        },
        create: {
          id: subId,
          tenantId: defaultTenant.id,
          planId: standardPlan.id,
          status: TenantSubscriptionStatus.ACTIVE,
        },
      });

      // Seed some usage counters
      await prisma.usageCounter.upsert({
        where: {
          tenantId_usageKey_period_periodStart: {
            tenantId: defaultTenant.id,
            usageKey: 'students',
            period: UsagePeriod.MONTHLY,
            periodStart: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ),
          },
        },
        update: { value: 120 },
        create: {
          tenantId: defaultTenant.id,
          usageKey: 'students',
          period: UsagePeriod.MONTHLY,
          periodStart: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          value: 120,
        },
      });
    }
  }

  // 4. Seed Provider Configs
  const providers = [
    {
      type: ProviderType.SMS,
      name: 'sparrow',
      environment: ProviderEnvironment.PRODUCTION,
      enabled: true,
    },
    {
      type: ProviderType.EMAIL,
      name: 'sendgrid',
      environment: ProviderEnvironment.PRODUCTION,
      enabled: true,
    },
    {
      type: ProviderType.OBJECT_STORAGE,
      name: 'r2',
      environment: ProviderEnvironment.PRODUCTION,
      enabled: true,
    },
  ];

  for (const p of providers) {
    await prisma.providerConfig.upsert({
      where: {
        type_name_environment: {
          type: p.type,
          name: p.name,
          environment: p.environment,
        },
      },
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
            },
          ],
        },
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
            },
          ],
        },
      },
    });

    // 6. Seed Audit Logs
    const auditActions = [
      {
        action: 'TENANT_STATUS_CHANGE',
        resource: 'tenant',
        resourceId: trialTenant.id,
        reason: 'Trial period review',
      },
      {
        action: 'SUBSCRIPTION_ASSIGN',
        resource: 'subscription',
        resourceId: defaultTenant.id,
        reason: 'Migration to Standard',
      },
      {
        action: 'PROVIDER_UPDATE',
        resource: 'provider',
        resourceId: 'sms-sparrow',
        reason: 'Update production tokens',
      },
      {
        action: 'FEATURE_OVERRIDE',
        resource: 'tenant',
        resourceId: defaultTenant.id,
        reason: 'Enabling Transport for pilot',
      },
      {
        action: 'QUEUE_RETRY',
        resource: 'queue',
        resourceId: 'communications',
        reason: 'Retrying failed SMS batch',
      },
      {
        action: 'SUPPORT_OVERRIDE_START',
        resource: 'tenant',
        resourceId: defaultTenant.id,
        reason: 'Debugging billing issue',
      },
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
