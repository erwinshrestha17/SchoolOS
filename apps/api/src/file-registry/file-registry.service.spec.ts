import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { FileRegistryService } from './file-registry.service';

describe('FileRegistryService tenant scoping', () => {
  let service: FileRegistryService;
  let prisma: any;
  let auditService: { record: jest.Mock };
  let storageService: { checkReadiness: jest.Mock };

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
    metadata: { kind: 'PHOTO' },
    status: FileStatus.UPLOADED,
    softDeletedAt: null,
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
    };
    auditService = { record: jest.fn().mockResolvedValue({}) };
    storageService = { checkReadiness: jest.fn().mockResolvedValue(undefined) };

    service = new FileRegistryService(
      prisma,
      auditService as any,
      { port: 4000 } as any,
      storageService as any,
    );
  });

  it('registers file metadata under the authenticated tenant and audits registration', async () => {
    prisma.fileAsset.create.mockResolvedValue({ ...asset, status: FileStatus.PENDING });

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

    await expect(service.getFileMetadata('tenant-1', 'file-1')).resolves.toEqual(
      asset,
    );

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

    await expect(service.getFileMetadata('tenant-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );

    prisma.fileAsset.findUnique.mockResolvedValueOnce({
      ...asset,
      softDeletedAt: new Date('2026-05-01T00:00:00.000Z'),
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
    ).resolves.toEqual(expect.objectContaining({ status: FileStatus.UPLOADED }));

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
});
