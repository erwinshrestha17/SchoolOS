import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GradeLockStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { PromotionReadinessService } from './promotion-readiness.service';

describe('PromotionReadinessService', () => {
  let service: PromotionReadinessService;
  let prisma: {
    academicYear: { findFirst: jest.Mock };
    examTerm: { findFirst: jest.Mock };
    class: { findFirst: jest.Mock };
    section: { findFirst: jest.Mock };
    student: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    reportCard: { findMany: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
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
    permissions: ['academics:update'],
  } as AuthContext;

  beforeEach(async () => {
    prisma = {
      academicYear: { findFirst: jest.fn() },
      examTerm: { findFirst: jest.fn() },
      class: { findFirst: jest.fn() },
      section: { findFirst: jest.fn() },
      student: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      reportCard: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback as Promise<unknown>[]);
      }),
    };
    auditService = { record: jest.fn() };
    financeService = { getStudentFeeLedger: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionReadinessService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: FinanceService, useValue: financeService },
      ],
    }).compile();

    service = module.get(PromotionReadinessService);
  });

  function mockReferenceData() {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.examTerm.findFirst.mockResolvedValue({ id: 'term-1' });
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({ id: 'section-1' });
    financeService.getStudentFeeLedger.mockResolvedValue({
      outstandingBalance: 0,
    });
  }

  function student(overrides: Record<string, unknown> = {}) {
    return {
      id: 'student-1',
      firstNameEn: 'John',
      lastNameEn: 'Doe',
      studentSystemId: 'STD-001',
      classId: 'class-1',
      sectionId: 'section-1',
      lifecycleStatus: 'ACTIVE',
      class: { id: 'class-1', name: 'Class 5' },
      sectionRef: { id: 'section-1', name: 'A' },
      ...overrides,
    };
  }

  it('rejects readiness when academic year is outside tenant', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);

    await expect(
      service.listPromotionReadiness(actor, { academicYearId: 'foreign-year' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns BLOCKED when report card is missing', async () => {
    mockReferenceData();
    prisma.student.findMany.mockResolvedValue([student()]);
    prisma.reportCard.findMany.mockResolvedValue([]);

    const result = await service.listPromotionReadiness(actor, {
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        status: 'BLOCKED',
        recommendedAction: 'HOLD',
        reasons: ['MISSING_REPORT_CARD'],
      }),
    );
  });

  it('returns READY for locked passing report card', async () => {
    mockReferenceData();
    prisma.student.findMany.mockResolvedValue([student()]);
    prisma.reportCard.findMany.mockResolvedValue([
      {
        id: 'report-card-1',
        studentId: 'student-1',
        status: GradeLockStatus.LOCKED,
        percentage: new Prisma.Decimal(85),
        grade: 'A',
        gpa: new Prisma.Decimal(3.6),
      },
    ]);

    const result = await service.listPromotionReadiness(actor, {
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
      status: 'READY',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        reportCardId: 'report-card-1',
        status: 'READY',
        recommendedAction: 'PROMOTE',
        reasons: ['READY'],
        percentage: 85,
        grade: 'A',
        gpa: 3.6,
      }),
    );
  });

  it('returns NEEDS_REVIEW for locked failing report card', async () => {
    mockReferenceData();
    prisma.student.findMany.mockResolvedValue([student()]);
    prisma.reportCard.findMany.mockResolvedValue([
      {
        id: 'report-card-1',
        studentId: 'student-1',
        status: GradeLockStatus.LOCKED,
        percentage: new Prisma.Decimal(20),
        grade: 'NG',
        gpa: new Prisma.Decimal(0),
      },
    ]);

    const result = await service.listPromotionReadiness(actor, {
      academicYearId: 'year-1',
      status: 'NEEDS_REVIEW',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        status: 'NEEDS_REVIEW',
        recommendedAction: 'REVIEW',
        reasons: ['FAILED_SUBJECTS'],
      }),
    );
  });

  it('blocks promotion when student is not ready', async () => {
    mockReferenceData();
    prisma.student.findFirst.mockResolvedValue(student());
    prisma.reportCard.findFirst.mockResolvedValue(null);

    await expect(
      service.promoteStudent(
        {
          academicYearId: 'year-1',
          targetAcademicYearId: 'year-2',
          studentId: 'student-1',
          toClassId: 'class-2',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMICS_PROMOTION_BLOCKED' }),
    );
  });

  it('promotes READY student transactionally and audits the change', async () => {
    mockReferenceData();
    prisma.academicYear.findFirst
      .mockResolvedValueOnce({ id: 'year-1' })
      .mockResolvedValueOnce({ id: 'year-2' });
    prisma.class.findFirst.mockResolvedValue({ id: 'class-2' });
    prisma.student.findFirst.mockResolvedValue(student());
    prisma.reportCard.findFirst.mockResolvedValue({
      id: 'report-card-1',
      studentId: 'student-1',
      status: GradeLockStatus.LOCKED,
      percentage: new Prisma.Decimal(85),
      grade: 'A',
      gpa: new Prisma.Decimal(3.6),
    });
    prisma.student.update.mockResolvedValue(
      student({ classId: 'class-2', sectionId: null }),
    );

    const result = await service.promoteStudent(
      {
        academicYearId: 'year-1',
        targetAcademicYearId: 'year-2',
        studentId: 'student-1',
        toClassId: 'class-2',
      },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ classId: 'class-2' }));
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMICS_STUDENT_PROMOTED' }),
    );
  });

  it('rejects duplicate student IDs in batch promotion', async () => {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.class.findFirst.mockResolvedValue({ id: 'class-2' });

    await expect(
      service.batchPromote(
        {
          academicYearId: 'year-1',
          targetAcademicYearId: 'year-2',
          classMappings: [
            {
              fromClassId: 'class-1',
              toClassId: 'class-2',
              studentIds: ['student-1', 'student-1'],
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('flags student as NEEDS_REVIEW with UNPAID_DUES reason if outstanding balance exists', async () => {
    mockReferenceData();
    financeService.getStudentFeeLedger.mockResolvedValue({
      outstandingBalance: 120,
    });
    prisma.student.findMany.mockResolvedValue([student()]);
    prisma.reportCard.findMany.mockResolvedValue([
      {
        id: 'report-card-1',
        studentId: 'student-1',
        status: GradeLockStatus.LOCKED,
        percentage: new Prisma.Decimal(85),
        grade: 'A',
        gpa: new Prisma.Decimal(3.6),
      },
    ]);

    const result = await service.listPromotionReadiness(actor, {
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        status: 'NEEDS_REVIEW',
        reasons: expect.arrayContaining(['UNPAID_DUES']),
        outstandingBalance: 120,
      }),
    );
  });
});
