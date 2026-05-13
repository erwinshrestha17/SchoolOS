import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { StudentLifecycleStatus, EnrollmentStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth.types';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('StudentsService (Duplicate Merge)', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  const mockAuth: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
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
              update: jest.fn(),
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
            studentMergeHistory: {
              create: jest.fn(),
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
            conversationParticipant: { updateMany: jest.fn(), count: jest.fn() },
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: StorageService, useValue: {} },
        { provide: FileRegistryService, useValue: {} },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
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
            studentDocuments: 0,
            generatedStudentDocuments: 0,
            notificationDeliveries: 0,
            developmentalMilestones: 0,
            moodLogs: 0,
            libraryIssues: 0,
            transportEnrollments: 0,
            transportLogs: 0,
        }
    });
    (prisma.feeWaiver.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversation.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversationParticipant.count as jest.Mock).mockResolvedValue(0);

    const result = await service.previewMergeDuplicateStudent({
      sourceStudentId: 'source-1',
      targetStudentId: 'target-1',
    }, mockAuth);

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

    const result = await service.mergeDuplicateStudent({
      sourceStudentId: 'source-1',
      targetStudentId: 'target-1',
      reason: 'Duplicate entry'
    }, mockAuth);

    expect(result.mergeCounts.invoices).toBe(2);
    expect(prisma.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: sourceStudent.id },
      data: expect.objectContaining({ lifecycleStatus: StudentLifecycleStatus.MERGED })
    }));
    expect(prisma.studentMergeHistory.create).toHaveBeenCalled();
  });

  it('should fail if students are not probable duplicates', async () => {
     (prisma.student.findFirst as jest.Mock)
      .mockResolvedValueOnce(sourceStudent)
      .mockResolvedValueOnce({ ...targetStudent, firstNameEn: 'Different' });

     await expect(service.mergeDuplicateStudent({
        sourceStudentId: 'source-1',
        targetStudentId: 'target-1',
        reason: 'Test'
     }, mockAuth)).rejects.toThrow(BadRequestException);
  });
});
