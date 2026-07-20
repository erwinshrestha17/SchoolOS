import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
  NotificationChannel,
} from '@prisma/client';
import { HomeworkService } from './homework.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import { HomeworkReminderType } from './dto/reminder.dto';
import { getQueueToken } from '@nestjs/bullmq';

describe('Homework Reminders', () => {
  let service: HomeworkService;
  let prisma: any;
  let communicationsService: any;

  const mockActor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-1',
    email: 'teacher@school.edu',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['homework:manage'],
  };

  const mockHomework = {
    id: 'hw-1',
    tenantId: 'tenant-1',
    title: 'Math HW',
    status: HomeworkAssignmentStatus.ASSIGNED,
    dueDate: new Date('2026-12-31'),
    academicYearId: 'year-1',
    subjectId: 'sub-1',
    classId: 'class-1',
    sectionId: 'section-1',
    subject: { name: 'Mathematics' },
  };

  beforeEach(async () => {
    prisma = {
      homeworkAssignment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      homeworkReminderBatch: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      homeworkSubmission: {
        findMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
      },
      staff: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      subjectTeacherAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'subject-teacher-1' }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    communicationsService = {
      recordDeliveryRecords: jest
        .fn()
        .mockResolvedValue({ count: 10, sentCount: 8, skippedCount: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworkService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CommunicationsService, useValue: communicationsService },
        {
          provide: FileRegistryService,
          useValue: { linkToEntity: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getQueueToken('homework'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<HomeworkService>(HomeworkService);
  });

  describe('Manual Reminders', () => {
    it('should send due soon reminder and record batch', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue(null);
      prisma.homeworkReminderBatch.upsert.mockResolvedValue({ id: 'batch-1' });
      prisma.homeworkReminderBatch.update.mockResolvedValue({ id: 'batch-1' });
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.homeworkSubmission.findMany.mockResolvedValue([]);

      const result = await service.sendHomeworkReminder(
        'hw-1',
        {
          reminderType: HomeworkReminderType.HOMEWORK_DUE_SOON,
        },
        mockActor,
      );

      expect(result.id).toBe('batch-1');
      expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'homework_due_soon',
          studentIds: ['s1', 's2'],
        }),
      );
      expect(prisma.homeworkReminderBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: expect.objectContaining({ status: 'COMPLETED', targetCount: 10 }),
      });
    });

    it('should respect idempotency key', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue({
        id: 'existing-batch',
        status: 'COMPLETED',
      });

      const result = await service.sendHomeworkReminder(
        'hw-1',
        {
          reminderType: HomeworkReminderType.HOMEWORK_DUE_SOON,
        },
        mockActor,
      );

      expect(result.id).toBe('existing-batch');
      expect(
        communicationsService.recordDeliveryRecords,
      ).not.toHaveBeenCalled();
    });

    it('re-checks homework status before retrying reminders', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue({
        ...mockHomework,
        status: HomeworkAssignmentStatus.CANCELLED,
      });

      await expect(
        service.sendHomeworkReminder(
          'hw-1',
          {
            reminderType: HomeworkReminderType.HOMEWORK_DUE_SOON,
            force: true,
          },
          mockActor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(
        communicationsService.recordDeliveryRecords,
      ).not.toHaveBeenCalled();
      expect(prisma.homeworkReminderBatch.upsert).not.toHaveBeenCalled();
    });

    it('should allow force resend', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue({
        id: 'existing-batch',
      });
      prisma.homeworkReminderBatch.upsert.mockResolvedValue({
        id: 'new-batch',
      });
      prisma.homeworkReminderBatch.update.mockResolvedValue({
        id: 'new-batch',
      });
      prisma.student.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.homeworkSubmission.findMany.mockResolvedValue([]);

      const result = await service.sendHomeworkReminder(
        'hw-1',
        {
          reminderType: HomeworkReminderType.HOMEWORK_DUE_SOON,
          force: true,
        },
        mockActor,
      );

      expect(result.id).toBe('new-batch');
      expect(communicationsService.recordDeliveryRecords).toHaveBeenCalled();
    });
  });

  describe('retryHomeworkReminderBatch scope check (confirmed gap: early-return paths skipped scope validation)', () => {
    it('blocks a teacher retrying another class batch even when already COMPLETED', async () => {
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        homeworkId: 'hw-1',
        status: 'COMPLETED',
      });
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.retryHomeworkReminderBatch('batch-1', mockActor),
      ).rejects.toThrow(
        'You are not assigned to review homework for this class and subject',
      );
    });

    it('blocks a teacher retrying another class batch even when PROCESSING', async () => {
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        homeworkId: 'hw-1',
        status: 'PROCESSING',
      });
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.retryHomeworkReminderBatch('batch-1', mockActor),
      ).rejects.toThrow(
        'You are not assigned to review homework for this class and subject',
      );
    });

    it('allows a properly assigned teacher to retry their own COMPLETED batch', async () => {
      prisma.homeworkReminderBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        homeworkId: 'hw-1',
        status: 'COMPLETED',
      });
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.subjectTeacherAssignment.findFirst.mockResolvedValue({
        id: 'subject-teacher-1',
      });

      const result = await service.retryHomeworkReminderBatch(
        'batch-1',
        mockActor,
      );

      expect(result).toEqual(
        expect.objectContaining({ id: 'batch-1', replayed: true }),
      );
    });
  });

  describe('Target Resolution', () => {
    it('should exclude students who already submitted', async () => {
      prisma.homeworkAssignment.findFirst.mockResolvedValue(mockHomework);
      prisma.student.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
      ]);
      prisma.homeworkSubmission.findMany.mockResolvedValue([
        { studentId: 's1' },
      ]);

      const targets = await (service as any).resolveHomeworkReminderTargets(
        mockActor,
        mockHomework,
        HomeworkReminderType.HOMEWORK_DUE_SOON,
      );

      expect(targets.studentIds).toEqual(['s2', 's3']);
    });
  });
});
