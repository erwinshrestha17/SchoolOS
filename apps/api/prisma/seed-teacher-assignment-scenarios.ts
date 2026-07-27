import {
  PrismaClient,
  TeacherAssignmentType,
  TeacherDelegationStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

/**
 * Canonical teacher-assignment scenarios for the development tenant.
 *
 * The backfill (seed-teacher-assignment-backfill.ts) faithfully reproduces
 * whatever the legacy tables held, and in the demo tenant that produced 24
 * Class Teacher rows and 192 Subject Teacher rows but *zero* teachers holding
 * both for the same section. That combination is the whole point of the
 * assignment model -- the union case where a teacher writes their own
 * subject, reads every other subject in their homeroom, and writes homeroom
 * records -- so it needs to exist in seed data or nobody can exercise it.
 *
 * This script builds the three reference teachers from the spec:
 *
 *   Teacher A  Class Teacher  — Class 1/A
 *              Mathematics    — Class 1/A     (combined case)
 *              Mathematics    — Class 2/A     (same subject, another class)
 *              Science        — Class 3/B     (another subject, another class)
 *   Teacher B  English        — Class 1/A     (co-teacher in A's homeroom:
 *              English        — Class 2/A      proves A can read but not edit)
 *   Teacher C  Science        — Class 1/A
 *              Mathematics    — Class 2/A     as a TEMPORARY substitution
 *
 * Idempotent: re-running refreshes the same rows rather than duplicating.
 * Assignments are keyed on the TeacherAssignment_scope_unique constraint.
 *
 * Run with `pnpm db:seed:teacher-scenarios`.
 */

const TENANT_SLUG = process.env.SCHOOLOS_SEED_TENANT_SLUG ?? 'default-school';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

interface Ctx {
  tenantId: string;
  academicYearId: string;
  startsOn: Date;
  endsOn: Date;
}

async function upsertAssignment(
  ctx: Ctx,
  input: {
    staffId: string;
    assignmentType: TeacherAssignmentType;
    classId: string;
    sectionId: string;
    subjectId: string | null;
  },
) {
  // Prisma's compound-unique `where` cannot take an explicit null for the
  // nullable members (subjectId/componentScope), so this looks the row up
  // manually rather than using upsert -- same approach as the backfill.
  const existing = await prisma.teacherAssignment.findFirst({
    where: {
      tenantId: ctx.tenantId,
      academicYearId: ctx.academicYearId,
      staffId: input.staffId,
      assignmentType: input.assignmentType,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
      componentScope: null,
    },
    select: { id: true },
  });

  const data = {
    effectiveFrom: ctx.startsOn,
    effectiveUntil: ctx.endsOn,
    status: 'ACTIVE' as const,
    isPrimary: true,
  };

  if (existing) {
    await prisma.teacherAssignment.update({ where: { id: existing.id }, data });
    return 'updated';
  }

  await prisma.teacherAssignment.create({
    data: {
      tenantId: ctx.tenantId,
      academicYearId: ctx.academicYearId,
      staffId: input.staffId,
      assignmentType: input.assignmentType,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
      ...data,
    },
  });
  return 'created';
}

async function main() {
  console.log('--- Teacher assignment scenarios: starting ---');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) throw new Error(`No tenant "${TENANT_SLUG}"`);

  const year = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    select: { id: true, startsOn: true, endsOn: true },
  });
  if (!year)
    throw new Error('No current academic year; run pnpm db:seed first');

  const ctx: Ctx = {
    tenantId: tenant.id,
    academicYearId: year.id,
    startsOn: year.startsOn,
    endsOn: year.endsOn,
  };

  const classFor = async (name: string) => {
    const record = await prisma.class.findFirst({
      where: { tenantId: tenant.id, name },
      select: { id: true, sections: { select: { id: true, name: true } } },
    });
    if (!record) throw new Error(`Class "${name}" not found`);
    return record;
  };

  const subjectFor = async (classId: string, namePrefix: string) => {
    const record = await prisma.subject.findFirst({
      where: {
        tenantId: tenant.id,
        classId,
        name: { startsWith: namePrefix },
      },
      select: { id: true, name: true },
    });
    if (!record) {
      throw new Error(`Subject "${namePrefix}" not found for class ${classId}`);
    }
    return record;
  };

  const staffFor = async (email: string) => {
    const record = await prisma.staff.findFirst({
      where: { tenantId: tenant.id, user: { email } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!record) throw new Error(`Staff for "${email}" not found`);
    return record;
  };

  const [class1, class2, class3] = await Promise.all([
    classFor('Class 1'),
    classFor('Class 2'),
    classFor('Class 3'),
  ]);

  const section = (
    klass: { sections: Array<{ id: string; name: string }> },
    name: string,
  ) => {
    const found = klass.sections.find((item) => item.name === name);
    if (!found) throw new Error(`Section ${name} not found`);
    return found;
  };

  const c1a = section(class1, 'A');
  const c2a = section(class2, 'A');
  const c3b = section(class3, 'B');

  const [maths1, english1, science1, maths2, english2, science3] =
    await Promise.all([
      subjectFor(class1.id, 'Mathematics'),
      subjectFor(class1.id, 'English'),
      subjectFor(class1.id, 'Science'),
      subjectFor(class2.id, 'Mathematics'),
      subjectFor(class2.id, 'English'),
      subjectFor(class3.id, 'Science'),
    ]);

  // Reference teachers, reusing the accounts the dev seed already creates.
  const teacherA = await staffFor('classteacher.1a@schoolos.com');
  const teacherB = await staffFor('subjectteacher.english@schoolos.com');
  const teacherC = await staffFor('subjectteacher.math@schoolos.com');

  const results: string[] = [];

  // --- Teacher A: the combined Class Teacher + Subject Teacher case --------
  results.push(
    await upsertAssignment(ctx, {
      staffId: teacherA.id,
      assignmentType: TeacherAssignmentType.CLASS_TEACHER,
      classId: class1.id,
      sectionId: c1a.id,
      subjectId: null,
    }),
    await upsertAssignment(ctx, {
      staffId: teacherA.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class1.id,
      sectionId: c1a.id,
      subjectId: maths1.id,
    }),
    await upsertAssignment(ctx, {
      staffId: teacherA.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class2.id,
      sectionId: c2a.id,
      subjectId: maths2.id,
    }),
    await upsertAssignment(ctx, {
      staffId: teacherA.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class3.id,
      sectionId: c3b.id,
      subjectId: science3.id,
    }),
  );

  // --- Teacher B: co-teacher inside A's homeroom ---------------------------
  // Exists so A's cross-subject READ has something to read, and so the
  // "cannot edit another teacher's record" case is reachable.
  results.push(
    await upsertAssignment(ctx, {
      staffId: teacherB.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class1.id,
      sectionId: c1a.id,
      subjectId: english1.id,
    }),
    await upsertAssignment(ctx, {
      staffId: teacherB.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class2.id,
      sectionId: c2a.id,
      subjectId: english2.id,
    }),
  );

  // --- Teacher C: permanent subject + a temporary substitution ------------
  results.push(
    await upsertAssignment(ctx, {
      staffId: teacherC.id,
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: class1.id,
      sectionId: c1a.id,
      subjectId: science1.id,
    }),
  );

  // The substitution is a delegation, not an assignment: it is time-bounded,
  // capability-limited, and expires on its own without transferring
  // ownership of anything Teacher A authored.
  const substitutionWindowEnd = new Date();
  substitutionWindowEnd.setDate(substitutionWindowEnd.getDate() + 14);

  const existingDelegation = await prisma.teacherDelegation.findFirst({
    where: {
      tenantId: tenant.id,
      academicYearId: year.id,
      recipientStaffId: teacherC.id,
      classId: class2.id,
      sectionId: c2a.id,
      subjectId: maths2.id,
    },
    select: { id: true },
  });

  const delegationData = {
    allowedCapabilities: ['MARKS_ENTER', 'PERIOD_ATTENDANCE_MARK'],
    reason: 'Covering Mathematics while the assigned teacher is on leave',
    effectiveFrom: new Date(),
    effectiveUntil: substitutionWindowEnd,
    status: TeacherDelegationStatus.ACTIVE,
  };

  if (existingDelegation) {
    await prisma.teacherDelegation.update({
      where: { id: existingDelegation.id },
      data: delegationData,
    });
  } else {
    await prisma.teacherDelegation.create({
      data: {
        tenantId: tenant.id,
        academicYearId: year.id,
        grantorStaffId: teacherA.id,
        recipientStaffId: teacherC.id,
        classId: class2.id,
        sectionId: c2a.id,
        subjectId: maths2.id,
        ...delegationData,
      },
    });
  }

  const created = results.filter((r) => r === 'created').length;
  const updated = results.filter((r) => r === 'updated').length;

  console.log(`Assignments created: ${created}, refreshed: ${updated}`);
  console.log(
    `Teacher A (${teacherA.firstName} ${teacherA.lastName}): Class Teacher 1/A + Maths 1/A, Maths 2/A, Science 3/B`,
  );
  console.log(
    `Teacher B (${teacherB.firstName} ${teacherB.lastName}): English 1/A, English 2/A`,
  );
  console.log(
    `Teacher C (${teacherC.firstName} ${teacherC.lastName}): Science 1/A + temporary Maths 2/A cover (14 days)`,
  );
  console.log('--- Teacher assignment scenarios: complete ---');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
