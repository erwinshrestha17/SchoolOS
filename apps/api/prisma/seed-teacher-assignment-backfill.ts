import { PrismaClient, TeacherAssignmentType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

/**
 * One-time (idempotent, safely re-runnable) backfill of the canonical
 * TeacherAssignment table from the two legacy sources this codebase already
 * had before the Teacher Persona security work:
 *
 *   - Section.classTeacherId          -> CLASS_TEACHER assignment
 *   - SubjectTeacherAssignment rows   -> SUBJECT_TEACHER assignment
 *
 * Legacy tables are left untouched; this only populates the new table so
 * TeacherScopeService has a single source to read from. Upserts are keyed on
 * the TeacherAssignment_scope_unique constraint, so re-running this script
 * after further legacy changes just refreshes existing rows rather than
 * duplicating them.
 *
 * P0-N3: an ACTIVE assignment must reference a live professional-eligibility
 * assessment (enforced by a database trigger). This backfill never creates or
 * infers eligibility: it attaches the teacher's most recent assessment only
 * when the database confirms it is live for that class/subject, and otherwise
 * skips the row and reports it as blocked until verified evidence exists.
 *
 * CLASS_TEACHER caveat: Section has no per-academic-year classTeacherId
 * history, so each backfilled row is scoped to the tenant's *current*
 * academic year. Tenants with no current academic year are skipped (logged),
 * not guessed.
 *
 * SUBJECT_TEACHER caveat: legacy SubjectTeacherAssignment.sectionId is
 * nullable (meaning "this subject teacher teaches every section of the
 * class"). The canonical model requires an explicit sectionId per the
 * Teacher Persona spec (4.5), so a null-section legacy row fans out into one
 * TeacherAssignment per section actually belonging to that class.
 */
async function liveAssessmentFor(input: {
  tenantId: string;
  staffId: string;
  classId: string;
  subjectId: string | null;
}): Promise<string | null> {
  const candidates = await prisma.teacherEligibilityAssessment.findMany({
    where: {
      tenantId: input.tenantId,
      staffId: input.staffId,
      outcome: 'ELIGIBLE',
    },
    orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
    take: 5,
  });
  for (const candidate of candidates) {
    const rows = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT schoolos_teacher_eligibility_live(
        ${input.tenantId}, ${input.staffId}, ${candidate.id}, now(),
        ${input.classId}, ${input.subjectId}
      ) AS allowed`;
    if (rows[0]?.allowed) return candidate.id;
  }
  return null;
}

async function main() {
  console.log('--- TeacherAssignment backfill: Starting ---');

  let classTeacherCount = 0;
  let subjectTeacherCount = 0;
  let skippedTenants = 0;
  let blockedPendingEligibility = 0;

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const { id: tenantId } of tenants) {
    const currentYear = await prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!currentYear) {
      skippedTenants += 1;
      continue;
    }

    const sectionsWithClassTeacher = await prisma.section.findMany({
      where: { tenantId, classTeacherId: { not: null } },
      select: { id: true, classId: true, classTeacherId: true },
    });

    for (const section of sectionsWithClassTeacher) {
      // Prisma's compound-unique `where` can't take an explicit null for a
      // nullable member field (subjectId/componentScope here), so this looks
      // up the existing row manually rather than using `upsert`.
      const existing = await prisma.teacherAssignment.findFirst({
        where: {
          tenantId,
          academicYearId: currentYear.id,
          staffId: section.classTeacherId!,
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: section.classId,
          sectionId: section.id,
          subjectId: null,
          componentScope: null,
        },
      });
      const eligibilityAssessmentId = await liveAssessmentFor({
        tenantId,
        staffId: section.classTeacherId!,
        classId: section.classId,
        subjectId: null,
      });
      if (!eligibilityAssessmentId) {
        blockedPendingEligibility += 1;
        continue;
      }
      if (existing) {
        await prisma.teacherAssignment.update({
          where: { id: existing.id },
          data: {
            effectiveFrom: currentYear.startsOn,
            effectiveUntil: currentYear.endsOn,
            status: 'ACTIVE',
            eligibilityAssessmentId,
          },
        });
      } else {
        await prisma.teacherAssignment.create({
          data: {
            tenantId,
            academicYearId: currentYear.id,
            staffId: section.classTeacherId!,
            assignmentType: TeacherAssignmentType.CLASS_TEACHER,
            classId: section.classId,
            sectionId: section.id,
            isPrimary: true,
            eligibilityAssessmentId,
            effectiveFrom: currentYear.startsOn,
            effectiveUntil: currentYear.endsOn,
          },
        });
      }
      classTeacherCount += 1;
    }

    const subjectAssignments = await prisma.subjectTeacherAssignment.findMany({
      where: { tenantId, academicYearId: currentYear.id },
    });

    for (const assignment of subjectAssignments) {
      const sectionIds = assignment.sectionId
        ? [assignment.sectionId]
        : (
            await prisma.section.findMany({
              where: { tenantId, classId: assignment.classId },
              select: { id: true },
            })
          ).map((s) => s.id);

      for (const sectionId of sectionIds) {
        const existing = await prisma.teacherAssignment.findFirst({
          where: {
            tenantId,
            academicYearId: currentYear.id,
            staffId: assignment.staffId,
            assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
            classId: assignment.classId,
            sectionId,
            subjectId: assignment.subjectId,
            componentScope: null,
          },
        });
        const eligibilityAssessmentId = await liveAssessmentFor({
          tenantId,
          staffId: assignment.staffId,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
        });
        if (!eligibilityAssessmentId) {
          blockedPendingEligibility += 1;
          continue;
        }
        if (existing) {
          await prisma.teacherAssignment.update({
            where: { id: existing.id },
            data: {
              effectiveFrom: currentYear.startsOn,
              effectiveUntil: currentYear.endsOn,
              status: 'ACTIVE',
              eligibilityAssessmentId,
            },
          });
        } else {
          await prisma.teacherAssignment.create({
            data: {
              tenantId,
              academicYearId: currentYear.id,
              staffId: assignment.staffId,
              assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
              classId: assignment.classId,
              sectionId,
              subjectId: assignment.subjectId,
              isPrimary: true,
              eligibilityAssessmentId,
              effectiveFrom: currentYear.startsOn,
              effectiveUntil: currentYear.endsOn,
            },
          });
        }
        subjectTeacherCount += 1;
      }
    }
  }

  console.log(`Class Teacher assignments backfilled: ${classTeacherCount}`);
  console.log(`Subject Teacher assignments backfilled: ${subjectTeacherCount}`);
  if (blockedPendingEligibility > 0) {
    console.log(
      `Blocked ${blockedPendingEligibility} assignment(s) pending verified professional eligibility (not activated).`,
    );
  }
  if (skippedTenants > 0) {
    console.log(
      `Skipped ${skippedTenants} tenant(s) with no current academic year.`,
    );
  }
  console.log('--- TeacherAssignment backfill: Complete ---');
}

main()
  .catch((error) => {
    console.error('❌ TeacherAssignment backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
