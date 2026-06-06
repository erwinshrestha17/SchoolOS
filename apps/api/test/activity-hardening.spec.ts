import {
  ActivityCategory,
  ActivityPostStatus,
  AudienceType,
  AuthMethod,
  StorageProvider,
} from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityFeedService } from '../src/activity-feed/activity-feed.service';
import { ActivityPostLifecycleService } from '../src/activity-feed/activity-post-lifecycle.service';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import { AuthContext } from '../src/auth/auth.types';

describe('Activity Hardening Verification', () => {
  const tenantId = 'tenant-hardening';
  const actor: AuthContext = {
    userId: 'teacher-1',
    tenantId,
    tenantSlug: 'test-school',
    email: 'teacher@test.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['activity_feed:create', 'activity_feed:read'],
  };

  const adminActor: AuthContext = {
    ...actor,
    userId: 'admin-1',
    roles: ['admin'],
  };

  const parentActor: AuthContext = {
    ...actor,
    userId: 'parent-1',
    roles: ['parent'],
  };

  let prisma: any;
  let storageService: any;
  let communicationsService: any;
  let auditService: any;
  let eventEmitter: any;
  let fileRegistry: any;
  let mediaQueue: any;
  let feedService: ActivityFeedService;
  let lifecycleService: ActivityPostLifecycleService;
  let mediaProcessor: ActivityMediaProcessor;

  beforeEach(() => {
    prisma = {
      class: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }) },
      section: { findFirst: jest.fn().mockResolvedValue({ id: 's-1' }) },
      student: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      guardian: { findFirst: jest.fn() },
      activityPost: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      activityAttachment: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      guardianConsent: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      fileAsset: { update: jest.fn() },
    };

    storageService = {
      saveBase64Object: jest.fn(),
      saveBufferObject: jest.fn(),
      getObjectBuffer: jest.fn(),
    };

    communicationsService = {
      recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 0 }),
    };

    auditService = {
      record: jest.fn(),
    };

    eventEmitter = {
      emitAsync: jest.fn(),
      emit: jest.fn(),
    };

    fileRegistry = {
      registerFile: jest.fn(),
      markUploaded: jest.fn(),
      getSignedUrl: jest.fn(),
      auditAccess: jest.fn(),
      updateFileEntity: jest.fn().mockResolvedValue({}),
    };

    mediaQueue = {
      add: jest.fn(),
    };

    feedService = new ActivityFeedService(
      prisma,
      storageService,
      communicationsService,
      auditService,
      eventEmitter,
      fileRegistry,
      mediaQueue,
    );

    lifecycleService = new ActivityPostLifecycleService(prisma, auditService);

    mediaProcessor = new ActivityMediaProcessor(prisma, storageService, {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    } as never);
  });

  describe('Post Lifecycle & Moderation', () => {
    it('restricts editing of approved posts', async () => {
      prisma.activityPost.findFirst.mockResolvedValue({
        id: 'post-1',
        tenantId,
        createdById: 'teacher-1',
        status: ActivityPostStatus.APPROVED,
        softDeletedAt: null,
      });

      await expect(
        lifecycleService.updatePost('post-1', { title: 'New Title' }, actor),
      ).rejects.toThrow(
        'Approved or Archived activity post cannot be silently edited',
      );
    });

    it('requires a reason for rejecting a post', async () => {
      prisma.activityPost.findFirst.mockResolvedValue({
        id: 'post-1',
        tenantId,
        status: ActivityPostStatus.PENDING_APPROVAL,
        softDeletedAt: null,
      });

      await expect(
        lifecycleService.moderatePost(
          'post-1',
          { status: ActivityPostStatus.REJECTED, reason: '' },
          adminActor,
        ),
      ).rejects.toThrow('Rejection reason is required');
    });

    it('soft deletes a post and audits the action', async () => {
      prisma.activityPost.findFirst.mockResolvedValue({
        id: 'post-1',
        tenantId,
        createdById: 'teacher-1',
        status: ActivityPostStatus.APPROVED,
        softDeletedAt: null,
      });

      prisma.activityPost.update.mockResolvedValue({ id: 'post-1' });

      await lifecycleService.softDeletePost(
        'post-1',
        { reason: 'Mistake' },
        actor,
      );

      expect(prisma.activityPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: expect.objectContaining({
          softDeletedAt: expect.any(Date),
          status: ActivityPostStatus.REJECTED,
        }),
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'soft_delete' }),
      );
    });
  });

  describe('Media Processing Queue', () => {
    it('triggers compression job after post creation', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      storageService.saveBase64Object.mockResolvedValue({
        objectKey: 'orig.jpg',
        sizeBytes: 100,
      });
      fileRegistry.registerFile.mockResolvedValue({ id: 'file-1' });
      prisma.activityPost.create.mockResolvedValue({
        id: 'post-1',
        attachments: [{ id: 'attach-1', fileAssetId: 'file-1' }],
        studentTags: [],
      });

      await feedService.createPost(
        {
          classId: 'class-1',
          title: 'Test',
          caption: 'Test',
          category: ActivityCategory.GENERAL,
          studentIds: [],
          attachments: [
            {
              fileName: 'a.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      );

      expect(mediaQueue.add).toHaveBeenCalledWith(
        'compress',
        expect.objectContaining({ attachmentId: 'attach-1' }),
        expect.any(Object),
      );
      expect(fileRegistry.markUploaded).toHaveBeenCalledWith(
        tenantId,
        'file-1',
        actor.userId,
      );
    });
  });

  describe('Parent Visibility', () => {
    it('hides unapproved posts from parents', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'g-1',
        studentLinks: [{ studentId: 's-1' }],
      });
      prisma.student.findMany.mockResolvedValue([
        { id: 's-1', classId: 'c-1', sectionId: 'sec-1' },
      ]);
      prisma.activityPost.findMany.mockResolvedValue([]);

      await feedService.listPosts(parentActor);

      expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ActivityPostStatus.APPROVED,
            softDeletedAt: null,
          }),
        }),
      );
    });

    it('does not expose storage fields and blocks parent media when photo consent is missing', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'g-1',
        studentLinks: [{ studentId: 's-1' }],
      });
      prisma.guardianConsent.findFirst.mockResolvedValue(null);
      prisma.student.findMany.mockResolvedValue([
        { id: 's-1', classId: 'c-1', sectionId: 'sec-1' },
      ]);
      prisma.activityPost.findMany.mockResolvedValue([
        {
          id: 'post-1',
          tenantId,
          classId: 'c-1',
          sectionId: 'sec-1',
          title: 'Class photo',
          caption: 'Learning together',
          category: ActivityCategory.LEARNING,
          audienceType: AudienceType.SECTION,
          status: ActivityPostStatus.APPROVED,
          publishedAt: new Date(),
          attachments: [
            {
              id: 'att-1',
              fileName: 'class.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 10,
              sortOrder: 0,
              processingStatus: 'READY',
              objectKey: 'tenant-hardening/private/class.jpg',
              publicUrl: '/private/class.jpg',
              fileAssetId: 'file-1',
            },
          ],
          studentTags: [{ studentId: 's-1' }],
          reactions: [],
        },
      ]);

      const posts = await feedService.listPosts(parentActor);
      const attachment = posts[0].attachments[0] as Record<string, unknown>;

      expect(attachment.previewUrl).toBeNull();
      expect(attachment.accessBlockedReason).toBe(
        'PHOTO_USAGE_CONSENT_REQUIRED',
      );
      expect(attachment.objectKey).toBeUndefined();
      expect(attachment.publicUrl).toBeUndefined();
      expect(attachment.fileAssetId).toBeUndefined();
    });
  });
});
