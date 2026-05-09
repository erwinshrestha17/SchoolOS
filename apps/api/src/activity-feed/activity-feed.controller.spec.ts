import type { AuthContext } from '../auth/auth.types';
import { ActivityFeedController } from './activity-feed.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'teacher@school.test',
  roles: ['teacher'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const activityFeedService = {
    listPosts: jest.fn(),
    getReactionAnalytics: jest.fn(),
    createPost: jest.fn(),
    createReaction: jest.fn(),
    listMoodLogs: jest.fn(),
    createMoodLog: jest.fn(),
    listMilestones: jest.fn(),
    createMilestone: jest.fn(),
  };
  const activityMediaService = {
    getAttachmentMedia: jest.fn(),
  };
  const activityPostLifecycleService = {
    updatePost: jest.fn(),
    softDeletePost: jest.fn(),
    restorePost: jest.fn(),
    moderatePost: jest.fn(),
  };
  const eventEmitter = {
    on: jest.fn(),
    emit: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };

  return {
    controller: new ActivityFeedController(
      activityFeedService as never,
      activityMediaService as never,
      activityPostLifecycleService as never,
      eventEmitter as never,
    ),
    activityFeedService,
    activityMediaService,
    activityPostLifecycleService,
  };
}

describe('ActivityFeedController M5 contracts', () => {
  it('delegates feed listing filters with current actor', () => {
    const { controller, activityFeedService } = createController();
    activityFeedService.listPosts.mockReturnValue([{ id: 'post-1' }]);

    const result = controller.listPosts(
      actor,
      'student-1',
      'class-1',
      'section-1',
      'GENERAL',
      '2026-05',
    );

    expect(activityFeedService.listPosts).toHaveBeenCalledWith(actor, {
      studentId: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
      category: 'GENERAL',
      month: '2026-05',
    });
    expect(result).toEqual([{ id: 'post-1' }]);
  });

  it('delegates post creation with current actor', () => {
    const { controller, activityFeedService } = createController();
    const dto = {
      classId: 'class-1',
      title: 'Outdoor play',
      caption: 'Children enjoyed outdoor play.',
      attachments: [],
    };
    activityFeedService.createPost.mockReturnValue({ id: 'post-1' });

    const result = controller.createPost(dto as never, actor);

    expect(activityFeedService.createPost).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ id: 'post-1' });
  });

  it('delegates post edit to lifecycle service', () => {
    const { controller, activityPostLifecycleService } = createController();
    const dto = { title: 'Updated title', caption: 'Updated caption' };
    activityPostLifecycleService.updatePost.mockReturnValue({ id: 'post-1' });

    const result = controller.updatePost('post-1', dto, actor);

    expect(activityPostLifecycleService.updatePost).toHaveBeenCalledWith(
      'post-1',
      dto,
      actor,
    );
    expect(result).toEqual({ id: 'post-1' });
  });

  it('delegates soft delete with reason to lifecycle service', () => {
    const { controller, activityPostLifecycleService } = createController();
    const dto = { reason: 'Duplicate post' };
    activityPostLifecycleService.softDeletePost.mockReturnValue({
      deleted: true,
    });

    const result = controller.softDeletePost('post-1', dto, actor);

    expect(activityPostLifecycleService.softDeletePost).toHaveBeenCalledWith(
      'post-1',
      dto,
      actor,
    );
    expect(result).toEqual({ deleted: true });
  });

  it('delegates restore to lifecycle service', () => {
    const { controller, activityPostLifecycleService } = createController();
    activityPostLifecycleService.restorePost.mockReturnValue({
      restored: true,
    });

    const result = controller.restorePost('post-1', actor);

    expect(activityPostLifecycleService.restorePost).toHaveBeenCalledWith(
      'post-1',
      actor,
    );
    expect(result).toEqual({ restored: true });
  });

  it('delegates moderation with current actor', () => {
    const { controller, activityPostLifecycleService } = createController();
    const dto = { status: 'REJECTED', reason: 'Photo consent issue' };
    activityPostLifecycleService.moderatePost.mockReturnValue({
      moderationStatus: 'REJECTED',
    });

    const result = controller.moderatePost('post-1', dto as never, actor);

    expect(activityPostLifecycleService.moderatePost).toHaveBeenCalledWith(
      'post-1',
      dto,
      actor,
    );
    expect(result).toEqual({ moderationStatus: 'REJECTED' });
  });

  it('delegates mood log and milestone creation with current actor', () => {
    const { controller, activityFeedService } = createController();
    const moodDto = {
      classId: 'class-1',
      studentId: 'student-1',
      mood: 'CALM',
      logDate: '2026-05-09',
    };
    const milestoneDto = {
      classId: 'class-1',
      studentId: 'student-1',
      domain: 'Social',
      milestone: 'Shares toys',
      status: 'ACHIEVED',
      observedAt: '2026-05-09T00:00:00.000Z',
    };
    activityFeedService.createMoodLog.mockReturnValue({ id: 'mood-1' });
    activityFeedService.createMilestone.mockReturnValue({ id: 'milestone-1' });

    expect(controller.createMoodLog(moodDto as never, actor)).toEqual({
      id: 'mood-1',
    });
    expect(controller.createMilestone(milestoneDto as never, actor)).toEqual({
      id: 'milestone-1',
    });
    expect(activityFeedService.createMoodLog).toHaveBeenCalledWith(
      moodDto,
      actor,
    );
    expect(activityFeedService.createMilestone).toHaveBeenCalledWith(
      milestoneDto,
      actor,
    );
  });
});
