import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, MarkEntryStatus } from '@prisma/client';
import { GradeCalculatorService } from '../src/academics/grade-calculator.service';
import { MarksService } from '../src/academics/marks.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
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
      { id: 'student-1', tenantId: 'tenant-a', classId: 'class-1' },
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

    it('handles ABSENT status by storing zero marks', async () => {
      const p = mockValidScope();

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

      expect(p.markEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            marksObtained: expect.anything(),
            status: MarkEntryStatus.ABSENT,
          }),
        }),
      );
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
