import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const TEACHER_EMAIL = 'classteacher.1a@schoolos.com';
const EXAM_TERM_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4c01';
const COMPONENT_ID = 'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4c02';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M4 marks fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M4_MARKS_MUTATIONS !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M4_MARKS_MUTATIONS=true to seed the dedicated M4 marks fixture.',
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
    throw new Error(`Seed the ${TENANT_SLUG} development tenant first.`);
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    orderBy: { startsOn: 'desc' },
    select: { id: true, startsOn: true, endsOn: true },
  });
  if (!academicYear) {
    throw new Error('The M4 marks fixture requires a current academic year.');
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      tenantId: tenant.id,
      academicYearId: academicYear.id,
      status: 'ACTIVE',
      assignmentType: 'SUBJECT_TEACHER',
      subjectId: { not: null },
      staff: { user: { email: TEACHER_EMAIL } },
      class: { name: 'Class 1' },
      subject: { name: { startsWith: 'Mathematics' } },
    },
    select: { subjectId: true },
  });
  if (!assignment?.subjectId) {
    throw new Error(
      `Run db:seed:teacher-scenarios before the M4 fixture; ${TEACHER_EMAIL} needs the Class 1 Mathematics assignment.`,
    );
  }
  const marksSubjectId = assignment.subjectId;

  await prisma.$transaction(async (tx) => {
    await tx.examTerm.upsert({
      where: { id: EXAM_TERM_ID },
      update: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        name: 'M4 E2E Marks Entry Term',
        startsOn: academicYear.startsOn,
        endsOn: academicYear.endsOn,
        weightPercent: 100,
        status: 'ACTIVE',
        isLocked: false,
      },
      create: {
        id: EXAM_TERM_ID,
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        name: 'M4 E2E Marks Entry Term',
        startsOn: academicYear.startsOn,
        endsOn: academicYear.endsOn,
        weightPercent: 100,
        status: 'ACTIVE',
        isLocked: false,
      },
    });

    await tx.assessmentComponent.upsert({
      where: { id: COMPONENT_ID },
      update: {
        tenantId: tenant.id,
        examTermId: EXAM_TERM_ID,
        subjectId: marksSubjectId,
        name: 'Theory',
        type: 'TERMINAL',
        maxMarks: 100,
        passMarks: 40,
        weightPercent: 100,
      },
      create: {
        id: COMPONENT_ID,
        tenantId: tenant.id,
        examTermId: EXAM_TERM_ID,
        subjectId: marksSubjectId,
        name: 'Theory',
        type: 'TERMINAL',
        maxMarks: 100,
        passMarks: 40,
        weightPercent: 100,
      },
    });
  });

  console.log(
    `Seeded unlocked M4 marks-entry fixture for ${TEACHER_EMAIL}.`,
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
