import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GradeLockStatus, MarkEntryStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { GradeCalculatorService } from './grade-calculator.service';
import { ReportCardsService } from './report-cards.service';
import { UsageService } from '../usage/usage.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ReportCardsService', () => {
  let service: ReportCardsService;
  let prisma: any;
  let auditService: { record: jest.Mock };
  let financeService: { getStudentFeeLedger: jest.Mock };
  let academicsQueue: { add: jest.Mock };

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['academics:manage_report_cards'],
  } as AuthContext;

  const dto = {
    academicYearId: 'year-1',
    examTermId: 'term-1',
    studentId: 'student-1',
    remarks: 'Good progress',
    lock: true,
  };

  beforeEach(async () => {
    prisma = {
      academicYear: { findFirst: jest.fn() },
      examTerm: { findFirst: jest.fn() },
      student: { findFirst: jest.fn() },
      tenantSetting: { findFirst: jest.fn() },
      assessmentComponent: { findMany: jest.fn() },
      assessmentRetake: { findFirst: jest.fn().mockResolvedValue(null) },
      markEntry: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      reportCard: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      reportCardCorrectionRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      reportCardHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };
    financeService = { getStudentFeeLedger: jest.fn() };
    academicsQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportCardsService,
        GradeCalculatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: FinanceService, useValue: financeService },
        {
          provide: SettingsService,
          useValue: { getSetting: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: UsageService,
          useValue: {
            verifyLimit: jest.fn().mockResolvedValue(undefined),
            checkLimit: jest.fn().mockResolvedValue(undefined),
            incrementUsage: jest.fn().mockResolvedValue(undefined),
          } as any,
        },
        {
          provide: getQueueToken('academics'),
          useValue: academicsQueue,
        },
      ],
    }).compile();

    service = module.get(ReportCardsService);
  });

  function mockValidBase() {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.examTerm.findFirst.mockResolvedValue({
      id: 'term-1',
      academicYearId: 'year-1',
      isLocked: true,
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      classId: 'class-1',
      sectionId: 'section-1',
      class: { id: 'class-1', name: 'Class 5' },
      sectionRef: { id: 'section-1', name: 'A' },
    });
    prisma.reportCard.findUnique.mockResolvedValue(null);
    prisma.tenantSetting.findFirst.mockResolvedValue(null);
    prisma.assessmentComponent.findMany.mockResolvedValue([
      {
        id: 'component-1',
        tenantId: actor.tenantId,
        examTermId: 'term-1',
        subjectId: 'subject-1',
        name: 'Theory',
        type: 'THEORY',
        maxMarks: new Prisma.Decimal(100),
        passMarks: new Prisma.Decimal(35),
        weightPercent: new Prisma.Decimal(100),
        subject: {
          id: 'subject-1',
          name: 'Mathematics',
          code: 'MATH',
          classId: 'class-1',
        },
      },
    ]);
    prisma.markEntry.findMany.mockResolvedValue([
      {
        id: 'mark-1',
        tenantId: actor.tenantId,
        examTermId: 'term-1',
        studentId: 'student-1',
        assessmentComponentId: 'component-1',
        subjectId: 'subject-1',
        marksObtained: new Prisma.Decimal(85),
        status: MarkEntryStatus.SUBMITTED,
        isLocked: true,
        assessmentComponent: { id: 'component-1' },
        subject: { id: 'subject-1' },
      },
    ]);
    prisma.reportCard.upsert.mockResolvedValue({
      id: 'report-card-1',
      status: GradeLockStatus.LOCKED,
    });
  }

  it('rejects generation when academic year is outside tenant', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    prisma.examTerm.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('requires the exam term marks to be locked before generation', async () => {
    mockValidBase();
    prisma.examTerm.findFirst.mockResolvedValue({
      id: 'term-1',
      academicYearId: 'year-1',
      isLocked: false,
    });

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects regeneration of an already locked report card', async () => {
    mockValidBase();
    prisma.reportCard.findUnique.mockResolvedValue({
      id: 'report-card-1',
      status: GradeLockStatus.LOCKED,
    });

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects generation when available marks are not locked', async () => {
    mockValidBase();
    prisma.markEntry.findMany.mockResolvedValue([
      {
        id: 'mark-1',
        assessmentComponentId: 'component-1',
        marksObtained: new Prisma.Decimal(85),
        status: MarkEntryStatus.SUBMITTED,
        isLocked: false,
      },
    ]);

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects incomplete report cards when component marks are missing', async () => {
    mockValidBase();
    prisma.markEntry.findMany.mockResolvedValue([]);

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects withheld report cards', async () => {
    mockValidBase();
    prisma.markEntry.findMany.mockResolvedValue([
      {
        id: 'mark-1',
        assessmentComponentId: 'component-1',
        marksObtained: new Prisma.Decimal(0),
        status: MarkEntryStatus.WITHHELD,
        isLocked: true,
      },
    ]);

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('blocks generation when fee-dues setting is enabled and student has outstanding balance', async () => {
    mockValidBase();
    prisma.tenantSetting.findFirst.mockResolvedValue({ value: 'true' });
    financeService.getStudentFeeLedger.mockResolvedValue({
      outstandingBalance: 500,
    });

    await expect(service.generateReportCard(dto, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('stores true total obtained and total full marks, not percentage as total marks', async () => {
    mockValidBase();

    await service.generateReportCard(dto, actor);

    expect(prisma.reportCard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalMarks: expect.objectContaining({
            toString: expect.any(Function),
          }),
          maxMarks: expect.objectContaining({
            toString: expect.any(Function),
          }),
          percentage: expect.objectContaining({
            toString: expect.any(Function),
          }),
          status: GradeLockStatus.LOCKED,
          lockedAt: expect.any(Date),
        }),
      }),
    );

    const upsertArg = prisma.reportCard.upsert.mock.calls[0][0];
    expect(Number(upsertArg.create.totalMarks)).toBe(85);
    expect(Number(upsertArg.create.maxMarks)).toBe(100);
    expect(Number(upsertArg.create.percentage)).toBe(85);
    expect(upsertArg.create.subjectResults.create).toEqual([
      expect.objectContaining({
        tenantId: actor.tenantId,
        version: 1,
        subjectId: 'subject-1',
        subjectName: 'Mathematics',
        subjectCode: 'MATH',
        grade: 'A',
      }),
    ]);
  });

  it('audits successful report card generation with academic summary', async () => {
    mockValidBase();

    await service.generateReportCard(dto, actor);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_REPORT_CARD_GENERATED',
        resource: 'report_card',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: expect.objectContaining({
          totalObtained: 85,
          totalFullMarks: 100,
          percentage: 85,
          resultStatus: 'PASS',
        }),
      }),
    );
  });

  it('rejects duplicate student IDs in batch generation', async () => {
    await expect(
      service.batchGenerateReportCards(
        {
          academicYearId: 'year-1',
          examTermId: 'term-1',
          studentIds: ['student-1', 'student-1'],
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('queues batch generation job when studentIds count is greater than 20', async () => {
    mockValidBase();
    const studentIds = Array.from({ length: 21 }, (_, i) => `student-${i}`);
    const result = await service.batchGenerateReportCards(
      {
        academicYearId: 'year-1',
        examTermId: 'term-1',
        studentIds,
        remarks: 'Batch test',
        lock: true,
      },
      actor,
    );

    expect(result.queued).toBe(true);
    expect(result.jobId).toBe('job-1');
    expect(academicsQueue.add).toHaveBeenCalledWith(
      'batchGenerateReportCards',
      expect.objectContaining({
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        examTermId: 'term-1',
        studentIds,
        remarks: 'Batch test',
        lock: true,
      }),
    );
  });

  it('requires a reason before requesting a locked report-card correction', async () => {
    await expect(
      service.requestCorrection('report-card-1', { reason: ' ' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('creates an auditable correction request for a tenant-scoped report card', async () => {
    prisma.reportCard.findFirst.mockResolvedValue({
      id: 'report-card-1',
      tenantId: actor.tenantId,
      version: 1,
    });
    prisma.reportCardCorrectionRequest.create.mockResolvedValue({
      id: 'corr-1',
      reportCardId: 'report-card-1',
    });

    const result = await service.requestCorrection(
      'report-card-1',
      { reason: 'Corrected Science marks after review' },
      actor,
    );

    expect(result.id).toBe('corr-1');
    expect(prisma.reportCard.findFirst).toHaveBeenCalledWith({
      where: { id: 'report-card-1', tenantId: actor.tenantId },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_REPORT_CARD_CORRECTION_REQUESTED',
        resourceId: 'report-card-1',
      }),
    );
  });

  it('regenerates a locked report card by preserving history in a transaction', async () => {
    mockValidBase();
    prisma.reportCard.findFirst.mockResolvedValue({
      id: 'report-card-1',
      tenantId: actor.tenantId,
      academicYearId: dto.academicYearId,
      examTermId: dto.examTermId,
      studentId: dto.studentId,
      classId: 'class-1',
      sectionId: 'section-1',
      totalMarks: new Prisma.Decimal(70),
      maxMarks: new Prisma.Decimal(100),
      percentage: new Prisma.Decimal(70),
      grade: 'B+',
      gpa: new Prisma.Decimal(3.2),
      remarks: null,
      version: 1,
      status: GradeLockStatus.LOCKED,
      fileId: 'file-old',
      publishStatus: 'PUBLISHED',
      publishedAt: new Date('2026-01-01'),
      publishedById: 'user-old',
      examTerm: { isLocked: true },
    });
    prisma.reportCardCorrectionRequest.findFirst.mockResolvedValue({
      id: 'corr-1',
      status: 'APPROVED',
    });
    prisma.reportCardCorrectionRequest.update.mockResolvedValue({
      id: 'corr-1',
      status: 'COMPLETED',
    });
    prisma.reportCardHistory.create.mockResolvedValue({ id: 'hist-1' });
    prisma.reportCard.update.mockResolvedValue({
      id: 'report-card-1',
      version: 2,
      publishStatus: 'CORRECTED_DRAFT',
    });
    prisma.markEntry.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.applyCorrectionAndRegenerate(
      'report-card-1',
      { reason: 'Reviewed mark correction' },
      actor,
    );

    expect(result.version).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.reportCardHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportCardId: 'report-card-1',
          version: 1,
          fileId: 'file-old',
        }),
      }),
    );
    expect(prisma.reportCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          fileId: null,
          publishStatus: 'CORRECTED_DRAFT',
          subjectResults: {
            create: [
              expect.objectContaining({
                version: 2,
                subjectId: 'subject-1',
              }),
            ],
          },
        }),
      }),
    );
  });
});
