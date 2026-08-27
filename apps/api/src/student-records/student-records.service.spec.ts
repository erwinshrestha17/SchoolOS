/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  FileStatus,
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
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentDocumentHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
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
    prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma),
    );
    storageService = {
      saveBase64Object: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    auditService = {
      record: jest.fn(),
    };
    fileRegistryService = {
      registerFile: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      markUploaded: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      getSignedUrl: jest.fn(),
      softDeleteFile: jest.fn().mockResolvedValue(undefined),
      auditAccess: jest.fn(),
      linkToEntityInTransaction: jest.fn(),
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

  it('denies student document URLs during a support override before reading file metadata', async () => {
    await expect(
      service.getSignedUrl(
        { ...actor, isSupportOverride: true },
        'asset-1',
        'preview',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
    expect(fileRegistryService.auditAccess).not.toHaveBeenCalled();
  });

  it('denies document metadata during support override before document reads', async () => {
    await expect(
      service.listDocuments({ ...actor, isSupportOverride: true }, 'student-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.studentDocument.findMany).not.toHaveBeenCalled();
  });

  it('denies document history during support override before history reads', async () => {
    await expect(
      service.listDocumentHistory(
        { ...actor, isSupportOverride: true },
        'student-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.studentDocumentHistory.findMany).not.toHaveBeenCalled();
  });

  it('denies expiring document metadata during support override before document reads', async () => {
    await expect(
      service.getExpiringDocuments(
        { ...actor, isSupportOverride: true },
        { days: 30 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.studentDocument.findMany).not.toHaveBeenCalled();
  });

  it('returns sibling groups with only student identity and class/section display fields', async () => {
    const student = {
      id: 'student-1',
      studentSystemId: 'STU-0001',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      firstNameNp: 'आशा',
      lastNameNp: 'तामाङ',
      class: { id: 'class-1', name: 'Class 1' },
      sectionRef: { id: 'section-1', name: 'A' },
    };
    prisma.siblingGroup.findMany.mockResolvedValue([
      {
        id: 'sibling-group-1',
        members: [{ id: 'member-1', student }],
      },
    ]);

    const result = await service.listSiblingGroups(actor);

    expect(prisma.siblingGroup.findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId },
      include: {
        members: {
          include: {
            student: {
              select: {
                id: true,
                studentSystemId: true,
                firstNameEn: true,
                lastNameEn: true,
                firstNameNp: true,
                lastNameNp: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                sectionRef: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
    expect(result[0]?.members[0]?.student).toEqual(student);
  });

  it('attaches File Registry admission documents to the admitted student inside the caller transaction', async () => {
    const tx = {
      studentDocument: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'document-1',
          ...data,
        })),
      },
      studentDocumentHistory: { create: jest.fn() },
      fileAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          tenantId: 'tenant-1',
          originalFilename: 'birth.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(12),
          storageProvider: StorageProvider.LOCAL,
          objectKey: 'tenant-1/admissions/case-1/birth.pdf',
          status: FileStatus.UPLOADED,
          module: 'admissions',
          entityId: 'case-1',
          uploadedByUserId: 'user-1',
        }),
      },
    } as any;

    await service.attachRegisteredAdmissionDocuments(tx, {
      tenantId: 'tenant-1',
      studentId: 'student-1',
      admissionCaseId: 'case-1',
      documents: [
        {
          fileId: 'asset-1',
          kind: 'BIRTH_CERTIFICATE',
          title: 'Birth certificate',
        },
      ],
      userId: 'user-1',
    });

    expect(fileRegistryService.linkToEntityInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        assetId: 'asset-1',
        entityId: 'student-1',
        ownerType: 'student',
      }),
    );
    expect(tx.studentDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        studentId: 'student-1',
        fileId: 'asset-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
      }),
    });
    expect(tx.studentDocumentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPLOAD',
        metadata: { admissionCaseId: 'case-1' },
      }),
    });
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
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
      verifiedAt: null,
      verifiedById: null,
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
    expect(result).toEqual(
      expect.objectContaining({
        id: 'document-1',
        studentId: 'student-1',
        fileId: 'asset-1',
        uploadedAt: '2026-04-27T00:00:00.000Z',
      }),
    );
    expect(result).not.toHaveProperty('objectKey');
    expect(result).not.toHaveProperty('publicUrl');
    expect(result).not.toHaveProperty('provider');
    expect(fileRegistryService.markUploaded).toHaveBeenCalledWith(
      actor.tenantId,
      'asset-1',
      actor.userId,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload',
        resource: 'student_document',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('replays a matching idempotent document upload without storing another object', async () => {
    const base64Content = 'aGVsbG8=';
    const existing = buildStudentDocument({
      id: 'document-existing',
      contentChecksumSha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    });
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentDocument.findUnique.mockResolvedValue(existing);

    const result = await service.uploadDocument(
      {
        studentId: 'student-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content,
      },
      actor,
      { idempotencyKey: 'admission:enrollment-1:document:birth' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: existing.id,
        fileId: existing.fileId,
        uploadedAt: existing.createdAt.toISOString(),
      }),
    );
    expect(result).not.toHaveProperty('objectKey');
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(prisma.studentDocument.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a document idempotency key with different content', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentDocument.findUnique.mockResolvedValue({
      id: 'document-existing',
      studentId: 'student-1',
      kind: StudentDocumentKind.BIRTH_CERTIFICATE,
      contentChecksumSha256: 'different-checksum',
    });

    await expect(
      service.uploadDocument(
        {
          studentId: 'student-1',
          kind: StudentDocumentKind.BIRTH_CERTIFICATE,
          fileName: 'birth.pdf',
          contentType: 'application/pdf',
          base64Content: 'aGVsbG8=',
        },
        actor,
        { idempotencyKey: 'admission:enrollment-1:document:birth' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });

  it('cleans up a losing stored object and returns the concurrent document replay', async () => {
    const concurrent = buildStudentDocument({
      id: 'document-concurrent',
      contentChecksumSha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    });
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentDocument.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrent);
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/students/student-1/documents/loser.pdf',
      publicUrl: null,
      sizeBytes: 5,
    });
    prisma.studentDocument.create.mockRejectedValue({ code: 'P2002' });

    const result = await service.uploadDocument(
      {
        studentId: 'student-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content: 'aGVsbG8=',
      },
      actor,
      { idempotencyKey: 'admission:enrollment-1:document:birth' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: concurrent.id,
        fileId: concurrent.fileId,
      }),
    );
    expect(result).not.toHaveProperty('objectKey');
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'tenant-1/students/student-1/documents/loser.pdf',
    );
    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      'asset-1',
      actor.userId,
    );
  });

  it('compensates storage and registry writes when document persistence fails', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/students/student-1/documents/failed.pdf',
      publicUrl: null,
      sizeBytes: 5,
    });
    prisma.studentDocument.create.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.uploadDocument(
        {
          studentId: 'student-1',
          kind: StudentDocumentKind.BIRTH_CERTIFICATE,
          fileName: 'birth.pdf',
          contentType: 'application/pdf',
          base64Content: 'aGVsbG8=',
        },
        actor,
      ),
    ).rejects.toThrow('database unavailable');

    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      'asset-1',
      actor.userId,
    );
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'tenant-1/students/student-1/documents/failed.pdf',
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
    expect(result[0]).not.toHaveProperty('provider');
  });

  it('lists document history through the bounded public contract', async () => {
    const createdAt = new Date('2026-05-25T08:00:00.000Z');
    prisma.studentDocumentHistory.findMany.mockResolvedValue([
      {
        id: 'history-1',
        documentId: 'document-1',
        action: 'UPLOAD_PENDING_REVIEW',
        documentTitle: 'Birth certificate',
        documentKind: StudentDocumentKind.BIRTH_CERTIFICATE,
        performedBy: actor.userId,
        reason: 'Initial upload',
        createdAt,
      },
    ]);

    const result = await service.listDocumentHistory(actor, 'student-1');

    expect(prisma.studentDocumentHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          documentId: true,
          action: true,
          documentTitle: true,
          documentKind: true,
          performedBy: true,
          reason: true,
          createdAt: true,
        },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'history-1',
        createdAt: createdAt.toISOString(),
      }),
    ]);
    expect(result[0]).not.toHaveProperty('tenantId');
    expect(result[0]).not.toHaveProperty('metadata');
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
    await service.getExpiringDocuments(actor, {
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

function buildStudentDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    tenantId: 'tenant-1',
    studentId: 'student-1',
    fileId: 'asset-1',
    idempotencyKey: 'document-operation-1',
    contentChecksumSha256:
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    kind: StudentDocumentKind.BIRTH_CERTIFICATE,
    status: 'ACTIVE',
    title: 'Birth certificate',
    fileName: 'birth.pdf',
    contentType: 'application/pdf',
    sizeBytes: 5,
    provider: StorageProvider.LOCAL,
    objectKey: 'tenant-1/students/student-1/documents/birth.pdf',
    publicUrl: null,
    signedUrl: null,
    notes: null,
    expiryDate: null,
    verifiedAt: null,
    verifiedById: null,
    uploadedById: 'user-1',
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
    updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    ...overrides,
  };
}
