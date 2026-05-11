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

describe('ReportCardsService', () => {
  let service: ReportCardsService;
  let prisma: {
    academicYear: { findFirst: jest.Mock };
    examTerm: { findFirst: jest.Mock };
    student: { findFirst: jest.Mock };
    tenantSetting: { findFirst: jest.Mock };
    assessmentComponent: { findMany: jest.Mock };
    markEntry: { findMany: jest.Mock };
    reportCard: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let auditService: { record: jest.Mock };
  let financeService: { getStudentFeeLedger: jest.Mock };

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
      markEntry: { findMany: jest.fn() },
      reportCard: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    auditService = { record: jest.fn() };
    financeService = { getStudentFeeLedger: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportCardsService,
        GradeCalculatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: FinanceService, useValue: financeService },
        { provide: SettingsService, useValue: {} },
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
          totalMarks: expect.objectContaining({ toString: expect.any(Function) }),
          maxMarks: expect.objectContaining({ toString: expect.any(Function) }),
          percentage: expect.objectContaining({ toString: expect.any(Function) }),
          status: GradeLockStatus.LOCKED,
          lockedAt: expect.any(Date),
        }),
      }),
    );

    const upsertArg = prisma.reportCard.upsert.mock.calls[0][0];
    expect(Number(upsertArg.create.totalMarks)).toBe(85);
    expect(Number(upsertArg.create.maxMarks)).toBe(100);
    expect(Number(upsertArg.create.percentage)).toBe(85);
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
});
