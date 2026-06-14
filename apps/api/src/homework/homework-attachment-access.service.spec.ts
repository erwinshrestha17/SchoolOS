import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, StudentLifecycleStatus } from '@prisma/client';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { HomeworkAttachmentAccessService } from './homework-attachment-access.service';

describe('HomeworkAttachmentAccessService', () => {
  let service: HomeworkAttachmentAccessService;
  let prisma: {
    homeworkAttachment: { findFirst: jest.Mock };
    student: { findFirst: jest.Mock };
    studentGuardian: { findFirst: jest.Mock };
  };
  let fileRegistry: {
    auditAccess: jest.Mock;
    getSignedUrl: jest.Mock;
  };

  const studentActor = {
    userId: 'student-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-1',
    email: 'student@example.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['student'],
    permissions: ['homework:read'],
  };

  const baseAttachment = {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    assignmentId: 'hw-1',
    submissionId: null,
    fileAssetId: 'file-1',
    fileAsset: {
      id: 'file-1',
      tenantId: 'tenant-1',
      originalFilename: 'homework.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      status: 'UPLOADED',
      module: 'homework',
      entityId: 'hw-1',
      softDeletedAt: null,
    },
    assignment: {
      id: 'hw-1',
      classId: 'class-1',
      sectionId: 'section-1',
    },
    submission: null,
  };

  beforeEach(() => {
    prisma = {
      homeworkAttachment: { findFirst: jest.fn() },
      student: { findFirst: jest.fn() },
      studentGuardian: { findFirst: jest.fn() },
    };
    fileRegistry = {
      auditAccess: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/file'),
    };
    service = new HomeworkAttachmentAccessService(
      prisma as unknown as PrismaService,
      fileRegistry as unknown as FileRegistryService,
    );
  });

  it('denies student attachment access after the student leaves the class or active roster', async () => {
    prisma.homeworkAttachment.findFirst.mockResolvedValue(baseAttachment);
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.getAttachmentAccessUrl('attachment-1', studentActor, 'preview'),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'student-user-1',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: {
        id: true,
        classId: true,
        sectionId: true,
        lifecycleStatus: true,
      },
    });
    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
  });

  it('denies assignment attachment access when the File Registry entity link is stale', async () => {
    prisma.homeworkAttachment.findFirst.mockResolvedValue({
      ...baseAttachment,
      fileAsset: {
        ...baseAttachment.fileAsset,
        entityId: 'other-homework',
      },
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });

    await expect(
      service.getAttachmentAccessUrl('attachment-1', studentActor, 'download'),
    ).rejects.toThrow(ForbiddenException);

    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
  });
});
