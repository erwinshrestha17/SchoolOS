import {
  PrismaClient,
  SchoolImprovementActionStatus,
  SchoolImprovementPlanStatus,
  StaffStatus,
  TeacherDevelopmentGoalStatus,
  TeacherObservationStatus,
  TeacherTrainingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const ids = {
  observation: 'e4a00000-0000-4000-8000-000000000001',
  goal: 'e4a00000-0000-4000-8000-000000000002',
  training: 'e4a00000-0000-4000-8000-000000000003',
  plan: 'e4a00000-0000-4000-8000-000000000004',
  kpi: 'e4a00000-0000-4000-8000-000000000005',
  action: 'e4a00000-0000-4000-8000-000000000006',
  review: 'e4a00000-0000-4000-8000-000000000007',
};
const requestIds = {
  observation: 'e4a00000-0000-4000-8000-000000000101',
  goal: 'e4a00000-0000-4000-8000-000000000102',
  training: 'e4a00000-0000-4000-8000-000000000103',
  plan: 'e4a00000-0000-4000-8000-000000000104',
  review: 'e4a00000-0000-4000-8000-000000000105',
};

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed Stage 4 fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_STAGE4_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_STAGE4_FIXTURES=true to seed the dedicated Stage 4 fixture.',
    );
  }
}

async function main() {
  assertFixtureAllowed();
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(`Seed the ${TENANT_SLUG} development tenant first.`);
  }
  const [academicYear, principal, teacher, mentor] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'principal@schoolos.com',
        },
      },
      select: { id: true },
    }),
    prisma.staff.findFirst({
      where: {
        tenantId: tenant.id,
        status: StaffStatus.ACTIVE,
      },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, userId: true },
    }),
    prisma.staff.findFirst({
      where: {
        tenantId: tenant.id,
        status: StaffStatus.ACTIVE,
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true },
    }),
  ]);
  if (!academicYear || !principal || !teacher?.userId || !mentor) {
    throw new Error(
      'The Stage 4 fixture requires a current academic year, seeded principal, and active staff records.',
    );
  }

  const tenantId = tenant.id;
  const actorUserId = principal.id;
  const teacherStaffId = teacher.id;
  const mentorStaffId = mentor.id;
  const fingerprint = 'stage4-deterministic-fixture';

  await prisma.$transaction(async (tx) => {
    await tx.teacherClassroomObservation.upsert({
      where: { id: ids.observation },
      update: {
        tenantId,
        teacherStaffId,
        observerUserId: actorUserId,
        academicYearId: academicYear.id,
        observedOn: new Date('2026-07-24T00:00:00.000Z'),
        strengths: 'Learners explained their reasoning and used peer examples.',
        developmentFocus:
          'Check every group before moving to independent practice.',
        agreedAction: 'Use two planned understanding checks in each lesson.',
        followUpOn: new Date('2026-08-07T00:00:00.000Z'),
        status: TeacherObservationStatus.FOLLOW_UP_DUE,
        version: 1,
        clientRequestId: requestIds.observation,
        requestFingerprint: fingerprint,
      },
      create: {
        id: ids.observation,
        tenantId,
        teacherStaffId,
        observerUserId: actorUserId,
        academicYearId: academicYear.id,
        observedOn: new Date('2026-07-24T00:00:00.000Z'),
        strengths: 'Learners explained their reasoning and used peer examples.',
        developmentFocus:
          'Check every group before moving to independent practice.',
        agreedAction: 'Use two planned understanding checks in each lesson.',
        followUpOn: new Date('2026-08-07T00:00:00.000Z'),
        status: TeacherObservationStatus.FOLLOW_UP_DUE,
        clientRequestId: requestIds.observation,
        requestFingerprint: fingerprint,
      },
    });

    await tx.teacherDevelopmentGoal.upsert({
      where: { id: ids.goal },
      update: {
        tenantId,
        teacherStaffId,
        mentorStaffId,
        academicYearId: academicYear.id,
        createdByUserId: actorUserId,
        title: 'Strengthen formative understanding checks',
        baseline: 'Checks are present but not yet consistent across groups.',
        target: 'Use two planned checks in every observed lesson.',
        actionPlan:
          'Plan with the mentor, trial two techniques, and review evidence monthly.',
        startsOn: new Date('2026-07-20T00:00:00.000Z'),
        dueOn: new Date('2026-09-30T00:00:00.000Z'),
        status: TeacherDevelopmentGoalStatus.ACTIVE,
        progressNote: 'First coaching conversation completed.',
        version: 1,
        clientRequestId: requestIds.goal,
        requestFingerprint: fingerprint,
      },
      create: {
        id: ids.goal,
        tenantId,
        teacherStaffId,
        mentorStaffId,
        academicYearId: academicYear.id,
        createdByUserId: actorUserId,
        title: 'Strengthen formative understanding checks',
        baseline: 'Checks are present but not yet consistent across groups.',
        target: 'Use two planned checks in every observed lesson.',
        actionPlan:
          'Plan with the mentor, trial two techniques, and review evidence monthly.',
        startsOn: new Date('2026-07-20T00:00:00.000Z'),
        dueOn: new Date('2026-09-30T00:00:00.000Z'),
        status: TeacherDevelopmentGoalStatus.ACTIVE,
        progressNote: 'First coaching conversation completed.',
        clientRequestId: requestIds.goal,
        requestFingerprint: fingerprint,
      },
    });

    await tx.teacherTrainingRecord.upsert({
      where: { id: ids.training },
      update: {
        tenantId,
        teacherStaffId,
        createdByUserId: actorUserId,
        title: 'Classroom formative assessment workshop',
        providerName: 'School professional learning team',
        startsOn: new Date('2026-07-15T00:00:00.000Z'),
        endsOn: new Date('2026-07-16T00:00:00.000Z'),
        status: TeacherTrainingStatus.COMPLETED,
        learningSummary:
          'Practised short, low-stakes checks and feedback routines.',
        clientRequestId: requestIds.training,
        requestFingerprint: fingerprint,
      },
      create: {
        id: ids.training,
        tenantId,
        teacherStaffId,
        createdByUserId: actorUserId,
        title: 'Classroom formative assessment workshop',
        providerName: 'School professional learning team',
        startsOn: new Date('2026-07-15T00:00:00.000Z'),
        endsOn: new Date('2026-07-16T00:00:00.000Z'),
        status: TeacherTrainingStatus.COMPLETED,
        learningSummary:
          'Practised short, low-stakes checks and feedback routines.',
        clientRequestId: requestIds.training,
        requestFingerprint: fingerprint,
      },
    });

    await tx.schoolImprovementPlan.upsert({
      where: { id: ids.plan },
      update: {
        tenantId,
        academicYearId: academicYear.id,
        createdByUserId: actorUserId,
        ownerUserId: actorUserId,
        title: 'Improve regular attendance follow-up',
        baselineSummary:
          'Monthly class-level attendance review is not yet consistent.',
        targetSummary:
          'Every class completes a documented monthly attendance review and follow-up.',
        startsOn: new Date('2026-07-01T00:00:00.000Z'),
        endsOn: new Date('2027-03-31T00:00:00.000Z'),
        status: SchoolImprovementPlanStatus.ACTIVE,
        version: 1,
        clientRequestId: requestIds.plan,
        requestFingerprint: fingerprint,
      },
      create: {
        id: ids.plan,
        tenantId,
        academicYearId: academicYear.id,
        createdByUserId: actorUserId,
        ownerUserId: actorUserId,
        title: 'Improve regular attendance follow-up',
        baselineSummary:
          'Monthly class-level attendance review is not yet consistent.',
        targetSummary:
          'Every class completes a documented monthly attendance review and follow-up.',
        startsOn: new Date('2026-07-01T00:00:00.000Z'),
        endsOn: new Date('2027-03-31T00:00:00.000Z'),
        status: SchoolImprovementPlanStatus.ACTIVE,
        clientRequestId: requestIds.plan,
        requestFingerprint: fingerprint,
      },
    });

    await tx.schoolImprovementKpi.upsert({
      where: { id: ids.kpi },
      update: {
        tenantId,
        planId: ids.plan,
        ownerUserId: actorUserId,
        name: 'Classes with a completed monthly review',
        unit: 'percent',
        baselineValue: 35,
        targetValue: 100,
        latestValue: 60,
        dueOn: new Date('2026-09-30T00:00:00.000Z'),
      },
      create: {
        id: ids.kpi,
        tenantId,
        planId: ids.plan,
        ownerUserId: actorUserId,
        name: 'Classes with a completed monthly review',
        unit: 'percent',
        baselineValue: 35,
        targetValue: 100,
        latestValue: 60,
        dueOn: new Date('2026-09-30T00:00:00.000Z'),
      },
    });

    await tx.schoolImprovementAction.upsert({
      where: { id: ids.action },
      update: {
        tenantId,
        planId: ids.plan,
        ownerUserId: actorUserId,
        title: 'Complete class-level attendance review',
        details:
          'Review attendance patterns with class teachers and record agreed follow-up.',
        dueOn: new Date('2026-08-31T00:00:00.000Z'),
        status: SchoolImprovementActionStatus.IN_PROGRESS,
        progressNote: 'Review template agreed with class teachers.',
        version: 1,
      },
      create: {
        id: ids.action,
        tenantId,
        planId: ids.plan,
        ownerUserId: actorUserId,
        title: 'Complete class-level attendance review',
        details:
          'Review attendance patterns with class teachers and record agreed follow-up.',
        dueOn: new Date('2026-08-31T00:00:00.000Z'),
        status: SchoolImprovementActionStatus.IN_PROGRESS,
        progressNote: 'Review template agreed with class teachers.',
      },
    });

    await tx.schoolImprovementReview.upsert({
      where: { id: ids.review },
      update: {
        tenantId,
        planId: ids.plan,
        reviewedByUserId: actorUserId,
        reviewedOn: new Date('2026-07-28T00:00:00.000Z'),
        summary:
          'The review template is in use and most class teachers have submitted the first check.',
        nextActions:
          'Follow up with remaining class teachers before the August review.',
        kpiSnapshot: [{ kpiId: ids.kpi, value: 60 }],
        clientRequestId: requestIds.review,
        requestFingerprint: fingerprint,
      },
      create: {
        id: ids.review,
        tenantId,
        planId: ids.plan,
        reviewedByUserId: actorUserId,
        reviewedOn: new Date('2026-07-28T00:00:00.000Z'),
        summary:
          'The review template is in use and most class teachers have submitted the first check.',
        nextActions:
          'Follow up with remaining class teachers before the August review.',
        kpiSnapshot: [{ kpiId: ids.kpi, value: 60 }],
        clientRequestId: requestIds.review,
        requestFingerprint: fingerprint,
      },
    });
  });

  console.log(
    `Seeded Stage 4 institutional-improvement fixtures for tenant ${tenantId}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
