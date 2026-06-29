import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  FileStatus,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
} from '@prisma/client';
import { HomeworkService } from './homework.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import { getQueueToken } from '@nestjs/bullmq';

describe('Homework Workflow', () => {
  let service: HomeworkService;
  let prisma: any;

  const mockActor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-1',
    email: 'teacher@school.edu',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['homework:manage', 'homework:review', 'homework:submit'],
  };

  const mockAssignment = {
    id: 'hw-1',
    tenantId: 'tenant-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'sub-1',
    assignedByStaffId: 'staff-1',
    title: 'Math Homework',
    instructions: 'Solve quadratic equations',
    dueDate: new Date('2026-12-31'),
    status: HomeworkAssignmentStatus.DRAFT,
    submissionRequired: true,
    attachments: [],
    submissions: [],
    subject: { name: 'Mathematics' },
  };
  const mockSubmissionStudent = {
    id: 'student-1',
    firstNameEn: 'Asha',
    lastNameEn: 'Rai',
  };

  beforeEach(async () => {
    prisma = {
      homeworkAssignment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'hw-1', ...q.data }),
          ),
        update: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'hw-1', ...q.data }),
          ),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      homeworkSubmission: {
        findFirst: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'sub-1', ...q.data }),
          ),
        update: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'sub-1', ...q.data }),
          ),
        upsert: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'sub-1', ...q.create }),
          ),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      homeworkAttachment: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      fileAsset: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      class: { findFirst: jest.fn().mockResolvedValue({ id: 'class-1' }) },
      section: { findFirst: jest.fn() },
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      student: { findFirst: jest.fn(), findMany: jest.fn() },
      subjectTeacherAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'assign-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'sub-1',
          },
        ]),
      },
      homeworkReminderBatch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest
          .fn()
          .mockImplementation((q) =>
            Promise.resolve({ id: 'batch-1', ...q.create }),
          ),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworkService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: CommunicationsService,
          useValue: {
            recordDeliveryRecords: jest
              .fn()
              .mockResolvedValue({ sentCount: 1 }),
          },
        },
        {
          provide: FileRegistryService,
          useValue: {
            linkToEntity: jest.fn().mockResolvedValue(undefined),
            linkToEntityInTransaction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getQueueToken('homework'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<HomeworkService>(HomeworkService);
  });

  it('lists metadata-backed homework templates with tenant-scoped filters', async () => {
    const template = {
      ...mockAssignment,
      id: 'hw-template-1',
      title: 'Fractions practice',
      attachmentMetadata: {
        homeworkTemplate: {
          isTemplate: true,
          name: 'Fractions practice',
        },
      },
      attachments: [],
      _count: { attachments: 0, submissions: 0 },
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    prisma.homeworkAssignment.findMany.mockResolvedValue([
      template,
      {
        ...mockAssignment,
        id: 'hw-normal-1',
        attachmentMetadata: { homeworkTemplate: { isTemplate: false } },
        _count: { attachments: 0, submissions: 0 },
      },
    ]);

    const result = await service.listTemplates(mockActor, {
      classId: 'class-1',
      subjectId: 'sub-1',
      search: 'fractions',
      limit: 20,
    });

    expect(prisma.homeworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: mockActor.tenantId,
          classId: 'class-1',
          subjectId: 'sub-1',
          OR: [
            { title: { contains: 'fractions', mode: 'insensitive' } },
            {
              instructions: {
                contains: 'fractions',
                mode: 'insensitive',
              },
            },
          ],
        }),
        take: 20,
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: template.id,
        title: template.title,
        attachmentCount: 0,
        submissionSummary: { total: 0 },
      }),
    ]);
  });

  describe('Assignment Lifecycle', () => {
    it('should create a draft homework with attachments', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.subject.findFirst.mockResolvedValue({ id: 'sub-1' });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      prisma.fileAsset.findMany.mockResolvedValue([
        {
          id: 'file-1',
          status: FileStatus.UPLOADED,
          softDeletedAt: null,
          deletedAt: null,
          module: 'homework',
          entityId: null,
          uploadedByUserId: mockActor.userId,
        },
      ]);
      prisma.homeworkAssignment.create.mockResolvedValue({
        ...mockAssignment,
        id: 'new-hw',
      });
      prisma.homeworkAssignment.findFirst.mockResolvedValue({
        ...mockAssignment,
        id: 'new-hw',
      });

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        subjectId: 'sub-1',
        title: 'New HW',
        instructions: 'Test',
        dueDate: '2026-12-31',
        attachmentFileIds: ['file-1'],
      };

      const result = (await service.createAssignment(dto, mockActor)) as any;

      expect(result.id).toBe('new-hw');
      expect(prisma.homeworkAttachment.createMany).toHaveBeenCalled();
    });

    it('should reject attachment from another tenant', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.subject.findFirst.mockResolvedValue({ id: 'sub-1' });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      prisma.fileAsset.findMany.mockResolvedValue([]); // File not found or wrong tenant
      prisma.homeworkAssignment.create.mockResolvedValue({ id: 'temp-hw' });

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        subjectId: 'sub-1',
        title: 'New HW',
        instructions: 'Test',
        dueDate: '2026-12-31',
        attachmentFileIds: ['file-from-other-tenant'],
      };

      await expect(service.createAssignment(dto, mockActor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should publish draft homework and emit notification', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockAssignment);
      prisma.student.findMany.mockResolvedValue([{ id: 'student-1' }]);
      prisma.homeworkAssignment.update.mockResolvedValue({
        ...mockAssignment,
        status: HomeworkAssignmentStatus.ASSIGNED,
      });
      const comms = (service as any).communicationsService;

      await service.assignHomework('hw-1', mockActor);

      expect(prisma.homeworkAssignment.update).toHaveBeenCalledWith({
        where: { id: 'hw-1' },
        data: expect.objectContaining({
          status: HomeworkAssignmentStatus.ASSIGNED,
        }),
        include: expect.anything(),
      });
      expect(comms.recordDeliveryRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'homework_published',
        }),
      );
    });
  });

  describe('Submission & Review', () => {
    it('should mark submission as LATE if submitted after due date', async () => {
      const pastAssignment = {
        ...mockAssignment,
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: new Date('2020-01-01'),
      };
      prisma.homeworkAssignment.findFirst.mockResolvedValue(pastAssignment);
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: 'ACTIVE',
      });
      prisma.homeworkSubmission.upsert.mockResolvedValue({
        id: 'sub-1',
        status: HomeworkSubmissionStatus.LATE,
      });
      prisma.homeworkSubmission.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          id: 'sub-1',
          homeworkId: 'hw-1',
          studentId: 'student-1',
          status: HomeworkSubmissionStatus.LATE,
          homework: pastAssignment,
          student: mockSubmissionStudent,
          attachments: [],
        });

      const result = await service.createSubmission(
        'hw-1',
        {
          studentId: 'student-1',
          submissionText: 'Too late',
        },
        mockActor,
      );

      expect(result.status).toBe(HomeworkSubmissionStatus.LATE);
    });

    it('blocks submission when the student is no longer active in the homework class scope', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue({
        ...mockAssignment,
        status: HomeworkAssignmentStatus.ASSIGNED,
      });
      prisma.student.findFirst
        .mockResolvedValueOnce({ id: 'student-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.createSubmission(
          'hw-1',
          {
            studentId: 'student-1',
            submissionText: 'No longer active',
          },
          mockActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should review submission and allow status change', async () => {
      const submission = {
        id: 'sub-1',
        tenantId: 'tenant-1',
        homeworkId: 'hw-1',
        studentId: 'student-1',
        homework: mockAssignment,
        student: mockSubmissionStudent,
        attachments: [],
        status: HomeworkSubmissionStatus.SUBMITTED,
      };
      prisma.homeworkSubmission.findFirst.mockResolvedValue(submission);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      prisma.homeworkSubmission.update.mockResolvedValue({
        ...submission,
        status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
      });

      const result = await service.reviewSubmission(
        'sub-1',
        {
          status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
          correctionRemarks: 'Fix this',
        },
        mockActor,
      );

      expect(result.status).toBe(HomeworkSubmissionStatus.NEEDS_CORRECTION);
      expect(prisma.homeworkSubmission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
          returnedAt: expect.any(Date),
        }),
        include: expect.anything(),
      });
    });

    it('should notify student when correction is requested', async () => {
      const submission = {
        id: 'sub-1',
        tenantId: 'tenant-1',
        homeworkId: 'hw-1',
        homework: mockAssignment,
        status: HomeworkSubmissionStatus.SUBMITTED,
        studentId: 'student-1',
        student: mockSubmissionStudent,
        attachments: [],
      };
      prisma.homeworkSubmission.findFirst.mockResolvedValue(submission);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      prisma.homeworkSubmission.update.mockResolvedValue({
        ...submission,
        status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
      });
      const comms = (service as any).communicationsService;

      await service.reviewSubmission(
        'sub-1',
        {
          status: HomeworkSubmissionStatus.NEEDS_CORRECTION,
          correctionRemarks: 'Fix this',
        },
        mockActor,
      );

      expect(comms.recordDeliveryRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'homework_returned_for_correction',
        }),
      );
    });
  });
});
