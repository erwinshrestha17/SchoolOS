import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningActivityStatus } from '@prisma/client';
import type { AuthContext } from '../../auth/auth.types';
import { LearningActivitiesService } from './learning-activities.service';

describe('LearningActivitiesService', () => {
  let prisma: any;
  let permissions: any;
  let auditService: any;
  let service: LearningActivitiesService;

  const adminActor = {
    tenantId: 'tenant-1',
    userId: 'admin-1',
    roles: ['admin'],
    permissions: ['learning:read'],
  } as unknown as AuthContext;

  const teacherActor = {
    tenantId: 'tenant-1',
    userId: 'teacher-user-1',
    roles: ['teacher'],
    permissions: ['learning:read'],
  } as unknown as AuthContext;

  beforeEach(() => {
    prisma = {
      learningActivity: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      learningQuestion: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    permissions = {
      resolveActorStaffId: jest.fn(),
      resolveTeacherIdForWrite: jest.fn(),
      assertActorCanControlScope: jest.fn(),
    };
    auditService = { record: jest.fn() };

    service = new LearningActivitiesService(prisma, permissions, auditService);
  });

  describe('teacher scoping (confirmed gap: previously any learning:read holder could list/read every activity in the tenant, including other teachers\' unpublished drafts)', () => {
    it('scopes listActivities to the teacher\'s own activities', async () => {
      permissions.resolveActorStaffId.mockResolvedValue('staff-1');
      prisma.learningActivity.findMany.mockResolvedValue([]);
      prisma.learningActivity.count.mockResolvedValue(0);

      await service.listActivities(teacherActor, {});

      expect(prisma.learningActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            teacherId: 'staff-1',
          }),
        }),
      );
    });

    it('overrides a caller-supplied teacherId for a non-admin', async () => {
      permissions.resolveActorStaffId.mockResolvedValue('staff-1');
      prisma.learningActivity.findMany.mockResolvedValue([]);
      prisma.learningActivity.count.mockResolvedValue(0);

      await service.listActivities(teacherActor, { teacherId: 'someone-else' });

      expect(prisma.learningActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teacherId: 'staff-1' }),
        }),
      );
    });

    it('returns an empty page for a teacher with no active staff profile', async () => {
      permissions.resolveActorStaffId.mockResolvedValue(null);

      const result = await service.listActivities(teacherActor, {});

      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
      expect(prisma.learningActivity.findMany).not.toHaveBeenCalled();
    });

    it('does not scope listActivities for a school admin', async () => {
      prisma.learningActivity.findMany.mockResolvedValue([]);
      prisma.learningActivity.count.mockResolvedValue(0);

      await service.listActivities(adminActor, { teacherId: 'any-teacher' });

      expect(permissions.resolveActorStaffId).not.toHaveBeenCalled();
      expect(prisma.learningActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teacherId: 'any-teacher' }),
        }),
      );
    });

    it('blocks getActivity for a teacher who does not own the activity', async () => {
      prisma.learningActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        teacherId: 'other-staff',
        classId: 'class-1',
        sectionId: null,
        subjectId: 'subject-1',
        topicId: null,
      });
      permissions.assertActorCanControlScope.mockRejectedValue(
        new ForbiddenException('Only the assigned teacher can manage this'),
      );

      await expect(
        service.getActivity(teacherActor, 'activity-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows getActivity for the owning teacher', async () => {
      prisma.learningActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        teacherId: 'staff-1',
        classId: 'class-1',
        sectionId: null,
        subjectId: 'subject-1',
        topicId: null,
      });
      permissions.assertActorCanControlScope.mockResolvedValue(undefined);

      const result = await service.getActivity(teacherActor, 'activity-1');

      expect(result).toEqual(
        expect.objectContaining({ id: 'activity-1', teacherId: 'staff-1' }),
      );
      expect(permissions.assertActorCanControlScope).toHaveBeenCalledWith(
        teacherActor,
        'staff-1',
        {
          classId: 'class-1',
          sectionId: null,
          subjectId: 'subject-1',
          topicId: null,
        },
      );
    });

    it('does not call the scope check for a school admin reading any activity', async () => {
      prisma.learningActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        teacherId: 'someone-else',
        classId: 'class-1',
        sectionId: null,
        subjectId: 'subject-1',
        topicId: null,
      });

      await service.getActivity(adminActor, 'activity-1');

      expect(permissions.assertActorCanControlScope).not.toHaveBeenCalled();
    });

    it('raises NotFoundException when the activity does not exist in the tenant', async () => {
      prisma.learningActivity.findFirst.mockResolvedValue(null);

      await expect(
        service.getActivity(teacherActor, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActivities pagination/filters (pre-existing behavior)', () => {
    it('applies caller filters alongside tenant scoping for an admin', async () => {
      prisma.learningActivity.findMany.mockResolvedValue([]);
      prisma.learningActivity.count.mockResolvedValue(0);

      await service.listActivities(adminActor, {
        classId: 'class-1',
        status: LearningActivityStatus.READY,
      });

      expect(prisma.learningActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classId: 'class-1',
            status: LearningActivityStatus.READY,
          }),
        }),
      );
    });
  });
});
