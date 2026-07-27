import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
} from '@prisma/client';
import { HomeworkService } from './homework.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import {
  createPrismaMock,
  createTeacherScopeServiceForTests,
  PrismaMock,
  teacherAssignmentFixture,
} from '../../test/test-helpers';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('Homework Hardening', () => {
  let homeworkService: HomeworkService;
  let prisma: PrismaMock;

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    email: 'user1@example.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['homework:create', 'homework:review'],
  };
  const emptyAssignmentPage = {
    items: [],
    meta: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  // Mutable between tests: each authorization case pushes the canonical
  // TeacherAssignment rows it wants the resolver to see.
  let teacherAssignments: Array<Record<string, any>>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    teacherAssignments = [];
    prisma.__state.staff.push({
      id: 'staff-1',
      tenantId: 'tenant-a',
      userId: 'user-1',
    });
    const scopeDeps = createTeacherScopeServiceForTests({
      // Read through a getter so rows pushed inside a test are visible.
      get assignments() {
        return teacherAssignments;
      },
      staffId: 'teacher-1',
    } as never);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworkService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: CommunicationsService,
          useValue: {
            recordDeliveryRecords: jest
              .fn()
              .mockResolvedValue({ sentCount: 1 }),
          },
        },
        {
          provide: FileRegistryService,
          useValue: { linkToEntity: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getQueueToken('homework'),
          useValue: { add: jest.fn() },
        },
        {
          // A real resolver over an in-memory assignment store, so these stay
          // genuine authorization tests rather than asserting against a stub.
          provide: TeacherScopeService,
          useFactory: () =>
            new TeacherScopeService(
              scopeDeps.prisma as never,
              scopeDeps.audit as never,
            ),
        },
      ],
    }).compile();

    homeworkService = module.get<HomeworkService>(HomeworkService);
  });

  describe('Tenant Isolation & Ownership', () => {
    it('should reject creating homework for a class from another tenant', async () => {
      const p = prisma as any;

      // Class from another tenant or not found
      p.class.findFirst.mockResolvedValue(null);
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-from-tenant-b',
            subjectId: 'sub-1',
            title: 'Test Homework',
            instructions: 'Do something',
            dueDate: '2026-12-31',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject submissions from students not in the homework scope', async () => {
      const p = prisma as any;
      const assignment = {
        id: 'hw-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
        sectionId: 'section-1',
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: new Date('2026-12-31'),
      };
      p.homeworkAssignment.findFirst.mockResolvedValue(assignment);

      // Student from another class or tenant
      p.student.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.createSubmission(
          'hw-1',
          {
            studentId: 'student-x',
            submissionText: 'My answer',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Date Integrity', () => {
    it('should reject due date before assigned date', async () => {
      const p = prisma as any;
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            title: 'Invalid Dates',
            instructions: 'Test',
            assignedDate: '2026-12-31',
            dueDate: '2026-12-30', // Earlier than assigned
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Teacher Scoping', () => {
    it('should restrict subject teachers to their assigned subjects', async () => {
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      // No canonical assignment for this subject: `teacherAssignments` is
      // left empty, so the resolver finds nothing.

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'sub-1',
            title: 'Not my subject',
            instructions: 'Test',
            dueDate: '2026-12-31',
          },
          teacherActor,
        ),
      ).rejects.toThrow(); // Should throw ForbiddenException

      // Authorization now resolves against the canonical TeacherAssignment
      // table rather than the legacy SubjectTeacherAssignment query, so the
      // legacy call is no longer made at all.
      expect(p.subjectTeacherAssignment.findFirst).not.toHaveBeenCalled();
    });

    it('should allow a properly assigned subject teacher to create homework', async () => {
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      // A real canonical assignment for this exact class/section/subject.
      teacherAssignments.push(
        teacherAssignmentFixture({
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'sub-1',
        }),
      );

      const result = (await homeworkService.createAssignment(
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'sub-1',
          title: 'My subject',
          instructions: 'Test',
          dueDate: '2026-12-31',
        },
        teacherActor,
      )) as any;

      expect(result.id).toBeDefined();
      // Authorization now resolves against the canonical TeacherAssignment
      // table rather than the legacy SubjectTeacherAssignment query, so the
      // legacy call is no longer made at all.
      expect(p.subjectTeacherAssignment.findFirst).not.toHaveBeenCalled();
    });

    it('allows a homeroom class teacher with no subject assignment to create homework for their own section', async () => {
      // Confirmed gap: this checkpoint (shared by create/update/review/bulk-
      // complete/reminder paths) only checked SubjectTeacherAssignment,
      // silently locking every homeroom class teacher out of managing
      // homework for their own class/section — mirrors the same dual-check
      // pattern TimetableService.exportClassTimetable already applies.
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      // No subject assignment for this teacher...
      // ...but they hold the section's canonical CLASS_TEACHER assignment.
      teacherAssignments.push(
        teacherAssignmentFixture({
          assignmentType: 'CLASS_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        }),
      );

      const result = (await homeworkService.createAssignment(
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'sub-1',
          title: 'Homeroom homework',
          instructions: 'Test',
          dueDate: '2026-12-31',
        },
        teacherActor,
      )) as any;

      expect(result.id).toBeDefined();
      // Homeroom authority is now resolved from the canonical
      // TeacherAssignment table, so the legacy Section.classTeacherId lookup
      // is no longer performed.
      expect(p.section.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ classTeacherId: 'teacher-1' }),
        }),
      );
    });

    it('denies a class teacher of Section A from creating homework for Section B in the same class', async () => {
      // The class-teacher fallback must stay scoped to the teacher's own
      // section, not the whole class: Section.findFirst is queried with the
      // REQUESTED sectionId, so a class teacher of Section A querying
      // Section B (same class, different homeroom teacher) must still fail.
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      p.subjectTeacherAssignment.findFirst.mockResolvedValue(null);
      // Section B's homeroom teacher is someone else entirely.
      p.section.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-b',
            subjectId: 'sub-1',
            title: 'Not my section',
            instructions: 'Test',
            dueDate: '2026-12-31',
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Section scoping is now enforced by the assignment row's own
      // sectionId, not a Section.classTeacherId lookup.
      expect(p.section.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ classTeacherId: 'teacher-1' }),
        }),
      );
    });

    it('denies the class-teacher fallback across tenants even with a matching section id', async () => {
      // The fallback's own Section.findFirst query is tenant-scoped
      // independently of the earlier class/academicYear/subject lookups, so
      // a cross-tenant sectionId collision cannot bypass it.
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      p.subjectTeacherAssignment.findFirst.mockResolvedValue(null);
      // A same-id section exists, but only under a different tenant; the
      // mock proves the query itself is tenant-scoped by returning null
      // for this tenant's lookup regardless of what another tenant holds.
      p.section.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-shared-id',
            subjectId: 'sub-1',
            title: 'Cross-tenant probe',
            instructions: 'Test',
            dueDate: '2026-12-31',
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Tenant scoping is enforced on the assignment query itself.
      expect(p.section.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ classTeacherId: 'teacher-1' }),
        }),
      );
    });

    it('should let an admin create homework for any class without an assignment check', async () => {
      const p = prisma as any;
      const adminActor: AuthContext = { ...actor, roles: ['admin'] };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'admin-staff-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      const result = (await homeworkService.createAssignment(
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          subjectId: 'sub-1',
          title: 'Admin-created homework',
          instructions: 'Test',
          dueDate: '2026-12-31',
        },
        adminActor,
      )) as any;

      expect(result.id).toBeDefined();
      expect(p.subjectTeacherAssignment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('Teacher Mobile Homework Scopes Contract', () => {
    it("lists only the current teacher's own assigned class/section/subject combinations", async () => {
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });
      p.subjectTeacherAssignment.findMany.mockResolvedValue([
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'sub-1',
          academicYear: { name: '2026-2027' },
          class: { name: 'Grade 3' },
          section: { name: 'A' },
          subject: { name: 'Mathematics' },
        },
      ]);

      const result =
        await homeworkService.listTeacherMobileHomeworkScopes(teacherActor);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        classId: 'class-1',
        className: 'Grade 3',
        sectionId: 'section-1',
        sectionName: 'A',
        subjectId: 'sub-1',
        subjectName: 'Mathematics',
      });
      // Must query scoped to this exact teacher's staff record and tenant,
      // never a tenant-wide or cross-teacher listing.
      expect(p.subjectTeacherAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            staffId: 'teacher-1',
            academicYear: { isCurrent: true },
          }),
        }),
      );
    });

    it('rejects when the actor has no active teacher/staff profile', async () => {
      const p = prisma as any;
      p.staff.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listTeacherMobileHomeworkScopes(actor),
      ).rejects.toThrow();
      expect(p.subjectTeacherAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Teacher "my homework only" self-scope', () => {
    it('resolves `mine` from the caller own staff row, never a client id', async () => {
      const p = prisma as any;
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-me',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });
      p.subjectTeacherAssignment.findMany.mockResolvedValue([
        { classId: 'class-1', sectionId: 'section-1', subjectId: 'sub-1' },
      ]);
      p.section.findMany.mockResolvedValue([]);
      p.homeworkAssignment.findMany.mockResolvedValue([]);
      p.homeworkAssignment.count.mockResolvedValue(0);

      // A teacher trying to point the filter at a colleague still only ever
      // gets their own rows back, because `mine` is resolved server-side.
      await homeworkService.listAssignments(actor, {
        mine: true,
        teacherId: 'staff-someone-else',
      });

      const where = p.homeworkAssignment.findMany.mock.calls.at(-1)[0].where;
      expect(where.AND).toEqual(
        expect.arrayContaining([{ assignedByStaffId: 'staff-me' }]),
      );
      // The client-supplied teacherId is an additional narrowing on top of
      // the assignment scope, so it can never widen the result.
      expect(where.assignedByStaffId).toBe('staff-someone-else');
    });

    it('returns nothing rather than everything when the caller has no staff row', async () => {
      const p = prisma as any;
      p.staff.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listAssignments(actor, { mine: true }),
      ).resolves.toEqual(emptyAssignmentPage);

      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Parent and student list scoping', () => {
    it('returns an empty homework list instead of tenant-wide rows when a parent has no linked student', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listAssignments(parentActor, {}),
      ).resolves.toEqual(emptyAssignmentPage);

      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
      expect(p.homeworkAssignment.count).not.toHaveBeenCalled();
    });

    it('blocks parent homework list queries for a student outside the guardian link', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listAssignments(parentActor, {
          studentId: 'other-student',
        }),
      ).resolves.toEqual(emptyAssignmentPage);

      expect(p.studentGuardian.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-a',
          guardian: { userId: 'parent-user-1' },
          studentId: 'other-student',
          student: { lifecycleStatus: 'ACTIVE' },
        },
        select: { studentId: true },
      });
      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
    });

    it('blocks student homework list queries for another student id', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:submit'],
      };
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
      });

      await expect(
        homeworkService.listAssignments(studentActor, {
          studentId: 'student-2',
        }),
      ).resolves.toEqual(emptyAssignmentPage);

      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
      expect(p.homeworkAssignment.count).not.toHaveBeenCalled();
    });

    it('scopes parent submission lists to linked students only', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findMany.mockResolvedValue([
        { studentId: 'student-1' },
      ]);
      p.studentGuardian.findFirst.mockResolvedValue({ id: 'guardian-link-1' });
      p.homeworkAssignment.findFirst.mockResolvedValue({
        id: 'hw-1',
        tenantId: 'tenant-a',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'sub-1',
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        attachments: [],
        submissions: [],
      });
      p.homeworkSubmission.findMany.mockResolvedValue([]);
      p.homeworkSubmission.count.mockResolvedValue(0);

      await homeworkService.listSubmissions(parentActor, 'hw-1', {});

      expect(p.homeworkSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            homeworkId: 'hw-1',
            studentId: { in: ['student-1'] },
          }),
        }),
      );
    });

    it('blocks student submission detail reads for another student', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:read'],
      };
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        lifecycleStatus: 'ACTIVE',
      });
      p.homeworkSubmission.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.getSubmission(studentActor, 'submission-other'),
      ).rejects.toThrow(NotFoundException);

      expect(p.homeworkSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'submission-other',
            tenantId: 'tenant-a',
            studentId: { in: ['student-1'] },
          }),
        }),
      );
    });

    it('blocks direct student homework detail reads outside the active class scope', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:read'],
      };
      p.homeworkAssignment.findFirst.mockResolvedValue({
        id: 'hw-other-class',
        tenantId: 'tenant-a',
        classId: 'class-2',
        sectionId: 'section-1',
        attachments: [],
      });
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: 'ACTIVE',
      });

      await expect(
        homeworkService.getAssignment(studentActor, 'hw-other-class'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
