/**
 * Seeds Wave 1 smoke-aligned personas and minimal academic fixtures for
 * pilot-rehearsal-1. Idempotent; run after seed-pilot-rehearsal-tenant.ts.
 */
import {
  AuthMethod,
  ContractType,
  EnrollmentStatus,
  Gender,
  GuardianCapability,
  GuardianRelationshipApprovalStatus,
  GuardianRelationshipStatus,
  GuardianRelationshipVerificationStatus,
  PrismaClient,
  StaffEmploymentType,
  StaffStatus,
  StudentLifecycleStatus,
  TeacherAssignmentType,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const PILOT_SLUG =
  process.env.PILOT_REHEARSAL_TENANT_SLUG ?? 'pilot-rehearsal-1';
const PERSONA_PASSWORD =
  process.env.PILOT_REHEARSAL_PERSONA_PASSWORD ??
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ??
  'PilotRehearsal1!';

const STUDENT_PREFIX = 'PR-01-A';

const demoGuardianCapabilities: GuardianCapability[] = [
  GuardianCapability.ACADEMICS_VIEW,
  GuardianCapability.ATTENDANCE_VIEW,
  GuardianCapability.FEES_VIEW,
  GuardianCapability.SCHOOL_COMMUNICATE,
  GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
  GuardianCapability.EMERGENCY_ALERT_RECEIVE,
];

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public',
});

const prisma = new PrismaClient({ adapter });

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function ensureUserWithRole(
  tenantId: string,
  email: string,
  roleName: string,
) {
  const role = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: roleName } },
  });
  if (!role) {
    throw new Error(`Role "${roleName}" not found for tenant ${tenantId}`);
  }

  const passwordHash = await bcrypt.hash(PERSONA_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {
      passwordHash,
      mustChangePassword: false,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
      failedLoginCount: 0,
      lockedUntil: null,
    },
    create: {
      tenantId,
      email,
      passwordHash,
      mustChangePassword: false,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: { tenantId, userId: user.id, roleId: role.id, scopeId: null },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { tenantId, userId: user.id, roleId: role.id, scopeId: null },
    });
  }

  return user;
}

async function ensureStaffProfile(
  tenantId: string,
  userId: string,
  input: {
    employeeId: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    designation: string;
    department: string;
    teacherRegistryId?: string | null;
  },
) {
  const base = {
    userId,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: date('1988-06-15'),
    gender: input.gender,
    address: 'Pilot Rehearsal School, Lalitpur, Nepal',
    teacherRegistryId: input.teacherRegistryId ?? null,
    citizenshipNo: `CTZ-${input.employeeId}`,
    panNumber: `PAN-${input.employeeId}`,
    bankAccount: `000${input.employeeId.replace(/\D/g, '').padStart(8, '0')}`,
    bankName: 'Nepal Bank Limited',
    department: input.department,
    designation: input.designation,
    employmentType: StaffEmploymentType.PERMANENT,
    status: StaffStatus.ACTIVE,
    contractStatus: 'ACTIVE',
    qualifications: 'Pilot rehearsal qualification profile',
    experience: 'Pilot rehearsal',
    joiningDate: date('2026-04-01'),
    contractType: ContractType.PERMANENT,
    privacyConsentAt: new Date(),
  };

  return prisma.staff.upsert({
    where: { tenantId_employeeId: { tenantId, employeeId: input.employeeId } },
    update: base,
    create: { tenantId, employeeId: input.employeeId, ...base },
  });
}

async function upsertTenantSetting(tenantId: string, key: string, value: string) {
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { value },
    create: { tenantId, key, value },
  });
}

async function ensureSubject(
  tenantId: string,
  classId: string,
  input: { name: string; code: string; type: string },
) {
  const existing = await prisma.subject.findFirst({
    where: { tenantId, classId, code: input.code },
  });
  if (existing) {
    return prisma.subject.update({
      where: { id: existing.id },
      data: { name: input.name, type: input.type },
    });
  }
  return prisma.subject.create({
    data: {
      tenantId,
      classId,
      name: input.name,
      code: input.code,
      type: input.type,
    },
  });
}

async function upsertTeacherAssignment(input: {
  tenantId: string;
  academicYearId: string;
  staffId: string;
  assignmentType: TeacherAssignmentType;
  classId: string;
  sectionId: string;
  subjectId?: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date;
}) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: {
      tenantId: input.tenantId,
      academicYearId: input.academicYearId,
      staffId: input.staffId,
      assignmentType: input.assignmentType,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId ?? null,
      componentScope: null,
    },
    select: { id: true },
  });

  const data = {
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    status: 'ACTIVE' as const,
    isPrimary: true,
  };

  if (existing) {
    return prisma.teacherAssignment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.teacherAssignment.create({
    data: {
      tenantId: input.tenantId,
      academicYearId: input.academicYearId,
      staffId: input.staffId,
      assignmentType: input.assignmentType,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId ?? null,
      ...data,
    },
  });
}

async function seedStudentWithGuardian(input: {
  tenantId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  sectionName: string;
  roll: number;
  guardianEmail: string;
  firstName: string;
  lastName: string;
}) {
  const code = `${STUDENT_PREFIX}-${String(input.roll).padStart(3, '0')}`;
  const guardianUser = await ensureUserWithRole(
    input.tenantId,
    input.guardianEmail,
    'parent',
  );

  const guardian = await prisma.guardian.upsert({
    where: { userId: guardianUser.id },
    update: {
      fullName: `${input.firstName} Guardian`,
      relation: 'Guardian',
      primaryPhone: `9800010${String(input.roll).padStart(3, '0')}`,
      email: input.guardianEmail,
      homeAddress: 'Lalitpur, Nepal',
      receivesAlerts: true,
      privacyConsentAt: new Date(),
    },
    create: {
      tenantId: input.tenantId,
      userId: guardianUser.id,
      fullName: `${input.firstName} Guardian`,
      relation: 'Guardian',
      primaryPhone: `9800010${String(input.roll).padStart(3, '0')}`,
      email: input.guardianEmail,
      homeAddress: 'Lalitpur, Nepal',
      receivesAlerts: true,
      privacyConsentAt: new Date(),
    },
  });

  const student = await prisma.student.upsert({
    where: {
      tenantId_studentSystemId: {
        tenantId: input.tenantId,
        studentSystemId: code,
      },
    },
    update: {
      firstNameEn: input.firstName,
      lastNameEn: input.lastName,
      dateOfBirth: date('2019-05-10'),
      gender: input.roll % 2 === 0 ? Gender.FEMALE : Gender.MALE,
      classId: input.classId,
      sectionId: input.sectionId,
      section: input.sectionName,
      rollNumber: input.roll,
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      privacyConsentAt: new Date(),
      dataProcessingConsentedAt: new Date(),
      medicalConsentAt: new Date(),
      photoUsageConsentAt: new Date(),
    },
    create: {
      tenantId: input.tenantId,
      studentSystemId: code,
      firstNameEn: input.firstName,
      lastNameEn: input.lastName,
      dateOfBirth: date('2019-05-10'),
      gender: input.roll % 2 === 0 ? Gender.FEMALE : Gender.MALE,
      nationality: 'Nepali',
      motherTongue: 'Nepali',
      disabilityFlag: 'No known disability',
      admissionDate: date('2026-04-10'),
      admissionNumber: code,
      mediumOfInstruct: 'English',
      classId: input.classId,
      sectionId: input.sectionId,
      section: input.sectionName,
      rollNumber: input.roll,
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
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
      status: GuardianRelationshipStatus.ACTIVE,
      verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
      approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
      effectiveFrom: date('2026-04-10'),
      capabilities: demoGuardianCapabilities,
    },
    create: {
      tenantId: input.tenantId,
      studentId: student.id,
      guardianId: guardian.id,
      relation: 'Guardian',
      isPrimary: true,
      appLoginLinked: true,
      status: GuardianRelationshipStatus.ACTIVE,
      verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
      approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
      effectiveFrom: date('2026-04-10'),
      capabilities: demoGuardianCapabilities,
    },
  });

  const admissionDate = date('2026-04-10');
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId: input.tenantId,
      academicYearId: input.academicYearId,
      studentId: student.id,
      status: EnrollmentStatus.ACTIVE,
      effectiveUntil: null,
    },
  });
  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        classId: input.classId,
        sectionId: input.sectionId,
        rollNumber: input.roll,
        admissionNumber: code,
        admissionDate,
        mediumOfInstruction: 'English',
        status: EnrollmentStatus.ACTIVE,
        effectiveUntil: null,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        tenantId: input.tenantId,
        academicYearId: input.academicYearId,
        studentId: student.id,
        classId: input.classId,
        sectionId: input.sectionId,
        rollNumber: input.roll,
        admissionNumber: code,
        admissionDate,
        mediumOfInstruction: 'English',
        status: EnrollmentStatus.ACTIVE,
        effectiveFrom: admissionDate,
        effectiveUntil: null,
      },
    });
  }

  return student;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${PILOT_SLUG}" not found. Run pnpm db:seed:pilot-rehearsal first.`,
    );
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
  });
  if (!academicYear) {
    throw new Error('No current academic year on pilot tenant.');
  }

  const schoolClass = await prisma.class.findFirst({
    where: { tenantId: tenant.id, name: 'Class 1' },
  });
  if (!schoolClass) {
    throw new Error('Class 1 not found. Run pnpm db:seed:pilot-rehearsal first.');
  }

  const sectionA = await prisma.section.upsert({
    where: {
      tenantId_classId_name: {
        tenantId: tenant.id,
        classId: schoolClass.id,
        name: 'A',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      classId: schoolClass.id,
      name: 'A',
    },
  });

  const sectionB = await prisma.section.upsert({
    where: {
      tenantId_classId_name: {
        tenantId: tenant.id,
        classId: schoolClass.id,
        name: 'B',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      classId: schoolClass.id,
      name: 'B',
    },
  });

  await upsertTenantSetting(tenant.id, 'school_name', 'Pilot Rehearsal School');
  await upsertTenantSetting(
    tenant.id,
    'school_address',
    'Rehearsal Campus, Lalitpur, Nepal',
  );
  await upsertTenantSetting(tenant.id, 'school_phone', '+977-1-5550100');

  const [nepali, english, mathematics] = await Promise.all([
    ensureSubject(tenant.id, schoolClass.id, {
      name: 'Nepali',
      code: 'NEP',
      type: 'CORE',
    }),
    ensureSubject(tenant.id, schoolClass.id, {
      name: 'English',
      code: 'ENG',
      type: 'CORE',
    }),
    ensureSubject(tenant.id, schoolClass.id, {
      name: 'Mathematics',
      code: 'MATH',
      type: 'CORE',
    }),
  ]);

  const principalUser = await ensureUserWithRole(
    tenant.id,
    'principal@schoolos.com',
    'principal',
  );
  const classTeacherUser = await ensureUserWithRole(
    tenant.id,
    'classteacher.1a@schoolos.com',
    'teacher',
  );
  const subjectTeacherUser = await ensureUserWithRole(
    tenant.id,
    'subjectteacher.math@schoolos.com',
    'subject_teacher',
  );
  await ensureUserWithRole(tenant.id, 'staff@schoolos.com', 'support_staff');
  await ensureUserWithRole(tenant.id, 'accountant@schoolos.com', 'accountant');
  await ensureUserWithRole(tenant.id, 'driver@schoolos.com', 'driver');

  await ensureStaffProfile(tenant.id, principalUser.id, {
    employeeId: 'PR-PRN-001',
    firstName: 'Anup',
    lastName: 'Shrestha',
    gender: Gender.MALE,
    designation: 'Principal',
    department: 'Leadership',
  });
  const classTeacherStaff = await ensureStaffProfile(
    tenant.id,
    classTeacherUser.id,
    {
      employeeId: 'PR-CT-1A',
      firstName: 'Mina',
      lastName: 'Gautam',
      gender: Gender.FEMALE,
      designation: 'Class 1-A Teacher',
      department: 'Primary',
      teacherRegistryId: 'NTR-PR-CT-1A',
    },
  );
  const subjectTeacherStaff = await ensureStaffProfile(
    tenant.id,
    subjectTeacherUser.id,
    {
      employeeId: 'PR-ST-MATH',
      firstName: 'Rajesh',
      lastName: 'Aryal',
      gender: Gender.MALE,
      designation: 'Mathematics Teacher',
      department: 'Academics',
      teacherRegistryId: 'NTR-PR-ST-MATH',
    },
  );

  const staffUser = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'staff@schoolos.com' },
    },
  });
  const accountantUser = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'accountant@schoolos.com' },
    },
  });
  const driverUser = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'driver@schoolos.com' },
    },
  });
  if (staffUser) {
    await ensureStaffProfile(tenant.id, staffUser.id, {
      employeeId: 'PR-STF-001',
      firstName: 'Rojina',
      lastName: 'Maharjan',
      gender: Gender.FEMALE,
      designation: 'Receptionist',
      department: 'Administration',
    });
  }
  if (accountantUser) {
    await ensureStaffProfile(tenant.id, accountantUser.id, {
      employeeId: 'PR-ACC-001',
      firstName: 'Sujata',
      lastName: 'Karki',
      gender: Gender.FEMALE,
      designation: 'Accountant',
      department: 'Finance',
    });
  }
  if (driverUser) {
    await ensureStaffProfile(tenant.id, driverUser.id, {
      employeeId: 'PR-DRV-001',
      firstName: 'Hari',
      lastName: 'Tamang',
      gender: Gender.MALE,
      designation: 'Driver',
      department: 'Transport',
    });
  }

  await prisma.section.update({
    where: { id: sectionA.id },
    data: { classTeacherId: classTeacherStaff.id },
  });

  await upsertTeacherAssignment({
    tenantId: tenant.id,
    academicYearId: academicYear.id,
    staffId: classTeacherStaff.id,
    assignmentType: TeacherAssignmentType.CLASS_TEACHER,
    classId: schoolClass.id,
    sectionId: sectionA.id,
    effectiveFrom: academicYear.startsOn,
    effectiveUntil: academicYear.endsOn,
  });

  await upsertTeacherAssignment({
    tenantId: tenant.id,
    academicYearId: academicYear.id,
    staffId: subjectTeacherStaff.id,
    assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
    classId: schoolClass.id,
    sectionId: sectionA.id,
    subjectId: mathematics.id,
    effectiveFrom: academicYear.startsOn,
    effectiveUntil: academicYear.endsOn,
  });

  await seedStudentWithGuardian({
    tenantId: tenant.id,
    academicYearId: academicYear.id,
    classId: schoolClass.id,
    sectionId: sectionA.id,
    sectionName: 'A',
    roll: 1,
    guardianEmail: 'guardian.c01a001@schoolos.test',
    firstName: 'Aarav',
    lastName: 'Shrestha',
  });

  await seedStudentWithGuardian({
    tenantId: tenant.id,
    academicYearId: academicYear.id,
    classId: schoolClass.id,
    sectionId: sectionA.id,
    sectionName: 'A',
    roll: 2,
    guardianEmail: 'guardian.c01a002@schoolos.test',
    firstName: 'Sita',
    lastName: 'Karki',
  });

  console.log('');
  console.log('--- Pilot Rehearsal Personas Ready ---');
  console.log(`Tenant: ${PILOT_SLUG}`);
  console.log(`Sections: ${sectionA.name}, ${sectionB.name}`);
  console.log(`Subjects: ${nepali.name}, ${english.name}, ${mathematics.name}`);
  console.log(`Persona password: ${PERSONA_PASSWORD}`);
  console.log('Smoke personas: principal, classteacher.1a, subjectteacher.math,');
  console.log('  guardian.c01a001, staff, accountant, driver');
  console.log('');
  console.log('Next: pnpm smoke:pilot:rehearsal');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
