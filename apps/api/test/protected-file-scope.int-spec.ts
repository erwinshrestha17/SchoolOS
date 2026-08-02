import 'dotenv/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import { FileRegistryService } from '../src/file-registry/file-registry.service';

/**
 * P0-01 protected-file scoping, against a real database.
 *
 * `getFileMetadata` is the gate every protected download passes through
 * (report cards, receipts, student documents, payslips, government exports).
 * It is defended twice — the Prisma tenant-scope extension, and an explicit
 * `asset.tenantId !== tenantId` check — and this suite proves both hold when
 * Postgres, rather than a mock, answers the query.
 *
 * Requires the local database (docker compose: schoolos_postgres on 5433).
 * Run with: pnpm test:integration
 */

class FakeCls {
  private readonly store = new Map<string, unknown>();
  setTenant(tenantId: string | undefined) {
    this.store.set(TENANT_ID_KEY, tenantId);
  }
  get(key: string) {
    return this.store.get(key);
  }
  set(key: string, value: unknown) {
    this.store.set(key, value);
  }
  isActive() {
    return true;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

const SUFFIX = `p0-01-file-${Date.now()}`;

describe('P0-01 protected file scoping (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let service: FileRegistryService;

  let tenantAId: string;
  let tenantBId: string;
  let ownAssetId: string;
  let foreignAssetId: string;
  let softDeletedAssetId: string;
  let hardDeletedAssetId: string;

  async function makeAsset(
    tenantId: string,
    label: string,
    extra: Record<string, unknown> = {},
  ) {
    return prisma.fileAsset.create({
      data: {
        tenantId,
        originalFilename: `${label}-${SUFFIX}.pdf`,
        objectKey: `${label}/${SUFFIX}`,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(1024),
        visibility: 'PRIVATE',
        status: 'UPLOADED',
        ...extra,
      },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);
    // Only getFileMetadata is exercised; it touches prisma alone.
    service = new FileRegistryService(
      prisma,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { assertTenantActive: jest.fn() } as never,
      {} as never,
    );

    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope(
      'integration fixture setup across two tenants',
      async () => {
        const [a, b] = await Promise.all([
          prisma.tenant.create({
            data: { name: `FA ${SUFFIX}`, slug: `fa-${SUFFIX}` },
          }),
          prisma.tenant.create({
            data: { name: `FB ${SUFFIX}`, slug: `fb-${SUFFIX}` },
          }),
        ]);
        tenantAId = a.id;
        tenantBId = b.id;

        const [own, foreign, soft, hard] = await Promise.all([
          makeAsset(tenantAId, 'own'),
          makeAsset(tenantBId, 'foreign'),
          makeAsset(tenantAId, 'soft', { softDeletedAt: new Date() }),
          makeAsset(tenantAId, 'hard', { deletedAt: new Date() }),
        ]);
        ownAssetId = own.id;
        foreignAssetId = foreign.id;
        softDeletedAssetId = soft.id;
        hardDeletedAssetId = hard.id;
      },
    );

    cls.setTenant(tenantAId);
  });

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('teardown', async () => {
      await prisma.fileAsset.deleteMany({
        where: { objectKey: { contains: SUFFIX } },
      });
      await prisma.tenant.deleteMany({
        where: { slug: { contains: SUFFIX } },
      });
    });
    await prisma.$disconnect();
  });

  beforeEach(() => cls.setTenant(tenantAId));

  it('resolves a protected asset owned by the caller tenant', async () => {
    const asset = await service.getFileMetadata(tenantAId, ownAssetId);

    expect(asset.id).toBe(ownAssetId);
    expect(asset.visibility).toBe('PRIVATE');
  });

  it("denies another tenant's asset addressed by its real id", async () => {
    // Both defences agree here: the extension filters the row out entirely, so
    // existence is not even confirmed to the caller.
    await expect(
      service.getFileMetadata(tenantAId, foreignAssetId),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies a caller whose claimed tenant does not own the asset', async () => {
    // CLS still on tenant A (as a real request would be), but the caller passes
    // tenant B: the explicit `asset.tenantId !== tenantId` check must fire.
    await expect(
      service.getFileMetadata(tenantBId, ownAssetId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a soft-deleted asset', async () => {
    await expect(
      service.getFileMetadata(tenantAId, softDeletedAssetId),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies a hard-deleted asset', async () => {
    await expect(
      service.getFileMetadata(tenantAId, hardDeletedAssetId),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies an unknown asset id without leaking existence', async () => {
    await expect(
      service.getFileMetadata(
        tenantAId,
        '00000000-0000-4000-8000-000000000000',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to resolve any asset with no tenant context at all', async () => {
    cls.setTenant(undefined);

    // Fail-closed: a file lookup outside a tenant context is refused rather
    // than silently searching every tenant's assets.
    await expect(
      service.getFileMetadata(tenantAId, ownAssetId),
    ).rejects.toThrow(/without a tenant context/);
  });
});
