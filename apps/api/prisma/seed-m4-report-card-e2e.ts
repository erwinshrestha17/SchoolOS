import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
// Dilip Gautam, Class 1 Section A — already linked to guardian.c01a002@schoolos.test.
const STUDENT_ID = 'b464b734-550e-4cdd-8a77-9f60fda31109';
const CLASS_ID = 'cbf6af3f-bc7c-4798-91d2-817bcd3d5475';
const SUBJECT_ID = 'b2b241c1-8a4e-41d5-959d-ac4466db0654';

const PUBLISHED_EXAM_TERM_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a01';
const PUBLISHED_COMPONENT_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a02';
const PUBLISHED_MARK_ENTRY_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a03';
const PUBLISHED_REPORT_CARD_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a04';
const PUBLISHED_SUBJECT_RESULT_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a05';

const DRAFT_EXAM_TERM_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b01';
const DRAFT_COMPONENT_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b02';
const DRAFT_MARK_ENTRY_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b03';
const DRAFT_REPORT_CARD_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b04';
const DRAFT_SUBJECT_RESULT_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b05';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M4 browser fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true to seed the dedicated M4 report card fixture.',
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
      `Seed the ${TENANT_SLUG} development tenant before the M4 report card fixture.`,
    );
  }

  const [academicYear, admin, student] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: 'admin@schoolos.com' },
      },
      select: { id: true },
    }),
    prisma.student.findUnique({
      where: { id: STUDENT_ID },
      select: { id: true, tenantId: true, classId: true },
    }),
  ]);

  if (!academicYear || !admin || student?.tenantId !== tenant.id) {
    throw new Error(
      'The M4 report card fixture requires the current academic year, seeded admin, and the dedicated Class 1 Section A student.',
    );
  }

  // Extracted as primitives so TypeScript keeps them narrowed as non-null
  // inside the nested closure below (narrowing doesn't cross function
  // boundaries for the captured object references).
  const tenantId = tenant.id;
  const academicYearId = academicYear.id;
  const adminId = admin.id;

  async function seedTermWithReportCard(config: {
    examTermId: string;
    componentId: string;
    markEntryId: string;
    reportCardId: string;
    subjectResultId: string;
    name: string;
    marksObtained: number;
    publishStatus: 'PUBLISHED' | 'UNPUBLISHED';
  }) {
    await prisma.$transaction(async (tx) => {
      await tx.examTerm.upsert({
        where: { id: config.examTermId },
        update: {
          tenantId: tenantId,
          academicYearId: academicYearId,
          name: config.name,
          startsOn: new Date('2026-04-01T00:00:00.000Z'),
          endsOn: new Date('2026-04-30T00:00:00.000Z'),
          isLocked: true,
        },
        create: {
          id: config.examTermId,
          tenantId: tenantId,
          academicYearId: academicYearId,
          name: config.name,
          startsOn: new Date('2026-04-01T00:00:00.000Z'),
          endsOn: new Date('2026-04-30T00:00:00.000Z'),
          isLocked: true,
        },
      });

      await tx.assessmentComponent.upsert({
        where: { id: config.componentId },
        update: {
          tenantId: tenantId,
          examTermId: config.examTermId,
          subjectId: SUBJECT_ID,
          name: 'Theory',
          type: 'TERMINAL',
          maxMarks: 100,
          passMarks: 40,
        },
        create: {
          id: config.componentId,
          tenantId: tenantId,
          examTermId: config.examTermId,
          subjectId: SUBJECT_ID,
          name: 'Theory',
          type: 'TERMINAL',
          maxMarks: 100,
          passMarks: 40,
        },
      });

      await tx.markEntry.upsert({
        where: { id: config.markEntryId },
        update: {
          tenantId: tenantId,
          examTermId: config.examTermId,
          assessmentComponentId: config.componentId,
          subjectId: SUBJECT_ID,
          studentId: STUDENT_ID,
          enteredById: adminId,
          marksObtained: config.marksObtained,
          status: 'SUBMITTED',
          isLocked: true,
        },
        create: {
          id: config.markEntryId,
          tenantId: tenantId,
          examTermId: config.examTermId,
          assessmentComponentId: config.componentId,
          subjectId: SUBJECT_ID,
          studentId: STUDENT_ID,
          enteredById: adminId,
          marksObtained: config.marksObtained,
          status: 'SUBMITTED',
          isLocked: true,
        },
      });

      const percentage = config.marksObtained;
      const grade = percentage >= 80 ? 'A' : percentage >= 60 ? 'B' : 'C';
      const gpa = percentage >= 80 ? 3.6 : percentage >= 60 ? 3.0 : 2.4;

      await tx.reportCard.upsert({
        where: { id: config.reportCardId },
        update: {
          tenantId: tenantId,
          academicYearId: academicYearId,
          examTermId: config.examTermId,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          totalMarks: config.marksObtained,
          maxMarks: 100,
          percentage,
          grade,
          gpa,
          remarks: 'Dedicated M4 report card browser fixture.',
          status: 'LOCKED',
          lockedAt: new Date(),
          publishStatus: config.publishStatus,
          publishedAt: config.publishStatus === 'PUBLISHED' ? new Date() : null,
          publishedById: config.publishStatus === 'PUBLISHED' ? adminId : null,
          unpublishedAt: null,
          isCurrent: true,
          version: 1,
        },
        create: {
          id: config.reportCardId,
          tenantId: tenantId,
          academicYearId: academicYearId,
          examTermId: config.examTermId,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          totalMarks: config.marksObtained,
          maxMarks: 100,
          percentage,
          grade,
          gpa,
          remarks: 'Dedicated M4 report card browser fixture.',
          status: 'LOCKED',
          lockedAt: new Date(),
          publishStatus: config.publishStatus,
          publishedAt: config.publishStatus === 'PUBLISHED' ? new Date() : null,
          publishedById: config.publishStatus === 'PUBLISHED' ? adminId : null,
          isCurrent: true,
          version: 1,
        },
      });

      await tx.reportCardSubjectResult.upsert({
        where: { id: config.subjectResultId },
        update: {
          tenantId: tenantId,
          reportCardId: config.reportCardId,
          version: 1,
          subjectId: SUBJECT_ID,
          subjectName: 'Mathematics',
          subjectCode: 'C01-MATH',
          marksObtained: config.marksObtained,
          maxMarks: 100,
          percentage,
          grade,
          gpa,
          resultStatus: 'PASS',
        },
        create: {
          id: config.subjectResultId,
          tenantId: tenantId,
          reportCardId: config.reportCardId,
          version: 1,
          subjectId: SUBJECT_ID,
          subjectName: 'Mathematics',
          subjectCode: 'C01-MATH',
          marksObtained: config.marksObtained,
          maxMarks: 100,
          percentage,
          grade,
          gpa,
          resultStatus: 'PASS',
        },
      });
    });
  }

  await seedTermWithReportCard({
    examTermId: PUBLISHED_EXAM_TERM_ID,
    componentId: PUBLISHED_COMPONENT_ID,
    markEntryId: PUBLISHED_MARK_ENTRY_ID,
    reportCardId: PUBLISHED_REPORT_CARD_ID,
    subjectResultId: PUBLISHED_SUBJECT_RESULT_ID,
    name: 'M4 E2E Published Term',
    marksObtained: 85,
    publishStatus: 'PUBLISHED',
  });

  await seedTermWithReportCard({
    examTermId: DRAFT_EXAM_TERM_ID,
    componentId: DRAFT_COMPONENT_ID,
    markEntryId: DRAFT_MARK_ENTRY_ID,
    reportCardId: DRAFT_REPORT_CARD_ID,
    subjectResultId: DRAFT_SUBJECT_RESULT_ID,
    name: 'M4 E2E Unpublished Term',
    marksObtained: 60,
    publishStatus: 'UNPUBLISHED',
  });

  const published = await prisma.reportCard.findFirst({
    where: {
      id: PUBLISHED_REPORT_CARD_ID,
      tenantId: tenant.id,
      publishStatus: 'PUBLISHED',
    },
    select: { id: true },
  });
  const draft = await prisma.reportCard.findFirst({
    where: {
      id: DRAFT_REPORT_CARD_ID,
      tenantId: tenant.id,
      publishStatus: 'UNPUBLISHED',
    },
    select: { id: true },
  });
  if (!published || !draft) {
    throw new Error(
      'The M4 report card fixture was not restored to its published/unpublished pair.',
    );
  }

  console.log('Seeded dedicated M4 report card browser fixture:');
  console.log(
    '- Dilip Gautam (Class 1 Section A): 1 published report card, 1 unpublished report card',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
