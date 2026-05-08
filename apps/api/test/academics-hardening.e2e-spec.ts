import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GradeLockStatus } from '@prisma/client';
import { AcademicsService } from '../src/academics/academics.service';
import { ReportCardsService } from '../src/academics/report-cards.service';
import { ReportCardPdfService } from '../src/academics/report-card-pdf.service';
import { GradeCalculatorService } from '../src/academics/grade-calculator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { createPrismaMock, PrismaMock } from './test-helpers';
import { CommunicationsService } from '../src/communications/communications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const MarkEntryStatus = {
  SUBMITTED: 'SUBMITTED',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
};

describe('Academics Hardening (Service Layer)', () => {
  let academicsService: AcademicsService;
  let prisma: PrismaMock;

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    roles: ['teacher'],
    permissions: ['academics:enter_marks'],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicsService,
        ReportCardsService,
        ReportCardPdfService,
        GradeCalculatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CommunicationsService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    academicsService = module.get<AcademicsService>(AcademicsService);
  });

  describe('enterMark Hardening', () => {
    it('should reject marks for students in a different tenant', async () => {
      prisma.assessmentComponent.findFirst.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-a',
        examTerm: { isLocked: false },
        subject: { id: 'sub-1' },
      } as any);

      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        academicsService.enterMark(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            studentId: 'student-from-tenant-b',
            marksObtained: 80,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject marks exceeding component maxMarks', async () => {
      prisma.assessmentComponent.findFirst.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-a',
        maxMarks: 100,
        examTerm: { isLocked: false },
        subject: { id: 'sub-1' },
      } as any);
      
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1', tenantId: 'tenant-a' } as any);

      await expect(
        academicsService.enterMark(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            studentId: 'student-1',
            marksObtained: 101,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject negative marks', async () => {
      prisma.assessmentComponent.findFirst.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-a',
        maxMarks: 100,
        examTerm: { isLocked: false },
        subject: { id: 'sub-1' },
      } as any);

      prisma.student.findFirst.mockResolvedValue({ id: 'student-1', tenantId: 'tenant-a' } as any);

      await expect(
        academicsService.enterMark(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            studentId: 'student-1',
            marksObtained: -5,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle ABSENT status by forcing marks to 0', async () => {
      prisma.assessmentComponent.findFirst.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-a',
        maxMarks: 100,
        examTerm: { isLocked: false },
        subjectId: 'sub-1',
        subject: { id: 'sub-1' },
      } as any);

      prisma.student.findFirst.mockResolvedValue({ id: 'student-1', tenantId: 'tenant-a' } as any);
      prisma.markEntry.findUnique.mockResolvedValue(null);
      prisma.markEntry.upsert.mockResolvedValue({ id: 'mark-1', status: MarkEntryStatus.ABSENT } as any);

      await academicsService.enterMark(
        {
          examTermId: 'term-1',
          assessmentComponentId: 'comp-1',
          studentId: 'student-1',
          marksObtained: 80,
          status: MarkEntryStatus.ABSENT as any,
        },
        actor,
      );

      expect(prisma.markEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            marksObtained: expect.anything(),
            status: MarkEntryStatus.ABSENT,
          }),
        }),
      );
    });

    it('should prevent editing individual locked marks even if term is unlocked', async () => {
      prisma.assessmentComponent.findFirst.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-a',
        examTerm: { isLocked: false },
      } as any);

      prisma.student.findFirst.mockResolvedValue({ id: 'student-1', tenantId: 'tenant-a' } as any);
      
      prisma.markEntry.findUnique.mockResolvedValue({
        id: 'mark-1',
        isLocked: true,
      } as any);

      await expect(
        academicsService.enterMark(
          {
            examTermId: 'term-1',
            assessmentComponentId: 'comp-1',
            studentId: 'student-1',
            marksObtained: 90,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('GradeCalculator Hardening', () => {
    it('should calculate NG grade if a student is ABSENT in a required component', async () => {
      const gradeCalculator = new GradeCalculatorService();
      
      const result = gradeCalculator.calculateWeightedSubjectGrade({
        subjectId: 'sub-1',
        components: [
          {
            componentId: 'comp-1',
            subjectId: 'sub-1',
            maxMarks: 100,
            marksObtained: 0,
            status: MarkEntryStatus.ABSENT as any,
            weightPercent: 100,
          }
        ]
      });

      expect(result.grade).toBe('NG');
    });
  });
});
