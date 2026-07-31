/**
 * Performance / load-test dataset generator.
 *
 * Provisions an ISOLATED tenant sized like one large school so load tests never
 * run against an empty database and never pollute development or production
 * data. See docs/performance/LOAD_TEST_PLAN.md.
 *
 * Target shape (override via env):
 *   1,500 students
 *   3,000 parent accounts (2 guardians per student, deduplicated for siblings)
 *      50 teachers
 *      15 admin / leadership users
 *   12 classes x 3 sections = 36 sections
 *   220 attendance days
 *
 * Idempotent by tenant slug: re-running refreshes structure and tops up bulk
 * data to target without duplicating.
 *
 * Usage:
 *   pnpm db:seed:performance
 *   PERF_STUDENTS=200 PERF_ATTENDANCE_DAYS=20 pnpm db:seed:performance   # quick
 *   PERF_RESET=1 pnpm db:seed:performance                                # purge bulk data first
 */
import {
  ActivityCategory,
  ActivityPostStatus,
  ActivityReactionType,
  AttendanceStatus,
  AudienceType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  CanteenEnrollmentStatus,
  CanteenMealPlanStatus,
  CanteenMealServingStatus,
  CanteenMenuItemStatus,
  CanteenWalletTransactionSource,
  CanteenWalletTransactionType,
  AuthMethod,
  ConsentType,
  ContractType,
  DevelopmentalMilestoneStatus,
  Gender,
  GuardianCapability,
  GuardianRelationshipApprovalStatus,
  GuardianRelationshipStatus,
  GuardianRelationshipVerificationStatus,
  Mode,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  PrismaClient,
  StaffStatus,
  StorageProvider,
  TeacherAssignmentType,
  TenantSubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { SCHOOL_CONFIG_OWNER_ROLE } from '@schoolos/core';
import {
  DEFAULT_ACCOUNTING_SOURCE_MAPPINGS,
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FEE_HEADS,
} from '../src/finance/finance.defaults';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/rbac/rbac.defaults';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SLUG = process.env.PERF_TENANT_SLUG ?? 'perf-school';
const NAME = process.env.PERF_TENANT_NAME ?? 'Performance Test School';

const STUDENTS = num('PERF_STUDENTS', 1500);
const TEACHERS = num('PERF_TEACHERS', 50);
const ADMINS = num('PERF_ADMINS', 15);
const CLASSES = num('PERF_CLASSES', 12);
const SECTIONS_PER_CLASS = num('PERF_SECTIONS_PER_CLASS', 3);
const ATTENDANCE_DAYS = num('PERF_ATTENDANCE_DAYS', 220);
const NOTICES = num('PERF_NOTICES', 60);
const HOMEWORK_PER_SECTION = num('PERF_HOMEWORK_PER_SECTION', 40);
const NOTIFICATIONS_PER_PARENT = num('PERF_NOTIFICATIONS_PER_PARENT', 12);
const ACTIVITY_POSTS = num('PERF_ACTIVITY_POSTS', 120);
const ACTIVITY_POSTS_PER_SECTION = num('PERF_ACTIVITY_POSTS_PER_SECTION', 3);
const MILESTONES_PER_STUDENT = num('PERF_MILESTONES_PER_STUDENT', 2);
const ACTIVITY_TAGGED_RATIO = ratio('PERF_ACTIVITY_TAGGED_RATIO', 0.15);
const CONSENT_DENIED_RATIO = ratio('PERF_CONSENT_DENIED_RATIO', 0.05);
const CANTEEN_MENU_ITEMS = num('PERF_CANTEEN_MENU_ITEMS', 25);
const CANTEEN_WALLET_RATIO = ratio('PERF_CANTEEN_WALLET_RATIO', 0.25);
const CANTEEN_ENROLLED_RATIO = ratio('PERF_CANTEEN_ENROLLED_RATIO', 0.1);
const FEE_INVOICE_RATIO = ratio('PERF_FEE_INVOICE_RATIO', 0.4);

const FIXTURE_PARENT_EMAILS = {
  empty: `parent-perf-empty@${SLUG}.test`,
  one: `parent-perf-one@${SLUG}.test`,
  multi: `parent-perf-multi@${SLUG}.test`,
} as const;

/**
 * Shared load-test password. This dataset is deliberately synthetic and lives
 * in an isolated tenant; the credential is a fixture, not a secret. It must
 * never be seeded into a real tenant.
 */
const PASSWORD = process.env.PERF_PASSWORD ?? 'LoadTest123!';

/**
 * bcrypt cost for seeded fixtures only. Login latency is measured against the
 * REAL configured cost at runtime — this only controls how long seeding takes,
 * because hashing 3,065 accounts at cost 12 would dominate seed time.
 * The application's own hashing strength is untouched.
 */
const SEED_BCRYPT_ROUNDS = num('PERF_BCRYPT_ROUNDS', 10);

const RESET = process.env.PERF_RESET === '1';
const BATCH = 1000;

function num(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer, got "${raw}"`);
  }
  return parsed;
}

function ratio(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${key} must be a number between 0 and 1, got "${raw}"`);
  }
  return parsed;
}

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Deterministic pseudo-random data
// ---------------------------------------------------------------------------

/** Mulberry32 — deterministic so re-runs and comparisons are reproducible. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260731);
const pick = <T>(items: readonly T[]) => items[Math.floor(rng() * items.length)];

const FIRST_NAMES = [
  'Aarav', 'Anisha', 'Bibek', 'Bina', 'Chetan', 'Deepa', 'Dipesh', 'Gita',
  'Hari', 'Ishwor', 'Kabita', 'Kiran', 'Laxmi', 'Manish', 'Nabin', 'Nisha',
  'Prakash', 'Pratima', 'Rajesh', 'Rekha', 'Sabin', 'Samir', 'Sarita', 'Suman',
  'Sunita', 'Trishna', 'Umesh', 'Yubraj',
];
const LAST_NAMES = [
  'Adhikari', 'Bhattarai', 'Chaudhary', 'Dahal', 'Gurung', 'Joshi', 'Karki',
  'Khadka', 'Lama', 'Magar', 'Maharjan', 'Nepali', 'Pandey', 'Poudel', 'Rai',
  'Sharma', 'Shrestha', 'Subedi', 'Tamang', 'Thapa',
];

const SUBJECT_DEFS = [
  { name: 'English', code: 'ENG' },
  { name: 'Nepali', code: 'NEP' },
  { name: 'Mathematics', code: 'MATH' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SOC' },
  { name: 'Computer', code: 'COMP' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(value: number, width: number) {
  return String(value).padStart(width, '0');
}

/**
 * 220 school days ending today, skipping weekends (Nepal school week: the
 * closed day is Saturday). Distribution matters: attendance-summary queries
 * scan by date range, so the dates must be spread across a real year.
 */
function schoolDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    if (cursor.getUTCDay() !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

/** Realistic attendance mix: ~94% present, 4% absent, 2% late. */
function attendanceStatus(): AttendanceStatus {
  const roll = rng();
  if (roll < 0.94) return AttendanceStatus.PRESENT;
  if (roll < 0.98) return AttendanceStatus.ABSENT;
  return AttendanceStatus.LATE;
}

async function insertInBatches<T>(
  label: string,
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    await insert(rows.slice(i, i + BATCH));
    process.stdout.write(
      `\r  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}   `,
    );
  }
  process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// Tenant scaffolding (mirrors seed-pilot-rehearsal-tenant.ts)
// ---------------------------------------------------------------------------

async function provisionTenantDefaults(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  for (const permission of PERMISSION_CATALOG) {
    await tx.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await tx.role.upsert({
      where: { tenantId_name: { tenantId, name: role.name } },
      update: { description: role.description, isSystem: true },
      create: {
        tenantId,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }

  for (const [roleName, permissionKeys] of Object.entries(
    SYSTEM_ROLE_PERMISSIONS,
  )) {
    const role = await tx.role.findUnique({
      where: { tenantId_name: { tenantId, name: roleName } },
    });
    if (!role) continue;

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permissionKey of permissionKeys) {
      const parts = permissionKey.split(':');
      const action = parts.pop();
      const resource = parts.join(':');
      if (!resource || !action) continue;

      const permission = await tx.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (!permission) continue;
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const yearStart = new Date(`${new Date().getUTCFullYear()}-04-01T00:00:00.000Z`);
  const yearEnd = new Date(
    `${new Date().getUTCFullYear() + 1}-03-31T23:59:59.999Z`,
  );
  const yearName = `${yearStart.getUTCFullYear()}-${yearEnd.getUTCFullYear()}`;

  await tx.academicYear.upsert({
    where: { tenantId_name: { tenantId, name: yearName } },
    update: { startsOn: yearStart, endsOn: yearEnd, isCurrent: true },
    create: {
      tenantId,
      name: yearName,
      startsOn: yearStart,
      endsOn: yearEnd,
      isCurrent: true,
    },
  });

  for (const account of DEFAULT_CHART_ACCOUNTS) {
    await tx.chartAccount.upsert({
      where: { tenantId_code: { tenantId, code: account.code } },
      update: { name: account.name, type: account.type, isSystem: true },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
        isSystem: true,
      },
    });
  }

  for (const feeHead of DEFAULT_FEE_HEADS) {
    await tx.feeHead.upsert({
      where: { tenantId_code: { tenantId, code: feeHead.code } },
      update: {
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
        vatApplicable: feeHead.vatApplicable,
      },
      create: {
        tenantId,
        code: feeHead.code,
        name: feeHead.name,
        frequency: feeHead.frequency,
        defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
        vatApplicable: feeHead.vatApplicable,
      },
    });
  }

  for (const mapping of DEFAULT_ACCOUNTING_SOURCE_MAPPINGS) {
    const debitAccount = await tx.chartAccount.findUnique({
      where: { tenantId_code: { tenantId, code: mapping.debitCode } },
    });
    const creditAccount = await tx.chartAccount.findUnique({
      where: { tenantId_code: { tenantId, code: mapping.creditCode } },
    });
    if (!debitAccount || !creditAccount) continue;

    const existing = await tx.accountingSourceMapping.findFirst({
      where: {
        tenantId,
        sourceModule: mapping.sourceModule,
        sourceType: mapping.sourceType,
        postingType: mapping.postingType,
        isActive: true,
      },
    });
    if (existing) continue;

    await tx.accountingSourceMapping.create({
      data: {
        tenantId,
        sourceModule: mapping.sourceModule,
        sourceType: mapping.sourceType,
        postingType: mapping.postingType,
        debitAccountId: debitAccount.id,
        creditAccountId: creditAccount.id,
        description: mapping.description,
      },
    });
  }
}

async function ensureTenant() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await provisionTenantDefaults(existing.id, tx);
    });
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: NAME,
        slug: SLUG,
        mode: Mode.MULTI,
        plan: 'standard',
        isActive: true,
      },
    });
    await provisionTenantDefaults(created.id, tx);
    return created;
  });
}

async function assignSubscription(tenantId: string) {
  // Wave 1 / one-school concurrency program: STANDARD without library,
  // transport, or canteen add-ons. PROFESSIONAL includes M8–M10 by default and
  // would inflate the parent dashboard SQL baseline with deferred modules.
  const plan = await prisma.platformPlan.findUnique({ where: { key: 'standard' } });

  if (!plan) {
    throw new Error(
      'No "standard" platform plan found. Run `pnpm db:seed:platform` before seeding the performance tenant.',
    );
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'standard' },
  });

  await prisma.tenantSubscription.upsert({
    where: { id: `sub-${SLUG}` },
    update: { planId: plan.id, status: TenantSubscriptionStatus.ACTIVE, addOns: [] },
    create: {
      id: `sub-${SLUG}`,
      tenantId,
      planId: plan.id,
      status: TenantSubscriptionStatus.ACTIVE,
      addOns: [],
    },
  });

  // Platform seed historically enabled library/transport/canteen on STANDARD.
  // Align plan features with ENTITLEMENT_MATRIX and fail closed for Wave 1.
  for (const featureKey of ['library', 'transport', 'canteen'] as const) {
    await prisma.platformPlanFeature.upsert({
      where: { planId_featureKey: { planId: plan.id, featureKey } },
      update: { enabled: false },
      create: { planId: plan.id, featureKey, enabled: false },
    });
    await prisma.tenantFeatureOverride.upsert({
      where: {
        tenantId_featureKey: {
          tenantId,
          featureKey: `module.${featureKey}`,
        },
      },
      update: {
        enabled: false,
        reason: 'Wave 1 deferred — excluded from one-school concurrency program',
      },
      create: {
        tenantId,
        featureKey: `module.${featureKey}`,
        enabled: false,
        reason: 'Wave 1 deferred — excluded from one-school concurrency program',
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Bulk data
// ---------------------------------------------------------------------------

async function purgeBulkData(tenantId: string) {
  console.log('Purging existing bulk data for this tenant...');
  // Ordered by FK dependency. Only the perf tenant is touched.
  await prisma.notificationDelivery.deleteMany({ where: { tenantId } });
  await prisma.onlinePaymentIntent.deleteMany({ where: { tenantId } });
  await prisma.receiptReprintHistory.deleteMany({ where: { tenantId } });
  await prisma.receipt.deleteMany({ where: { tenantId } });
  await prisma.financeApprovalRequestHistory.deleteMany({ where: { tenantId } });
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } });
  await prisma.paymentRefund.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoiceLine.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.canteenPosSaleItem.deleteMany({ where: { tenantId } });
  await prisma.canteenPosSale.deleteMany({ where: { tenantId } });
  await prisma.canteenWalletTransaction.deleteMany({ where: { tenantId } });
  await prisma.canteenMealServing.deleteMany({ where: { tenantId } });
  await prisma.canteenStudentEnrollment.deleteMany({ where: { tenantId } });
  await prisma.canteenWallet.deleteMany({ where: { tenantId } });
  await prisma.canteenMenuItem.deleteMany({ where: { tenantId } });
  await prisma.canteenMealPlan.deleteMany({ where: { tenantId } });
  await prisma.activityReaction.deleteMany({ where: { tenantId } });
  await prisma.activityAttachment.deleteMany({ where: { tenantId } });
  await prisma.activityPostStudent.deleteMany({ where: { tenantId } });
  await prisma.activityPost.deleteMany({ where: { tenantId } });
  await prisma.developmentalMilestone.deleteMany({ where: { tenantId } });
  await prisma.guardianConsent.deleteMany({ where: { tenantId } });
  await prisma.attendanceRecord.deleteMany({ where: { tenantId } });
  await prisma.attendanceSession.deleteMany({ where: { tenantId } });
  await prisma.homeworkAssignment.deleteMany({ where: { tenantId } });
  await prisma.notice.deleteMany({ where: { tenantId } });
  await prisma.enrollment.deleteMany({ where: { tenantId } });
  await prisma.studentGuardian.deleteMany({ where: { tenantId } });
  await prisma.student.deleteMany({ where: { tenantId } });
  await prisma.teacherAssignment.deleteMany({ where: { tenantId } });
}

async function seedStructure(tenantId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId, isCurrent: true },
  });
  if (!academicYear) throw new Error('No current academic year provisioned');

  const classes: { id: string; level: number }[] = [];
  const sections: { id: string; classId: string; level: number; name: string }[] = [];
  const subjects: { id: string; classId: string }[] = [];

  for (let level = 1; level <= CLASSES; level += 1) {
    const cls = await prisma.class.upsert({
      where: { tenantId_name: { tenantId, name: `Class ${level}` } },
      update: { level },
      create: { tenantId, name: `Class ${level}`, level },
    });
    classes.push({ id: cls.id, level });

    for (const def of SUBJECT_DEFS) {
      const subject = await prisma.subject.upsert({
        where: {
          tenantId_classId_code: { tenantId, classId: cls.id, code: def.code },
        },
        update: { name: def.name },
        create: {
          tenantId,
          classId: cls.id,
          name: def.name,
          code: def.code,
          type: 'CORE',
        },
      });
      subjects.push({ id: subject.id, classId: cls.id });
    }

    for (let s = 0; s < SECTIONS_PER_CLASS; s += 1) {
      const sectionName = String.fromCharCode(65 + s);
      const section = await prisma.section.upsert({
        where: {
          tenantId_classId_name: { tenantId, classId: cls.id, name: sectionName },
        },
        update: {},
        create: { tenantId, classId: cls.id, name: sectionName, capacity: 50 },
      });
      sections.push({
        id: section.id,
        classId: cls.id,
        level,
        name: sectionName,
      });
    }
  }

  console.log(
    `  structure: ${classes.length} classes, ${sections.length} sections, ${subjects.length} subjects`,
  );
  return { academicYear, classes, sections, subjects };
}

async function seedStaff(
  tenantId: string,
  academicYearId: string,
  sections: { id: string; classId: string }[],
  subjects: { id: string; classId: string }[],
  passwordHash: string,
) {
  const teacherRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'teacher' } },
  });
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'admin' } },
  });
  const configOwnerRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: SCHOOL_CONFIG_OWNER_ROLE } },
  });
  if (!teacherRole || !adminRole || !configOwnerRole) {
    throw new Error('System roles were not provisioned');
  }

  const teachers: { staffId: string; userId: string; email: string }[] = [];

  for (let i = 0; i < TEACHERS; i += 1) {
    const email = `teacher${pad(i + 1, 3)}@${SLUG}.test`;
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { passwordHash, status: UserStatus.ACTIVE, mustChangePassword: false },
      create: {
        tenantId,
        email,
        passwordHash,
        authMethod: AuthMethod.PASSWORD,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    const staff = await prisma.staff.upsert({
      where: { tenantId_employeeId: { tenantId, employeeId: `T${pad(i + 1, 4)}` } },
      update: { userId: user.id, status: StaffStatus.ACTIVE },
      create: {
        tenantId,
        userId: user.id,
        employeeId: `T${pad(i + 1, 4)}`,
        firstName: pick(FIRST_NAMES),
        lastName: pick(LAST_NAMES),
        dateOfBirth: new Date('1988-06-15T00:00:00.000Z'),
        gender: i % 2 === 0 ? Gender.FEMALE : Gender.MALE,
        address: 'Kathmandu, Bagmati',
        designation: 'Teacher',
        department: 'Academics',
        status: StaffStatus.ACTIVE,
        joiningDate: new Date('2022-04-01T00:00:00.000Z'),
        contractType: ContractType.PERMANENT,
      },
    });

    const existingRole = await prisma.userRole.findFirst({
      where: { tenantId, userId: user.id, roleId: teacherRole.id, scopeId: null },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { tenantId, userId: user.id, roleId: teacherRole.id, scopeId: null },
      });
    }

    teachers.push({ staffId: staff.id, userId: user.id, email });
  }

  for (let i = 0; i < ADMINS; i += 1) {
    const email = `admin${pad(i + 1, 3)}@${SLUG}.test`;
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { passwordHash, status: UserStatus.ACTIVE, mustChangePassword: false },
      create: {
        tenantId,
        email,
        passwordHash,
        authMethod: AuthMethod.PASSWORD,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    const roleIds = i === 0 ? [adminRole.id, configOwnerRole.id] : [adminRole.id];
    for (const roleId of roleIds) {
      const existing = await prisma.userRole.findFirst({
        where: { tenantId, userId: user.id, roleId, scopeId: null },
      });
      if (!existing) {
        await prisma.userRole.create({
          data: { tenantId, userId: user.id, roleId, scopeId: null },
        });
      }
    }
  }

  // Class teacher per section, round-robin across teachers.
  for (const [index, section] of sections.entries()) {
    const teacher = teachers[index % teachers.length];
    await prisma.section.update({
      where: { id: section.id },
      data: { classTeacherId: teacher.staffId },
    });
  }

  // Assignment-derived authorization records: homeroom + subject assignments.
  const assignments: Prisma.TeacherAssignmentCreateManyInput[] = [];
  const effectiveFrom = new Date('2026-04-01T00:00:00.000Z');

  for (const [index, section] of sections.entries()) {
    const homeroomTeacher = teachers[index % teachers.length];
    assignments.push({
      tenantId,
      academicYearId,
      staffId: homeroomTeacher.staffId,
      assignmentType: TeacherAssignmentType.CLASS_TEACHER,
      classId: section.classId,
      sectionId: section.id,
      isPrimary: true,
      effectiveFrom,
    });

    const sectionSubjects = subjects.filter((s) => s.classId === section.classId);
    for (const [subjectIndex, subject] of sectionSubjects.entries()) {
      const subjectTeacher = teachers[(index + subjectIndex + 1) % teachers.length];
      assignments.push({
        tenantId,
        academicYearId,
        staffId: subjectTeacher.staffId,
        assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
        classId: section.classId,
        sectionId: section.id,
        subjectId: subject.id,
        isPrimary: true,
        effectiveFrom,
      });
    }
  }

  await insertInBatches('teacher assignments', assignments, (chunk) =>
    prisma.teacherAssignment.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log(`  staff: ${TEACHERS} teachers, ${ADMINS} admins`);
  return { teachers };
}

async function seedStudentsAndParents(
  tenantId: string,
  academicYearId: string,
  sections: { id: string; classId: string; level: number }[],
  passwordHash: string,
) {
  const existing = await prisma.student.count({ where: { tenantId } });
  if (existing >= STUDENTS) {
    console.log(`  students: ${existing} already present, skipping`);
    const students = await prisma.student.findMany({
      where: { tenantId },
      select: { id: true, classId: true, sectionId: true },
    });
    const guardians = await prisma.guardian.findMany({
      where: { tenantId, userId: { not: null } },
      select: { id: true, userId: true },
    });
    return { students, guardianUserIds: guardians.map((g) => g.userId!) };
  }

  const admissionDate = new Date('2026-04-01T00:00:00.000Z');

  // --- students -----------------------------------------------------------
  const studentRows: Prisma.StudentCreateManyInput[] = [];
  for (let i = existing; i < STUDENTS; i += 1) {
    const section = sections[i % sections.length];
    studentRows.push({
      tenantId,
      studentSystemId: `S${pad(i + 1, 5)}`,
      admissionNumber: `ADM-${pad(i + 1, 5)}`,
      firstNameEn: pick(FIRST_NAMES),
      lastNameEn: pick(LAST_NAMES),
      dateOfBirth: new Date(
        Date.UTC(2026 - 5 - section.level, Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)),
      ),
      gender: rng() < 0.5 ? Gender.FEMALE : Gender.MALE,
      admissionDate,
      classId: section.classId,
      sectionId: section.id,
      rollNumber: Math.floor(i / sections.length) + 1,
    });
  }
  await insertInBatches('students', studentRows, (chunk) =>
    prisma.student.createMany({ data: chunk, skipDuplicates: true }),
  );

  const students = await prisma.student.findMany({
    where: { tenantId },
    select: { id: true, classId: true, sectionId: true },
    orderBy: { studentSystemId: 'asc' },
  });

  // --- enrollments --------------------------------------------------------
  await insertInBatches(
    'enrollments',
    students.map<Prisma.EnrollmentCreateManyInput>((student, i) => ({
      tenantId,
      studentId: student.id,
      academicYearId,
      classId: student.classId,
      sectionId: student.sectionId,
      admissionNumber: `ADM-${pad(i + 1, 5)}`,
      admissionDate,
      mediumOfInstruction: 'English',
      effectiveFrom: admissionDate,
      effectiveUntil: null,
    })),
    (chunk) => prisma.enrollment.createMany({ data: chunk, skipDuplicates: true }),
  );

  // --- parent user accounts ----------------------------------------------
  // Two guardians per student => 2 x STUDENTS accounts, matching the 3,000
  // parent target at 1,500 students.
  const parentCount = STUDENTS * 2;
  const parentUserRows: Prisma.UserCreateManyInput[] = [];
  for (let i = 0; i < parentCount; i += 1) {
    parentUserRows.push({
      tenantId,
      email: `parent${pad(i + 1, 5)}@${SLUG}.test`,
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    });
  }
  await insertInBatches('parent users', parentUserRows, (chunk) =>
    prisma.user.createMany({ data: chunk, skipDuplicates: true }),
  );

  const parentUsers = await prisma.user.findMany({
    where: { tenantId, email: { startsWith: 'parent' } },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
  });

  const parentRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'parent' } },
  });
  if (!parentRole) throw new Error('parent role not provisioned');

  await insertInBatches(
    'parent roles',
    parentUsers.map<Prisma.UserRoleCreateManyInput>((user) => ({
      tenantId,
      userId: user.id,
      roleId: parentRole.id,
      scopeId: null,
    })),
    (chunk) => prisma.userRole.createMany({ data: chunk, skipDuplicates: true }),
  );

  // --- guardians ----------------------------------------------------------
  await insertInBatches(
    'guardians',
    parentUsers.map<Prisma.GuardianCreateManyInput>((user, i) => ({
      tenantId,
      userId: user.id,
      fullName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      relation: i % 2 === 0 ? 'Father' : 'Mother',
      primaryPhone: `98${pad((10000000 + i) % 100000000, 8)}`,
      email: user.email ?? undefined,
      receivesAlerts: true,
    })),
    (chunk) => prisma.guardian.createMany({ data: chunk, skipDuplicates: true }),
  );

  const guardians = await prisma.guardian.findMany({
    where: { tenantId },
    select: { id: true, userId: true, email: true },
    orderBy: { email: 'asc' },
  });

  // --- student <-> guardian links ----------------------------------------
  // Guardian 2i and 2i+1 belong to student i. Full capability set so parent
  // read paths are actually exercised rather than short-circuited by scope.
  const capabilities: GuardianCapability[] = [
    GuardianCapability.ATTENDANCE_VIEW,
    GuardianCapability.ACADEMICS_VIEW,
    GuardianCapability.FEES_VIEW,
    GuardianCapability.EMERGENCY_ALERT_RECEIVE,
  ];

  const links: Prisma.StudentGuardianCreateManyInput[] = [];
  for (const [i, student] of students.entries()) {
    for (const slot of [0, 1]) {
      const guardian = guardians[i * 2 + slot];
      if (!guardian) continue;
      links.push({
        tenantId,
        studentId: student.id,
        guardianId: guardian.id,
        relation: slot === 0 ? 'Father' : 'Mother',
        isPrimary: slot === 0,
        appLoginLinked: true,
        capabilities,
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        status: GuardianRelationshipStatus.ACTIVE,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        emergencyContactPriority: slot + 1,
      });
    }
  }
  await insertInBatches('guardian links', links, (chunk) =>
    prisma.studentGuardian.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log(`  students: ${students.length}, parents: ${guardians.length}`);
  return {
    students,
    guardianUserIds: guardians
      .map((g) => g.userId)
      .filter((id): id is string => Boolean(id)),
  };
}

async function seedAttendance(
  tenantId: string,
  academicYearId: string,
  sections: { id: string; classId: string }[],
  students: { id: string; sectionId: string | null }[],
) {
  if (ATTENDANCE_DAYS === 0) return;

  const alreadySeeded = await prisma.attendanceSession.count({ where: { tenantId } });
  if (alreadySeeded >= sections.length * ATTENDANCE_DAYS) {
    console.log(`  attendance: ${alreadySeeded} sessions already present, skipping`);
    return;
  }

  const days = schoolDays(ATTENDANCE_DAYS);
  const bySection = new Map<string, string[]>();
  for (const student of students) {
    if (!student.sectionId) continue;
    const list = bySection.get(student.sectionId) ?? [];
    list.push(student.id);
    bySection.set(student.sectionId, list);
  }

  console.log(
    `  attendance: ${days.length} days x ${sections.length} sections ` +
      `(~${(days.length * students.length).toLocaleString()} records)`,
  );

  // Day-at-a-time keeps peak memory bounded; ~1,500 records per day.
  for (const [dayIndex, day] of days.entries()) {
    const sessionRows: Prisma.AttendanceSessionCreateManyInput[] = sections.map(
      (section) => ({
        tenantId,
        academicYearId,
        classId: section.classId,
        sectionId: section.id,
        attendanceDate: day,
        submittedAt: day,
        lockAt: new Date(day.getTime() + 36 * 60 * 60 * 1000),
      }),
    );
    await prisma.attendanceSession.createMany({
      data: sessionRows,
      skipDuplicates: true,
    });

    const sessions = await prisma.attendanceSession.findMany({
      where: { tenantId, attendanceDate: day },
      select: { id: true, sectionId: true },
    });

    const recordRows: Prisma.AttendanceRecordCreateManyInput[] = [];
    for (const session of sessions) {
      for (const studentId of bySection.get(session.sectionId ?? '') ?? []) {
        recordRows.push({
          tenantId,
          attendanceSessionId: session.id,
          studentId,
          status: attendanceStatus(),
        });
      }
    }

    for (let i = 0; i < recordRows.length; i += BATCH) {
      await prisma.attendanceRecord.createMany({
        data: recordRows.slice(i, i + BATCH),
        skipDuplicates: true,
      });
    }

    if (dayIndex % 10 === 0 || dayIndex === days.length - 1) {
      process.stdout.write(`\r    day ${dayIndex + 1}/${days.length}   `);
    }
  }
  process.stdout.write('\n');
}

async function seedNotifications(tenantId: string, guardianUserIds: string[]) {
  if (NOTIFICATIONS_PER_PARENT === 0) return;

  const already = await prisma.notificationDelivery.count({ where: { tenantId } });
  if (already >= guardianUserIds.length * NOTIFICATIONS_PER_PARENT) {
    console.log(`  notifications: ${already} already present, skipping`);
    return;
  }

  const rows: Prisma.NotificationDeliveryCreateManyInput[] = [];
  const now = Date.now();
  for (const [i, userId] of guardianUserIds.entries()) {
    for (let n = 0; n < NOTIFICATIONS_PER_PARENT; n += 1) {
      rows.push({
        tenantId,
        idempotencyKey: `perf-notif-${i}-${n}`,
        channel: NotificationChannel.PUSH,
        status: NotificationStatus.SENT,
        sourceType: 'notice',
        sourceId: `perf-notice-${n % NOTICES}`,
        recipientUserId: userId,
        title: `School update ${n + 1}`,
        body: 'Please review the latest update from the school.',
        sentAt: new Date(now - n * 86400000),
        createdAt: new Date(now - n * 86400000),
      });
    }
  }

  await insertInBatches('notifications', rows, (chunk) =>
    prisma.notificationDelivery.createMany({ data: chunk, skipDuplicates: true }),
  );
}

type PerfStudent = {
  id: string;
  classId: string;
  sectionId: string | null;
};

async function seedGuardianConsents(
  tenantId: string,
  guardians: { id: string }[],
) {
  const version = 'perf-2026.1';
  const rows: Prisma.GuardianConsentCreateManyInput[] = [];

  for (const [index, guardian] of guardians.entries()) {
    const photoGranted = rng() >= CONSENT_DENIED_RATIO;
    for (const consentType of [
      ConsentType.PRIVACY,
      ConsentType.DATA_PROCESSING,
      ConsentType.MESSAGING,
      ConsentType.MEDICAL,
      ConsentType.PHOTO_USAGE,
    ]) {
      const granted =
        consentType === ConsentType.PHOTO_USAGE
          ? photoGranted
          : consentType !== ConsentType.MEDICAL || index % 7 !== 0;
      rows.push({
        tenantId,
        guardianId: guardian.id,
        consentType,
        granted,
        version,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
        revokedAt: granted ? null : new Date('2026-05-01T00:00:00.000Z'),
        metadata: { source: 'perf-seed' },
      });
    }
  }

  await insertInBatches('guardian consents', rows, (chunk) =>
    prisma.guardianConsent.createMany({ data: chunk, skipDuplicates: true }),
  );
}

async function seedActivityAndMilestones(
  tenantId: string,
  sections: { id: string; classId: string; level: number; name: string }[],
  students: PerfStudent[],
  teachers: { staffId: string; userId: string }[],
  excludeSectionId: string,
  excludeClassId: string,
) {
  if (ACTIVITY_POSTS === 0 && MILESTONES_PER_STUDENT === 0) return;

  const already = await prisma.activityPost.count({ where: { tenantId } });
  if (already >= ACTIVITY_POSTS) {
    console.log(`  activity: ${already} posts already present, skipping bulk seed`);
  } else {
    const teacher = teachers[0];
    if (!teacher) return;

    const now = Date.now();
    const postRows: Prisma.ActivityPostCreateManyInput[] = [];
    const tagRows: Prisma.ActivityPostStudentCreateManyInput[] = [];
    const attachmentRows: Prisma.ActivityAttachmentCreateManyInput[] = [];
    const reactionRows: Prisma.ActivityReactionCreateManyInput[] = [];
    const hiddenPostRows: Prisma.ActivityPostCreateManyInput[] = [];

    let postIndex = 0;

    const audienceCycle: AudienceType[] = [
      AudienceType.SECTION,
      AudienceType.CLASS,
      AudienceType.STUDENT,
    ];

    for (const section of sections) {
      if (section.id === excludeSectionId) continue;

      const sectionStudents = students.filter((s) => s.sectionId === section.id);
      const count = Math.min(
        ACTIVITY_POSTS_PER_SECTION,
        Math.max(1, Math.floor(ACTIVITY_POSTS / Math.max(sections.length - 1, 1))),
      );

      for (let n = 0; n < count; n += 1) {
        const audienceType = audienceCycle[(postIndex + n) % audienceCycle.length];
        // CLASS posts reach every section in the class. The empty-path fixture
        // student lives in excludeClassId, so skip CLASS audience there.
        if (
          audienceType === AudienceType.CLASS &&
          section.classId === excludeClassId
        ) {
          postIndex += 1;
          continue;
        }
        const daysAgo = n * 3 + (postIndex % 5);
        const publishedAt = new Date(now - daysAgo * 86400000);
        const postId = `perf-post-${postIndex}`;
        postIndex += 1;

        postRows.push({
          id: postId,
          tenantId,
          classId: section.classId,
          sectionId:
            audienceType === AudienceType.CLASS ||
            audienceType === AudienceType.ALL
              ? null
              : section.id,
          createdById: teacher.userId,
          title: `Class ${section.level}${section.name} activity ${n + 1}`,
          caption: `Performance fixture activity for section ${section.level}${section.name}.`,
          category: pick([
            ActivityCategory.LEARNING,
            ActivityCategory.ART_AND_CRAFT,
            ActivityCategory.GENERAL,
          ]),
          audienceType,
          status: ActivityPostStatus.APPROVED,
          parentVisible: true,
          publishedAt,
          activityDate: publishedAt,
        });

        if (audienceType === AudienceType.STUDENT && sectionStudents.length > 0) {
          const tagged = sectionStudents.slice(
            0,
            rng() < 0.3 ? Math.min(2, sectionStudents.length) : 1,
          );
          for (const student of tagged) {
            tagRows.push({
              tenantId,
              activityPostId: postId,
              studentId: student.id,
            });
          }
        } else if (rng() < ACTIVITY_TAGGED_RATIO && sectionStudents.length > 0) {
          tagRows.push({
            tenantId,
            activityPostId: postId,
            studentId: sectionStudents[0].id,
          });
        }

        const attachmentCount = postIndex % 3;
        for (let a = 0; a < attachmentCount; a += 1) {
          attachmentRows.push({
            tenantId,
            activityPostId: postId,
            fileName: `photo-${a + 1}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 2048 + a * 512,
            provider: StorageProvider.LOCAL,
            objectKey: `perf/${postId}/${a}`,
            sortOrder: a,
            processingStatus: 'READY',
            optimizedObjectKey: a === 0 ? `perf/${postId}/optimized` : null,
            thumbnailFileAssetId: null,
          });
        }
      }
    }

    // Class-wide post visible to every section in the first active section's class.
    const firstSection = sections.find((s) => s.id !== excludeSectionId);
    if (firstSection) {
      postRows.push({
        id: 'perf-post-classwide',
        tenantId,
        classId: firstSection.classId,
        sectionId: null,
        createdById: teacher.userId,
        title: 'Class-wide celebration',
        caption: 'Shared class-level activity visible to every section in the class.',
        category: ActivityCategory.CELEBRATION,
        audienceType: AudienceType.CLASS,
        status: ActivityPostStatus.APPROVED,
        parentVisible: true,
        publishedAt: new Date(now - 2 * 86400000),
        activityDate: new Date(now - 2 * 86400000),
      });
      postRows.push({
        id: 'perf-post-old-history',
        tenantId,
        classId: firstSection.classId,
        sectionId: firstSection.id,
        createdById: teacher.userId,
        title: 'Older classroom activity',
        caption: 'Historical activity for ordering tests.',
        category: ActivityCategory.LEARNING,
        audienceType: AudienceType.SECTION,
        status: ActivityPostStatus.APPROVED,
        parentVisible: true,
        publishedAt: new Date(now - 75 * 86400000),
        activityDate: new Date(now - 75 * 86400000),
      });
    }

    // Hidden variants — must never surface on parent reads.
    if (firstSection && students[0]) {
      hiddenPostRows.push(
        {
          id: 'perf-post-draft',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Draft activity',
          caption: 'Should stay hidden from parents.',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.DRAFT,
          parentVisible: true,
          publishedAt: new Date(now),
        },
        {
          id: 'perf-post-archived',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Archived activity',
          caption: 'Should stay hidden from parents.',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.ARCHIVED,
          parentVisible: true,
          publishedAt: new Date(now),
        },
        {
          id: 'perf-post-withdrawn',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Withdrawn activity',
          caption: 'Soft-deleted post.',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.APPROVED,
          parentVisible: true,
          softDeletedAt: new Date(now),
          publishedAt: new Date(now),
        },
        {
          id: 'perf-post-hidden',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Not parent visible',
          caption: 'parentVisible=false',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.APPROVED,
          parentVisible: false,
          publishedAt: new Date(now),
        },
        {
          id: 'perf-post-wrong-class',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Wrong class activity',
          caption: 'Outside the linked child class.',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.APPROVED,
          parentVisible: true,
          publishedAt: new Date(now),
        },
        {
          id: 'perf-post-tagged-other',
          tenantId,
          classId: firstSection.classId,
          sectionId: firstSection.id,
          createdById: teacher.userId,
          title: 'Tagged to another student',
          caption: 'Student audience mismatch.',
          category: ActivityCategory.GENERAL,
          audienceType: AudienceType.STUDENT,
          status: ActivityPostStatus.APPROVED,
          parentVisible: true,
          publishedAt: new Date(now),
        },
      );
    }

    await insertInBatches('activity posts', [...postRows, ...hiddenPostRows], (chunk) =>
      prisma.activityPost.createMany({ data: chunk, skipDuplicates: true }),
    );
    await insertInBatches('activity student tags', tagRows, (chunk) =>
      prisma.activityPostStudent.createMany({ data: chunk, skipDuplicates: true }),
    );

    if (students[1]) {
      await prisma.activityPostStudent.createMany({
        data: [
          {
            tenantId,
            activityPostId: 'perf-post-tagged-other',
            studentId: students[1].id,
          },
        ],
        skipDuplicates: true,
      });
    }

    await insertInBatches('activity attachments', attachmentRows, (chunk) =>
      prisma.activityAttachment.createMany({ data: chunk, skipDuplicates: true }),
    );

    // One SEEN reaction on the newest school-wide post for populated-path realism.
    const firstGuardian = await prisma.guardian.findFirst({
      where: { tenantId, userId: { not: null } },
      select: { id: true },
    });
    if (firstGuardian) {
      reactionRows.push({
        tenantId,
        activityPostId: 'perf-post-classwide',
        guardianId: firstGuardian.id,
        reaction: ActivityReactionType.SEEN,
        createdAt: new Date(now - 86400000),
      });
    }
    await insertInBatches('activity reactions', reactionRows, (chunk) =>
      prisma.activityReaction.createMany({ data: chunk, skipDuplicates: true }),
    );

    console.log(
      `  activity: ${postRows.length + hiddenPostRows.length} posts, ` +
        `${attachmentRows.length} attachments, ${tagRows.length} tags`,
    );
  }

  if (MILESTONES_PER_STUDENT === 0) return;

  const milestoneAlready = await prisma.developmentalMilestone.count({
    where: { tenantId },
  });
  if (milestoneAlready >= students.length * MILESTONES_PER_STUDENT) {
    console.log(`  milestones: ${milestoneAlready} already present, skipping`);
    return;
  }

  const teacher = teachers[0];
  if (!teacher) return;

  const milestoneRows: Prisma.DevelopmentalMilestoneCreateManyInput[] = [];
  const now = Date.now();
  for (const [index, student] of students.entries()) {
    for (let m = 0; m < MILESTONES_PER_STUDENT; m += 1) {
      milestoneRows.push({
        tenantId,
        classId: student.classId,
        sectionId: student.sectionId,
        studentId: student.id,
        domain: pick(['Language', 'Motor', 'Social', 'Cognitive']),
        milestone: `Observed milestone ${m + 1} for student ${index + 1}`,
        status: pick([
          DevelopmentalMilestoneStatus.EMERGING,
          DevelopmentalMilestoneStatus.PROGRESSING,
          DevelopmentalMilestoneStatus.ACHIEVED,
        ]),
        observationNote: 'Performance fixture milestone.',
        observedAt: new Date(now - (m + 1) * 7 * 86400000),
        createdById: teacher.userId,
      });
    }
  }

  await insertInBatches('developmental milestones', milestoneRows, (chunk) =>
    prisma.developmentalMilestone.createMany({ data: chunk, skipDuplicates: true }),
  );
}

async function seedCanteen(
  tenantId: string,
  students: PerfStudent[],
  fixtureStudentIds: { empty: string; one: string },
) {
  if (CANTEEN_MENU_ITEMS === 0) return;

  const already = await prisma.canteenMenuItem.count({ where: { tenantId } });
  if (already >= CANTEEN_MENU_ITEMS) {
    console.log(`  canteen: ${already} menu items already present, skipping`);
    return;
  }

  const now = Date.now();
  const mealPlanIds = ['perf-meal-plan-lunch', 'perf-meal-plan-breakfast'];

  await prisma.canteenMealPlan.createMany({
    data: [
      {
        id: mealPlanIds[0],
        tenantId,
        name: 'Daily Lunch',
        description: 'Standard lunch plan',
        mealType: 'LUNCH',
        price: 3500,
        billingFrequency: 'MONTHLY',
        status: CanteenMealPlanStatus.ACTIVE,
      },
      {
        id: mealPlanIds[1],
        tenantId,
        name: 'Breakfast Club',
        description: 'Morning meal plan',
        mealType: 'BREAKFAST',
        price: 2000,
        billingFrequency: 'MONTHLY',
        status: CanteenMealPlanStatus.ACTIVE,
      },
    ],
    skipDuplicates: true,
  });

  const menuRows: Prisma.CanteenMenuItemCreateManyInput[] = [];
  const categories = ['Snacks', 'Meals', 'Beverages'];
  for (let i = 0; i < CANTEEN_MENU_ITEMS; i += 1) {
    menuRows.push({
      tenantId,
      name: `Menu item ${i + 1}`,
      category: categories[i % categories.length],
      description: i % 4 === 0 ? `Description for item ${i + 1}` : null,
      unitPrice: 25 + (i % 10) * 5,
      status: CanteenMenuItemStatus.ACTIVE,
      isMealItem: i % 5 === 0,
      allergenTags: i % 7 === 0 ? ['nuts'] : [],
    });
  }
  await insertInBatches('canteen menu items', menuRows, (chunk) =>
    prisma.canteenMenuItem.createMany({ data: chunk, skipDuplicates: true }),
  );

  const walletRows: Prisma.CanteenWalletCreateManyInput[] = [];
  const transactionRows: Prisma.CanteenWalletTransactionCreateManyInput[] = [];
  const enrollmentRows: Prisma.CanteenStudentEnrollmentCreateManyInput[] = [];
  const servingRows: Prisma.CanteenMealServingCreateManyInput[] = [];

  for (const [index, student] of students.entries()) {
    if (student.id === fixtureStudentIds.empty) continue;

    const withWallet =
      student.id === fixtureStudentIds.one || rng() < CANTEEN_WALLET_RATIO;
    const withEnrollment =
      student.id === fixtureStudentIds.one || rng() < CANTEEN_ENROLLED_RATIO;

    let walletId: string | null = null;
    if (withWallet) {
      walletId = `perf-wallet-${student.id}`;
      const balance = student.id === fixtureStudentIds.one ? 450 : 50 + (index % 20) * 25;
      const threshold = 100;
      walletRows.push({
        id: walletId,
        tenantId,
        studentId: student.id,
        balance,
        lowBalanceThreshold: threshold,
      });

      const txCount = student.id === fixtureStudentIds.one ? 5 : 2;
      for (let t = 0; t < txCount; t += 1) {
        transactionRows.push({
          tenantId,
          walletId,
          studentId: student.id,
          type:
            t === 0
              ? CanteenWalletTransactionType.TOP_UP
              : CanteenWalletTransactionType.DEDUCTION,
          source:
            t === 0
              ? CanteenWalletTransactionSource.MANUAL
              : CanteenWalletTransactionSource.POS_SALE,
          amount: t === 0 ? 500 : 25 + t * 10,
          balanceAfter: balance - t * 25,
          transactionDate: new Date(now - t * 86400000),
          note: t === 0 ? 'Wallet top-up' : `POS purchase ${t}`,
        });
      }
    }

    if (withEnrollment) {
      const mealPlanId = mealPlanIds[index % mealPlanIds.length];
      const enrollmentId = `perf-enrollment-${student.id}`;
      enrollmentRows.push({
        id: enrollmentId,
        tenantId,
        studentId: student.id,
        mealPlanId,
        startsOn: new Date('2026-04-01T00:00:00.000Z'),
        endsOn: null,
        status: CanteenEnrollmentStatus.ACTIVE,
      });

      const servingCount = student.id === fixtureStudentIds.one ? 3 : 1;
      for (let s = 0; s < servingCount; s += 1) {
        servingRows.push({
          tenantId,
          studentId: student.id,
          enrollmentId,
          mealPlanId,
          mealType: s % 2 === 0 ? 'LUNCH' : 'BREAKFAST',
          mealDate: new Date(now - (s + 1) * 86400000),
          servedAt: new Date(now - (s + 1) * 86400000 + 3600000),
          status: CanteenMealServingStatus.SERVED,
          notes: s === 0 ? 'On time' : null,
        });
      }
    }
  }

  await insertInBatches('canteen wallets', walletRows, (chunk) =>
    prisma.canteenWallet.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('canteen enrollments', enrollmentRows, (chunk) =>
    prisma.canteenStudentEnrollment.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('canteen servings', servingRows, (chunk) =>
    prisma.canteenMealServing.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('canteen wallet transactions', transactionRows, (chunk) =>
    prisma.canteenWalletTransaction.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log(
    `  canteen: ${menuRows.length} menu items, ${walletRows.length} wallets, ` +
      `${enrollmentRows.length} enrollments, ${servingRows.length} servings, ` +
      `${transactionRows.length} transactions`,
  );
}

async function seedFees(
  tenantId: string,
  academicYearId: string,
  students: PerfStudent[],
  fixtureStudentIds: { empty: string; one: string },
) {
  const already = await prisma.invoice.count({ where: { tenantId } });
  if (already > 0) {
    console.log(`  fees: ${already} invoices already present, skipping`);
    return;
  }

  const feeHeads = await prisma.feeHead.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  });
  const tuition = feeHeads.find((head) => head.code === 'TUITION') ?? feeHeads[0];
  const exam = feeHeads.find((head) => head.code === 'EXAM') ?? feeHeads[0];
  if (!tuition) {
    console.log('  fees: no fee heads provisioned, skipping');
    return;
  }

  const now = Date.now();
  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const lineRows: Prisma.InvoiceLineCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const receiptRows: Prisma.ReceiptCreateManyInput[] = [];

  let invoiceIndex = 0;

  function pushInvoice(opts: {
    studentId: string;
    status: InvoiceStatus;
    total: number;
    paid?: number;
    dueDaysAgo: number;
  }) {
    invoiceIndex += 1;
    const invoiceId = `perf-inv-${pad(invoiceIndex, 5)}`;
    const invoiceNumber = `PERF-INV-${pad(invoiceIndex, 5)}`;
    const dueDate = new Date(now - opts.dueDaysAgo * 86400000);
    invoiceRows.push({
      id: invoiceId,
      tenantId,
      studentId: opts.studentId,
      academicYearId,
      invoiceNumber,
      dueDate,
      status: opts.status,
      subtotal: opts.total,
      vatAmount: 0,
      totalAmount: opts.total,
      issuedAt: new Date(dueDate.getTime() - 14 * 86400000),
      paidAt: opts.status === InvoiceStatus.PAID ? dueDate : null,
    });
    lineRows.push({
      id: `perf-line-${pad(invoiceIndex, 5)}`,
      tenantId,
      invoiceId,
      feeHeadId: invoiceIndex % 2 === 0 && exam ? exam.id : tuition.id,
      description: 'Performance fixture fee line',
      quantity: 1,
      unitAmount: opts.total,
      vatAmount: 0,
      totalAmount: opts.total,
    });

    if (opts.paid && opts.paid > 0) {
      const paymentId = `perf-pay-${pad(invoiceIndex, 5)}`;
      paymentRows.push({
        id: paymentId,
        tenantId,
        studentId: opts.studentId,
        invoiceId,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        amount: opts.paid,
        paidAt: dueDate,
        idempotencyKey: `perf-pay-${invoiceNumber}`,
      });
      receiptRows.push({
        id: `perf-rec-${pad(invoiceIndex, 5)}`,
        tenantId,
        paymentId,
        receiptNumber: `PERF-REC-${pad(invoiceIndex, 5)}`,
        vatAmount: 0,
        issuedAt: dueDate,
      });
    }
  }

  // Empty-path fixture: no invoices.
  // Populated fixture: ISSUED + PARTIAL + PAID.
  pushInvoice({
    studentId: fixtureStudentIds.one,
    status: InvoiceStatus.ISSUED,
    total: 5000,
    dueDaysAgo: -20,
  });
  pushInvoice({
    studentId: fixtureStudentIds.one,
    status: InvoiceStatus.PARTIAL,
    total: 3000,
    paid: 1000,
    dueDaysAgo: 10,
  });
  pushInvoice({
    studentId: fixtureStudentIds.one,
    status: InvoiceStatus.PAID,
    total: 2000,
    paid: 2000,
    dueDaysAgo: 40,
  });

  for (const student of students) {
    if (student.id === fixtureStudentIds.empty || student.id === fixtureStudentIds.one) {
      continue;
    }
    if (rng() >= FEE_INVOICE_RATIO) continue;
    const roll = rng();
    if (roll < 0.35) {
      pushInvoice({
        studentId: student.id,
        status: InvoiceStatus.ISSUED,
        total: 2500 + Math.floor(rng() * 3000),
        dueDaysAgo: Math.floor(rng() * 45) - 15,
      });
    } else if (roll < 0.7) {
      const total = 2500 + Math.floor(rng() * 3000);
      pushInvoice({
        studentId: student.id,
        status: InvoiceStatus.PARTIAL,
        total,
        paid: Math.floor(total * 0.4),
        dueDaysAgo: Math.floor(rng() * 30),
      });
    } else {
      const total = 2000 + Math.floor(rng() * 2000);
      pushInvoice({
        studentId: student.id,
        status: InvoiceStatus.PAID,
        total,
        paid: total,
        dueDaysAgo: 20 + Math.floor(rng() * 60),
      });
    }
  }

  await insertInBatches('fee invoices', invoiceRows, (chunk) =>
    prisma.invoice.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('fee invoice lines', lineRows, (chunk) =>
    prisma.invoiceLine.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('fee payments', paymentRows, (chunk) =>
    prisma.payment.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insertInBatches('fee receipts', receiptRows, (chunk) =>
    prisma.receipt.createMany({ data: chunk, skipDuplicates: true }),
  );

  console.log(
    `  fees: ${invoiceRows.length} invoices, ${lineRows.length} lines, ` +
      `${paymentRows.length} payments, ${receiptRows.length} receipts ` +
      `(empty fixture has none)`,
  );
}

async function seedMeasurementFixtures(
  tenantId: string,
  passwordHash: string,
  students: PerfStudent[],
  sections: { id: string; classId: string; level: number; name: string }[],
) {
  if (students.length < 3) return;

  const emptySection = sections[sections.length - 1];
  const emptyStudent = students.find((s) => s.sectionId === emptySection?.id);
  if (!emptyStudent) {
    throw new Error(
      'No student found in the empty-activity section; cannot create measurement fixtures.',
    );
  }
  const oneChild =
    students.find(
      (s) => s.sectionId !== emptySection.id && s.id !== emptyStudent.id,
    ) ?? students[1];
  const multiChildA = oneChild;
  const multiChildB =
    students.find(
      (s) =>
        s.id !== oneChild.id &&
        s.id !== emptyStudent.id &&
        s.sectionId === oneChild.sectionId,
    ) ??
    students.find((s) => s.id !== oneChild.id && s.id !== emptyStudent.id) ??
    students[2];

  const parentRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'parent' } },
  });
  if (!parentRole) return;
  const parentRoleId = parentRole.id;

  const capabilities: GuardianCapability[] = [
    GuardianCapability.ATTENDANCE_VIEW,
    GuardianCapability.ACADEMICS_VIEW,
    GuardianCapability.FEES_VIEW,
    GuardianCapability.EMERGENCY_ALERT_RECEIVE,
  ];

  async function upsertFixtureParent(
    email: string,
    fullName: string,
    linkedStudents: PerfStudent[],
  ) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { passwordHash, status: UserStatus.ACTIVE, mustChangePassword: false },
      create: {
        tenantId,
        email,
        passwordHash,
        authMethod: AuthMethod.PASSWORD,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    const existingRole = await prisma.userRole.findFirst({
      where: { tenantId, userId: user.id, roleId: parentRoleId, scopeId: null },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { tenantId, userId: user.id, roleId: parentRoleId, scopeId: null },
      });
    }

    const guardianExisting = await prisma.guardian.findFirst({
      where: { tenantId, userId: user.id },
    });
    const guardian = guardianExisting
      ? await prisma.guardian.update({
          where: { id: guardianExisting.id },
          data: { fullName, receivesAlerts: true, email },
        })
      : await prisma.guardian.create({
          data: {
            tenantId,
            userId: user.id,
            fullName,
            relation: 'Guardian',
            primaryPhone: `98${pad(Math.floor(rng() * 100000000), 8)}`,
            email,
            receivesAlerts: true,
          },
        });

    await prisma.studentGuardian.deleteMany({
      where: { tenantId, guardianId: guardian.id },
    });

    await prisma.studentGuardian.createMany({
      data: linkedStudents.map((student, index) => ({
        tenantId,
        studentId: student.id,
        guardianId: guardian.id,
        relation: index === 0 ? 'Father' : 'Mother',
        isPrimary: index === 0,
        appLoginLinked: true,
        capabilities,
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        status: GuardianRelationshipStatus.ACTIVE,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        emergencyContactPriority: index + 1,
      })),
    });

    return { email, guardianId: guardian.id, studentIds: linkedStudents.map((s) => s.id) };
  }

  const fixtures = {
    empty: await upsertFixtureParent(
      FIXTURE_PARENT_EMAILS.empty,
      'Perf Empty Parent',
      [emptyStudent],
    ),
    one: await upsertFixtureParent(FIXTURE_PARENT_EMAILS.one, 'Perf One Child Parent', [
      oneChild,
    ]),
    multi: await upsertFixtureParent(
      FIXTURE_PARENT_EMAILS.multi,
      'Perf Multi Child Parent',
      [multiChildA, multiChildB],
    ),
  };

  console.log('  measurement fixtures:');
  console.log(`    empty path:  ${fixtures.empty.email} -> ${fixtures.empty.studentIds.join(', ')}`);
  console.log(`    one child:   ${fixtures.one.email} -> ${fixtures.one.studentIds.join(', ')}`);
  console.log(
    `    multi child: ${fixtures.multi.email} -> ${fixtures.multi.studentIds.join(', ')}`,
  );

  return fixtures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();

  console.log(`Seeding performance tenant "${SLUG}"`);
  console.log(
    `Target: ${STUDENTS} students, ${STUDENTS * 2} parents, ${TEACHERS} teachers, ` +
      `${ADMINS} admins, ${CLASSES * SECTIONS_PER_CLASS} sections, ${ATTENDANCE_DAYS} attendance days`,
  );
  console.log('');

  const tenant = await ensureTenant();
  await assignSubscription(tenant.id);

  if (RESET) await purgeBulkData(tenant.id);

  const passwordHash = await bcrypt.hash(PASSWORD, SEED_BCRYPT_ROUNDS);

  const { academicYear, sections, subjects } = await seedStructure(tenant.id);
  const { teachers } = await seedStaff(tenant.id, academicYear.id, sections, subjects, passwordHash);
  const { students, guardianUserIds } = await seedStudentsAndParents(
    tenant.id,
    academicYear.id,
    sections,
    passwordHash,
  );
  const emptySectionId = sections[sections.length - 1]?.id ?? '';
  const emptyClassId = sections[sections.length - 1]?.classId ?? '';
  const guardians = await prisma.guardian.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  await seedGuardianConsents(tenant.id, guardians);
  await seedActivityAndMilestones(
    tenant.id,
    sections,
    students,
    teachers,
    emptySectionId,
    emptyClassId,
  );
  const fixtures = await seedMeasurementFixtures(tenant.id, passwordHash, students, sections);
  if (fixtures) {
    await seedCanteen(tenant.id, students, {
      empty: fixtures.empty.studentIds[0],
      one: fixtures.one.studentIds[0],
    });
    await seedFees(tenant.id, academicYear.id, students, {
      empty: fixtures.empty.studentIds[0],
      one: fixtures.one.studentIds[0],
    });
  }
  await seedAttendance(tenant.id, academicYear.id, sections, students);
  await seedNotifications(tenant.id, guardianUserIds);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('');
  console.log('--- Performance tenant ready ---');
  console.log(`Tenant ID:   ${tenant.id}`);
  console.log(`Slug:        ${SLUG}`);
  console.log(`Elapsed:     ${elapsed}s`);
  console.log('');
  console.log('Load-test credentials (synthetic fixture tenant only):');
  console.log(`  parent:  parent00001@${SLUG}.test .. parent${pad(STUDENTS * 2, 5)}@${SLUG}.test`);
  console.log(`  teacher: teacher001@${SLUG}.test .. teacher${pad(TEACHERS, 3)}@${SLUG}.test`);
  console.log(`  admin:   admin001@${SLUG}.test .. admin${pad(ADMINS, 3)}@${SLUG}.test`);
  console.log(`  password: ${PASSWORD}`);
  console.log('');
  console.log('Measurement fixture parents (synthetic tenant only):');
  console.log(`  empty:  ${FIXTURE_PARENT_EMAILS.empty}`);
  console.log(`  one:    ${FIXTURE_PARENT_EMAILS.one}`);
  console.log(`  multi:  ${FIXTURE_PARENT_EMAILS.multi}`);
  console.log('');
  console.log('Next: pnpm --filter @schoolos/api perf:verify   (row counts)');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
