import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { ReportsService } from '../src/reports/reports.service';
import { PlansService } from '../src/plans/plans.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';
import { AuthContext } from '../src/auth/auth.types';
import { AuthMethod } from '@prisma/client';
import { SUSPENDED_TENANT_MESSAGE } from '../src/plans/tenant-access.constants';
import { PrismaMock, createPrismaMock, createQueueMock } from './test-helpers';

describe('Suspended tenant file and export denial (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let fileRegistryService: FileRegistryService;
  let reportsService: ReportsService;
  let plansService: PlansService;

  const suspendedActor: AuthContext = {
    tenantId: 'tenant-suspended',
    userId: 'user-1',
    email: 'admin@suspended.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['reports:read', 'reports:export', 'homework:read'],
    tenantSlug: 'suspended-school',
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.__state.tenants.push({
      id: 'tenant-suspended',
      slug: 'suspended-school',
      name: 'Suspended School',
      isActive: false,
      plan: 'standard',
      createdAt: new Date(),
    } as Record<string, unknown>);

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('reports'))
      .useValue(createQueueMock())
      .overrideProvider(NotificationsService)
      .useValue({ sendAuthCodeEmail: jest.fn(), sendEmail: jest.fn() })
      .compile();

    fileRegistryService = moduleRef.get(FileRegistryService);
    reportsService = moduleRef.get(ReportsService);
    plansService = moduleRef.get(PlansService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('denies protected file downloads for suspended tenants at the File Registry boundary', async () => {
    prisma.__state.fileAssets = [
      {
        id: 'file-1',
        tenantId: 'tenant-suspended',
        uploadedByUserId: 'user-1',
        originalFilename: 'report.pdf',
        objectKey: 'tenant-suspended/reports/report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(100),
        module: 'reports',
        entityId: 'export-1',
        status: 'UPLOADED',
        visibility: 'PRIVATE',
        softDeletedAt: null,
        deletedAt: null,
      },
    ] as Record<string, unknown>[];

    await expect(
      fileRegistryService.getProtectedDownload(
        'tenant-suspended',
        'file-1',
        'user-1',
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      fileRegistryService.getProtectedDownload(
        'tenant-suspended',
        'file-1',
        'user-1',
      ),
    ).rejects.toThrow(SUSPENDED_TENANT_MESSAGE);
  });

  it('denies queued report export completion for suspended tenants', async () => {
    await expect(
      reportsService.completeQueuedExport({
        exportId: 'export-1',
        reportKey: 'student-roster',
        filters: {},
        format: 'json',
        actor: suspendedActor,
      }),
    ).rejects.toThrow(SUSPENDED_TENANT_MESSAGE);
  });

  it('uses the same tenant-active assertion helper across plans, files, and exports', async () => {
    await expect(
      plansService.assertTenantActive('tenant-suspended'),
    ).rejects.toThrow(SUSPENDED_TENANT_MESSAGE);
  });
});
