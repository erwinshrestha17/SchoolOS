import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  HomeworkAssignmentStatus,
  HomeworkSubmissionStatus,
} from '@prisma/client';
import { HomeworkService } from './homework.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { getQueueToken } from '@nestjs/bullmq';

describe('Homework Hardening', () => {
  let homeworkService: HomeworkService;
  let prisma: PrismaMock;

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    email: 'user1@example.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['homework:create', 'homework:review'],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.__state.staff.push({
      id: 'staff-1',
      tenantId: 'tenant-a',
      userId: 'user-1',
    });
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
          useValue: { linkToEntity: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getQueueToken('homework'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    homeworkService = module.get<HomeworkService>(HomeworkService);
  });

  describe('Tenant Isolation & Ownership', () => {
    it('should reject creating homework for a class from another tenant', async () => {
      const p = prisma as any;

      // Class from another tenant or not found
      p.class.findFirst.mockResolvedValue(null);
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-from-tenant-b',
            subjectId: 'sub-1',
            title: 'Test Homework',
            instructions: 'Do something',
            dueDate: '2026-12-31',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject submissions from students not in the homework scope', async () => {
      const p = prisma as any;
      const assignment = {
        id: 'hw-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
        sectionId: 'section-1',
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: new Date('2026-12-31'),
      };
      p.homeworkAssignment.findFirst.mockResolvedValue(assignment);

      // Student from another class or tenant
      p.student.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.createSubmission(
          'hw-1',
          {
            studentId: 'student-x',
            submissionText: 'My answer',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Date Integrity', () => {
    it('should reject due date before assigned date', async () => {
      const p = prisma as any;
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            title: 'Invalid Dates',
            instructions: 'Test',
            assignedDate: '2026-12-31',
            dueDate: '2026-12-30', // Earlier than assigned
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Teacher Scoping', () => {
    it('should restrict subject teachers to their assigned subjects', async () => {
      const p = prisma as any;
      const teacherActor: AuthContext = {
        ...actor,
        roles: ['subject_teacher'],
      };

      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
        userId: 'user-1',
      });

      // No assignment for this subject
      p.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.createAssignment(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            title: 'Not my subject',
            instructions: 'Test',
            dueDate: '2026-12-31',
          },
          teacherActor,
        ),
      ).rejects.toThrow(); // Should throw ForbiddenException
    });
  });
});
