import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  ActivityPostStatus,
  AudienceType,
  ConsentType,
  NotificationChannel,
  StorageProvider,
} from '@prisma/client';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { ActivityFeedService } from '../src/activity-feed/activity-feed.service';
import { ActivityPostLifecycleService } from '../src/activity-feed/activity-post-lifecycle.service';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import { CommunicationsService } from '../src/communications/communications.service';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

interface ActivityPostRecord {
  id: string;
  tenantId: string;
  classId: string;
  sectionId: string | null;
  createdById: string;
  title: string;
  caption: string;
  category: ActivityCategory;
  audienceType: AudienceType;
  publishedAt: Date;
  createdAt: Date;
  status: ActivityPostStatus;
  moderationStatus: string;
  softDeletedAt: Date | null;
  attachments: ActivityAttachmentRecord[];
  studentTags: { tenantId: string; studentId: string }[];
  reactions: unknown[];
}

interface ActivityAttachmentRecord {
  id: string;
  tenantId: string;
  activityPostId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: StorageProvider;
  objectKey: string;
  publicUrl: string | null;
  fileAssetId: string;
  sortOrder: number;
  processingStatus?: string;
  activityPost?: ActivityPostRecord;
}

interface ActivityPostLifecycleRow {
  id: string;
  tenantId: string;
  createdById: string;
  status: ActivityPostStatus;
  moderationStatus: string;
  softDeletedAt: Date | null;
}

interface ActivityPrivacyState {
  classes: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  students: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  guardianConsents: Record<string, unknown>[];
  activityPosts: ActivityPostRecord[];
  activityAttachments: ActivityAttachmentRecord[];
  fileAssets: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  rawQueries: unknown[];
}

type ActivityPrismaMock = ReturnType<typeof buildPrismaMock>;

describe('Activity Media + Consent Privacy Integration (E2E)', () => {
  const tenantId = 'tenant-activity-privacy';
  const otherTenantId = 'tenant-activity-other';
  const adminActor = createActor({
    tenantId,
    userId: 'admin-user',
    roles: ['admin'],
    permissions: ['activity_feed:create', 'activity_feed:read'],
  });
  const teacherActor = createActor({
    tenantId,
    userId: 'teacher-user',
    roles: ['teacher'],
    permissions: ['activity_feed:create', 'activity_feed:read'],
  });
  const parentActor = createActor({
    tenantId,
    userId: 'guardian-user-1',
    roles: ['parent'],
    permissions: ['activity_feed:read'],
  });

  let prisma: ActivityPrismaMock;
  let storageService: {
    saveBase64Object: jest.Mock;
    getObjectBuffer: jest.Mock;
    saveBufferObject: jest.Mock;
  };
  let communicationsService: { recordDeliveryRecords: jest.Mock };
  let auditService: { record: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let fileRegistryService: {
    registerFile: jest.Mock;
    markUploaded: jest.Mock;
    getSignedUrl: jest.Mock;
    auditAccess: jest.Mock;
  };
  let activityFeedService: ActivityFeedService;
  let lifecycleService: ActivityPostLifecycleService;
  let mediaProcessor: ActivityMediaProcessor;

  beforeEach(() => {
    prisma = buildPrismaMock(tenantId, otherTenantId);
    storageService = {
      saveBase64Object: jest.fn().mockResolvedValue({
        provider: StorageProvider.LOCAL,
        objectKey: `${tenantId}/activity/photo.jpg`,
        publicUrl: '/should-not-be-used-publicly/photo.jpg',
        sizeBytes: 42,
      }),
      getObjectBuffer: jest.fn().mockResolvedValue(Buffer.from('image-data')),
      saveBufferObject: jest.fn().mockResolvedValue({
        provider: StorageProvider.LOCAL,
        objectKey: `${tenantId}/activity-feed/optimized/photo.jpg`,
        publicUrl: null,
        sizeBytes: 21,
      }),
    };
    communicationsService = {
      recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 1 }),
    };
    auditService = {
      record: jest.fn(async (entry: Record<string, unknown>) => {
        prisma.__state.auditLogs.push({
          id: `audit-${prisma.__state.auditLogs.length + 1}`,
          ...entry,
          createdAt: new Date(),
        });
      }),
    };
    eventEmitter = { emit: jest.fn() };
    fileRegistryService = {
      registerFile: jest.fn().mockResolvedValue({ id: 'file-asset-1' }),
      markUploaded: jest.fn().mockResolvedValue({ id: 'file-asset-1' }),
      getSignedUrl: jest
        .fn()
        .mockResolvedValue('signed://activity/file-asset-1'),
      auditAccess: jest.fn().mockResolvedValue(undefined),
    };

    activityFeedService = new ActivityFeedService(
      prisma as unknown as PrismaService,
      storageService as unknown as StorageService,
      communicationsService as unknown as CommunicationsService,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
      fileRegistryService as unknown as FileRegistryService,
      { add: jest.fn() } as never,
    );
    lifecycleService = new ActivityPostLifecycleService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
    );
    mediaProcessor = new ActivityMediaProcessor(
      prisma as unknown as PrismaService,
      storageService as unknown as StorageService,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
    );
  });

  it('creates private activity media, registers file assets, dispatches only through PHOTO_USAGE consent boundary, and audits creation', async () => {
    const post = await activityFeedService.createPost(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        title: 'Art day',
        caption: 'Children made paper flowers.',
        category: ActivityCategory.ART_AND_CRAFT,
        studentIds: ['student-1'],
        attachments: [
          {
            fileName: 'art.jpg',
            contentType: 'image/jpeg',
            base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
              'base64',
            ),
          },
        ],
      },
      teacherActor,
    );

    expect(storageService.saveBase64Object).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        prefix: 'activity-feed/class-1',
        fileName: 'art.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        module: 'activity',
        originalFilename: 'art.jpg',
        objectKey: `${tenantId}/activity/photo.jpg`,
      }),
    );
    expect(fileRegistryService.markUploaded).toHaveBeenCalledWith(
      tenantId,
      'file-asset-1',
      teacherActor.userId,
    );
    expect(prisma.__state.activityAttachments).toEqual([
      expect.objectContaining({
        activityPostId: post.id,
        publicUrl: null,
        fileAssetId: 'file-asset-1',
      }),
    ]);
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: teacherActor,
        sourceType: 'activity_post',
        sourceId: post.id,
        activityPostId: post.id,
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.PHOTO_USAGE],
        studentIds: ['student-1'],
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'activity_post',
        tenantId,
        resourceId: post.id,
        after: expect.objectContaining({ attachmentCount: 1 }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('feed.post.created', post);
  });

  it('scopes parent feed to own child/class posts and excludes unrelated tagged student posts', async () => {
    seedPost({
      id: 'post-tagged-own-child',
      studentIds: ['student-1'],
      title: 'Own child tagged',
    });
    seedPost({
      id: 'post-class-wide',
      studentIds: [],
      title: 'Class wide',
    });
    seedPost({
      id: 'post-other-child',
      studentIds: ['student-2'],
      title: 'Other child tagged',
    });

    const posts = await activityFeedService.listPosts(parentActor);
    const postIds = posts.map((post) => post.id);

    expect(postIds).toHaveLength(2);
    expect(postIds).toEqual(
      expect.arrayContaining(['post-tagged-own-child', 'post-class-wide']),
    );
    expect(postIds).not.toContain('post-other-child');
    expect(posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'post-tagged-own-child',
          attachments: [
            expect.objectContaining({
              previewUrl:
                'http://localhost:4000/api/v1/activity-feed/attachments/attachment-post-tagged-own-child/preview',
            }),
          ],
        }),
        expect.objectContaining({
          id: 'post-class-wide',
          attachments: [
            expect.objectContaining({
              previewUrl:
                'http://localhost:4000/api/v1/activity-feed/attachments/attachment-post-class-wide/preview',
            }),
          ],
        }),
      ]),
    );
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
  });

  it('blocks parent feed reads and media previews outside own child scope', async () => {
    const post = seedPost({
      id: 'post-other-child',
      studentIds: ['student-2'],
      title: 'Other child tagged',
    });

    await expect(
      activityFeedService.listPosts(parentActor, { studentId: 'student-2' }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      activityFeedService.getAttachmentPreview(
        parentActor,
        post.attachments[0].id,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns signed preview only after tenant and parent-scope checks, and audits media access', async () => {
    const post = seedPost({
      id: 'post-own-child',
      studentIds: ['student-1'],
      title: 'Own child tagged',
    });

    const preview = await activityFeedService.getAttachmentPreview(
      parentActor,
      post.attachments[0].id,
    );

    expect(preview).toBe('signed://activity/file-asset-1');
    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      tenantId,
      post.attachments[0].fileAssetId,
      parentActor.userId,
      'preview',
    );
    expect(fileRegistryService.getSignedUrl).toHaveBeenCalledWith(
      tenantId,
      post.attachments[0].fileAssetId,
    );

    await expect(
      activityFeedService.getAttachmentPreview(
        { ...parentActor, tenantId: otherTenantId },
      post.attachments[0].id,
    ),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks direct class-wide media previews when the linked child is inactive', async () => {
    const student = prisma.__state.students.find(
      (item) => item.id === 'student-1',
    );
    if (student) {
      student.lifecycleStatus = 'ARCHIVED';
    }
    const post = seedPost({
      id: 'post-class-wide-inactive-child',
      studentIds: [],
      title: 'Class wide inactive child',
    });

    await expect(
      activityFeedService.getAttachmentPreview(
        parentActor,
        post.attachments[0].id,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
  });

  it('blocks direct tagged media previews when any tagged student lacks active consent', async () => {
    const post = seedPost({
      id: 'post-mixed-consent',
      studentIds: ['student-1', 'student-2'],
      title: 'Mixed consent',
    });

    await expect(
      activityFeedService.getAttachmentPreview(
        parentActor,
        post.attachments[0].id,
      ),
    ).rejects.toThrow(
      'Some media is hidden because of student photo consent settings.',
    );

    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'activity_attachment_denied_consent',
        resourceId: post.attachments[0].id,
        after: expect.objectContaining({
          blockedStudentId: 'student-2',
          reason: 'PHOTO_USAGE_CONSENT_REQUIRED',
        }),
      }),
    );
  });

  it('rejects non-image media before storage and delivery dispatch', async () => {
    await expect(
      activityFeedService.createPost(
        {
          classId: 'class-1',
          sectionId: 'section-1',
          title: 'Invalid file',
          caption: 'PDF must not be accepted as activity media.',
          category: ActivityCategory.LEARNING,
          studentIds: ['student-1'],
          attachments: [
            {
              fileName: 'worksheet.pdf',
              contentType: 'application/pdf',
              base64Content: Buffer.from('pdf-data').toString('base64'),
            },
          ],
        },
        teacherActor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
  });

  it('soft deletes and moderates posts through lifecycle service with tenant-scoped audit trail', async () => {
    seedPost({ id: 'post-lifecycle', studentIds: ['student-1'] });

    const rejected = await lifecycleService.moderatePost(
      'post-lifecycle',
      { status: 'REJECTED', reason: 'Contains unrelated child photo' },
      adminActor,
    );

    expect(rejected).toEqual(
      expect.objectContaining({
        id: 'post-lifecycle',
        status: 'REJECTED',
      }),
    );

    const deleted = await lifecycleService.softDeletePost(
      'post-lifecycle',
      { reason: 'Remove rejected media' },
      adminActor,
    );

    expect(deleted).toEqual(
      expect.objectContaining({
        id: 'post-lifecycle',
        deleted: true,
      }),
    );
    expect(prisma.__state.activityPosts[0]).toEqual(
      expect.objectContaining({
        status: 'REJECTED',
        softDeletedAt: expect.any(Date),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'moderate',
        resource: 'activity_post',
        tenantId,
        resourceId: 'post-lifecycle',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'soft_delete',
        resource: 'activity_post',
        tenantId,
        resourceId: 'post-lifecycle',
      }),
    );
  });

  it('processes activity media compression with tenant, attachment, and file asset scoping', async () => {
    const post = seedPost({ id: 'post-media', studentIds: ['student-1'] });
    const attachment = post.attachments[0];

    const result = await mediaProcessor.process({
      data: {
        tenantId,
        attachmentId: attachment.id,
        fileAssetId: attachment.fileAssetId,
        requestedById: adminActor.userId,
      },
    } as Job);

    expect(result).toEqual(
      expect.objectContaining({
        attachmentId: attachment.id,
        fileAssetId: attachment.fileAssetId,
        status: 'READY',
      }),
    );
    expect(prisma.activityAttachment.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: attachment.id,
      },
      data: { processingStatus: 'PROCESSING' },
    });
    expect(prisma.activityAttachment.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: attachment.id,
      },
      data: expect.objectContaining({ processingStatus: 'READY' }),
    });
    expect(prisma.__state.activityAttachments[0].processingStatus).toBe(
      'READY',
    );
  });

  function seedPost(input: {
    id: string;
    studentIds: string[];
    title?: string;
    tenant?: string;
    classId?: string;
    sectionId?: string | null;
  }) {
    const attachment: ActivityAttachmentRecord = {
      id: `attachment-${input.id}`,
      tenantId: input.tenant ?? tenantId,
      activityPostId: input.id,
      fileName: `${input.id}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 42,
      provider: StorageProvider.LOCAL,
      objectKey: `${input.tenant ?? tenantId}/activity/${input.id}.jpg`,
      publicUrl: null,
      fileAssetId: `file-${input.id}`,
      sortOrder: 0,
    };
    const post: ActivityPostRecord = {
      id: input.id,
      tenantId: input.tenant ?? tenantId,
      classId: input.classId ?? 'class-1',
      sectionId: input.sectionId ?? 'section-1',
      createdById: teacherActor.userId,
      title: input.title ?? input.id,
      caption: 'Caption',
      category: ActivityCategory.GENERAL,
      audienceType: input.studentIds.length
        ? AudienceType.ALL
        : AudienceType.SECTION,
      publishedAt: new Date(),
      createdAt: new Date(),
      status: ActivityPostStatus.APPROVED,
      moderationStatus: 'APPROVED',
      softDeletedAt: null,
      attachments: [attachment],
      studentTags: input.studentIds.map((studentId) => ({
        tenantId,
        studentId,
      })),
      reactions: [],
    };
    attachment.activityPost = post;
    prisma.__state.activityPosts.push(post);
    prisma.__state.activityAttachments.push(attachment);
    return post;
  }
});

function buildPrismaMock(tenantId: string, otherTenantId: string) {
  const state: ActivityPrivacyState = {
    classes: [
      { id: 'class-1', tenantId, name: 'Class 1' },
      { id: 'other-class-1', tenantId: otherTenantId, name: 'Other Class' },
    ],
    sections: [{ id: 'section-1', tenantId, classId: 'class-1', name: 'A' }],
    students: [
      {
        id: 'student-1',
        tenantId,
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: 'ACTIVE',
        guardianLinks: [
          {
            guardian: {
              id: 'guardian-1',
              consents: [
                {
                  consentType: ConsentType.PHOTO_USAGE,
                  granted: true,
                  revokedAt: null,
                },
              ],
            },
          },
        ],
      },
      {
        id: 'student-2',
        tenantId,
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: 'ACTIVE',
        guardianLinks: [],
      },
    ],
    guardians: [
      {
        id: 'guardian-1',
        tenantId,
        userId: 'guardian-user-1',
        studentLinks: [{ studentId: 'student-1' }],
      },
    ],
    guardianConsents: [
      {
        id: 'consent-1',
        tenantId,
        guardianId: 'guardian-1',
        consentType: ConsentType.PHOTO_USAGE,
        granted: true,
        capturedAt: new Date(),
        revokedAt: null,
      },
    ],
    activityPosts: [],
    activityAttachments: [],
    fileAssets: [],
    auditLogs: [],
    rawQueries: [],
  };

  const queryRawMock: jest.Mock<
    Promise<ActivityPostLifecycleRow[]>,
    unknown[]
  > = jest.fn(async () => []);

  const prisma = {
    __state: state,
    class: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.classes.find(
            (classroom) =>
              classroom.id === q.where?.id &&
              classroom.tenantId === q.where?.tenantId,
          ) ?? null,
      ),
    },
    section: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.sections.find(
            (section) =>
              section.id === q.where?.id &&
              section.tenantId === q.where?.tenantId,
          ) ?? null,
      ),
    },
    staff: {
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        if (q.where?.userId === 'teacher-user') {
          return { id: 'staff-1' };
        }
        return null;
      }),
    },
    student: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        const idIn = (where.id as { in?: string[] } | undefined)?.in;
        return state.students.filter(
          (student) =>
            student.tenantId === where.tenantId &&
            (!where.classId || student.classId === where.classId) &&
            (!where.sectionId || student.sectionId === where.sectionId) &&
            (!where.lifecycleStatus ||
              student.lifecycleStatus === where.lifecycleStatus) &&
            (!idIn || idIn.includes(student.id as string)),
        );
      }),
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.students.find(
            (student) =>
              student.id === q.where?.id &&
              student.tenantId === q.where?.tenantId,
          ) ?? null,
      ),
    },
    guardian: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.guardians.find(
            (guardian) =>
              guardian.tenantId === q.where?.tenantId &&
              guardian.userId === q.where?.userId,
          ) ?? null,
      ),
    },
    guardianConsent: {
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        return (
          state.guardianConsents
            .filter(
              (consent) =>
                consent.tenantId === q.where?.tenantId &&
                consent.guardianId === q.where?.guardianId &&
                consent.consentType === q.where?.consentType,
            )
            .sort(
              (a, b) =>
                (b.capturedAt as Date).getTime() -
                (a.capturedAt as Date).getTime(),
            )[0] ?? null
        );
      }),
    },
    activityPost: {
      create: jest.fn(
        async (q: { data: Record<string, unknown>; include?: unknown }) => {
          const data = q.data;
          const attachmentsCreate = ((
            data.attachments as
              | { create?: Record<string, unknown>[] }
              | undefined
          )?.create ?? []) as Record<string, unknown>[];
          const studentTagsCreate = ((
            data.studentTags as
              | { create?: Record<string, unknown>[] }
              | undefined
          )?.create ?? []) as Record<string, unknown>[];
          const postId = `post-${state.activityPosts.length + 1}`;
          const attachments = attachmentsCreate.map((attachment, index) => ({
            id: `attachment-${postId}-${index + 1}`,
            activityPostId: postId,
            ...attachment,
          })) as ActivityAttachmentRecord[];
          const post: ActivityPostRecord = {
            id: postId,
            tenantId: data.tenantId as string,
            classId: data.classId as string,
            sectionId: (data.sectionId as string | null) ?? null,
            createdById: data.createdById as string,
            title: data.title as string,
            caption: data.caption as string,
            category: data.category as ActivityCategory,
            audienceType: data.audienceType as AudienceType,
            publishedAt: data.publishedAt as Date,
            createdAt: new Date(),
            status: ActivityPostStatus.APPROVED,
            moderationStatus: 'APPROVED',
            softDeletedAt: null,
            attachments,
            studentTags: studentTagsCreate.map((tag) => ({
              tenantId: tag.tenantId as string,
              studentId: tag.studentId as string,
            })),
            reactions: [],
          };
          for (const attachment of attachments) {
            attachment.activityPost = post;
          }
          state.activityPosts.push(post);
          state.activityAttachments.push(...attachments);
          return post;
        },
      ),
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        return state.activityPosts
          .filter((post) => post.tenantId === where.tenantId)
          .filter((post) => !where.classId || post.classId === where.classId)
          .filter(
            (post) => !where.sectionId || post.sectionId === where.sectionId,
          )
          .filter((post) =>
            matchesVisibility(
              post,
              where.OR as Record<string, unknown>[] | undefined,
            ),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }),
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        return (
          state.activityPosts
            .filter(
              (post) =>
                post.id === where.id && post.tenantId === where.tenantId,
            )
            .find((post) =>
              matchesVisibility(
                post,
                where.OR as Record<string, unknown>[] | undefined,
              ),
            ) ?? null
        );
      }),
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          const post = state.activityPosts.find(
            (item) => item.id === q.where.id,
          );
          if (!post) return null;
          Object.assign(post, q.data);
          if (q.data.status) {
            post.moderationStatus = q.data.status as string;
          }
          return post;
        },
      ),
    },
    activityAttachment: {
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const attachment = state.activityAttachments.find(
          (item) =>
            item.id === q.where?.id && item.tenantId === q.where?.tenantId,
        );
        return attachment
          ? {
              ...attachment,
              activityPost: attachment.activityPost,
              fileAsset: {
                id: attachment.fileAssetId,
                tenantId: attachment.tenantId,
                objectKey: attachment.objectKey,
              },
            }
          : null;
      }),
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          const attachment = state.activityAttachments.find(
            (item) => item.id === q.where.id,
          );
          if (!attachment) return null;
          Object.assign(attachment, q.data);
          return attachment;
        },
      ),
      updateMany: jest.fn(
        async (q: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          let count = 0;
          for (const attachment of state.activityAttachments) {
            if (
              attachment.id === q.where.id &&
              attachment.tenantId === q.where.tenantId &&
              attachment.fileAssetId === q.where.fileAssetId
            ) {
              Object.assign(attachment, q.data);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    activityReaction: {
      groupBy: jest.fn(async () => []),
    },
    fileAsset: {
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          state.fileAssets.push({ id: q.where.id, ...q.data });
          return { id: q.where.id, ...q.data };
        },
      ),
    },
    $queryRaw: queryRawMock,
  };

  prisma.$queryRaw.mockImplementation(async (...args: unknown[]) => {
    state.rawQueries.push(args);
    const sqlText = JSON.stringify(args);
    const postId = extractPostId(sqlText, state.activityPosts);
    const post = state.activityPosts.find((item) => item.id === postId);

    if (!post) {
      return [];
    }

    if (isSoftDeleteQuery(sqlText)) {
      post.softDeletedAt = new Date();
      post.moderationStatus = 'REJECTED';
      post.status = ActivityPostStatus.REJECTED;
      return [toLifecycleRow(post)];
    }

    if (isModerationQuery(sqlText)) {
      post.moderationStatus = sqlText.includes('REJECTED')
        ? 'REJECTED'
        : 'APPROVED';
      post.status = sqlText.includes('REJECTED')
        ? ActivityPostStatus.REJECTED
        : ActivityPostStatus.APPROVED;
      return [toLifecycleRow(post)];
    }

    return [toLifecycleRow(post)];
  });

  return prisma;
}

function matchesVisibility(
  post: ActivityPostRecord,
  visibility?: Record<string, unknown>[],
) {
  if (!visibility?.length) {
    return true;
  }

  return visibility.some((condition) => {
    const studentTag = condition.studentTags as
      | {
          some?: { studentId?: { in?: string[] } };
          none?: Record<string, never>;
        }
      | undefined;
    if (studentTag?.some?.studentId?.in) {
      return post.studentTags.some((tag) =>
        studentTag.some?.studentId?.in?.includes(tag.studentId),
      );
    }
    if (studentTag?.none) {
      return (
        post.studentTags.length === 0 &&
        post.classId === condition.classId &&
        post.sectionId === (condition.sectionId ?? null)
      );
    }
    return false;
  });
}

function toLifecycleRow(post: ActivityPostRecord): ActivityPostLifecycleRow {
  return {
    id: post.id,
    tenantId: post.tenantId,
    createdById: post.createdById,
    status: post.status,
    moderationStatus: post.moderationStatus,
    softDeletedAt: post.softDeletedAt,
  };
}

function extractPostId(sqlText: string, posts: ActivityPostRecord[]) {
  return posts.find((post) => sqlText.includes(post.id))?.id;
}

function isSoftDeleteQuery(sqlText: string) {
  return (
    sqlText.includes('UPDATE') && sqlText.includes('Remove rejected media')
  );
}

function isModerationQuery(sqlText: string) {
  return (
    sqlText.includes('UPDATE') &&
    sqlText.includes('Contains unrelated child photo')
  );
}

function createActor(overrides: Partial<AuthContext>): AuthContext {
  return {
    tenantId: 'tenant-activity-privacy',
    tenantSlug: 'activity-privacy',
    userId: 'user-1',
    email: 'user@schoolos.test',
    authMethod: 'PASSWORD' as never,
    roles: [],
    permissions: [],
    ...overrides,
  };
}
