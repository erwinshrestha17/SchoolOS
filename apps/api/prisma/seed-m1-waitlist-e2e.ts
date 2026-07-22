import {
  AdmissionPolicyApplicantType,
  AdmissionPolicyStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const SECTION_ID = '00a94f9d-a117-4053-91f6-42f756da91cc';
const POLICY_ID = '4c293df1-d314-445f-a009-e745c2138aeb';
const POLICY_VERSION_ID = 'ee081d6f-80a4-4c3c-99d1-88265f35c5a9';
const WAITLIST_CASE_ID = 'ee8ab8d8-ea8b-47f1-a8b5-03d18b5a1709';
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
  if (process.env.SCHOOLOS_E2E_M1_WAITLIST_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M1_WAITLIST_FIXTURES=true to seed the dedicated M1 waitlist fixture.',
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
      `Seed the ${TENANT_SLUG} development tenant before the M1 waitlist fixture.`,
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
      'The M1 waitlist fixture requires the current academic year, Class 5, and seeded school admin.',
    );
  }

  const nepalNow = new Date(Date.now() + NEPAL_OFFSET_MS);
  const appliedAt = new Date(
    Date.UTC(
      nepalNow.getUTCFullYear(),
      nepalNow.getUTCMonth(),
      nepalNow.getUTCDate() - 6,
    ),
  );

  await prisma.$transaction(async (tx) => {
    await tx.section.upsert({
      where: { id: SECTION_ID },
      update: {
        tenantId: tenant.id,
        classId: schoolClass.id,
        name: 'Annapurna E2E',
        capacity: 5,
      },
      create: {
        id: SECTION_ID,
        tenantId: tenant.id,
        classId: schoolClass.id,
        name: 'Annapurna E2E',
        capacity: 5,
      },
    });

    await tx.admissionPolicy.upsert({
      where: { id: POLICY_ID },
      update: {
        tenantId: tenant.id,
        name: 'M1 Waitlist Browser Policy',
        slug: 'm1-waitlist-browser-policy',
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
        name: 'M1 Waitlist Browser Policy',
        slug: 'm1-waitlist-browser-policy',
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
        requireSection: true,
        requireDocumentReview: false,
        requireInterview: false,
        requirePrincipalApproval: false,
        requireTransferCertificate: false,
        requirePriorMarksheet: false,
        requireStreamOrMarksReview: false,
        allowAdmissionWithDocumentsPending: true,
        enforceCapacityWhenAvailable: true,
        capacityOverride: 5,
        approvalPolicyId: null,
        activatedAt: appliedAt,
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
        requireSection: true,
        requireDocumentReview: false,
        requireInterview: false,
        requirePrincipalApproval: false,
        requireTransferCertificate: false,
        requirePriorMarksheet: false,
        requireStreamOrMarksReview: false,
        allowAdmissionWithDocumentsPending: true,
        enforceCapacityWhenAvailable: true,
        capacityOverride: 5,
        activatedAt: appliedAt,
        activatedById: admin.id,
        createdById: admin.id,
      },
    });

    await tx.admissionPolicy.update({
      where: { id: POLICY_ID },
      data: { currentVersionId: POLICY_VERSION_ID },
    });

    await tx.admissionApplication.upsert({
      where: { id: WAITLIST_CASE_ID },
      update: {
        tenantId: tenant.id,
        status: 'WAITLISTED',
        firstNameEn: 'Aarushi',
        lastNameEn: 'Karki',
        guardianFullName: 'Sunita Karki',
        guardianRelation: 'Mother',
        guardianPhone: null,
        guardianEmail: null,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        sectionId: SECTION_ID,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason: 'Dedicated M1 waitlist browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-waitlist-promotion' },
        convertedStudentId: null,
        rejectedReason: null,
        updatedById: admin.id,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      },
      create: {
        id: WAITLIST_CASE_ID,
        tenantId: tenant.id,
        status: 'WAITLISTED',
        firstNameEn: 'Aarushi',
        lastNameEn: 'Karki',
        guardianFullName: 'Sunita Karki',
        guardianRelation: 'Mother',
        guardianPhone: null,
        academicYearId: academicYear.id,
        classId: schoolClass.id,
        sectionId: SECTION_ID,
        source: 'OFFICE_WALK_IN',
        policyVersionId: POLICY_VERSION_ID,
        policyResolutionReason: 'Dedicated M1 waitlist browser fixture policy.',
        duplicateReview: { e2eFixture: 'm1-waitlist-promotion' },
        createdById: admin.id,
        updatedById: admin.id,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      },
    });
  });

  const seededCase = await prisma.admissionApplication.findFirst({
    where: {
      id: WAITLIST_CASE_ID,
      tenantId: tenant.id,
      status: 'WAITLISTED',
      sectionId: SECTION_ID,
      policyVersionId: POLICY_VERSION_ID,
    },
    select: { id: true, updatedAt: true },
  });
  if (seededCase?.updatedAt.getTime() !== appliedAt.getTime()) {
    throw new Error(
      'The M1 waitlist fixture was not restored to its stable waitlisted state.',
    );
  }

  console.log('Seeded dedicated M1 waitlist browser fixture:');
  console.log('- Aarushi Karki (available-seat promotion path)');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
