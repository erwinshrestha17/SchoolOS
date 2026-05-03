import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('SchoolOS File Registry (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: any;
  let fileRegistryService: FileRegistryService;

  beforeEach(async () => {
    prisma = await createPrismaMock();
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn(async () => 'PONG'), onModuleDestroy: jest.fn() })
      .overrideProvider(getQueueToken('finance')).useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications')).useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll')).useValue(createQueueMock())
      .overrideProvider(NotificationsService).useValue({ sendAuthCodeEmail: jest.fn(), sendEmail: jest.fn() })
      .compile();

    fileRegistryService = moduleRef.get(FileRegistryService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('enforces tenant isolation and lifecycle for file assets', async () => {
    const tenantAId = 'tenant-a';
    const tenantBId = 'tenant-b';
    const userAId = 'user-a';

    // 1. Register a file for Tenant A
    const assetA = await fileRegistryService.registerFile({
      tenantId: tenantAId,
      uploadedByUserId: userAId,
      originalFilename: 'report.pdf',
      objectKey: 'tenant-a/docs/report-123.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      module: 'students',
      entityId: 'student-1',
    });

    expect(assetA.id).toBeDefined();
    expect(assetA.tenantId).toBe(tenantAId);

    // 2. Tenant A can fetch metadata
    const metaA = await fileRegistryService.getFileMetadata(tenantAId, assetA.id);
    expect(metaA.originalFilename).toBe('report.pdf');

    // 3. Tenant B CANNOT fetch metadata (Tenant Isolation)
    await expect(fileRegistryService.getFileMetadata(tenantBId, assetA.id))
      .rejects.toBeInstanceOf(ForbiddenException);

    // 4. List files by entity
    const files = await fileRegistryService.listFilesByEntity(tenantAId, 'students', 'student-1');
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe(assetA.id);

    // 5. Soft delete
    await fileRegistryService.softDeleteFile(tenantAId, assetA.id, userAId);
    
    // Should not show up in list
    const filesAfter = await fileRegistryService.listFilesByEntity(tenantAId, 'students', 'student-1');
    expect(filesAfter).toHaveLength(0);

    // Fetch by ID should return 404
    await expect(fileRegistryService.getFileMetadata(tenantAId, assetA.id))
      .rejects.toBeInstanceOf(NotFoundException);

    // 6. Audit access
    await fileRegistryService.auditAccess(tenantAId, assetA.id, userAId, 'preview');
    expect(prisma.__state.auditLogs).toContainEqual(expect.objectContaining({
      action: 'file_preview',
      tenantId: tenantAId,
      userId: userAId,
    }));
  });
});

async function createPrismaMock() {
  const state: {
    fileAssets: any[];
    auditLogs: any[];
  } = {
    fileAssets: [],
    auditLogs: [],
  };
  return {
    __state: state,
    fileAsset: {
      create: jest.fn(async (q) => {
        const asset = { id: `asset-${state.fileAssets.length + 1}`, ...q.data, createdAt: new Date(), updatedAt: new Date(), softDeletedAt: null };
        state.fileAssets.push(asset);
        return asset;
      }),
      findUnique: jest.fn(async (q) => state.fileAssets.find(a => a.id === q.where.id)),
      findMany: jest.fn(async (q) => {
        return state.fileAssets.filter(a => {
          let match = true;
          if (q.where.tenantId) match = match && a.tenantId === q.where.tenantId;
          if (q.where.module) match = match && a.module === q.where.module;
          if (q.where.entityId) match = match && a.entityId === q.where.entityId;
          if (q.where.softDeletedAt === null) match = match && a.softDeletedAt === null;
          return match;
        });
      }),
      update: jest.fn(async (q) => {
        const asset = state.fileAssets.find(a => a.id === q.where.id);
        if (asset) Object.assign(asset, q.data);
        return asset;
      }),
    },
    auditLog: {
      create: jest.fn(async (q) => {
        const log = { id: `log-${state.auditLogs.length}`, ...q.data, createdAt: new Date() };
        state.auditLogs.push(log);
        return log;
      }),
    },
  };
}

function createQueueMock() {
  return { add: jest.fn(), close: jest.fn(), on: jest.fn() };
}
