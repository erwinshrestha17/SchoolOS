import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { StudentRecordsService } from '../src/student-records/student-records.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';
import { StudentDocumentKind } from '@prisma/client';
import { PrismaMock, createQueueMock } from './test-helpers';

describe('Student Documents Registry Integration (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let studentRecordsService: StudentRecordsService;
  let fileRegistryService: FileRegistryService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(async () => 'PONG'),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(NotificationsService)
      .useValue({ sendAuthCodeEmail: jest.fn(), sendEmail: jest.fn() })
      .compile();

    studentRecordsService = moduleRef.get(StudentRecordsService);
    fileRegistryService = moduleRef.get(FileRegistryService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('wires student documents to file registry and enforces security', async () => {
    const tenantAId = 'tenant-a';
    const tenantBId = 'tenant-b';
    const studentAId = 'student-a';
    const userAId = 'user-a';

    const actorA = { tenantId: tenantAId, userId: userAId } as unknown;
    const actorB = { tenantId: tenantBId, userId: 'user-b' } as unknown;

    // 1. Upload a document for Student A
    const doc = await studentRecordsService.uploadDocument(
      {
        studentId: studentAId,
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content: 'base64data',
        title: 'Birth Certificate',
      },
      actorA as { tenantId: string; userId: string },
    );

    // 2. Verify it's in the FileRegistry
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

    // 3. Tenant A can get signed URL (preview)
    const preview = await studentRecordsService.getSignedUrl(
      actorA as { tenantId: string; userId: string },
      assetId,
      'preview',
    );
    expect(preview.url).toBeDefined();

    // 4. Tenant B CANNOT get signed URL (Tenant Isolation)
    await expect(
      studentRecordsService.getSignedUrl(
        actorB as { tenantId: string; userId: string },
        assetId,
        'preview',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    // 5. Deletion removes from registry
    await studentRecordsService.deleteDocument(
      actorA as { tenantId: string; userId: string },
      assetId,
    );
    const registryFilesAfter = await fileRegistryService.listFilesByEntity(
      tenantAId,
      'students',
      studentAId,
    );
    expect(registryFilesAfter).toHaveLength(0);

    // 6. Verify Auditing
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

function createPrismaMock() {
  const state: {
    fileAssets: Record<string, unknown>[];
    auditLogs: Record<string, unknown>[];
    studentDocuments: Record<string, unknown>[];
    students: Record<string, unknown>[];
  } = {
    fileAssets: [],
    auditLogs: [],
    studentDocuments: [],
    students: [{ id: 'student-a', tenantId: 'tenant-a' }],
  };
  return {
    __state: state,
    student: {
      findFirst: jest.fn(async (q: Record<string, unknown>) =>
        state.students.find(
          (s) => s.id === q.where.id && s.tenantId === q.where.tenantId,
        ),
      ),
    },
    studentDocument: {
      create: jest.fn(async (q: Record<string, unknown>) => {
        const doc = {
          id: `doc-${String(state.studentDocuments.length)}`,
          ...q.data,
          createdAt: new Date(),
        };
        state.studentDocuments.push(doc);
        return doc;
      }),
    },
    fileAsset: {
      create: jest.fn(async (q: Record<string, unknown>) => {
        const asset = {
          id: `asset-${String(state.fileAssets.length + 1)}`,
          ...q.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          softDeletedAt: null,
        };
        state.fileAssets.push(asset);
        return asset;
      }),
      findUnique: jest.fn(async (q: Record<string, unknown>) =>
        state.fileAssets.find((a) => a.id === q.where.id),
      ),
      findMany: jest.fn(async (q: Record<string, unknown>) => {
        return state.fileAssets.filter((a) => {
          let match = true;
          if (q.where.tenantId)
            match = match && a.tenantId === q.where.tenantId;
          if (q.where.module) match = match && a.module === q.where.module;
          if (q.where.entityId)
            match = match && a.entityId === q.where.entityId;
          if (q.where.softDeletedAt === null)
            match = match && a.softDeletedAt === null;
          return match;
        });
      }),
      update: jest.fn(async (q: Record<string, unknown>) => {
        const asset = state.fileAssets.find((a) => a.id === q.where.id);
        if (asset) Object.assign(asset, q.data);
        return asset;
      }),
    },
    auditLog: {
      create: jest.fn(async (q: Record<string, unknown>) => {
        const log = {
          id: `log-${String(state.auditLogs.length)}`,
          ...q.data,
          createdAt: new Date(),
        };
        state.auditLogs.push(log);
        return log;
      }),
    },
  };
}
