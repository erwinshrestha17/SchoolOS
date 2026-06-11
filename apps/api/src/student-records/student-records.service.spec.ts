import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  StorageProvider,
  StudentDocumentKind,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { StudentRecordsService } from './student-records.service';

describe('StudentRecordsService', () => {
  let prisma: any;
  let storageService: any;
  let auditService: any;
  let fileRegistryService: any;
  let service: StudentRecordsService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentDocument: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentDocumentHistory: {
        create: jest.fn(),
      },
      siblingGroup: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      fileAsset: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    storageService = {
      saveBase64Object: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    fileRegistryService = {
      registerFile: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      getSignedUrl: jest.fn(),
      softDeleteFile: jest.fn(),
      auditAccess: jest.fn(),
    };
    actor = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'admin@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['student_documents:manage'],
    };

    service = new StudentRecordsService(
      prisma,
      storageService,
      auditService,
      fileRegistryService,
    );
  });

  it('stores document metadata only after validating tenant-scoped student access', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/students/student-1/documents/doc.pdf',
      publicUrl: '/storage/tenant-1/students/student-1/documents/doc.pdf',
      sizeBytes: 12,
    });
    prisma.studentDocument.create.mockImplementation(async ({ data }: any) => ({
      id: 'document-1',
      ...data,
    }));

    const result = await service.uploadDocument(
      {
        studentId: 'student-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        title: 'Birth certificate',
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content: 'aGVsbG8=',
      },
      actor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'student-1',
        tenantId: 'tenant-1',
      },
    });
    expect(storageService.saveBase64Object).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        prefix: 'students/student-1/documents',
      }),
    );
    expect(result.objectKey).toContain('student-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload',
        resource: 'student_document',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('rejects document uploads for students outside the tenant', async () => {
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadDocument(
        {
          studentId: 'student-outside',
          kind: StudentDocumentKind.OTHER,
          fileName: 'note.txt',
          contentType: 'text/plain',
          base64Content: 'aGVsbG8=',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });

  it('rejects malformed document expiry dates before storing files', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });

    await expect(
      service.uploadDocument(
        {
          studentId: 'student-1',
          kind: StudentDocumentKind.BIRTH_CERTIFICATE,
          title: 'Birth certificate',
          fileName: 'birth.pdf',
          contentType: 'application/pdf',
          base64Content: 'aGVsbG8=',
          expiryDate: 'not-a-date',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('lists student documents without raw storage keys or public URLs', async () => {
    const createdAt = new Date('2026-05-25T08:00:00.000Z');
    prisma.studentDocument.findMany.mockResolvedValue([
      {
        id: 'document-1',
        studentId: 'student-1',
        fileId: 'asset-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        status: 'ACTIVE',
        title: 'Birth certificate',
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        sizeBytes: 12,
        provider: StorageProvider.LOCAL,
        notes: null,
        expiryDate: null,
        verifiedAt: null,
        uploadedById: 'user-1',
        createdAt,
      },
    ]);

    const result = await service.listDocuments(actor, 'student-1');

    expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
        select: expect.not.objectContaining({
          objectKey: true,
          publicUrl: true,
        }),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'document-1',
        fileId: 'asset-1',
        uploadedAt: createdAt.toISOString(),
      }),
    );
    expect(result[0]).not.toHaveProperty('objectKey');
    expect(result[0]).not.toHaveProperty('publicUrl');
  });

  it('audits preview and download access after tenant-scoped file checks', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue({
      id: 'asset-1',
      tenantId: actor.tenantId,
      objectKey: 'tenant-1/students/student-1/documents/birth.pdf',
      originalFilename: 'birth.pdf',
    });
    prisma.studentDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      title: 'Birth certificate',
      kind: StudentDocumentKind.BIRTH_CERTIFICATE,
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'https://signed.example/birth.pdf',
    );

    const result = await service.getSignedUrl(actor, 'asset-1', 'preview');

    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      actor.tenantId,
      'asset-1',
      actor.userId,
      'preview',
    );
    expect(prisma.studentDocumentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        documentId: 'document-1',
        action: 'PREVIEW',
      }),
    });
    expect(result).toEqual({ url: 'https://signed.example/birth.pdf' });
  });

  it('lists expiring and expired documents with correct metadata', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 5);

    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 10);

    prisma.studentDocument.findMany.mockResolvedValue([
      {
        id: 'doc-expired',
        studentId: 'student-1',
        fileId: 'asset-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        status: 'ACTIVE',
        title: 'Expired document',
        fileName: 'expired.pdf',
        expiryDate: expiredDate,
        student: {
          id: 'student-1',
          studentSystemId: 'STU-0001',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
        },
      },
      {
        id: 'doc-expiring',
        studentId: 'student-1',
        fileId: 'asset-2',
        kind: StudentDocumentKind.OTHER,
        status: 'ACTIVE',
        title: 'Expiring document',
        fileName: 'expiring.pdf',
        expiryDate: expiringDate,
        student: {
          id: 'student-1',
          studentSystemId: 'STU-0001',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
        },
      },
    ]);

    const resultAll = await service.getExpiringDocuments(actor, { days: 30 });

    expect(resultAll).toHaveLength(2);
    expect(resultAll[0].id).toBe('doc-expired');
    expect(resultAll[0].isExpired).toBe(true);
    expect(resultAll[1].id).toBe('doc-expiring');
    expect(resultAll[1].isExpired).toBe(false);
    expect(resultAll[1].daysUntilExpiry).toBe(10);

    // Exclude expired test
    const resultActiveOnly = await service.getExpiringDocuments(actor, {
      days: 30,
      excludeExpired: true,
    });
    expect(prisma.studentDocument.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiryDate: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });
});
