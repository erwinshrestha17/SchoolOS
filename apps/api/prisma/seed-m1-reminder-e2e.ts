import {
  AdmissionDocumentTiming,
  AdmissionPolicyApplicantType,
  AdmissionPolicyStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const POLICY_ID = '6e2c48ad-c72d-4b74-8a12-71bd32c55ab1';
const POLICY_VERSION_ID = '82bd2ce1-78f2-4e8e-9b1e-b8d13838bff4';
const DOCUMENT_REQUIREMENT_ID = 'f44de47e-76b4-41f6-a915-a0af070d8647';
const DELIVERABLE_CASE_ID = '57e5f206-73d4-4d61-9ad7-05ed7d3b1f63';
const NO_PHONE_CASE_ID = '3b90431c-463a-4625-89a2-9b545bfccad7';
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
  if (process.env.SCHOOLOS_E2E_M1_REMINDER_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M1_REMINDER_FIXTURES=true to seed the dedicated M1 reminder fixtures.',
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
      `Seed the ${TENANT_SLUG} development tenant before the M1 reminder fixtures.`,
    );
  }

  const [academicYear, schoolClass, admin] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { tenantId: tenant.id, level: 5 },
      orderBy: { name: 'asc' },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@schoolos.com',
        },
      },
      select: { id: true },
    }),
  ]);

  if (!academicYear || !schoolClass || !admin) {
    throw new Error(
      'The M1 reminder fixtures require the current academic year, Class 5, and seeded school admin.',
    );
  }

  const nepalNow = new Date(Date.now() + NEPAL_OFFSET_MS);
  const openedAt = new Date(
    Date.UTC(
      nepalNow.getUTCFullYear(),
      nepalNow.getUTCMonth(),
      nepalNow.getUTCDate() - 8,
    ),
  );
  const fixtureMetadata = {
    documents: [],
    e2eFixture: 'm1-document-reminders',
  };

  await prisma.$transaction(async (tx) => {
    await tx.admissionPolicy.upsert({
      where: { id: POLICY_ID },
      update: {
        tenantId: tenant.id,
        name: 'M1 Reminder Browser Policy',
        slug: 'm1-reminder-browser-policy',
        status: AdmissionPolicyStatus.ACTIVE,
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
        name: 'M1 Reminder Browser Policy',
        slug: 'm1-reminder-browser-policy',
        status: AdmissionPolicyStatus.ACTIVE,
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
        requireDocumentReview: true,
        allowAdmissionWithDocumentsPending: true,
        activatedAt: openedAt,
        activatedById: admin.id,
      },
      create: {
        id: POLICY_VERSION_ID,
        tenantId: tenant.id,
        policyId: POLICY_ID,
        version: 1,
        status: AdmissionPolicyStatus.ACTIVE,
        admissionMode: 'REVIEW_REQUIRED',
        requireDocumentReview: true,
        allowAdmissionWithDocumentsPending: true,
        activatedAt: openedAt,
        activatedById: admin.id,
        createdById: admin.id,
      },
    });

    await tx.admissionPolicyDocumentRequirement.upsert({
      where: { id: DOCUMENT_REQUIREMENT_ID },
      update: {
        tenantId: tenant.id,
        policyVersionId: POLICY_VERSION_ID,
        documentKind: 'BIRTH_CERTIFICATE',
        label: 'Birth certificate',
        isRequired: true,
        timing: AdmissionDocumentTiming.BEFORE_REVIEW,
        requiresOriginalVerification: true,
        canBeWaived: false,
        waivableByRoleKeys: [],
        sortOrder: 1,
      },
      create: {
        id: DOCUMENT_REQUIREMENT_ID,
        tenantId: tenant.id,
        policyVersionId: POLICY_VERSION_ID,
        documentKind: 'BIRTH_CERTIFICATE',
        label: 'Birth certificate',
        isRequired: true,
        timing: AdmissionDocumentTiming.BEFORE_REVIEW,
        requiresOriginalVerification: true,
        canBeWaived: false,
        waivableByRoleKeys: [],
        sortOrder: 1,
      },
    });

    await tx.admissionPolicy.update({
      where: { id: POLICY_ID },
      data: { currentVersionId: POLICY_VERSION_ID },
    });

    const commonCase = {
      tenantId: tenant.id,
      status: 'WAITING_FOR_REVIEW',
      academicYearId: academicYear.id,
      classId: schoolClass.id,
      source: 'OFFICE_WALK_IN',
      policyVersionId: POLICY_VERSION_ID,
      duplicateReview: fixtureMetadata,
      createdById: admin.id,
      updatedById: admin.id,
      createdAt: openedAt,
      updatedAt: openedAt,
    };

    await tx.admissionApplication.upsert({
      where: { id: DELIVERABLE_CASE_ID },
      update: {
        ...commonCase,
        firstNameEn: 'Mira',
        lastNameEn: 'Adhikari',
        guardianFullName: 'Sarita Adhikari',
        guardianRelation: 'Mother',
        guardianPhone: '9800000000',
        guardianEmail: null,
        convertedStudentId: null,
      },
      create: {
        id: DELIVERABLE_CASE_ID,
        ...commonCase,
        firstNameEn: 'Mira',
        lastNameEn: 'Adhikari',
        guardianFullName: 'Sarita Adhikari',
        guardianRelation: 'Mother',
        guardianPhone: '9800000000',
      },
    });

    await tx.admissionApplication.upsert({
      where: { id: NO_PHONE_CASE_ID },
      update: {
        ...commonCase,
        firstNameEn: 'Nima',
        lastNameEn: 'Gurung',
        guardianFullName: 'Karma Gurung',
        guardianRelation: 'Father',
        guardianPhone: null,
        guardianEmail: null,
        convertedStudentId: null,
      },
      create: {
        id: NO_PHONE_CASE_ID,
        ...commonCase,
        firstNameEn: 'Nima',
        lastNameEn: 'Gurung',
        guardianFullName: 'Karma Gurung',
        guardianRelation: 'Father',
        guardianPhone: null,
      },
    });
  });

  const seededCases = await prisma.admissionApplication.findMany({
    where: {
      tenantId: tenant.id,
      id: { in: [DELIVERABLE_CASE_ID, NO_PHONE_CASE_ID] },
    },
    select: { id: true, updatedAt: true },
  });
  if (
    seededCases.length !== 2 ||
    seededCases.some(
      (admissionCase) =>
        admissionCase.updatedAt.getTime() !== openedAt.getTime(),
    )
  ) {
    throw new Error(
      'M1 reminder fixtures were not persisted with their stable school-day timestamp.',
    );
  }

  console.log('Seeded dedicated M1 reminder browser fixtures:');
  console.log('- Mira Adhikari (guardian phone; queue/idempotency path)');
  console.log('- Nima Gurung (no guardian phone; safe skip path)');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
