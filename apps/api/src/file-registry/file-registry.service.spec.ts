import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileStatus, FileVisibility, StorageProvider } from '@prisma/client';
import { FileRegistryService } from './file-registry.service';
import { UsageService } from '../usage/usage.service';

describe('FileRegistryService tenant scoping', () => {
  let service: FileRegistryService;
  let prisma: any;
  let auditService: { record: jest.Mock };
  let storageService: {
    checkReadiness: jest.Mock;
    createSignedReadUrl: jest.Mock;
  };

  const asset = {
    id: 'file-1',
    tenantId: 'tenant-1',
    uploadedByUserId: 'user-1',
    originalFilename: 'student-photo.png',
    objectKey: 'tenant-1/students/student-photo.png',
    mimeType: 'image/png',
    sizeBytes: BigInt(100),
    module: 'students',
    entityId: 'student-1',
    storageProvider: StorageProvider.LOCAL,
    bucket: null,
    checksumSha256: 'checksum-1',
    ownerType: 'students',
    ownerId: 'student-1',
    visibility: FileVisibility.PRIVATE,
    metadata: { kind: 'PHOTO' },
    status: FileStatus.UPLOADED,
    softDeletedAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      fileAsset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      activityAttachment: {
        findFirst: jest.fn(),
      },
      parentTeacherThread: {
        findFirst: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
    };
    auditService = { record: jest.fn().mockResolvedValue({}) };
    storageService = {
      checkReadiness: jest.fn().mockResolvedValue(undefined),
      createSignedReadUrl: jest
        .fn()
        .mockResolvedValue('https://signed-storage.test/file-1'),
    };

    service = new FileRegistryService(
      prisma,
      auditService as any,
      {
        port: 4000,
        storageProvider: 'local',
        storageConfig: {
          provider: 'local',
          signedReadUrlTtlSeconds: 300,
        },
      } as any,
      storageService as any,
      {
        verifyLimit: jest.fn().mockResolvedValue(undefined),
        checkLimit: jest.fn().mockResolvedValue(undefined),
        incrementUsage: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
  });

  it('registers file metadata under the authenticated tenant and audits registration', async () => {
    prisma.fileAsset.create.mockResolvedValue({
      ...asset,
      status: FileStatus.PENDING,
    });

    await expect(
      service.registerFile({
        tenantId: 'tenant-1',
        uploadedByUserId: 'user-1',
        originalFilename: 'document.pdf',
        objectKey: 'tenant-1/homework/document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512,
        module: 'homework',
        entityId: 'homework-1',
      }),
    ).resolves.toEqual(expect.objectContaining({ tenantId: 'tenant-1' }));

    expect(storageService.checkReadiness).toHaveBeenCalledTimes(1);
    expect(prisma.fileAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        uploadedByUserId: 'user-1',
        originalFilename: 'document.pdf',
        objectKey: 'tenant-1/homework/document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(512),
        storageProvider: StorageProvider.LOCAL,
        bucket: null,
        checksumSha256: null,
        ownerType: 'homework',
        ownerId: 'homework-1',
        visibility: FileVisibility.PRIVATE,
        module: 'homework',
        entityId: 'homework-1',
        metadata: {},
        status: FileStatus.PENDING,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'file_registered',
        resource: 'file_registry',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });

  it('returns metadata only for the owning tenant', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue(asset);

    await expect(
      service.getFileMetadata('tenant-1', 'file-1'),
    ).resolves.toEqual(asset);

    expect(prisma.fileAsset.findUnique).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });
  });

  it('rejects cross-tenant file metadata access', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue(asset);

    await expect(service.getFileMetadata('tenant-2', 'file-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('treats missing and soft-deleted files as not found', async () => {
    prisma.fileAsset.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.getFileMetadata('tenant-1', 'missing'),
    ).rejects.toThrow(NotFoundException);

    prisma.fileAsset.findUnique.mockResolvedValueOnce({
      ...asset,
      softDeletedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(service.getFileMetadata('tenant-1', 'file-1')).rejects.toThrow(
      NotFoundException,
    );

    prisma.fileAsset.findUnique.mockResolvedValueOnce({
      ...asset,
      deletedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(service.getFileMetadata('tenant-1', 'file-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks uploaded files only after tenant ownership validation', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      status: FileStatus.PENDING,
    });
    prisma.fileAsset.update.mockResolvedValue({
      ...asset,
      status: FileStatus.UPLOADED,
    });

    await expect(
      service.markUploaded('tenant-1', 'file-1', 'user-1'),
    ).resolves.toEqual(
      expect.objectContaining({ status: FileStatus.UPLOADED }),
    );

    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: { status: FileStatus.UPLOADED },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'file_uploaded',
        resource: 'file_registry',
        resourceId: 'file-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });

  it('lists files by entity using tenant-scoped filters only', async () => {
    prisma.fileAsset.findMany.mockResolvedValue([asset]);

    await expect(
      service.listFilesByEntity('tenant-1', 'students', 'student-1'),
    ).resolves.toEqual([asset]);

    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        module: 'students',
        entityId: 'student-1',
        softDeletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns protected preview URLs instead of raw object keys or public storage URLs', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      module: 'homework',
      entityId: 'homework-1',
      metadata: {},
    });

    await expect(service.getSignedUrl('tenant-1', 'file-1')).resolves.toBe(
      'http://localhost:4000/api/v1/files/file-1/preview',
    );
  });

  it('creates bounded signed preview URLs without exposing provider metadata', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      module: 'homework',
      entityId: 'homework-1',
      metadata: {},
    });

    await expect(
      service.createSignedPreviewUrl(
        {
          tenantId: 'tenant-1',
          userId: 'teacher-1',
          roles: ['teacher'],
          permissions: ['homework:read'],
        } as any,
        'file-1',
      ),
    ).resolves.toEqual({
      id: 'file-1',
      fileName: 'student-photo.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      url: 'https://signed-storage.test/file-1',
      expiresAt: expect.any(Date),
      expiresInSeconds: 300,
    });

    expect(storageService.createSignedReadUrl).toHaveBeenCalledWith({
      objectKey: 'tenant-1/students/student-photo.png',
      expiresInSeconds: 300,
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'file_preview',
        resource: 'file_registry',
        resourceId: 'file-1',
      }),
    );
  });

  it('creates signed download URLs with the same bounded expiry as preview URLs', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      module: 'reports',
      entityId: 'report-1',
      metadata: {},
    });

    const signed = await service.createSignedDownloadUrl(
      {
        tenantId: 'tenant-1',
        userId: 'admin-1',
        roles: ['admin'],
        permissions: ['reports:read'],
      } as any,
      'file-1',
    );

    expect(signed.expiresInSeconds).toBe(300);
    expect(signed).not.toHaveProperty('objectKey');
    expect(signed).not.toHaveProperty('bucket');
    expect(signed).not.toHaveProperty('provider');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'file_download' }),
    );
  });

  it('does not create a signed preview URL for a deleted file', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      deletedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(
      service.createSignedPreviewUrl(
        {
          tenantId: 'tenant-1',
          userId: 'teacher-1',
          roles: ['teacher'],
          permissions: ['students:read'],
        } as any,
        'file-1',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(storageService.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('returns a school-friendly permission error before signing unauthorized files', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      ...asset,
      module: 'reports',
      entityId: 'report-1',
      metadata: {},
    });

    await expect(
      service.createSignedPreviewUrl(
        {
          tenantId: 'tenant-1',
          userId: 'teacher-1',
          roles: ['teacher'],
          permissions: ['homework:read'],
        } as any,
        'file-1',
      ),
    ).rejects.toThrow('You do not have permission to view this file');

    expect(storageService.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('allows guardian-owned student file access only for linked children', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue(asset);
    prisma.guardian.findFirst.mockResolvedValue({
      studentLinks: [{ studentId: 'student-1' }],
    });

    await expect(
      service.createSignedPreviewUrl(
        {
          tenantId: 'tenant-1',
          userId: 'guardian-user-1',
          roles: ['parent'],
          permissions: ['students:read'],
        } as any,
        'file-1',
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'file-1' }));

    prisma.guardian.findFirst.mockResolvedValueOnce({
      studentLinks: [{ studentId: 'student-2' }],
    });

    await expect(
      service.createSignedPreviewUrl(
        {
          tenantId: 'tenant-1',
          userId: 'guardian-user-2',
          roles: ['parent'],
          permissions: ['students:read'],
        } as any,
        'file-1',
      ),
    ).rejects.toThrow('You can only view files for your linked child');
  });

  it('allows guardian-owned parent-teacher chat attachment access only for the linked guardian', async () => {
    const chatAsset = {
      ...asset,
      module: 'parent-teacher-chat',
      entityId: 'thread-1',
      metadata: {},
    };
    prisma.parentTeacherThread.findFirst.mockResolvedValue({
      guardianId: 'guardian-1',
      classTeacherId: 'staff-1',
    });
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });

    await expect(
      service.assertFileAccessForAuth(
        chatAsset as any,
        {
          tenantId: 'tenant-1',
          userId: 'guardian-user-1',
          roles: ['parent'],
          permissions: ['messaging:read'],
        } as any,
      ),
    ).resolves.toBeUndefined();

    expect(prisma.parentTeacherThread.findFirst).toHaveBeenCalledWith({
      where: { id: 'thread-1', tenantId: 'tenant-1' },
      select: { guardianId: true, classTeacherId: true },
    });
  });

  it('rejects parent-teacher chat attachment access for unrelated guardians', async () => {
    const chatAsset = {
      ...asset,
      module: 'parent-teacher-chat',
      entityId: 'thread-1',
      metadata: {},
    };
    prisma.parentTeacherThread.findFirst.mockResolvedValue({
      guardianId: 'guardian-1',
      classTeacherId: 'staff-1',
    });
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-2' });

    await expect(
      service.assertFileAccessForAuth(
        chatAsset as any,
        {
          tenantId: 'tenant-1',
          userId: 'guardian-user-2',
          roles: ['parent'],
          permissions: ['messaging:read'],
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
