import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, StudentLifecycleStatus } from '@prisma/client';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  createTeacherScopeDeniedException,
  TEACHER_SCOPE_DENIED_CODE,
  TeacherScopeService,
} from '../teacher-scope/teacher-scope.service';
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
  let teacherScope: {
    canActorAccess: jest.Mock;
    canActorAccessAnySectionOfClass: jest.Mock;
    requireActorAccess: jest.Mock;
    requireActorAccessAnySectionOfClass: jest.Mock;
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
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      status: 'ASSIGNED',
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
    teacherScope = {
      canActorAccess: jest.fn().mockResolvedValue(null),
      canActorAccessAnySectionOfClass: jest.fn().mockResolvedValue(null),
      requireActorAccess: jest.fn().mockResolvedValue({}),
      requireActorAccessAnySectionOfClass: jest.fn().mockResolvedValue({}),
    };
    service = new HomeworkAttachmentAccessService(
      prisma as unknown as PrismaService,
      fileRegistry as unknown as FileRegistryService,
      teacherScope as unknown as TeacherScopeService,
    );
  });

  it('denies homework attachment URLs during a support override before attachment lookup', async () => {
    await expect(
      service.getAttachmentAccessUrl(
        'attachment-1',
        { ...studentActor, isSupportOverride: true },
        'preview',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.homeworkAttachment.findFirst).not.toHaveBeenCalled();
    expect(fileRegistry.auditAccess).not.toHaveBeenCalled();
    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
  });

  it('authorizes a subject teacher attachment through canonical exact-subject scope', async () => {
    prisma.homeworkAttachment.findFirst.mockResolvedValue(baseAttachment);
    teacherScope.canActorAccess.mockResolvedValue({
      assignmentId: 'assignment-1',
    });
    const teacherActor = {
      ...studentActor,
      userId: 'teacher-user-1',
      roles: ['teacher'],
    };

    await service.getAttachmentAccessUrl(
      'attachment-1',
      teacherActor,
      'preview',
    );

    expect(teacherScope.canActorAccess).toHaveBeenCalledWith(
      {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        capability: TeacherCapability.SUBJECT_RECORD_READ,
      },
      teacherActor,
    );
  });

  it('denies another subject teacher with the stable canonical reason code', async () => {
    prisma.homeworkAttachment.findFirst.mockResolvedValue(baseAttachment);
    teacherScope.requireActorAccess.mockRejectedValue(
      createTeacherScopeDeniedException(),
    );

    await expect(
      service.getAttachmentAccessUrl(
        'attachment-1',
        {
          ...studentActor,
          userId: 'teacher-user-1',
          roles: ['teacher'],
        },
        'download',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: TEACHER_SCOPE_DENIED_CODE }),
    });
    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
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
