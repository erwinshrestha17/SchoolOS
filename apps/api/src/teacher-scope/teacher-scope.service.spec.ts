import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, TeacherAssignmentType } from '@prisma/client';
import { TeacherScopeService } from './teacher-scope.service';
import { TeacherCapability } from './teacher-capability';
import type { AuthContext } from '../auth/auth.types';

/**
 * The authorization matrix from the assignment-based access-control spec,
 * expressed as executable rules.
 *
 * Scenario used throughout (the spec's worked example):
 *
 *   Ramesh Gurung
 *     Class Teacher     — Class 1/A
 *     Mathematics       — Class 1/A
 *     Mathematics       — Class 2/A
 *     Science           — Class 3/B
 *
 * Expected effective permissions:
 *
 *   Class 1/A Mathematics  read + write   (subject assignment)
 *   Class 1/A English      read only      (class teacher, non-draft only)
 *   Class 1/A Science      read only      (class teacher, non-draft only)
 *   Class 2/A Mathematics  read + write   (subject assignment)
 *   Class 2/A English      no access
 *   Class 3/B Science      read + write   (subject assignment)
 *   Class 3/B Mathematics  no access
 */

const TENANT = 'tenant-1';
const YEAR = 'year-2026';
const STAFF = 'staff-ramesh';
const OTHER_STAFF = 'staff-sita';

const CLASS_1 = 'class-1';
const SECTION_1A = 'section-1a';
const CLASS_2 = 'class-2';
const SECTION_2A = 'section-2a';
const CLASS_3 = 'class-3';
const SECTION_3B = 'section-3b';

const MATHS = 'subject-maths';
const ENGLISH = 'subject-english';
const SCIENCE = 'subject-science';

const actor: AuthContext = {
  tenantId: TENANT,
  tenantSlug: 'everest',
  userId: 'user-ramesh',
  email: 'ramesh@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['teacher'],
  permissions: ['academics:enter_marks', 'attendance:mark'],
};

interface FakeAssignment {
  id: string;
  assignmentType: TeacherAssignmentType;
  classId: string;
  sectionId: string;
  subjectId: string | null;
  componentScope: null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isPrimary: boolean;
  academicYearId: string;
  staffId: string;
  status: 'ACTIVE';
}

function assignment(
  id: string,
  type: TeacherAssignmentType,
  classId: string,
  sectionId: string,
  subjectId: string | null,
  overrides: Partial<FakeAssignment> = {},
): FakeAssignment {
  return {
    id,
    assignmentType: type,
    classId,
    sectionId,
    subjectId,
    componentScope: null,
    effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
    effectiveUntil: null,
    isPrimary: true,
    academicYearId: YEAR,
    staffId: STAFF,
    status: 'ACTIVE',
    ...overrides,
  };
}

const RAMESH_ASSIGNMENTS: FakeAssignment[] = [
  assignment('a-ct-1a', TeacherAssignmentType.CLASS_TEACHER, CLASS_1, SECTION_1A, null),
  assignment('a-mth-1a', TeacherAssignmentType.SUBJECT_TEACHER, CLASS_1, SECTION_1A, MATHS),
  assignment('a-mth-2a', TeacherAssignmentType.SUBJECT_TEACHER, CLASS_2, SECTION_2A, MATHS),
  assignment('a-sci-3b', TeacherAssignmentType.SUBJECT_TEACHER, CLASS_3, SECTION_3B, SCIENCE),
];

function buildService(
  assignments: FakeAssignment[] = RAMESH_ASSIGNMENTS,
  delegations: Array<Record<string, unknown>> = [],
) {
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    staff: {
      findFirst: jest.fn().mockResolvedValue({ id: STAFF }),
    },
    teacherAssignment: {
      // Faithfully reproduce the real query's filtering so the test exercises
      // the service's own matching logic, not a pre-filtered fixture.
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          assignments.filter((row) => {
            if (where.tenantId !== TENANT) return false;
            if (where.staffId !== row.staffId) return false;
            if (where.academicYearId && where.academicYearId !== row.academicYearId)
              return false;
            if (where.classId && where.classId !== row.classId) return false;
            if (where.sectionId && where.sectionId !== row.sectionId) return false;
            if (
              where.assignmentType?.in &&
              !where.assignmentType.in.includes(row.assignmentType)
            )
              return false;
            const on: Date = where.effectiveFrom?.lte ?? new Date();
            if (row.effectiveFrom > on) return false;
            if (row.effectiveUntil && row.effectiveUntil < on) return false;
            return true;
          }),
        ),
      ),
    },
    teacherDelegation: {
      findMany: jest.fn().mockResolvedValue(delegations),
    },
  } as never;

  const service = new TeacherScopeService(prisma, {
    record: auditRecord,
  } as never);

  return { service, auditRecord, prisma };
}

function ask(
  capability: TeacherCapability,
  classId: string,
  sectionId: string,
  subjectId?: string,
  extra: Record<string, unknown> = {},
) {
  return {
    tenantId: TENANT,
    staffId: STAFF,
    academicYearId: YEAR,
    classId,
    sectionId,
    subjectId,
    capability,
    ...extra,
  } as never;
}

describe('TeacherScopeService — assignment-based authorization', () => {
  describe('Subject Teacher: write is confined to the exact assignment', () => {
    it('allows marks entry for an assigned subject in an assigned section', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS),
          actor,
        ),
      ).resolves.toMatchObject({ source: 'ASSIGNMENT' });
    });

    it('allows the same subject in a different assigned class', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_2, SECTION_2A, MATHS),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it('DENIES a different subject in a class the teacher does teach', async () => {
      // Class 1/A English: Ramesh is Class Teacher here and teaches Maths,
      // but he does not teach English. This is the central rule.
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, ENGLISH),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES the assigned subject in a class the teacher does not teach', async () => {
      // Class 3/B Mathematics: he teaches Maths, and he teaches in 3/B, but
      // not Maths in 3/B.
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_3, SECTION_3B, MATHS),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES a class with no assignment at all', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, 'class-9', 'section-9z', MATHS),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES a subject request with no subject supplied', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, undefined),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Class Teacher: broad READ, never cross-subject write', () => {
    it('allows reading another subject in the homeroom once it leaves draft', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
            CLASS_1,
            SECTION_1A,
            ENGLISH,
            { recordStatus: 'SUBMITTED' },
          ),
          actor,
        ),
      ).resolves.toMatchObject({
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
      });
    });

    it('allows reading a published record of any subject in the homeroom', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
            CLASS_1,
            SECTION_1A,
            SCIENCE,
            { recordStatus: 'PUBLISHED' },
          ),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it("DENIES another teacher's private DRAFT in the homeroom", async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
            CLASS_1,
            SECTION_1A,
            ENGLISH,
            { recordStatus: 'DRAFT' },
          ),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES cross-subject read in a section that is not the homeroom', async () => {
      // Ramesh teaches Maths in 2/A but is not its Class Teacher.
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
            CLASS_2,
            SECTION_2A,
            ENGLISH,
            { recordStatus: 'PUBLISHED' },
          ),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows homeroom attendance for the assigned homeroom', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.HOMEROOM_ATTENDANCE_MARK, CLASS_1, SECTION_1A),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it('DENIES homeroom attendance for a section the teacher only teaches in', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.HOMEROOM_ATTENDANCE_MARK, CLASS_2, SECTION_2A),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not let a subject assignment satisfy a homeroom capability', async () => {
      // Only a subject assignment in 2/A exists; HOMEROOM_RECORD_WRITE
      // requires subjectMatch NONE, so a subject-bearing row must not match.
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.HOMEROOM_RECORD_WRITE, CLASS_2, SECTION_2A),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Combined Class + Subject Teacher produces the union', () => {
    it('writes Mathematics AND reads other subjects in Class 1/A', async () => {
      const { service } = buildService();

      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS),
          actor,
        ),
      ).resolves.toBeTruthy();

      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
            CLASS_1,
            SECTION_1A,
            ENGLISH,
            { recordStatus: 'SUBMITTED' },
          ),
          actor,
        ),
      ).resolves.toBeTruthy();

      await expect(
        service.requireAccess(
          ask(TeacherCapability.HOMEROOM_ATTENDANCE_MARK, CLASS_1, SECTION_1A),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it('the union still does not add English write in Class 1/A', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.SUBJECT_RECORD_WRITE,
            CLASS_1,
            SECTION_1A,
            ENGLISH,
          ),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Record ownership', () => {
    it("DENIES editing a co-teacher's record in a subject the caller teaches", async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.SUBJECT_RECORD_WRITE, CLASS_1, SECTION_1A, MATHS, {
            recordOwnerStaffId: OTHER_STAFF,
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows editing the caller own record', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.SUBJECT_RECORD_WRITE, CLASS_1, SECTION_1A, MATHS, {
            recordOwnerStaffId: STAFF,
          }),
          actor,
        ),
      ).resolves.toBeTruthy();
    });
  });

  describe('Effective dates', () => {
    it('DENIES a write after the assignment has ended', async () => {
      const ended = [
        assignment(
          'a-expired',
          TeacherAssignmentType.SUBJECT_TEACHER,
          CLASS_1,
          SECTION_1A,
          MATHS,
          { effectiveUntil: new Date('2026-05-01T00:00:00.000Z') },
        ),
      ];
      const { service } = buildService(ended);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS, {
            effectiveOn: new Date('2026-07-01T00:00:00.000Z'),
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still allows a record dated while the assignment was live', async () => {
      const ended = [
        assignment(
          'a-expired',
          TeacherAssignmentType.SUBJECT_TEACHER,
          CLASS_1,
          SECTION_1A,
          MATHS,
          { effectiveUntil: new Date('2026-05-01T00:00:00.000Z') },
        ),
      ];
      const { service } = buildService(ended);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS, {
            effectiveOn: new Date('2026-04-15T00:00:00.000Z'),
          }),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it('DENIES a future-dated assignment today', async () => {
      const future = [
        assignment(
          'a-future',
          TeacherAssignmentType.SUBJECT_TEACHER,
          CLASS_1,
          SECTION_1A,
          MATHS,
          { effectiveFrom: new Date('2099-01-01T00:00:00.000Z') },
        ),
      ];
      const { service } = buildService(future);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Temporary substitution via delegation', () => {
    const substitution = {
      id: 'deleg-1',
      classId: CLASS_2,
      sectionId: SECTION_2A,
      subjectId: ENGLISH,
      componentScope: null,
      allowedCapabilities: [TeacherCapability.MARKS_ENTER],
      effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
      effectiveUntil: new Date('2099-01-01T00:00:00.000Z'),
      academicYearId: YEAR,
    };

    it('grants exactly the delegated capability on the delegated scope', async () => {
      const { service } = buildService(RAMESH_ASSIGNMENTS, [substitution]);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_2, SECTION_2A, ENGLISH),
          actor,
        ),
      ).resolves.toMatchObject({ source: 'DELEGATION' });
    });

    it('does NOT grant other capabilities on the same scope', async () => {
      const { service } = buildService(RAMESH_ASSIGNMENTS, [substitution]);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.SUBJECT_HOMEWORK_CREATE, CLASS_2, SECTION_2A, ENGLISH),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does NOT grant the delegated capability on a different subject', async () => {
      const { service } = buildService(RAMESH_ASSIGNMENTS, [substitution]);
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_2, SECTION_2A, SCIENCE),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('canAccess (non-throwing) mirrors requireAccess', () => {
    it('returns a grant where requireAccess resolves', async () => {
      const { service } = buildService();
      await expect(
        service.canAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, MATHS),
          actor,
        ),
      ).resolves.toBeTruthy();
    });

    it('returns null (not a throw) where requireAccess rejects', async () => {
      const { service } = buildService();
      await expect(
        service.canAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, ENGLISH),
          actor,
        ),
      ).resolves.toBeNull();
    });

    it('does not write a denial audit entry for a probe', async () => {
      const { service, auditRecord } = buildService();
      await service.canAccess(
        ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, ENGLISH),
        actor,
      );
      expect(auditRecord).not.toHaveBeenCalled();
    });

    it('DOES audit a denied real operation', async () => {
      const { service, auditRecord } = buildService();
      await expect(
        service.requireAccess(
          ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, ENGLISH),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'teacher_scope.denied' }),
      );
    });
  });

  describe('resolveReadableScope', () => {
    it('separates homeroom sections from subject-only sections', async () => {
      const { service } = buildService();
      const scope = await service.resolveReadableScope(actor);

      expect([...scope.homeroomSectionIds]).toEqual([SECTION_1A]);
      expect([...scope.subjectsBySection.get(SECTION_1A) ?? []]).toEqual([MATHS]);
      expect([...scope.subjectsBySection.get(SECTION_2A) ?? []]).toEqual([MATHS]);
      expect([...scope.subjectsBySection.get(SECTION_3B) ?? []]).toEqual([SCIENCE]);
      expect(scope.allSectionIds.size).toBe(3);
    });

    it('returns nothing for a caller with no active staff row', async () => {
      const { service, prisma } = buildService();
      (prisma as any).staff.findFirst.mockResolvedValue(null);
      const scope = await service.resolveReadableScope(actor);
      expect(scope.allSectionIds.size).toBe(0);
    });
  });
});
