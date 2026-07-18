import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { CommunicationsService } from '../communications/communications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { StudentPhotoService } from './student-photo.service';
import {
  EnrollmentStatus,
  StudentDuplicateReviewStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuthContext } from '../auth/auth.types';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('StudentsService (Duplicate Merge)', () => {
  let service: StudentsService;
  let prisma: PrismaService;
  let auditService: AuditService;

  const mockAuth: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['students:manage_lifecycle'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            studentGuardian: {
              createMany: jest.fn(),
            },
            studentDocument: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            generatedStudentDocument: {
              updateMany: jest.fn(),
            },
            invoice: {
              updateMany: jest.fn(),
            },
            payment: {
              updateMany: jest.fn(),
            },
            feeWaiver: {
              updateMany: jest.fn(),
              count: jest.fn(),
            },
            enrollment: {
              updateMany: jest.fn(),
            },
            attendanceRecord: {
              updateMany: jest.fn(),
            },
            studentMergeHistory: {
              create: jest.fn(),
            },
            studentDuplicateReview: {
              findUnique: jest.fn(),
            },
            studentLifecycleTransition: {
              create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
            notificationDelivery: { updateMany: jest.fn() },
            developmentalMilestone: { updateMany: jest.fn() },
            moodLog: { updateMany: jest.fn() },
            libraryIssue: { updateMany: jest.fn() },
            transportEnrollment: { updateMany: jest.fn() },
            transportLog: { updateMany: jest.fn() },
            conversation: { updateMany: jest.fn(), count: jest.fn() },
            conversationParticipant: {
              updateMany: jest.fn(),
              count: jest.fn(),
            },
            attendanceCorrectionRequest: { updateMany: jest.fn() },
            canteenStudentEnrollment: { updateMany: jest.fn() },
            canteenMealServing: { updateMany: jest.fn() },
            canteenWalletTransaction: { updateMany: jest.fn() },
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: CommunicationsService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: { sendEmail: jest.fn(), sendSms: jest.fn() },
        },
        {
          provide: UsageService,
          useValue: { verifyLimit: jest.fn(), checkLimit: jest.fn() },
        },
        { provide: StorageService, useValue: {} },
        { provide: FileRegistryService, useValue: {} },
        {
          provide: StudentPhotoService,
          useValue: { getPhotoContent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    const delegates = [
      prisma.studentGuardian,
      prisma.studentDocument,
      prisma.generatedStudentDocument,
      prisma.invoice,
      prisma.payment,
      prisma.feeWaiver,
      prisma.notificationDelivery,
      prisma.developmentalMilestone,
      prisma.moodLog,
      prisma.libraryIssue,
      prisma.transportEnrollment,
      prisma.transportLog,
      prisma.conversation,
      prisma.conversationParticipant,
      prisma.enrollment,
      prisma.attendanceRecord,
      prisma.attendanceCorrectionRequest,
      prisma.canteenStudentEnrollment,
      prisma.canteenMealServing,
      prisma.canteenWalletTransaction,
    ] as unknown as { updateMany?: jest.Mock; createMany?: jest.Mock }[];

    for (const delegate of delegates) {
      delegate.updateMany?.mockResolvedValue({ count: 0 });
      delegate.createMany?.mockResolvedValue({ count: 0 });
    }
    (prisma.studentDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.student.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
  });

  const sourceStudent = {
    id: 'source-1',
    tenantId: 'tenant-1',
    studentSystemId: 'SCH-001',
    firstNameEn: 'John',
    lastNameEn: 'Doe',
    dateOfBirth: new Date('2015-01-01'),
    lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    guardianLinks: [],
  };

  const targetStudent = {
    id: 'target-1',
    tenantId: 'tenant-1',
    studentSystemId: 'SCH-002',
    firstNameEn: 'John',
    lastNameEn: 'Doe',
    dateOfBirth: new Date('2015-01-01'),
    lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    guardianLinks: [],
  };

  it('should preview merge correctly', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce(targetStudent);

    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      _count: {
        invoices: 2,
        payments: 1,
        guardianLinks: 0,
        documents: 0,
        generatedDocuments: 0,
        notificationDeliveries: 0,
        developmentalMilestones: 0,
        moodLogs: 0,
        libraryIssues: 0,
        transportEnrollments: 0,
        transportLogs: 0,
      },
    });
    (prisma.feeWaiver.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversation.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversationParticipant.count as jest.Mock).mockResolvedValue(0);

    const result = await service.previewMergeDuplicateStudent(
      {
        sourceStudentId: 'source-1',
        targetStudentId: 'target-1',
      },
      mockAuth,
    );

    expect(result.mergeCounts.invoices).toBe(2);
    expect(result.isProbableDuplicate).toBe(true);
  });

  it('should execute merge transactionally', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce(targetStudent);

    (prisma.studentDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await service.mergeDuplicateStudent(
      {
        sourceStudentId: 'source-1',
        targetStudentId: 'target-1',
        reason: 'Duplicate entry',
      },
      mockAuth,
    );

    expect(result.mergeCounts.invoices).toBe(2);
    expect(prisma.student.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sourceStudent.id,
          tenantId: mockAuth.tenantId,
          lifecycleStatus: {
            in: [
              StudentLifecycleStatus.ACTIVE,
              StudentLifecycleStatus.ARCHIVED,
            ],
          },
        }),
        data: expect.objectContaining({
          lifecycleStatus: StudentLifecycleStatus.MERGED,
        }),
      }),
    );
    expect(prisma.studentMergeHistory.create).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'merge_duplicate',
        tenantId: mockAuth.tenantId,
        resourceId: sourceStudent.id,
      }),
      prisma,
    );
    expect(
      (prisma.studentMergeHistory.create as jest.Mock).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      (auditService.record as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('rejects when the source lifecycle changes before the conditional merge update', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce(targetStudent);
    (prisma.student.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: sourceStudent.id,
          targetStudentId: targetStudent.id,
          reason: 'Duplicate entry',
        },
        mockAuth,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.studentMergeHistory.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('keeps merge audit failure inside the transaction boundary', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce(targetStudent);
    (auditService.record as jest.Mock).mockRejectedValue(
      new Error('audit unavailable'),
    );

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: sourceStudent.id,
          targetStudentId: targetStudent.id,
          reason: 'Duplicate entry',
        },
        mockAuth,
      ),
    ).rejects.toThrow('audit unavailable');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.any(Object),
      prisma,
    );
  });

  it('requires a not-duplicate disposition to be reopened before merge', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce(targetStudent);
    (prisma.studentDuplicateReview.findUnique as jest.Mock).mockResolvedValue({
      status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
    });

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: 'source-1',
          targetStudentId: 'target-1',
          reason: 'Duplicate entry',
        },
        mockAuth,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.student.updateMany).not.toHaveBeenCalled();
    expect(prisma.studentMergeHistory.create).not.toHaveBeenCalled();
  });

  it('should fail if students are not probable duplicates', async () => {
    (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce({ ...targetStudent, firstNameEn: 'Different' });

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: 'source-1',
          targetStudentId: 'target-1',
          reason: 'Test',
        },
        mockAuth,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("should deny duplicate merge if the source or target student is not in the actor's tenant (cross-tenant merge denied)", async () => {
    // If the student is not in the actor's tenant, findFirst returns null, and it throws NotFoundException.
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: 'cross-source-1',
          targetStudentId: 'target-1',
          reason: 'Attempted cross-tenant merge',
        },
        mockAuth,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
