import {
  ActivityCategory,
  AudienceType,
  AuthMethod,
  DevelopmentalMilestoneStatus,
  NotificationChannel,
  StorageProvider,
} from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types.js';
import { ActivityFeedService } from './activity-feed.service';

describe('ActivityFeedService', () => {
  let prisma: any;
  let storageService: any;
  let communicationsService: any;
  let auditService: any;
  let fileRegistry: any;
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
      staff: {
        findFirst: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
      },
      guardianConsent: {
        findFirst: jest.fn(),
      },
      activityPost: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      activityReaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
      },
      fileAsset: {
        update: jest.fn(),
      },
      moodLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      developmentalMilestone: {
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

    fileRegistry = {
      registerFile: jest.fn(),
      markUploaded: jest.fn(),
      getSignedUrl: jest.fn(),
      auditAccess: jest.fn(),
    };

    service = new ActivityFeedService(
      prisma,
      storageService,
      communicationsService,
      auditService,
      { emit: jest.fn() } as any,
      fileRegistry,
      { add: jest.fn() } as any,
    );
  });

  it('stores post attachments, student tags, delivery records, and audit trail in one tenant scope', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findMany.mockResolvedValue([{ id: 'student-1' }]);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    fileRegistry.registerFile.mockResolvedValue({ id: 'file-asset-1' });
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
            base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
              'base64',
            ),
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
                publicUrl: null,
                sortOrder: 0,
              }),
            ],
          }),
        }),
      }),
    );
    expect(fileRegistry.markUploaded).toHaveBeenCalledWith(
      'tenant-1',
      'file-asset-1',
      'teacher-1',
    );
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        audienceType: AudienceType.ALL,
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

  it('blocks teachers who are not assigned to the selected class or section', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          sectionId: 'section-1',
          title: 'Science day',
          caption: 'Students built plant life-cycle charts.',
          category: ActivityCategory.LEARNING,
          studentIds: [],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('Teacher is not assigned to this class/section');
  });

  it('rejects non-image activity attachments before storage', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          title: 'Worksheet',
          caption: 'A PDF should not be uploaded as an activity photo.',
          category: ActivityCategory.LEARNING,
          studentIds: [],
          attachments: [
            {
              fileName: 'worksheet.pdf',
              contentType: 'application/pdf',
              base64Content: 'aGVsbG8=',
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('Only standard images are allowed');
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });

  it('scopes parent feed reads to own child tagged, section, and whole-class posts', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.student.findMany.mockResolvedValue([
      { id: 'student-1', classId: 'class-1', sectionId: 'section-1' },
    ]);
    prisma.activityPost.findMany.mockResolvedValue([]);

    await service.listPosts(parentActor);

    expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [
            { studentTags: { some: { studentId: { in: ['student-1'] } } } },
            {
              studentTags: { none: {} },
              classId: 'class-1',
              sectionId: null,
            },
            {
              studentTags: { none: {} },
              classId: 'class-1',
              sectionId: 'section-1',
            },
          ],
        }),
      }),
    );
  });

  it('blocks parent feed reads for another child', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });

    await expect(
      service.listPosts(parentActor, { studentId: 'student-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.activityPost.findMany).not.toHaveBeenCalled();
  });

  it('stores milestone photo references as private object metadata', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.developmentalMilestone.create.mockImplementation(
      async ({ data }: any) => ({ id: 'milestone-1', ...data }),
    );

    const result = await service.createMilestone(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        domain: 'Motor skills',
        milestone: 'Uses classroom materials independently',
        status: DevelopmentalMilestoneStatus.PROGRESSING,
        observationNote: 'Needs occasional prompting.',
        photoUrl: '/storage/public/photo.jpg',
        observedAt: '2026-04-28T00:00:00.000Z',
      },
      actor,
    );

    expect(result.photoObjectKey).toBe('/storage/public/photo.jpg');
    expect(result.photoUrl).toBeNull();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'developmental_milestone',
      }),
    );
  });
});
