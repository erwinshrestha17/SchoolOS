import {
  AdmissionPolicyApplicantType,
  AdmissionPolicyStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const POLICY_ID = 'a13f2e04-8f41-4b7a-9c2a-51e6d3c8b901';
const POLICY_VERSION_ID = 'a13f2e04-8f41-4b7a-9c2a-51e6d3c8b902';
const SCHEDULE_CASE_ID = 'a13f2e04-8f41-4b7a-9c2a-51e6d3c8b903';
const RESULT_CASE_ID = 'a13f2e04-8f41-4b7a-9c2a-51e6d3c8b904';
const RESULT_SESSION_ID = 'a13f2e04-8f41-4b7a-9c2a-51e6d3c8b905';
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000;

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M1 browser fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M1_ASSESSMENT_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M1_ASSESSMENT_FIXTURES=true to seed the dedicated M1 assessment fixture.',
    );
  }
}

async function main() {
  assertE2eFixtureAllowed();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(
      `Seed the ${TENANT_SLUG} development tenant before the M1 assessment fixture.`,
    );
  }

  const [academicYear, schoolClass, admin] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { tenantId: tenant.id, level: 3 },
      orderBy: { name: 'asc' },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: 'admin@schoolos.com' },
      },
      select: { id: true },
    }),
  ]);

  if (!academicYear || !schoolClass || !admin) {
    throw new Error(
      'The M1 assessment fixture requires the current academic year, Class 3, and seeded school admin.',
    );
  }

  const nepalNow = new Date(Date.now() + NEPAL_OFFSET_MS);
  const activatedAt = new Date(
    Date.UTC(
      nepalNow.getUTCFullYear(),
      nepalNow.getUTCMonth(),
      nepalNow.getUTCDate() - 6,
    ),
  );
  const pastScheduledAt = new Date(
    Date.UTC(
      nepalNow.getUTCFullYear(),
      nepalNow.getUTCMonth(),
      nepalNow.getUTCDate() - 1,
      6,
      0,
      0,
    ),
  );

  await prisma.$transaction(async (tx) => {
    await tx.admissionPolicy.upsert({
      where: { id: POLICY_ID },
      update: {
        tenantId: tenant.id,
        name: 'M1 Assessment Browser Policy',
        slug: 'm1-assessment-browser-policy',
        status: AdmissionPolicyStatus.DRAFT,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        applicantType: AdmissionPolicyApplicantType.NEW,
        source: 'OFFICE_WALK_IN',
        isDefault: false,
        archivedAt: null,
        updatedById: admin.id,
      },
      create: {
        id: POLICY_ID,
        tenantId: tenant.id,
        name: 'M1 Assessment Browser Policy',
        slug: 'm1-assessment-browser-policy',
        status: AdmissionPolicyStatus.DRAFT,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        applicantType: AdmissionPolicyApplicantType.NEW,
        source: 'OFFICE_WALK_IN',
        isDefault: false,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await tx.admissionPolicyVersion.upsert({
      where: { id: POLICY_VERSION_ID },
      update: {
        tenantId: tenant.id,
        policyId: POLICY_ID,
        version: 1,
        status: AdmissionPolicyStatus.ACTIVE,
        admissionMode: 'REVIEW_REQUIRED',
        requiredFields: [],
        requireSection: false,
        requireDocumentReview: false,
        requireInterview: true,
        requirePrincipalApproval: false,
        requireTransferCertificate: false,
        requirePriorMarksheet: false,
        requireStreamOrMarksReview: false,
        allowAdmissionWithDocumentsPending: true,
        enforceCapacityWhenAvailable: false,
        capacityOverride: null,
        approvalPolicyId: null,
        activatedAt,
        activatedById: admin.id,
      },
      create: {
        id: POLICY_VERSION_ID,
        tenantId: tenant.id,
        policyId: POLICY_ID,
        version: 1,
        status: AdmissionPolicyStatus.ACTIVE,
        admissionMode: 'REVIEW_REQUIRED',
        requiredFields: [],
        requireSection: false,
        requireDocumentReview: false,
        requireInterview: true,
        requirePrincipalApproval: false,
        requireTransferCertificate: false,
        requirePriorMarksheet: false,
        requireStreamOrMarksReview: false,
        allowAdmissionWithDocumentsPending: true,
        enforceCapacityWhenAvailable: false,
        activatedAt,
        activatedById: admin.id,
        createdById: admin.id,
      },
    });

    await tx.admissionPolicy.update({
      where: { id: POLICY_ID },
      data: { currentVersionId: POLICY_VERSION_ID },
    });

    await tx.admissionApplication.upsert({
      where: { id: SCHEDULE_CASE_ID },
      update: {
        tenantId: tenant.id,
        status: 'WAITING_FOR_REVIEW',
        firstNameEn: 'Priya',
        lastNameEn: 'Gurung E2E',
        dateOfBirth: new Date('2016-03-10'),
        gender: 'FEMALE',
        guardianFullName: 'Kamala Gurung',
        guardianRelation: 'Mother',
        guardianPhone: '9841000001',
        guardianEmail: null,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        sectionId: null,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason:
          'Dedicated M1 assessment browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-assessment-schedule' },
        convertedStudentId: null,
        rejectedReason: null,
        updatedById: admin.id,
        createdAt: activatedAt,
        updatedAt: activatedAt,
      },
      create: {
        id: SCHEDULE_CASE_ID,
        tenantId: tenant.id,
        status: 'WAITING_FOR_REVIEW',
        firstNameEn: 'Priya',
        lastNameEn: 'Gurung E2E',
        dateOfBirth: new Date('2016-03-10'),
        gender: 'FEMALE',
        guardianFullName: 'Kamala Gurung',
        guardianRelation: 'Mother',
        guardianPhone: '9841000001',
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason:
          'Dedicated M1 assessment browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-assessment-schedule' },
        createdById: admin.id,
        updatedById: admin.id,
        createdAt: activatedAt,
        updatedAt: activatedAt,
      },
    });

    // A prior scheduling run must not leave this case with a session, or it
    // would drop out of the "needs scheduling" candidate list.
    await tx.admissionAssessmentSession.deleteMany({
      where: { tenantId: tenant.id, admissionCaseId: SCHEDULE_CASE_ID },
    });

    await tx.admissionApplication.upsert({
      where: { id: RESULT_CASE_ID },
      update: {
        tenantId: tenant.id,
        status: 'WAITING_FOR_REVIEW',
        firstNameEn: 'Rohan',
        lastNameEn: 'Thapa E2E',
        dateOfBirth: new Date('2015-11-02'),
        gender: 'MALE',
        guardianFullName: 'Bimala Thapa',
        guardianRelation: 'Mother',
        guardianPhone: '9841000002',
        guardianEmail: null,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        sectionId: null,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason:
          'Dedicated M1 assessment browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-assessment-result' },
        convertedStudentId: null,
        rejectedReason: null,
        updatedById: admin.id,
        createdAt: activatedAt,
        updatedAt: activatedAt,
      },
      create: {
        id: RESULT_CASE_ID,
        tenantId: tenant.id,
        status: 'WAITING_FOR_REVIEW',
        firstNameEn: 'Rohan',
        lastNameEn: 'Thapa E2E',
        dateOfBirth: new Date('2015-11-02'),
        gender: 'MALE',
        guardianFullName: 'Bimala Thapa',
        guardianRelation: 'Mother',
        guardianPhone: '9841000002',
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason:
          'Dedicated M1 assessment browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-assessment-result' },
        createdById: admin.id,
        updatedById: admin.id,
        createdAt: activatedAt,
        updatedAt: activatedAt,
      },
    });

    // Recorded results are terminal (COMPLETED); always restore this fixture
    // to a fresh awaiting-result SCHEDULED session so the browser test is repeatable.
    await tx.admissionAssessmentSession.upsert({
      where: { id: RESULT_SESSION_ID },
      update: {
        tenantId: tenant.id,
        admissionCaseId: RESULT_CASE_ID,
        status: 'SCHEDULED',
        scheduledAt: pastScheduledAt,
        durationMinutes: 30,
        mode: 'IN_PERSON',
        location: 'Front office',
        notes: 'Dedicated M1 assessment result browser fixture.',
        interviewerUserId: admin.id,
        result: null,
        resultNotes: null,
        resultScore: null,
        resultRecordedAt: null,
        resultRecordedById: null,
        updatedById: admin.id,
      },
      create: {
        id: RESULT_SESSION_ID,
        tenantId: tenant.id,
        admissionCaseId: RESULT_CASE_ID,
        status: 'SCHEDULED',
        scheduledAt: pastScheduledAt,
        durationMinutes: 30,
        mode: 'IN_PERSON',
        location: 'Front office',
        notes: 'Dedicated M1 assessment result browser fixture.',
        interviewerUserId: admin.id,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  });

  const scheduleCandidate = await prisma.admissionApplication.findFirst({
    where: {
      id: SCHEDULE_CASE_ID,
      tenantId: tenant.id,
      status: 'WAITING_FOR_REVIEW',
      policyVersionId: POLICY_VERSION_ID,
      assessmentSessions: { none: {} },
    },
    select: { id: true },
  });
  if (!scheduleCandidate) {
    throw new Error(
      'The M1 assessment fixture schedule candidate was not restored to its unscheduled state.',
    );
  }

  const resultSession = await prisma.admissionAssessmentSession.findFirst({
    where: {
      id: RESULT_SESSION_ID,
      tenantId: tenant.id,
      status: 'SCHEDULED',
      result: null,
      scheduledAt: { lt: new Date() },
    },
    select: { id: true },
  });
  if (!resultSession) {
    throw new Error(
      'The M1 assessment fixture result session was not restored to its awaiting-result state.',
    );
  }

  console.log('Seeded dedicated M1 assessment browser fixture:');
  console.log('- Priya Gurung E2E (needs-scheduling path)');
  console.log('- Rohan Thapa E2E (awaiting-result path)');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
