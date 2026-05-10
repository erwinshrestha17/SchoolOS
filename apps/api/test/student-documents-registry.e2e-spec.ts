import { NotFoundException } from '@nestjs/common';
import { StudentDocumentKind, StorageProvider } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { ConfigService } from '../src/config/config.service';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { StudentRecordsService } from '../src/student-records/student-records.service';
import {
  PrismaMock,
  createAuthContextMock,
  createPrismaMock,
} from './test-helpers';

describe('Student Documents Registry Integration (E2E)', () => {
  let prisma: PrismaMock;
  let studentRecordsService: StudentRecordsService;
  let fileRegistryService: FileRegistryService;
  let auditService: { record: jest.Mock };
  let storageService: { saveBase64Object: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
    auditService = {
      record: jest.fn(async (entry: Record<string, unknown>) => {
        prisma.__state.auditLogs.push({
          id: `audit-${prisma.__state.auditLogs.length + 1}`,
          ...entry,
          createdAt: new Date(),
        });
      }),
    };
    storageService = {
      saveBase64Object: jest.fn(
        async (input: { tenantId: string; fileName: string }) => ({
          provider: StorageProvider.LOCAL,
          objectKey: `${input.tenantId}/students/student-a/documents/${input.fileName}`,
          publicUrl: null,
          sizeBytes: 10,
        }),
      ),
    };

    fileRegistryService = new FileRegistryService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      { port: 4000 } as ConfigService,
    );
    studentRecordsService = new StudentRecordsService(
      prisma as unknown as PrismaService,
      storageService as unknown as StorageService,
      auditService as unknown as AuditService,
      fileRegistryService,
    );
  });

  it('wires student documents to file registry and enforces security', async () => {
    const tenantAId = 'tenant-a';
    const tenantBId = 'tenant-b';
    const studentAId = 'student-a';
    const userAId = 'user-a';

    const actorA = createAuthContextMock({
      tenantId: tenantAId,
      userId: userAId,
    });
    const actorB = createAuthContextMock({
      tenantId: tenantBId,
      userId: 'user-b',
    });

    await studentRecordsService.uploadDocument(
      {
        studentId: studentAId,
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content: 'base64data',
        title: 'Birth Certificate',
      },
      actorA,
    );

    expect(storageService.saveBase64Object).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantAId,
        prefix: `students/${studentAId}/documents`,
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
      }),
    );

    const registryFiles = await fileRegistryService.listFilesByEntity(
      tenantAId,
      'students',
      studentAId,
    );
    expect(registryFiles).toHaveLength(1);
    expect(registryFiles[0].originalFilename).toBe('birth.pdf');
    expect((registryFiles[0].metadata as Record<string, unknown>).kind).toBe(
      StudentDocumentKind.BIRTH_CERTIFICATE,
    );

    const assetId = registryFiles[0].id;

    const preview = await studentRecordsService.getSignedUrl(
      actorA,
      assetId,
      'preview',
    );
    expect(preview.url).toBe(
      `http://localhost:4000/api/v1/files/${assetId}/preview`,
    );

    await expect(
      studentRecordsService.getSignedUrl(actorB, assetId, 'preview'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await studentRecordsService.deleteDocument(actorA, assetId);
    const registryFilesAfter = await fileRegistryService.listFilesByEntity(
      tenantAId,
      'students',
      studentAId,
    );
    expect(registryFilesAfter).toHaveLength(0);

    expect(prisma.__state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: 'file_preview',
        tenantId: tenantAId,
        userId: userAId,
        resourceId: assetId,
      }),
    );
    expect(prisma.__state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: 'file_deleted',
        tenantId: tenantAId,
        userId: userAId,
        resourceId: assetId,
      }),
    );
  });
});
