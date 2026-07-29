import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, MarkEntryStatus, Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { MarksService } from './marks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import type { AuthContext } from '../auth/auth.types';
import {
  createTeacherScopeServiceForTests,
  teacherAssignmentFixture,
} from '../../test/test-helpers';

function makeAllowingTeacherScopeService() {
  return {
    resolveActiveStaffId: jest.fn().mockResolvedValue('staff-1'),
    requireAccess: jest.fn().mockResolvedValue({
      source: 'ASSIGNMENT',
      assignmentId: 'assignment-1',
      componentScope: null,
    }),
  };
}

describe('MarksService', () => {
  let service: MarksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarksService,
        {
          provide: PrismaService,
          useValue: {}, // Mock Prisma
        },
        {
          provide: AuditService,
          useValue: {}, // Mock AuditService
        },
        {
          provide: TeacherScopeService,
          useValue: {}, // Mock TeacherScopeService
        },
      ],
    }).compile();

    service = module.get<MarksService>(MarksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists draft, absent, and withheld states through tenant-scoped bulk upsert', async () => {
    const actor: AuthContext = {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-one',
      userId: 'teacher-1',
      email: 'teacher@schoolos.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['academics:marks'],
    };
    const prisma = {
      examTerm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'term-1',
          tenantId: actor.tenantId,
          isLocked: false,
        }),
      },
      assessmentComponent: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'component-1',
          tenantId: actor.tenantId,
          examTermId: 'term-1',
          subjectId: 'subject-1',
          maxMarks: new Prisma.Decimal(100),
          subject: {
            id: 'subject-1',
            classId: 'class-1',
            class: { id: 'class-1', name: 'Class 1' },
          },
        }),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'student-absent',
            tenantId: actor.tenantId,
            sectionId: 'section-1',
          },
          {
            id: 'student-withheld',
            tenantId: actor.tenantId,
            sectionId: 'section-1',
          },
          {
            id: 'student-draft',
            tenantId: actor.tenantId,
            sectionId: 'section-1',
          },
        ]),
      },
      reportCardCorrectionRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      markEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn((query: { create: Record<string, unknown> }) =>
          Promise.resolve({
            id: `mark-${String(query.create.studentId)}`,
            ...query.create,
          }),
        ),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const marksService = new MarksService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      makeAllowingTeacherScopeService() as unknown as TeacherScopeService,
    );

    const result = await marksService.bulkUpsert(
      {
        examTermId: 'term-1',
        assessmentComponentId: 'component-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        entries: [
          { studentId: 'student-draft', isDraft: true },
          { studentId: 'student-absent', isAbsent: true },
          { studentId: 'student-withheld', isWithheld: true },
        ],
      },
      actor,
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['student-draft', 'student-absent', 'student-withheld'],
        },
        tenantId: actor.tenantId,
        classId: 'class-1',
      },
    });
    expect(prisma.markEntry.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.markEntry.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          tenantId_assessmentComponentId_studentId: {
            tenantId: actor.tenantId,
            assessmentComponentId: 'component-1',
            studentId: 'student-draft',
          },
        },
        create: expect.objectContaining({
          status: MarkEntryStatus.DRAFT,
          marksObtained: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(prisma.markEntry.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          status: MarkEntryStatus.ABSENT,
          marksObtained: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(prisma.markEntry.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        create: expect.objectContaining({
          status: MarkEntryStatus.WITHHELD,
          marksObtained: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(result.updated).toBe(3);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_MARKS_BULK_UPSERTED',
        resource: 'mark_entry',
        tenantId: actor.tenantId,
        after: expect.objectContaining({
          componentId: 'component-1',
          count: 3,
        }),
      }),
    );
  });

  it('rejects direct retest flags so lifecycle records cannot be bypassed', async () => {
    const actor = {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-one',
      userId: 'teacher-1',
      email: 'teacher@schoolos.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['academics:enter_marks'],
    } as AuthContext;
    const prisma = {
      examTerm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'term-1',
          tenantId: actor.tenantId,
          isLocked: false,
        }),
      },
      assessmentComponent: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'component-1',
          tenantId: actor.tenantId,
          examTermId: 'term-1',
          subjectId: 'subject-1',
          maxMarks: new Prisma.Decimal(100),
          subject: {
            id: 'subject-1',
            classId: 'class-1',
            class: { id: 'class-1', name: 'Class 1' },
          },
        }),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'student-1',
            tenantId: actor.tenantId,
            sectionId: 'section-1',
          },
        ]),
      },
    };
    const marksService = new MarksService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
      makeAllowingTeacherScopeService() as unknown as TeacherScopeService,
    );

    await expect(
      marksService.bulkUpsert(
        {
          examTermId: 'term-1',
          assessmentComponentId: 'component-1',
          subjectId: 'subject-1',
          classId: 'class-1',
          entries: [
            {
              studentId: 'student-1',
              isRetest: true,
              marksObtained: 60,
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('assessment-retakes workflow');
  });

  describe('teacher authorization (DEF-03)', () => {
    const teacherActor: AuthContext = {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-one',
      userId: 'teacher-user-1',
      email: 'teacher@schoolos.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['academics:enter_marks'],
    };

    let teacherAssignments: Array<Record<string, unknown>>;

    function buildMarksService(prisma: Record<string, unknown>) {
      const deps = createTeacherScopeServiceForTests({
        get assignments() {
          return teacherAssignments;
        },
        staffId: 'staff-1',
      } as never);
      const teacherScopeService = new TeacherScopeService(
        deps.prisma as never,
        deps.audit as never,
      );
      return new MarksService(
        prisma as unknown as PrismaService,
        { record: jest.fn() } as unknown as AuditService,
        teacherScopeService,
      );
    }

    beforeEach(() => {
      teacherAssignments = [];
    });

    it('updateMark denies a teacher without MARKS_ENTER assignment for the mark scope', async () => {
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-other',
        }),
      ];
      const prisma = {
        markEntry: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mark-1',
            tenantId: 'tenant-1',
            studentId: 'student-1',
            examTermId: 'term-1',
            subjectId: 'subject-1',
            status: MarkEntryStatus.SUBMITTED,
            marksObtained: new Prisma.Decimal(80),
            isLocked: false,
            assessmentComponent: {
              type: 'THEORY',
              maxMarks: new Prisma.Decimal(100),
            },
          }),
          update: jest.fn(),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'student-1',
            classId: 'class-1',
            sectionId: 'section-1',
          }),
        },
        examTerm: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'term-1',
            academicYearId: 'year-1',
            isLocked: false,
          }),
        },
        assessmentRetake: { findFirst: jest.fn().mockResolvedValue(null) },
        reportCardCorrectionRequest: { findFirst: jest.fn() },
      };
      const marksService = buildMarksService(prisma);

      await expect(
        marksService.updateMark('mark-1', { marksObtained: 90 }, teacherActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.markEntry.update).not.toHaveBeenCalled();
    });

    it('updateMark allows a teacher with matching MARKS_ENTER assignment', async () => {
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        }),
      ];
      const prisma = {
        markEntry: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mark-1',
            tenantId: 'tenant-1',
            studentId: 'student-1',
            examTermId: 'term-1',
            subjectId: 'subject-1',
            status: MarkEntryStatus.SUBMITTED,
            marksObtained: new Prisma.Decimal(80),
            isLocked: false,
            remarks: null,
            assessmentComponent: {
              type: 'THEORY',
              maxMarks: new Prisma.Decimal(100),
            },
          }),
          update: jest.fn().mockResolvedValue({
            id: 'mark-1',
            marksObtained: new Prisma.Decimal(90),
            status: MarkEntryStatus.SUBMITTED,
          }),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'student-1',
            classId: 'class-1',
            sectionId: 'section-1',
          }),
        },
        examTerm: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'term-1',
            academicYearId: 'year-1',
            isLocked: false,
          }),
        },
        assessmentRetake: { findFirst: jest.fn().mockResolvedValue(null) },
        reportCardCorrectionRequest: { findFirst: jest.fn() },
      };
      const marksService = buildMarksService(prisma);

      await expect(
        marksService.updateMark('mark-1', { marksObtained: 90 }, teacherActor),
      ).resolves.toBeDefined();
      expect(prisma.markEntry.update).toHaveBeenCalled();
    });

    it('listMarks scopes results to SUBJECT_RECORD_READ assignments for teachers', async () => {
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        }),
      ];
      const prisma = {
        markEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      const marksService = buildMarksService(prisma);

      await marksService.listMarks(teacherActor, { page: 1, limit: 10 });

      expect(prisma.markEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: teacherActor.tenantId,
            AND: [
              {
                OR: [
                  {
                    examTerm: { academicYearId: 'year-1' },
                    subjectId: 'subject-1',
                    student: {
                      classId: 'class-1',
                      sectionId: 'section-1',
                    },
                  },
                ],
              },
            ],
          }),
        }),
      );
    });

    it('getStudentHistory denies a teacher for a student outside teaching scope', async () => {
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        }),
      ];
      const prisma = {
        student: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'student-9',
            classId: 'class-9',
            sectionId: 'section-9',
          }),
        },
      };
      const marksService = buildMarksService(prisma);

      await expect(
        marksService.getStudentHistory('student-9', teacherActor, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
