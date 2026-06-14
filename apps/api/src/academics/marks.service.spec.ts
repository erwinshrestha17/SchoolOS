import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, MarkEntryStatus, Prisma } from '@prisma/client';
import { MarksService } from './marks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';

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
      ],
    }).compile();

    service = module.get<MarksService>(MarksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists absent, withheld, and retest mark states through tenant-scoped bulk upsert', async () => {
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
          { id: 'student-absent', tenantId: actor.tenantId },
          { id: 'student-withheld', tenantId: actor.tenantId },
          { id: 'student-retest', tenantId: actor.tenantId },
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
    );

    const result = await marksService.bulkUpsert(
      {
        examTermId: 'term-1',
        assessmentComponentId: 'component-1',
        subjectId: 'subject-1',
        classId: 'class-1',
        entries: [
          { studentId: 'student-absent', isAbsent: true },
          { studentId: 'student-withheld', isWithheld: true },
          {
            studentId: 'student-retest',
            isRetest: true,
            marksObtained: 60,
            remarks: 'Make-up test scheduled',
          },
        ],
      },
      actor,
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['student-absent', 'student-withheld', 'student-retest'],
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
            studentId: 'student-absent',
          },
        },
        create: expect.objectContaining({
          status: MarkEntryStatus.ABSENT,
          marksObtained: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(prisma.markEntry.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          status: MarkEntryStatus.WITHHELD,
          marksObtained: new Prisma.Decimal(0),
        }),
      }),
    );
    expect(prisma.markEntry.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        create: expect.objectContaining({
          status: MarkEntryStatus.RETEST,
          marksObtained: new Prisma.Decimal(60),
          remarks: 'Make-up test scheduled',
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
});
