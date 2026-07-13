import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ActivityMediaService } from './activity-media.service';

describe('ActivityMediaService protected thumbnails', () => {
  const parent: AuthContext = {
    userId: 'parent-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
    email: 'parent@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['parent'],
    permissions: ['activity_feed:read'],
  };
  const thumbnail = {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    activityPostId: 'post-1',
    fileName: 'classroom.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 4000,
    optimizedObjectKey: 'tenant-1/activity/optimized.jpg',
    optimizedSizeBytes: 2000,
    fileAssetId: 'file-original-1',
    activityPost: {
      id: 'post-1',
      classId: 'class-1',
      sectionId: 'section-1',
      status: 'APPROVED',
      softDeletedAt: null,
      parentVisible: true,
      studentTags: [{ studentId: 'student-1' }],
    },
    fileAsset: {
      id: 'file-original-1',
      tenantId: 'tenant-1',
      objectKey: 'tenant-1/activity/original.jpg',
      softDeletedAt: null,
    },
    thumbnailFileAsset: {
      id: 'file-thumbnail-1',
      tenantId: 'tenant-1',
      originalFilename: 'classroom-thumbnail-256.webp',
      objectKey: 'tenant-1/activity/thumbnail.webp',
      mimeType: 'image/webp',
      sizeBytes: BigInt(512),
      module: 'activity',
      entityId: 'attachment-1',
      status: 'UPLOADED',
      metadata: {
        variant: 'thumbnail-256',
        sourceFileAssetId: 'file-original-1',
        activityAttachmentId: 'attachment-1',
      },
      softDeletedAt: null,
      deletedAt: null,
    },
  };

  let prisma: any;
  let storage: any;
  let audit: any;
  let service: ActivityMediaService;

  beforeEach(() => {
    prisma = {
      activityAttachment: { findFirst: jest.fn().mockResolvedValue(thumbnail) },
      guardian: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'guardian-1',
          studentLinks: [{ studentId: 'student-1' }],
        }),
      },
      guardianConsent: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ granted: true, revokedAt: null }),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'student-1',
            lifecycleStatus: 'ACTIVE',
            guardianLinks: [
              {
                guardian: {
                  consents: [{ granted: true, revokedAt: null }],
                },
              },
            ],
          },
        ]),
      },
      staff: { findFirst: jest.fn() },
      subjectTeacherAssignment: { findFirst: jest.fn() },
    };
    storage = {
      getObjectBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail')),
    };
    audit = { record: jest.fn() };
    service = new ActivityMediaService(
      prisma,
      { port: 4000 } as never,
      storage,
      audit,
    );
  });

  it('serves the registered thumbnail variant to a linked consented parent', async () => {
    await expect(
      service.getAttachmentMedia(parent, 'attachment-1', 'thumbnail'),
    ).resolves.toEqual(
      expect.objectContaining({
        fileName: 'classroom-thumbnail-256.webp',
        contentType: 'image/webp',
        sizeBytes: 512,
      }),
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      'tenant-1/activity/thumbnail.webp',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'activity_attachment_thumbnail',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('fails closed when the linked child is outside the post audience', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-other' }],
    });
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.getAttachmentMedia(parent, 'attachment-1', 'thumbnail'),
    ).rejects.toThrow('Activity media is outside your scope');
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('does not resolve a thumbnail outside the authenticated tenant', async () => {
    prisma.activityAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.getAttachmentMedia(
        parent,
        'other-tenant-attachment',
        'thumbnail',
      ),
    ).rejects.toThrow('Activity attachment not found');
    expect(prisma.activityAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'other-tenant-attachment',
          tenantId: 'tenant-1',
        },
      }),
    );
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('fails closed when parent photo consent is revoked', async () => {
    prisma.guardianConsent.findFirst.mockResolvedValue({
      granted: false,
      revokedAt: new Date(),
    });

    await expect(
      service.getAttachmentMedia(parent, 'attachment-1', 'thumbnail'),
    ).rejects.toThrow('Some media is hidden');
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('uses an existing optimized preview for legacy media without a thumbnail', async () => {
    const admin = {
      ...parent,
      userId: 'admin-1',
      roles: ['admin'],
      permissions: ['activity_feed:read', 'activity_feed:moderate'],
    };
    prisma.activityAttachment.findFirst.mockResolvedValue({
      ...thumbnail,
      thumbnailFileAsset: null,
    });

    await service.getAttachmentMedia(admin, 'attachment-1', 'thumbnail');

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      'tenant-1/activity/optimized.jpg',
    );
    expect(storage.getObjectBuffer).not.toHaveBeenCalledWith(
      'tenant-1/activity/original.jpg',
    );
  });
});
