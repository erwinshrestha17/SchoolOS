import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, MarkEntryStatus } from '@prisma/client';
import { GradeCalculatorService } from '../src/academics/grade-calculator.service';
import { MarkSheetService } from '../src/academics/mark-sheet.service';
import { MarksService } from '../src/academics/marks.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TeacherScopeService } from '../src/teacher-scope/teacher-scope.service';
import { createPrismaMock, PrismaMock } from './test-helpers';

describe('Academics Hardening (Service Layer)', () => {
  let marksService: MarksService;
  let prisma: PrismaMock;

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    email: 'teacher@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['academics:enter_marks'],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: TeacherScopeService,
          useValue: {
            resolveActiveStaffId: jest.fn().mockResolvedValue('staff-1'),
            requireAccess: jest.fn().mockResolvedValue({
              source: 'ASSIGNMENT',
              assignmentId: 'assignment-1',
              componentScope: null,
            }),
          },
        },
        {
          // Sheet lifecycle collaborator (Phase 6.3): an editable DRAFT sheet.
          provide: MarkSheetService,
          useValue: {
            ensureSheet: jest.fn().mockResolvedValue({
              id: 'sheet-1',
              status: 'DRAFT',
              version: 1,
            }),
            claimForMarkWrite: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    marksService = module.get<MarksService>(MarksService);
  });

  function mockValidScope() {
    const p = prisma as unknown as {
      examTerm: { findFirst: jest.Mock };
      assessmentComponent: { findFirst: jest.Mock };
      student: { findMany: jest.Mock };
      markEntry: {
        findMany: jest.Mock;
        upsert: jest.Mock;
        findFirst: jest.Mock;
      };
      reportCardCorrectionRequest: { findMany: jest.Mock };
      $transaction: jest.Mock;
    };

    p.examTerm.findFirst.mockResolvedValue({
      id: 'term-1',
      tenantId: 'tenant-a',
    });
    p.assessmentComponent.findFirst.mockResolvedValue({
      id: 'comp-1',
      tenantId: 'tenant-a',
      examTermId: 'term-1',
      subjectId: 'sub-1',
      maxMarks: 100,
      subject: {
        id: 'sub-1',
        classId: 'class-1',
        class: { id: 'class-1' },
      },
    });
    p.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
        sectionId: 'section-1',
      },
    ]);
    p.reportCardCorrectionRequest = p.reportCardCorrectionRequest ?? {
      findMany: jest.fn(),
    };
    p.reportCardCorrectionRequest.findMany.mockResolvedValue([]);
    p.markEntry.findMany.mockResolvedValue([]);
    p.markEntry.upsert.mockResolvedValue({ id: 'mark-1' });
    p.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );

    return p;
  }

  describe('marks entry hardening', () => {
    it('rejects marks for students beyond the selected scope', async () => {
      const p = mockValidScope();
      p.student.findMany.mockResolvedValue([]);

      await expect(
        marksService.bulkUpsert(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            entries: [
              { studentId: 'student-from-tenant-b', marksObtained: 80 },
            ],
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects marks exceeding component maxMarks', async () => {
      mockValidScope();

      await expect(
        marksService.bulkUpsert(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            entries: [{ studentId: 'student-1', marksObtained: 101 }],
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects negative marks', async () => {
      mockValidScope();

      await expect(
        marksService.bulkUpsert(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            entries: [{ studentId: 'student-1', marksObtained: -5 }],
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('stores an absent entry as ABSENT with NULL marks, never zero', async () => {
      const p = mockValidScope();
      // bulkUpsert writes inside an interactive transaction (Phase 6.3).
      const tx = {
        markEntry: {
          create: jest.fn().mockResolvedValue({ id: 'mark-1' }),
          updateMany: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
      };
      p.$transaction.mockImplementation((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (client: unknown) => unknown)(tx)
          : Promise.all(arg as Promise<unknown>[]),
      );

      await marksService.bulkUpsert(
        {
          examTermId: 'term-1',
          assessmentComponentId: 'comp-1',
          classId: 'class-1',
          subjectId: 'sub-1',
          entries: [{ studentId: 'student-1', isAbsent: true }],
        },
        actor,
      );

      // Phase 6.3 invariant: absent marks are NULL (DB CHECK), never 0.
      expect(tx.markEntry.create).toHaveBeenCalledTimes(1);
      expect(tx.markEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          studentId: 'student-1',
          marksObtained: null,
          status: MarkEntryStatus.ABSENT,
        }),
      });
    });

    it('prevents editing locked marks', async () => {
      const p = mockValidScope();
      p.markEntry.findMany.mockResolvedValue([
        { id: 'mark-1', isLocked: true },
      ]);

      await expect(
        marksService.bulkUpsert(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            entries: [{ studentId: 'student-1', marksObtained: 90 }],
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('GradeCalculator hardening', () => {
    it('calculates NG grade for absent required component', () => {
      const gradeCalculator = new GradeCalculatorService();

      const result = gradeCalculator.calculateWeightedSubjectGrade({
        subjectId: 'sub-1',
        components: [
          {
            componentId: 'comp-1',
            subjectId: 'sub-1',
            maxMarks: 100,
            marksObtained: 0,
            status: MarkEntryStatus.ABSENT,
            weightPercent: 100,
          },
        ],
      });

      expect(result.grade).toBe('NG');
    });
  });
});
