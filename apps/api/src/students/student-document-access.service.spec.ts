import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StudentDocumentAccessService } from './student-document-access.service';
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

function createServiceMocks() {
  const prisma = {
    student: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const fileRegistryService = {
    getFileMetadata: jest.fn(),
    auditAccess: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const service = new StudentDocumentAccessService(
    prisma as never,
    fileRegistryService as never,
  );

  return { service, prisma, fileRegistryService };
}

describe('StudentDocumentAccessService', () => {
  it('rejects when the student is outside the current tenant', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.getDocumentAccessUrl(
        actor,
        'student-other-tenant',
        'document-1',
        'preview',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-other-tenant', tenantId: actor.tenantId },
      select: { id: true },
    });
    expect(fileRegistryService.getFileMetadata).not.toHaveBeenCalled();
  });

  it('rejects missing or cross-tenant student document rows', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      service.getDocumentAccessUrl(actor, 'student-1', 'document-1', 'preview'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(fileRegistryService.getFileMetadata).not.toHaveBeenCalled();
  });

  it('rejects archived or replaced documents before exposing file access', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'document-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        status: 'ARCHIVED',
        documentFileId: 'file-1',
        fileName: 'birth.pdf',
        kind: 'BIRTH_CERTIFICATE',
      },
    ]);

    await expect(
      service.getDocumentAccessUrl(actor, 'student-1', 'document-1', 'preview'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fileRegistryService.getFileMetadata).not.toHaveBeenCalled();
  });

  it('rejects a file asset linked to a different student', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'document-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        status: 'ACTIVE',
        documentFileId: 'file-1',
        fileName: 'birth.pdf',
        kind: 'BIRTH_CERTIFICATE',
      },
    ]);
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'file-1',
      status: 'UPLOADED',
      module: 'students',
      entityId: 'student-2',
      originalFilename: 'birth.pdf',
    });

    await expect(
      service.getDocumentAccessUrl(actor, 'student-1', 'document-1', 'preview'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
  });

  it('returns signed/API URL payload for active tenant-owned student documents', async () => {
    const { service, prisma, fileRegistryService } = createServiceMocks();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'document-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        status: 'ACTIVE',
        documentFileId: 'file-1',
        fileName: 'birth.pdf',
        kind: 'BIRTH_CERTIFICATE',
      },
    ]);
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'file-1',
      status: 'UPLOADED',
      module: 'student-documents',
      entityId: 'student-1',
      originalFilename: 'birth.pdf',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'http://localhost:3001/api/v1/files/file-1/preview',
    );

    const result = await service.getDocumentAccessUrl(
      actor,
      'student-1',
      'document-1',
      'download',
    );

    expect(fileRegistryService.getFileMetadata).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
    );
    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
      actor.userId,
      'download',
    );
    expect(result).toEqual({
      documentId: 'document-1',
      studentId: 'student-1',
      fileAssetId: 'file-1',
      fileName: 'birth.pdf',
      kind: 'BIRTH_CERTIFICATE',
      url: 'http://localhost:3001/api/v1/files/file-1/preview',
      expiresInSeconds: 60,
    });
  });
});
