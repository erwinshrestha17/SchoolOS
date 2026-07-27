import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, MarkEntryStatus } from '@prisma/client';
import { HomeroomSummaryService } from './homeroom-summary.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import {
  createTeacherScopeServiceForTests,
  teacherAssignmentFixture,
} from '../../test/test-helpers';
import type { AuthContext } from '../auth/auth.types';

/**
 * The homeroom summary is the only surface where a teacher legitimately reads
 * records for subjects they do not teach, so it gets its own negative-path
 * suite: who may open it, whose drafts it must never reveal, and that it
 * exposes no mutation at all.
 */

const TENANT = 'tenant-a';
const YEAR = 'year-1';
const STAFF = 'teacher-1';

const actor: AuthContext = {
  tenantId: TENANT,
  tenantSlug: 'everest',
  userId: 'user-1',
  email: 'ramesh@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['teacher'],
  permissions: ['students:read'],
};

function buildService(assignments: Array<Record<string, any>>) {
  const scopeDeps = createTeacherScopeServiceForTests({
    assignments,
    staffId: STAFF,
  });
  const teacherScope = new TeacherScopeService(
    scopeDeps.prisma as never,
    scopeDeps.audit as never,
  );

  const markGroupBy = jest
    .fn()
    .mockResolvedValue([
      {
        subjectId: 'sub-maths',
        status: MarkEntryStatus.SUBMITTED,
        _count: { _all: 3 },
      },
    ]);
  const homeworkFindMany = jest.fn().mockResolvedValue([]);

  const prisma = {
    academicYear: { findFirst: jest.fn().mockResolvedValue({ id: YEAR }) },
    section: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'section-1a',
          name: 'A',
          classId: 'class-1',
          class: { id: 'class-1', name: 'Class 1' },
          _count: { students: 2 },
        },
      ]),
    },
    student: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'student-1',
          studentSystemId: 'EA-1',
          firstNameEn: 'Sita',
          lastNameEn: 'Rai',
          rollNumber: 1,
        },
      ]),
    },
    subject: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sub-maths', name: 'Mathematics', code: 'MTH' },
        { id: 'sub-english', name: 'English', code: 'ENG' },
      ]),
    },
    markEntry: { groupBy: markGroupBy },
    homeworkAssignment: { findMany: homeworkFindMany },
    attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]) },
  } as never;

  const service = new HomeroomSummaryService(prisma, teacherScope);
  return { service, markGroupBy, homeworkFindMany, prisma };
}

const CLASS_TEACHER_1A = teacherAssignmentFixture({
  tenantId: TENANT,
  staffId: STAFF,
  academicYearId: YEAR,
  assignmentType: 'CLASS_TEACHER',
  classId: 'class-1',
  sectionId: 'section-1a',
  subjectId: null,
});

const SUBJECT_TEACHER_1A = teacherAssignmentFixture({
  tenantId: TENANT,
  staffId: STAFF,
  academicYearId: YEAR,
  assignmentType: 'SUBJECT_TEACHER',
  classId: 'class-1',
  sectionId: 'section-1a',
  subjectId: 'sub-maths',
});

describe('HomeroomSummaryService', () => {
  describe('authorization', () => {
    it('allows the section Class Teacher', async () => {
      const { service } = buildService([CLASS_TEACHER_1A]);
      await expect(
        service.getHomeroomAcademicSummary(actor, {
          classId: 'class-1',
          sectionId: 'section-1a',
        }),
      ).resolves.toMatchObject({ sectionId: 'section-1a' });
    });

    it('DENIES a Subject Teacher of the same section', async () => {
      // Teaching Mathematics in 1/A does not entitle you to English marks.
      const { service } = buildService([SUBJECT_TEACHER_1A]);
      await expect(
        service.getHomeroomAcademicSummary(actor, {
          classId: 'class-1',
          sectionId: 'section-1a',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES a Class Teacher asking about a different section (IDOR probe)', async () => {
      // Query parameters are attacker-controlled; the per-section capability
      // check is what stops a homeroom teacher reading another homeroom.
      const { service } = buildService([CLASS_TEACHER_1A]);
      await expect(
        service.getHomeroomAcademicSummary(actor, {
          classId: 'class-2',
          sectionId: 'section-2b',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES a teacher with no assignments at all', async () => {
      const { service } = buildService([]);
      await expect(
        service.getHomeroomAcademicSummary(actor, {
          classId: 'class-1',
          sectionId: 'section-1a',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('DENIES once the homeroom assignment has ended', async () => {
      const { service } = buildService([
        {
          ...CLASS_TEACHER_1A,
          effectiveUntil: new Date('2020-01-02T00:00:00.000Z'),
        },
      ]);
      await expect(
        service.getHomeroomAcademicSummary(actor, {
          classId: 'class-1',
          sectionId: 'section-1a',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('draft protection', () => {
    it('never queries DRAFT marks', async () => {
      const { service, markGroupBy } = buildService([CLASS_TEACHER_1A]);
      await service.getHomeroomAcademicSummary(actor, {
        classId: 'class-1',
        sectionId: 'section-1a',
      });

      const statuses = markGroupBy.mock.calls[0][0].where.status.in;
      expect(statuses).not.toContain(MarkEntryStatus.DRAFT);
      // Exclusion happens in the query, so drafts never leave the database.
      expect(statuses).toContain(MarkEntryStatus.SUBMITTED);
    });

    it('never queries unpublished homework', async () => {
      const { service, homeworkFindMany } = buildService([CLASS_TEACHER_1A]);
      await service.getHomeroomAcademicSummary(actor, {
        classId: 'class-1',
        sectionId: 'section-1a',
      });

      const statuses = homeworkFindMany.mock.calls[0][0].where.status.in;
      expect(statuses).not.toContain('DRAFT');
    });
  });

  describe('cross-subject content', () => {
    it('reports coverage for every subject, including ones the teacher does not teach', async () => {
      const { service } = buildService([CLASS_TEACHER_1A]);
      const summary = await service.getHomeroomAcademicSummary(actor, {
        classId: 'class-1',
        sectionId: 'section-1a',
      });

      expect(summary.subjectCoverage.map((s) => s.subjectName)).toEqual([
        'Mathematics',
        'English',
      ]);
      // English has no reported marks in the fixture -- surfaced as a gap the
      // Class Teacher can chase, not as an editable record.
      expect(summary.subjectsWithNoMarks).toEqual(['English']);
    });
  });

  describe('listMyHomerooms', () => {
    it('returns only CLASS_TEACHER assignments', async () => {
      const { service } = buildService([CLASS_TEACHER_1A, SUBJECT_TEACHER_1A]);
      const homerooms = await service.listMyHomerooms(actor);
      expect(homerooms).toHaveLength(1);
      expect(homerooms[0]).toMatchObject({
        sectionId: 'section-1a',
        className: 'Class 1',
        sectionName: 'A',
      });
    });

    it('returns nothing for a subject-only teacher', async () => {
      const { service } = buildService([SUBJECT_TEACHER_1A]);
      await expect(service.listMyHomerooms(actor)).resolves.toEqual([]);
    });
  });

  it('exposes no mutating method', () => {
    // A structural guarantee: the Class Teacher's cross-subject view must
    // stay read-only, so no write verb may appear on this service.
    const methods = Object.getOwnPropertyNames(
      HomeroomSummaryService.prototype,
    ).filter((name) => name !== 'constructor');
    for (const method of methods) {
      expect(method).not.toMatch(/^(create|update|delete|submit|approve|set)/i);
    }
  });
});
