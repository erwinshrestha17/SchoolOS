import { ForbiddenException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ActivityMediaService } from './activity-media.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  createTeacherScopeDeniedException,
  TEACHER_SCOPE_DENIED_CODE,
} from '../teacher-scope/teacher-scope.service';

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
  let teacherScope: {
    requireActorAccess: jest.Mock;
    requireActorAccessAnySectionOfClass: jest.Mock;
  };
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
    teacherScope = {
      requireActorAccess: jest.fn().mockResolvedValue({
        source: 'ASSIGNMENT',
        assignmentId: 'assignment-1',
      }),
      requireActorAccessAnySectionOfClass: jest.fn().mockResolvedValue({
        source: 'ASSIGNMENT',
        assignmentId: 'assignment-1',
      }),
    };
    service = new ActivityMediaService(
      prisma,
      { port: 4000 } as never,
      storage,
      audit,
      teacherScope as never,
    );
  });

  it('denies activity media bytes during a support override before attachment lookup', async () => {
    await expect(
      service.getAttachmentMedia(
        { ...parent, isSupportOverride: true },
        'attachment-1',
        'preview',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.activityAttachment.findFirst).not.toHaveBeenCalled();
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('denies activity media access URLs during a support override before attachment lookup', async () => {
    await expect(
      service.getAttachmentAccessUrl(
        { ...parent, isSupportOverride: true },
        'attachment-1',
        'preview',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.activityAttachment.findFirst).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
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

  it('authorizes teacher media reads through the canonical assignment scope', async () => {
    const teacher: AuthContext = {
      ...parent,
      userId: 'teacher-1',
      email: 'teacher@school.test',
      roles: ['teacher'],
      permissions: ['activity_feed:read'],
    };

    await service.getAttachmentMedia(teacher, 'attachment-1', 'preview');

    expect(teacherScope.requireActorAccess).toHaveBeenCalledWith(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        capability: TeacherCapability.CLASS_ROSTER_READ,
      },
      teacher,
    );
  });

  it('returns the stable teacher-scope denial before reading media bytes', async () => {
    const teacher: AuthContext = {
      ...parent,
      userId: 'teacher-2',
      email: 'teacher2@school.test',
      roles: ['teacher'],
      permissions: ['activity_feed:read'],
    };
    teacherScope.requireActorAccess.mockRejectedValueOnce(
      createTeacherScopeDeniedException(),
    );

    await expect(
      service.getAttachmentMedia(teacher, 'attachment-1', 'preview'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: TEACHER_SCOPE_DENIED_CODE,
      }),
    });
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
