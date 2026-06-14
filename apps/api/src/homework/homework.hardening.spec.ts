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
            sectionId: 'section-1',
            subjectId: 'sub-1',
            title: 'Not my subject',
            instructions: 'Test',
            dueDate: '2026-12-31',
          },
          teacherActor,
        ),
      ).rejects.toThrow(); // Should throw ForbiddenException

      expect(p.subjectTeacherAssignment.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-a',
          academicYearId: 'year-1',
          subjectId: 'sub-1',
          staffId: 'teacher-1',
          classId: 'class-1',
          OR: [{ sectionId: 'section-1' }, { sectionId: null }],
        },
      });
    });
  });

  describe('Parent and student list scoping', () => {
    it('returns an empty homework list instead of tenant-wide rows when a parent has no linked student', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listAssignments(parentActor, {}),
      ).resolves.toEqual({ items: [], total: 0 });

      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
      expect(p.homeworkAssignment.count).not.toHaveBeenCalled();
    });

    it('blocks parent homework list queries for a student outside the guardian link', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.listAssignments(parentActor, {
          studentId: 'other-student',
        }),
      ).resolves.toEqual({ items: [], total: 0 });

      expect(p.studentGuardian.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-a',
          guardian: { userId: 'parent-user-1' },
          studentId: 'other-student',
          student: { lifecycleStatus: 'ACTIVE' },
        },
        select: { studentId: true },
      });
      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
    });

    it('blocks student homework list queries for another student id', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:submit'],
      };
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
      });

      await expect(
        homeworkService.listAssignments(studentActor, {
          studentId: 'student-2',
        }),
      ).resolves.toEqual({ items: [], total: 0 });

      expect(p.homeworkAssignment.findMany).not.toHaveBeenCalled();
      expect(p.homeworkAssignment.count).not.toHaveBeenCalled();
    });

    it('scopes parent submission lists to linked students only', async () => {
      const p = prisma as any;
      const parentActor: AuthContext = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['homework:read'],
      };
      p.studentGuardian.findMany.mockResolvedValue([
        { studentId: 'student-1' },
      ]);
      p.homeworkSubmission.findMany.mockResolvedValue([]);
      p.homeworkSubmission.count.mockResolvedValue(0);

      await homeworkService.listSubmissions(parentActor, 'hw-1', {});

      expect(p.homeworkSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            homeworkId: 'hw-1',
            studentId: { in: ['student-1'] },
          }),
        }),
      );
    });

    it('blocks student submission detail reads for another student', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:read'],
      };
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        lifecycleStatus: 'ACTIVE',
      });
      p.homeworkSubmission.findFirst.mockResolvedValue(null);

      await expect(
        homeworkService.getSubmission(studentActor, 'submission-other'),
      ).rejects.toThrow(NotFoundException);

      expect(p.homeworkSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'submission-other',
            tenantId: 'tenant-a',
            studentId: { in: ['student-1'] },
          }),
        }),
      );
    });

    it('blocks direct student homework detail reads outside the active class scope', async () => {
      const p = prisma as any;
      const studentActor: AuthContext = {
        ...actor,
        userId: 'student-user-1',
        roles: ['student'],
        permissions: ['homework:read'],
      };
      p.homeworkAssignment.findFirst.mockResolvedValue({
        id: 'hw-other-class',
        tenantId: 'tenant-a',
        classId: 'class-2',
        sectionId: 'section-1',
        attachments: [],
      });
      p.student.findFirst.mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: 'ACTIVE',
      });

      await expect(
        homeworkService.getAssignment(studentActor, 'hw-other-class'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
