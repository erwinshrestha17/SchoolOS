import {
  CurriculumProgressStatus,
  FormativeAssessmentKind,
  LearningMasteryStatus,
  LearningOutcomeDomain,
  ParentLearningGuidanceStatus,
  PrismaClient,
  RemedialGroupStatus,
  StudentInterventionEntryType,
  StudentInterventionPriority,
  StudentInterventionStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
// Class 1 Section A student already linked to guardian.c01a002@schoolos.test.
const STUDENT_ID = 'b464b734-550e-4cdd-8a77-9f60fda31109';
const SUBJECT_ID = 'b2b241c1-8a4e-41d5-959d-ac4466db0654';

const ids = {
  outcome: 'e3a00000-0000-4000-8000-000000000001',
  assessmentOne: 'e3a00000-0000-4000-8000-000000000002',
  assessmentTwo: 'e3a00000-0000-4000-8000-000000000003',
  assessmentThree: 'e3a00000-0000-4000-8000-000000000004',
  intervention: 'e3a00000-0000-4000-8000-000000000005',
  interventionEntry: 'e3a00000-0000-4000-8000-000000000006',
  remedialGroup: 'e3a00000-0000-4000-8000-000000000007',
  remedialMember: 'e3a00000-0000-4000-8000-000000000008',
  curriculum: 'e3a00000-0000-4000-8000-000000000009',
  guidance: 'e3a00000-0000-4000-8000-000000000010',
};

const requestIds = {
  intervention: 'e3a00000-0000-4000-8000-000000000101',
  interventionEntry: 'e3a00000-0000-4000-8000-000000000102',
  remedial: 'e3a00000-0000-4000-8000-000000000103',
  curriculum: 'e3a00000-0000-4000-8000-000000000104',
  guidance: 'e3a00000-0000-4000-8000-000000000105',
};

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed Stage 3 fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_STAGE3_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_STAGE3_FIXTURES=true to seed the dedicated Stage 3 fixture.',
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

  const [academicYear, student, subject, admin] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.student.findUnique({
      where: { id: STUDENT_ID },
      select: {
        id: true,
        tenantId: true,
        classId: true,
        sectionId: true,
        class: { select: { level: true } },
        sectionRef: {
          select: {
            classTeacher: { select: { id: true, userId: true } },
          },
        },
      },
    }),
    prisma.subject.findUnique({
      where: { id: SUBJECT_ID },
      select: { id: true, tenantId: true, classId: true },
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

  if (
    !academicYear ||
    !admin ||
    student?.tenantId !== tenant.id ||
    student.class.level < 1 ||
    student.class.level > 3 ||
    !student.sectionId ||
    subject?.tenantId !== tenant.id ||
    subject.classId !== student.classId
  ) {
    throw new Error(
      'The Stage 3 fixture requires the current academic year, seeded admin, and the linked Class 1 student/subject fixture.',
    );
  }

  const teacher =
    student.sectionRef?.classTeacher ??
    (
      await prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          classId: student.classId,
          subjectId: subject.id,
          sectionId: student.sectionId,
        },
        select: { staff: { select: { id: true, userId: true } } },
      })
    )?.staff;
  if (!teacher) {
    throw new Error(
      'The Stage 3 fixture requires an assigned Class 1 teacher.',
    );
  }

  const tenantId = tenant.id;
  const academicYearId = academicYear.id;
  const classId = student.classId;
  const sectionId = student.sectionId;
  const teacherStaffId = teacher.id;
  const teacherUserId = teacher.userId;

  await prisma.$transaction(async (tx) => {
    await tx.learningOutcome.upsert({
      where: { id: ids.outcome },
      update: {
        tenantId,
        academicYearId,
        classId,
        subjectId: subject.id,
        code: 'STAGE3-NUM-01',
        title: 'Uses number bonds within ten',
        description:
          'Recognises and explains pairs of numbers that combine to make ten.',
        domain: LearningOutcomeDomain.FOUNDATIONAL_NUMERACY,
        isActive: true,
      },
      create: {
        id: ids.outcome,
        tenantId,
        academicYearId,
        classId,
        subjectId: subject.id,
        code: 'STAGE3-NUM-01',
        title: 'Uses number bonds within ten',
        description:
          'Recognises and explains pairs of numbers that combine to make ten.',
        domain: LearningOutcomeDomain.FOUNDATIONAL_NUMERACY,
        isActive: true,
      },
    });

    const assessments = [
      {
        id: ids.assessmentOne,
        assessedOn: new Date('2026-07-21T00:00:00.000Z'),
        masteryStatus: LearningMasteryStatus.BEGINNING,
        parentSummary:
          'We are practising number pairs with counters and pictures.',
        clientSubmissionId: 'e3a00000-0000-4000-8000-000000000201',
        reassessmentOfId: null,
      },
      {
        id: ids.assessmentTwo,
        assessedOn: new Date('2026-07-23T00:00:00.000Z'),
        masteryStatus: LearningMasteryStatus.BEGINNING,
        parentSummary:
          'Short guided practice is helping build confidence with number pairs.',
        clientSubmissionId: 'e3a00000-0000-4000-8000-000000000202',
        reassessmentOfId: ids.assessmentOne,
      },
      {
        id: ids.assessmentThree,
        assessedOn: new Date('2026-07-25T00:00:00.000Z'),
        masteryStatus: LearningMasteryStatus.DEVELOPING,
        parentSummary:
          'The student now identifies several number pairs with a prompt.',
        clientSubmissionId: 'e3a00000-0000-4000-8000-000000000203',
        reassessmentOfId: ids.assessmentTwo,
      },
    ];
    for (const assessment of assessments) {
      await tx.formativeAssessmentEvidence.upsert({
        where: { id: assessment.id },
        update: {
          tenantId,
          outcomeId: ids.outcome,
          studentId: student.id,
          academicYearId,
          classId,
          sectionId,
          subjectId: subject.id,
          teacherStaffId,
          kind: FormativeAssessmentKind.OBSERVATION,
          masteryStatus: assessment.masteryStatus,
          assessedOn: assessment.assessedOn,
          note: 'Stage 3 deterministic classroom observation fixture.',
          parentSummary: assessment.parentSummary,
          reassessmentOfId: assessment.reassessmentOfId,
          clientSubmissionId: assessment.clientSubmissionId,
          requestFingerprint: null,
        },
        create: {
          id: assessment.id,
          tenantId,
          outcomeId: ids.outcome,
          studentId: student.id,
          academicYearId,
          classId,
          sectionId,
          subjectId: subject.id,
          teacherStaffId,
          kind: FormativeAssessmentKind.OBSERVATION,
          masteryStatus: assessment.masteryStatus,
          assessedOn: assessment.assessedOn,
          note: 'Stage 3 deterministic classroom observation fixture.',
          parentSummary: assessment.parentSummary,
          reassessmentOfId: assessment.reassessmentOfId,
          clientSubmissionId: assessment.clientSubmissionId,
        },
      });
    }

    await tx.studentInterventionCase.upsert({
      where: { id: ids.intervention },
      update: {
        tenantId,
        studentId: student.id,
        academicYearId,
        classId,
        sectionId,
        ownerStaffId: teacherStaffId,
        sourceSignalKey: `${student.id}:stage3-v1`,
        priority: StudentInterventionPriority.ROUTINE,
        status: StudentInterventionStatus.MONITORING,
        title: 'Number-pair confidence plan',
        concernSummary:
          'Two recent classroom observations showed that number bonds still need guided practice.',
        parentVisibleSummary:
          'The school is providing short number-pair practice and will share progress.',
        nextFollowUpOn: new Date('2026-07-30T00:00:00.000Z'),
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.intervention,
        requestFingerprint: null,
        version: 1,
      },
      create: {
        id: ids.intervention,
        tenantId,
        studentId: student.id,
        academicYearId,
        classId,
        sectionId,
        ownerStaffId: teacherStaffId,
        sourceSignalKey: `${student.id}:stage3-v1`,
        priority: StudentInterventionPriority.ROUTINE,
        status: StudentInterventionStatus.MONITORING,
        title: 'Number-pair confidence plan',
        concernSummary:
          'Two recent classroom observations showed that number bonds still need guided practice.',
        parentVisibleSummary:
          'The school is providing short number-pair practice and will share progress.',
        nextFollowUpOn: new Date('2026-07-30T00:00:00.000Z'),
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.intervention,
      },
    });

    await tx.studentInterventionEntry.upsert({
      where: { id: ids.interventionEntry },
      update: {
        tenantId,
        caseId: ids.intervention,
        entryType: StudentInterventionEntryType.PROGRESS,
        body: 'Used counters in a five-minute small-group check; the student identified three number pairs with one prompt.',
        parentVisible: true,
        nextFollowUpOn: new Date('2026-07-30T00:00:00.000Z'),
        actorUserId: teacherUserId,
        clientRequestId: requestIds.interventionEntry,
        requestFingerprint: null,
      },
      create: {
        id: ids.interventionEntry,
        tenantId,
        caseId: ids.intervention,
        entryType: StudentInterventionEntryType.PROGRESS,
        body: 'Used counters in a five-minute small-group check; the student identified three number pairs with one prompt.',
        parentVisible: true,
        nextFollowUpOn: new Date('2026-07-30T00:00:00.000Z'),
        actorUserId: teacherUserId,
        clientRequestId: requestIds.interventionEntry,
      },
    });

    await tx.remedialGroup.upsert({
      where: { id: ids.remedialGroup },
      update: {
        tenantId,
        academicYearId,
        classId,
        sectionId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        teacherStaffId,
        name: 'Number Pairs Practice',
        purpose:
          'Build confidence with number bonds through short, concrete practice.',
        status: RemedialGroupStatus.ACTIVE,
        startsOn: new Date('2026-07-22T00:00:00.000Z'),
        endsOn: new Date('2026-08-05T00:00:00.000Z'),
        scheduleNote: 'Tuesday and Thursday after the first break.',
        parentSummary:
          'A short small-group practice supports number-pair confidence.',
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.remedial,
        requestFingerprint: null,
      },
      create: {
        id: ids.remedialGroup,
        tenantId,
        academicYearId,
        classId,
        sectionId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        teacherStaffId,
        name: 'Number Pairs Practice',
        purpose:
          'Build confidence with number bonds through short, concrete practice.',
        status: RemedialGroupStatus.ACTIVE,
        startsOn: new Date('2026-07-22T00:00:00.000Z'),
        endsOn: new Date('2026-08-05T00:00:00.000Z'),
        scheduleNote: 'Tuesday and Thursday after the first break.',
        parentSummary:
          'A short small-group practice supports number-pair confidence.',
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.remedial,
      },
    });

    await tx.remedialGroupMember.upsert({
      where: { id: ids.remedialMember },
      update: {
        tenantId,
        groupId: ids.remedialGroup,
        studentId: student.id,
        isActive: true,
        leftAt: null,
        addedByUserId: teacherUserId,
      },
      create: {
        id: ids.remedialMember,
        tenantId,
        groupId: ids.remedialGroup,
        studentId: student.id,
        isActive: true,
        addedByUserId: teacherUserId,
      },
    });

    await tx.curriculumProgressItem.upsert({
      where: { id: ids.curriculum },
      update: {
        tenantId,
        academicYearId,
        classId,
        sectionId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        teacherStaffId,
        title: 'Number bonds within ten',
        status: CurriculumProgressStatus.RETEACH_REQUIRED,
        plannedOn: new Date('2026-07-20T00:00:00.000Z'),
        completedOn: new Date('2026-07-22T00:00:00.000Z'),
        reteachPlan:
          'Repeat with counters and pair cards before independent practice.',
        resourceUrl: 'https://example.edu.np/resources/number-pairs',
        note: 'Stage 3 deterministic curriculum progress fixture.',
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.curriculum,
        requestFingerprint: null,
      },
      create: {
        id: ids.curriculum,
        tenantId,
        academicYearId,
        classId,
        sectionId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        teacherStaffId,
        title: 'Number bonds within ten',
        status: CurriculumProgressStatus.RETEACH_REQUIRED,
        plannedOn: new Date('2026-07-20T00:00:00.000Z'),
        completedOn: new Date('2026-07-22T00:00:00.000Z'),
        reteachPlan:
          'Repeat with counters and pair cards before independent practice.',
        resourceUrl: 'https://example.edu.np/resources/number-pairs',
        note: 'Stage 3 deterministic curriculum progress fixture.',
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.curriculum,
      },
    });

    await tx.parentLearningGuidance.upsert({
      where: { id: ids.guidance },
      update: {
        tenantId,
        studentId: student.id,
        academicYearId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        remedialGroupId: ids.remedialGroup,
        teacherStaffId,
        title: 'Make ten with household objects',
        skillExplanation:
          'Finding different pairs that make ten helps build flexible number sense.',
        homeActivity:
          'Place ten buttons or beans on a plate. Hide some under a cup and ask how many are hidden. Keep it playful and stop after five minutes.',
        status: ParentLearningGuidanceStatus.PUBLISHED,
        visibleFrom: new Date('2026-07-22T00:00:00.000Z'),
        visibleUntil: new Date('2026-08-10T00:00:00.000Z'),
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.guidance,
        requestFingerprint: null,
        publishedAt: new Date('2026-07-22T08:00:00.000Z'),
      },
      create: {
        id: ids.guidance,
        tenantId,
        studentId: student.id,
        academicYearId,
        subjectId: subject.id,
        outcomeId: ids.outcome,
        remedialGroupId: ids.remedialGroup,
        teacherStaffId,
        title: 'Make ten with household objects',
        skillExplanation:
          'Finding different pairs that make ten helps build flexible number sense.',
        homeActivity:
          'Place ten buttons or beans on a plate. Hide some under a cup and ask how many are hidden. Keep it playful and stop after five minutes.',
        status: ParentLearningGuidanceStatus.PUBLISHED,
        visibleFrom: new Date('2026-07-22T00:00:00.000Z'),
        visibleUntil: new Date('2026-08-10T00:00:00.000Z'),
        createdByUserId: teacherUserId,
        clientRequestId: requestIds.guidance,
        publishedAt: new Date('2026-07-22T08:00:00.000Z'),
      },
    });
  });

  console.log('Stage 3 learning-improvement fixture is ready.');
  console.log(`- Tenant: ${TENANT_SLUG}`);
  console.log(`- Student: ${student.id}`);
  console.log(`- Academic year: ${academicYearId}`);
  console.log(`- Class / section: ${classId} / ${sectionId}`);
  console.log(`- Subject: ${subject.id}`);
  console.log(`- Teacher staff / user: ${teacherStaffId} / ${teacherUserId}`);
  console.log(`- Outcome: ${ids.outcome}`);
  console.log(`- Intervention: ${ids.intervention}`);
  console.log(`- Remedial group: ${ids.remedialGroup}`);
  console.log(`- Curriculum item: ${ids.curriculum}`);
  console.log(`- Published guidance: ${ids.guidance}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
