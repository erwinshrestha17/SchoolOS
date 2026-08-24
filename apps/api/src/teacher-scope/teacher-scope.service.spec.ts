import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, TeacherAssignmentType } from '@prisma/client';
import {
  TEACHER_SCOPE_DENIED_CODE,
  TeacherScopeService,
} from './teacher-scope.service';
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
  assignment(
    'a-ct-1a',
    TeacherAssignmentType.CLASS_TEACHER,
    CLASS_1,
    SECTION_1A,
    null,
  ),
  assignment(
    'a-mth-1a',
    TeacherAssignmentType.SUBJECT_TEACHER,
    CLASS_1,
    SECTION_1A,
    MATHS,
  ),
  assignment(
    'a-mth-2a',
    TeacherAssignmentType.SUBJECT_TEACHER,
    CLASS_2,
    SECTION_2A,
    MATHS,
  ),
  assignment(
    'a-sci-3b',
    TeacherAssignmentType.SUBJECT_TEACHER,
    CLASS_3,
    SECTION_3B,
    SCIENCE,
  ),
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
            if (
              where.academicYearId &&
              where.academicYearId !== row.academicYearId
            )
              return false;
            if (where.classId && where.classId !== row.classId) return false;
            if (where.sectionId && where.sectionId !== row.sectionId)
              return false;
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
      aggregate: jest.fn().mockResolvedValue({
        _max: { updatedAt: new Date('2026-07-31T10:00:00.000Z') },
      }),
    },
    teacherDelegation: {
      findMany: jest.fn().mockResolvedValue(delegations),
      aggregate: jest.fn().mockResolvedValue({
        _max: { updatedAt: new Date('2026-07-31T12:00:00.000Z') },
      }),
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
          ask(
            TeacherCapability.SUBJECT_RECORD_WRITE,
            CLASS_1,
            SECTION_1A,
            MATHS,
            {
              recordOwnerStaffId: OTHER_STAFF,
            },
          ),
          actor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows editing the caller own record', async () => {
      const { service } = buildService();
      await expect(
        service.requireAccess(
          ask(
            TeacherCapability.SUBJECT_RECORD_WRITE,
            CLASS_1,
            SECTION_1A,
            MATHS,
            {
              recordOwnerStaffId: STAFF,
            },
          ),
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
          ask(
            TeacherCapability.SUBJECT_HOMEWORK_CREATE,
            CLASS_2,
            SECTION_2A,
            ENGLISH,
          ),
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

    it('filters list scopes by the delegation capability allow-list', async () => {
      const { service } = buildService(RAMESH_ASSIGNMENTS, [substitution]);

      const markScopes = await service.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.MARKS_ENTER,
      );
      expect(markScopes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assignmentId: 'deleg-1',
            source: 'DELEGATION',
            subjectId: ENGLISH,
          }),
        ]),
      );

      const readScopes = await service.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.SUBJECT_RECORD_READ,
      );
      expect(readScopes).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ assignmentId: 'deleg-1' }),
        ]),
      );
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
      const denied = service.requireAccess(
        ask(TeacherCapability.MARKS_ENTER, CLASS_1, SECTION_1A, ENGLISH),
        actor,
      );
      await expect(denied).rejects.toBeInstanceOf(ForbiddenException);
      await expect(denied).rejects.toMatchObject({
        response: expect.objectContaining({
          code: TEACHER_SCOPE_DENIED_CODE,
        }),
      });
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'teacher_scope.denied' }),
      );
    });

    it('resolves the active staff row inside the actor-oriented contract', async () => {
      const { service, prisma } = buildService();

      await expect(
        service.requireActorAccess(
          {
            academicYearId: YEAR,
            classId: CLASS_1,
            sectionId: SECTION_1A,
            subjectId: MATHS,
            capability: TeacherCapability.MARKS_ENTER,
          },
          actor,
        ),
      ).resolves.toMatchObject({ assignmentId: 'a-mth-1a' });

      expect((prisma as any).staff.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT,
          userId: actor.userId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    });

    it('fails closed and audits when the actor has no active staff row', async () => {
      const { service, prisma, auditRecord } = buildService();
      (prisma as any).staff.findFirst.mockResolvedValue(null);

      await expect(
        service.requireActorAccess(
          {
            academicYearId: YEAR,
            classId: CLASS_1,
            sectionId: SECTION_1A,
            subjectId: MATHS,
            capability: TeacherCapability.MARKS_ENTER,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: TEACHER_SCOPE_DENIED_CODE,
        }),
      });

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'teacher_scope.denied',
          after: expect.objectContaining({
            reason: 'no_active_staff',
            staffId: null,
          }),
        }),
      );
    });

    it('returns the stable denial contract and audits a request with missing scope', async () => {
      const { service, auditRecord } = buildService();

      await expect(
        service.denyActorAccess(
          {
            capability: TeacherCapability.CLASS_ROSTER_READ,
            reason: 'missing_scope',
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: TEACHER_SCOPE_DENIED_CODE,
        }),
      });

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'teacher_scope.denied',
          resource: TeacherCapability.CLASS_ROSTER_READ,
          after: expect.objectContaining({ reason: 'missing_scope' }),
        }),
      );
    });
  });

  describe('getScopeVersion', () => {
    interface ScopeAssignmentFixture {
      id: string;
      tenantId: string;
      academicYearId: string;
      staffId: string;
      assignmentType: TeacherAssignmentType;
      classId: string;
      sectionId: string;
      subjectId: string | null;
      componentScope: null;
      isPrimary: boolean;
      effectiveFrom: Date;
      effectiveUntil: Date | null;
      status: string;
      updatedAt: Date;
    }

    interface ScopeDelegationFixture {
      id: string;
      tenantId: string;
      academicYearId: string;
      grantorStaffId: string;
      recipientStaffId: string;
      sourceAssignmentId: string | null;
      classId: string;
      sectionId: string;
      subjectId: string | null;
      componentScope: null;
      allowedCapabilities: TeacherCapability[];
      timetableSubstitutionId: string | null;
      effectiveFrom: Date;
      effectiveUntil: Date;
      status: string;
      updatedAt: Date;
    }

    interface ScopeStaffFixture {
      id: string;
      status: string;
      teacherAssignmentRecords: ScopeAssignmentFixture[];
      delegationsReceived: ScopeDelegationFixture[];
    }

    interface ScopeVersionFindFirstArgs {
      where: {
        tenantId: string;
        userId: string;
        status?: string;
      };
      select: {
        teacherAssignmentRecords: {
          where: {
            tenantId: string;
            status: string;
            effectiveFrom: { lte: Date };
          };
          select: Record<string, boolean>;
        };
        delegationsReceived: {
          where: {
            tenantId: string;
            status: string;
            effectiveFrom: { lte: Date };
          };
          select: Record<string, boolean>;
        };
      };
    }

    type ScopeStaffFindFirst = (
      args: ScopeVersionFindFirstArgs,
    ) => Promise<ScopeStaffFixture | null>;

    const scopeStaffFindFirst = (prisma: unknown) =>
      (
        prisma as {
          staff: { findFirst: jest.MockedFunction<ScopeStaffFindFirst> };
        }
      ).staff.findFirst;

    const scopeAssignment = (
      overrides: Partial<ScopeAssignmentFixture> = {},
    ): ScopeAssignmentFixture => ({
      id: 'scope-assignment-1',
      tenantId: TENANT,
      academicYearId: YEAR,
      staffId: STAFF,
      assignmentType: TeacherAssignmentType.CLASS_TEACHER,
      classId: CLASS_1,
      sectionId: SECTION_1A,
      subjectId: null,
      componentScope: null,
      isPrimary: true,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveUntil: null,
      status: 'ACTIVE',
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      ...overrides,
    });

    const scopeDelegation = (
      overrides: Partial<ScopeDelegationFixture> = {},
    ): ScopeDelegationFixture => ({
      id: 'scope-delegation-1',
      tenantId: TENANT,
      academicYearId: YEAR,
      grantorStaffId: OTHER_STAFF,
      recipientStaffId: STAFF,
      sourceAssignmentId: null,
      classId: CLASS_2,
      sectionId: SECTION_2A,
      subjectId: MATHS,
      componentScope: null,
      allowedCapabilities: [TeacherCapability.CLASS_ROSTER_READ],
      timetableSubstitutionId: null,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-08-31T23:59:59.999Z'),
      status: 'ACTIVE',
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      ...overrides,
    });

    const scopeStaff = (
      status: string,
      assignments: ScopeAssignmentFixture[] = [],
      delegations: ScopeDelegationFixture[] = [],
    ): ScopeStaffFixture => ({
      id: STAFF,
      status,
      teacherAssignmentRecords: assignments,
      delegationsReceived: delegations,
    });

    it('distinguishes missing, inactive, and active staff authority', async () => {
      const { service, prisma } = buildService();
      const assignmentRow = scopeAssignment();
      const delegationRow = scopeDelegation();
      const findFirst = scopeStaffFindFirst(prisma);
      findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          scopeStaff('INACTIVE', [assignmentRow], [delegationRow]),
        )
        .mockResolvedValueOnce(
          scopeStaff('ACTIVE', [assignmentRow], [delegationRow]),
        );

      const missing = await service.getScopeVersion(actor);
      const inactive = await service.getScopeVersion(actor);
      const active = await service.getScopeVersion(actor);

      expect(missing.scopeVersion).toMatch(/^\d+$/);
      expect(inactive.scopeVersion).toMatch(/^\d+$/);
      expect(active.scopeVersion).toMatch(/^\d+$/);
      expect(
        new Set([
          missing.scopeVersion,
          inactive.scopeVersion,
          active.scopeVersion,
        ]).size,
      ).toBe(3);

      const query = findFirst.mock.calls[0][0];
      expect(query.where).toEqual({ tenantId: TENANT, userId: actor.userId });
      expect(query.where.status).toBeUndefined();
      expect(query.select.teacherAssignmentRecords.where).toEqual(
        expect.objectContaining({ tenantId: TENANT, status: 'ACTIVE' }),
      );
      expect(query.select.delegationsReceived.where).toEqual(
        expect.objectContaining({ tenantId: TENANT, status: 'ACTIVE' }),
      );
    });

    it('changes solely as the same rows activate and expire naturally', async () => {
      const { service, prisma } = buildService();
      const assignmentRows = [
        scopeAssignment({
          id: 'scope-assignment-early',
          effectiveFrom: new Date('2026-08-24T09:00:00.000Z'),
          effectiveUntil: new Date('2026-08-24T10:00:00.000Z'),
        }),
        scopeAssignment({
          id: 'scope-assignment-late',
          effectiveFrom: new Date('2026-08-24T11:15:00.000Z'),
          effectiveUntil: null,
        }),
      ];
      const delegationRows = [
        scopeDelegation({
          effectiveFrom: new Date('2026-08-24T10:15:00.000Z'),
          effectiveUntil: new Date('2026-08-24T11:00:00.000Z'),
        }),
      ];

      scopeStaffFindFirst(prisma).mockImplementation(({ select }) => {
        const assignmentAt: Date =
          select.teacherAssignmentRecords.where.effectiveFrom.lte;
        const delegationAt: Date =
          select.delegationsReceived.where.effectiveFrom.lte;
        return Promise.resolve(
          scopeStaff(
            'ACTIVE',
            assignmentRows.filter(
              (row) =>
                row.status === 'ACTIVE' &&
                row.effectiveFrom <= assignmentAt &&
                (row.effectiveUntil === null ||
                  row.effectiveUntil >= assignmentAt),
            ),
            delegationRows.filter(
              (row) =>
                row.status === 'ACTIVE' &&
                row.effectiveFrom <= delegationAt &&
                row.effectiveUntil >= delegationAt,
            ),
          ),
        );
      });

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-08-24T09:30:00.000Z'));
        const before = await service.getScopeVersion(actor);
        jest.setSystemTime(new Date('2026-08-24T10:30:00.000Z'));
        const during = await service.getScopeVersion(actor);
        jest.setSystemTime(new Date('2026-08-24T11:30:00.000Z'));
        const after = await service.getScopeVersion(actor);

        expect(
          new Set([
            before.scopeVersion,
            during.scopeVersion,
            after.scopeVersion,
          ]).size,
        ).toBe(3);
      } finally {
        jest.useRealTimers();
      }

      expect(assignmentRows.map((row) => row.updatedAt)).toEqual([
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      ]);
      expect(delegationRows[0].updatedAt).toEqual(
        new Date('2026-08-01T00:00:00.000Z'),
      );
    });

    it('is unchanged when only non-authority update timestamps change', async () => {
      const { service, prisma } = buildService();
      const assignmentRow = scopeAssignment();
      const delegationRow = scopeDelegation();
      const findFirst = scopeStaffFindFirst(prisma);
      findFirst
        .mockResolvedValueOnce(
          scopeStaff('ACTIVE', [assignmentRow], [delegationRow]),
        )
        .mockResolvedValueOnce(
          scopeStaff(
            'ACTIVE',
            [
              {
                ...assignmentRow,
                updatedAt: new Date('2026-08-24T10:00:00.000Z'),
              },
            ],
            [
              {
                ...delegationRow,
                updatedAt: new Date('2026-08-24T11:00:00.000Z'),
              },
            ],
          ),
        );

      const before = await service.getScopeVersion(actor);
      const after = await service.getScopeVersion(actor);

      expect(after.scopeVersion).toBe(before.scopeVersion);
      const query = findFirst.mock.calls[0][0];
      expect(query.select.teacherAssignmentRecords.select).not.toHaveProperty(
        'updatedAt',
      );
      expect(query.select.delegationsReceived.select).not.toHaveProperty(
        'updatedAt',
      );
    });

    it('is deterministic across row and capability ordering', async () => {
      const { service, prisma } = buildService();
      const firstAssignment = scopeAssignment({ id: 'assignment-a' });
      const secondAssignment = scopeAssignment({
        id: 'assignment-b',
        classId: CLASS_2,
        sectionId: SECTION_2A,
      });
      const firstDelegation = scopeDelegation({
        id: 'delegation-a',
        allowedCapabilities: [
          TeacherCapability.HOMEROOM_ATTENDANCE_MARK,
          TeacherCapability.CLASS_ROSTER_READ,
        ],
      });
      const secondDelegation = scopeDelegation({
        id: 'delegation-b',
        classId: CLASS_3,
        sectionId: SECTION_3B,
      });
      scopeStaffFindFirst(prisma)
        .mockResolvedValueOnce(
          scopeStaff(
            'ACTIVE',
            [firstAssignment, secondAssignment],
            [firstDelegation, secondDelegation],
          ),
        )
        .mockResolvedValueOnce(
          scopeStaff(
            'ACTIVE',
            [secondAssignment, firstAssignment],
            [
              secondDelegation,
              {
                ...firstDelegation,
                allowedCapabilities: [
                  TeacherCapability.CLASS_ROSTER_READ,
                  TeacherCapability.HOMEROOM_ATTENDANCE_MARK,
                ],
              },
            ],
          ),
        );

      const first = await service.getScopeVersion(actor);
      const reordered = await service.getScopeVersion(actor);

      expect(first.scopeVersion).toBe(reordered.scopeVersion);
    });
  });

  describe('resolveReadableScope', () => {
    it('separates homeroom sections from subject-only sections', async () => {
      const { service } = buildService();
      const scope = await service.resolveReadableScope(actor);

      expect([...scope.homeroomSectionIds]).toEqual([SECTION_1A]);
      expect([...(scope.subjectsBySection.get(SECTION_1A) ?? [])]).toEqual([
        MATHS,
      ]);
      expect([...(scope.subjectsBySection.get(SECTION_2A) ?? [])]).toEqual([
        MATHS,
      ]);
      expect([...(scope.subjectsBySection.get(SECTION_3B) ?? [])]).toEqual([
        SCIENCE,
      ]);
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
