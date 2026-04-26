import {
  ActivityCategory,
  AudienceType,
  AuthMethod,
  NotificationChannel,
  StorageProvider,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ActivityFeedService } from './activity-feed.service';

describe('ActivityFeedService', () => {
  let prisma: any;
  let storageService: any;
  let communicationsService: any;
  let auditService: any;
  let service: ActivityFeedService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      activityPost: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      moodLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    storageService = {
      saveBase64Object: jest.fn(),
    };
    communicationsService = {
      recordDeliveryRecords: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    actor = {
      userId: 'teacher-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['activity_feed:create'],
    };

    service = new ActivityFeedService(
      prisma,
      storageService,
      communicationsService,
      auditService,
    );
  });

  it('stores post attachments, student tags, delivery records, and audit trail in one tenant scope', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({ id: 'section-1' });
    prisma.student.findMany.mockResolvedValue([{ id: 'student-1' }]);
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/activity-feed/class-1/photo.jpg',
      publicUrl: '/storage/tenant-1/activity-feed/class-1/photo.jpg',
      sizeBytes: 42,
    });
    prisma.activityPost.create.mockImplementation(async ({ data }: any) => ({
      id: 'post-1',
      classId: data.classId,
      sectionId: data.sectionId,
      title: data.title,
      caption: data.caption,
      category: data.category,
      audienceType: data.audienceType,
      attachments: [{ id: 'attachment-1' }],
      studentTags: [{ studentId: 'student-1' }],
    }));

    const result = await service.createPost(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        title: 'Science day',
        caption: 'Students built plant life-cycle charts.',
        category: ActivityCategory.LEARNING,
        studentIds: ['student-1'],
        attachments: [
          {
            fileName: 'photo.jpg',
            contentType: 'image/jpeg',
            base64Content: 'aGVsbG8=',
          },
        ],
      },
      actor,
    );

    expect(result.id).toBe('post-1');
    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        classId: 'class-1',
        sectionId: 'section-1',
        id: { in: ['student-1'] },
      },
    });
    expect(prisma.activityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          createdById: 'teacher-1',
          attachments: expect.objectContaining({
            create: [
              expect.objectContaining({
                tenantId: 'tenant-1',
                provider: StorageProvider.LOCAL,
                sortOrder: 0,
              }),
            ],
          }),
        }),
      }),
    );
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        audienceType: AudienceType.SECTION,
        channels: [NotificationChannel.PUSH],
        studentIds: ['student-1'],
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'activity_post',
        tenantId: 'tenant-1',
      }),
    );
  });
});
