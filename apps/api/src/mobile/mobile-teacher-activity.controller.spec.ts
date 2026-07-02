import { AuthMethod } from '@prisma/client';
import { ActivityFeedService } from '../activity-feed/activity-feed.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { MobileTeacherActivityController } from './mobile-teacher-activity.controller';

describe('MobileTeacherActivityController', () => {
  let activityFeedService: jest.Mocked<
    Pick<
      ActivityFeedService,
      | 'listTeacherMobileScopes'
      | 'listTeacherMobileStudents'
      | 'listTeacherMobilePosts'
      | 'createPost'
      | 'createMilestone'
    >
  >;
  let controller: MobileTeacherActivityController;
  let actor: AuthContext;

  beforeEach(() => {
    activityFeedService = {
      listTeacherMobileScopes: jest.fn(),
      listTeacherMobileStudents: jest.fn(),
      listTeacherMobilePosts: jest.fn(),
      createPost: jest.fn(),
      createMilestone: jest.fn(),
    };
    controller = new MobileTeacherActivityController(
      activityFeedService as unknown as ActivityFeedService,
    );
    actor = {
      userId: 'teacher-user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['activity_feed:read', 'activity_feed:create'],
    };
  });

  it('allows teachers and subject teachers through the mobile activity route', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MobileTeacherActivityController),
    ).toEqual(['teacher', 'subject_teacher']);
  });

  it('delegates purpose-limited scopes, students, and recent posts', async () => {
    const studentsQuery = {
      classId: '5a21e235-b33f-46be-b6de-cad39bf4aa10',
      page: 1,
      limit: 20,
    };
    const postsQuery = { page: 1, limit: 20 };
    activityFeedService.listTeacherMobileScopes.mockResolvedValue({
      items: [{ id: 'scope-1' }],
    } as never);
    activityFeedService.listTeacherMobileStudents.mockResolvedValue({
      items: [{ id: 'student-1' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    } as never);
    activityFeedService.listTeacherMobilePosts.mockResolvedValue({
      items: [{ id: 'post-1' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    } as never);

    await expect(controller.listScopes(actor)).resolves.toEqual({
      items: [{ id: 'scope-1' }],
    });
    await expect(
      controller.listStudents(actor, studentsQuery),
    ).resolves.toEqual(
      expect.objectContaining({ items: [{ id: 'student-1' }] }),
    );
    await expect(controller.listPosts(actor, postsQuery)).resolves.toEqual(
      expect.objectContaining({ items: [{ id: 'post-1' }] }),
    );

    expect(activityFeedService.listTeacherMobileStudents).toHaveBeenCalledWith(
      actor,
      studentsQuery,
    );
    expect(activityFeedService.listTeacherMobilePosts).toHaveBeenCalledWith(
      actor,
      postsQuery,
    );
  });

  it('delegates idempotent post capture and milestone creation', async () => {
    const post = {
      clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
      classId: '5a21e235-b33f-46be-b6de-cad39bf4aa10',
      title: 'Class activity',
      caption: 'Students worked together.',
      studentIds: ['1c74dbe5-206d-49c3-b007-7903c560c068'],
      attachments: [
        {
          fileName: 'activity.jpg',
          contentType: 'image/jpeg',
          base64Content: '/9j/2Q==',
        },
      ],
    };
    const milestone = {
      classId: '5a21e235-b33f-46be-b6de-cad39bf4aa10',
      studentId: '1c74dbe5-206d-49c3-b007-7903c560c068',
      domain: 'Social',
      milestone: 'Shares classroom materials',
      status: 'PROGRESSING',
      observedAt: '2026-06-29T00:00:00.000Z',
    };
    activityFeedService.createPost.mockResolvedValue({
      id: 'post-1',
    } as never);
    activityFeedService.createMilestone.mockResolvedValue({
      id: 'milestone-1',
    } as never);

    await expect(controller.createPost(post as never, actor)).resolves.toEqual({
      id: 'post-1',
    });
    await expect(
      controller.createMilestone(milestone as never, actor),
    ).resolves.toEqual({ id: 'milestone-1' });

    expect(activityFeedService.createPost).toHaveBeenCalledWith(post, actor);
    expect(activityFeedService.createMilestone).toHaveBeenCalledWith(
      milestone,
      actor,
    );
  });
});
