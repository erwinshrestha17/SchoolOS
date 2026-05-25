import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { StudentPhotoService } from './student-photo.service';
import type { AuthContext } from '../auth/auth.types';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'admin@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

function createServiceMocks() {
  const prisma = {
    student: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const storageService = {
    saveBufferObject: jest.fn(),
  };

  const fileRegistryService = {
    registerFile: jest.fn(),
    markUploaded: jest.fn(),
    softDeleteFile: jest.fn(),
    getFileMetadata: jest.fn(),
    auditAccess: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const auditService = {
    record: jest.fn(),
  };

  const service = new StudentPhotoService(
    prisma as never,
    storageService as never,
    fileRegistryService as never,
    auditService as never,
  );

  return { service, prisma, storageService, fileRegistryService, auditService };
}

describe('StudentPhotoService', () => {
  it('rejects cross-tenant or missing students before uploading a photo', async () => {
    const { service, prisma, storageService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadPhoto(
        'student-other-tenant',
        {
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          base64Content: validJpeg.toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-other-tenant', tenantId: actor.tenantId },
      select: {
        id: true,
        tenantId: true,
        photoFileId: true,
        lifecycleStatus: true,
      },
    });
    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('rejects invalid student photo MIME types', async () => {
    const { service, prisma, storageService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: null,
      lifecycleStatus: 'ACTIVE',
    });

    await expect(
      service.uploadPhoto(
        'student-1',
        {
          fileName: 'photo.gif',
          mimeType: 'image/gif' as 'image/jpeg',
          base64Content: Buffer.from('photo').toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('rejects student photos whose extension does not match the MIME type', async () => {
    const { service, prisma, storageService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: null,
      lifecycleStatus: 'ACTIVE',
    });

    await expect(
      service.uploadPhoto(
        'student-1',
        {
          fileName: 'photo.exe',
          mimeType: 'image/jpeg',
          base64Content: validJpeg.toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('rejects student photos whose content does not match the declared MIME type', async () => {
    const { service, prisma, storageService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: null,
      lifecycleStatus: 'ACTIVE',
    });

    await expect(
      service.uploadPhoto(
        'student-1',
        {
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          base64Content: Buffer.from('not-a-real-jpeg').toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('rejects student photos larger than 2MB', async () => {
    const { service, prisma, storageService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: null,
      lifecycleStatus: 'ACTIVE',
    });

    await expect(
      service.uploadPhoto(
        'student-1',
        {
          fileName: 'large.jpg',
          mimeType: 'image/jpeg',
          base64Content: Buffer.concat([
            validJpeg,
            Buffer.alloc(2 * 1024 * 1024 + 1),
          ]).toString('base64'),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
  });

  it('soft-deletes the previous photo when replacing it', async () => {
    const {
      service,
      prisma,
      storageService,
      fileRegistryService,
      auditService,
    } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: 'old-photo-file',
      lifecycleStatus: 'ACTIVE',
    });
    storageService.saveBufferObject.mockResolvedValue({
      objectKey: 'tenant-1/students/student-1/photo/new.jpg',
      sizeBytes: 256,
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'new-photo-file',
      originalFilename: 'new.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(256),
    });
    fileRegistryService.markUploaded.mockResolvedValue({
      id: 'new-photo-file',
    });
    prisma.student.update.mockResolvedValue({ id: 'student-1' });

    const result = await service.uploadPhoto(
      'student-1',
      {
        fileName: '../new unsafe.jpg',
        mimeType: 'image/jpeg',
        base64Content: validJpeg.toString('base64'),
      },
      actor,
    );

    expect(storageService.saveBufferObject).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        prefix: 'students/student-1/photo',
        fileName: 'new-unsafe.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      'old-photo-file',
      actor.userId,
    );
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: {
        photoFileId: 'new-photo-file',
        photoUrl: 'new-photo-file',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student_photo_replaced',
        resource: 'student',
        resourceId: 'student-1',
        tenantId: actor.tenantId,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        photoFileId: 'new-photo-file',
        previewUrl: '/api/v1/students/student-1/photo/preview',
      }),
    );
  });

  it('accepts valid PNG photo uploads after signature and extension checks', async () => {
    const { service, prisma, storageService, fileRegistryService } =
      createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: null,
      lifecycleStatus: 'ACTIVE',
    });
    storageService.saveBufferObject.mockResolvedValue({
      objectKey: 'tenant-1/students/student-1/photo/photo.png',
      sizeBytes: validPng.byteLength,
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'photo-file',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(validPng.byteLength),
    });
    fileRegistryService.markUploaded.mockResolvedValue({ id: 'photo-file' });
    prisma.student.update.mockResolvedValue({ id: 'student-1' });

    await service.uploadPhoto(
      'student-1',
      {
        fileName: 'photo.png',
        mimeType: 'image/png',
        base64Content: validPng.toString('base64'),
      },
      actor,
    );

    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: 'photo.png',
        mimeType: 'image/png',
      }),
    );
  });

  it('checks tenant-owned file metadata before returning preview access', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: 'photo-file',
      lifecycleStatus: 'ACTIVE',
    });
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'photo-file',
      status: FileStatus.UPLOADED,
      module: 'students',
      entityId: 'student-1',
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(128),
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'http://localhost:3001/api/v1/students/student-1/photo/preview',
    );

    const result = await service.getPhotoAccess('student-1', actor, 'preview');

    expect(fileRegistryService.getFileMetadata).toHaveBeenCalledWith(
      actor.tenantId,
      'photo-file',
    );
    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      actor.tenantId,
      'photo-file',
      actor.userId,
      'preview',
    );
    expect(result.url).toBe(
      'http://localhost:3001/api/v1/students/student-1/photo/preview',
    );
  });

  it('rejects preview access when the file is not linked to the same student', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: 'photo-file',
      lifecycleStatus: 'ACTIVE',
    });
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'photo-file',
      status: FileStatus.UPLOADED,
      module: 'students',
      entityId: 'other-student',
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(128),
    });

    await expect(
      service.getPhotoAccess('student-1', actor, 'preview'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
  });

  it('soft-deletes and audits photo removal without deleting the student', async () => {
    const { service, prisma, fileRegistryService, auditService } =
      createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      photoFileId: 'photo-file',
      lifecycleStatus: 'ACTIVE',
    });
    prisma.student.update.mockResolvedValue({ id: 'student-1' });

    const result = await service.deletePhoto('student-1', actor);

    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      'photo-file',
      actor.userId,
    );
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: {
        photoFileId: null,
        photoUrl: null,
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'student_photo_removed',
        resource: 'student',
        resourceId: 'student-1',
      }),
    );
    expect(result).toEqual({ success: true, deleted: true });
  });
});
