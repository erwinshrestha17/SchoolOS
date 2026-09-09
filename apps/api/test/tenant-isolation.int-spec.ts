import 'dotenv/config';
import { ClsService } from 'nestjs-cls';
import {
  MissingTenantScopeError,
  PrismaService,
  TENANT_ID_KEY,
} from '../src/prisma/prisma.service';

/**
 * Real-database proof of P0-01 tenant isolation.
 *
 * Every other suite in this repo maps `@prisma/client` to `test/mocks/prisma-client.ts`,
 * which means the one mechanism the whole isolation model rests on -- the
 * `PrismaService` `$extends` query extension that injects `tenantId` from CLS --
 * is never actually executed under test. This suite runs against real Postgres
 * with the real extension so the guarantee is demonstrated rather than assumed.
 *
 * Requires the local database (docker compose: schoolos_postgres on 5433).
 * Run with: pnpm --filter @schoolos/api exec jest --config ./test/jest-integration.json
 */

/**
 * Minimal CLS stand-in. It must be a real key/value store, not a stub: the
 * fail-closed bypass works by writing TENANT_SCOPE_BYPASS_KEY, so a no-op
 * `set` would make `runWithoutTenantScope` silently ineffective.
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

const SUFFIX = `p0-01-int-${Date.now()}`;
const TENANT_A_SLUG = `tenant-a-${SUFFIX}`;
const TENANT_B_SLUG = `tenant-b-${SUFFIX}`;

describe('P0-01 tenant isolation (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;
  let classAId: string;
  let classBId: string;

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);

    // Tenant rows themselves are in TENANT_SCOPE_EXCLUDED_MODELS, so they are
    // created with no CLS tenant set.
    cls.setTenant(undefined);
    const tenantA = await prisma.tenant.create({
      data: { name: `Tenant A ${SUFFIX}`, slug: TENANT_A_SLUG },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: `Tenant B ${SUFFIX}`, slug: TENANT_B_SLUG },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Class is tenant-scoped, so each fixture is created under its own tenant
    // context -- with fail-closed scoping these would otherwise be refused.
    cls.setTenant(tenantAId);
    const classA = await prisma.class.create({
      data: { tenantId: tenantAId, name: `Grade A ${SUFFIX}`, level: 1 },
    });

    cls.setTenant(tenantBId);
    const classB = await prisma.class.create({
      data: { tenantId: tenantBId, name: `Grade B ${SUFFIX}`, level: 1 },
    });

    classAId = classA.id;
    classBId = classB.id;
  });

  afterAll(async () => {
    // Isolated fixtures, removed so this suite never pollutes a shared tenant.
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope(
      'test teardown across both tenants',
      () =>
        prisma.class.deleteMany({
          where: { name: { contains: SUFFIX } },
        }),
    );
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  describe('with tenant A in CLS', () => {
    beforeEach(() => cls.setTenant(tenantAId));

    it('findMany returns only tenant A rows', async () => {
      const rows = await prisma.class.findMany({
        where: { name: { contains: SUFFIX } },
      });

      expect(rows.map((r) => r.id)).toEqual([classAId]);
    });

    it("findUnique cannot read tenant B's class by its real id", async () => {
      const found = await prisma.class.findUnique({
        where: { id: classBId },
      });

      expect(found).toBeNull();
    });

    it("findFirst cannot read tenant B's class by its real id", async () => {
      const found = await prisma.class.findFirst({
        where: { id: classBId },
      });

      expect(found).toBeNull();
    });

    it('count excludes tenant B rows', async () => {
      const total = await prisma.class.count({
        where: { name: { contains: SUFFIX } },
      });

      expect(total).toBe(1);
    });

    it('aggregate and groupBy exclude tenant B rows', async () => {
      const aggregate = await prisma.class.aggregate({
        where: { name: { contains: SUFFIX } },
        _count: { _all: true },
      });
      const groups = await prisma.class.groupBy({
        by: ['tenantId'],
        where: { name: { contains: SUFFIX } },
        _count: { _all: true },
      });

      expect(aggregate._count._all).toBe(1);
      expect(groups).toEqual([
        expect.objectContaining({
          tenantId: tenantAId,
          _count: { _all: 1 },
        }),
      ]);
    });

    it("findUniqueOrThrow cannot read tenant B's class by its real id", async () => {
      await expect(
        prisma.class.findUniqueOrThrow({ where: { id: classBId } }),
      ).rejects.toMatchObject({ code: 'P2025' });
    });

    it("updateMany cannot write tenant B's class", async () => {
      const result = await prisma.class.updateMany({
        where: { id: classBId },
        data: { level: 99 },
      });

      expect(result.count).toBe(0);

      cls.setTenant(tenantBId);
      const untouched = await prisma.class.findUnique({
        where: { id: classBId },
      });
      expect(untouched?.level).toBe(1);
    });

    it('update cannot move a tenant A row into tenant B', async () => {
      const updated = await prisma.class.update({
        where: { id: classAId },
        data: { tenantId: tenantBId, level: 2 },
      });

      expect(updated.tenantId).toBe(tenantAId);
      expect(updated.level).toBe(2);
    });

    it('upsert scopes lookup, create, and update branches to tenant A', async () => {
      const key = `isolation-${SUFFIX}`;
      const created = await prisma.tenantSetting.upsert({
        where: {
          tenantId_key: { tenantId: tenantBId, key },
        },
        create: {
          tenantId: tenantBId,
          key,
          value: { status: 'created' },
        },
        update: {
          tenantId: tenantBId,
          value: { status: 'updated' },
        },
      });

      expect(created.tenantId).toBe(tenantAId);
      expect(created.value).toEqual({ status: 'created' });

      const updated = await prisma.tenantSetting.upsert({
        where: {
          tenantId_key: { tenantId: tenantAId, key },
        },
        create: {
          tenantId: tenantBId,
          key,
          value: { status: 'duplicate' },
        },
        update: {
          tenantId: tenantBId,
          value: { status: 'updated' },
        },
      });

      expect(updated.tenantId).toBe(tenantAId);
      expect(updated.value).toEqual({ status: 'updated' });
      await prisma.tenantSetting.deleteMany({ where: { key } });
    });

    it("deleteMany cannot destroy tenant B's class", async () => {
      const result = await prisma.class.deleteMany({
        where: { id: classBId },
      });

      expect(result.count).toBe(0);

      cls.setTenant(tenantBId);
      const survivor = await prisma.class.findUnique({
        where: { id: classBId },
      });
      expect(survivor).not.toBeNull();
    });

    it('create forces the CLS tenant even when a foreign tenantId is supplied', async () => {
      const created = await prisma.class.create({
        data: {
          tenantId: tenantBId,
          name: `Injected ${SUFFIX}`,
          level: 2,
        },
      });

      // The extension overwrites `data.tenantId`, so the row lands in tenant A.
      expect(created.tenantId).toBe(tenantAId);

      await prisma.class.deleteMany({ where: { id: created.id } });
    });
  });

  describe('with tenant B in CLS', () => {
    beforeEach(() => cls.setTenant(tenantBId));

    it('sees only its own class, confirming the fixture is genuinely split', async () => {
      const rows = await prisma.class.findMany({
        where: { name: { contains: SUFFIX } },
      });

      expect(rows.map((r) => r.id)).toEqual([classBId]);
    });
  });

  describe('with NO tenant in CLS (fail-closed)', () => {
    beforeEach(() => cls.setTenant(undefined));

    it('refuses to read a tenant-scoped model', async () => {
      await expect(
        prisma.class.findMany({ where: { name: { contains: SUFFIX } } }),
      ).rejects.toThrow(MissingTenantScopeError);
    });

    it('refuses to write a tenant-scoped model', async () => {
      await expect(
        prisma.class.create({
          data: { tenantId: tenantAId, name: `Nope ${SUFFIX}`, level: 3 },
        }),
      ).rejects.toThrow(MissingTenantScopeError);
    });

    it('refuses raw SQL without tenant context or an explicit bypass', async () => {
      await expect(prisma.$queryRaw`SELECT 1`).rejects.toThrow(
        MissingTenantScopeError,
      );
    });

    it('names the model and operation so the offending call site is findable', async () => {
      await expect(
        prisma.class.deleteMany({ where: { id: classAId } }),
      ).rejects.toThrow(/Class\.deleteMany/);
    });

    it('still allows excluded global models (Tenant) through', async () => {
      await expect(
        prisma.tenant.findUnique({ where: { id: tenantAId } }),
      ).resolves.not.toBeNull();
    });
  });

  describe('runWithoutTenantScope (explicit cross-tenant escape hatch)', () => {
    beforeEach(() => cls.setTenant(undefined));

    it('permits a deliberate cross-tenant sweep and sees every tenant', async () => {
      const rows = await prisma.runWithoutTenantScope(
        'test: platform-wide sweep',
        () => prisma.class.findMany({ where: { name: { contains: SUFFIX } } }),
      );

      expect(rows).toHaveLength(2);
    });

    it('permits reviewed global raw SQL only inside the explicit bypass', async () => {
      const rows = await prisma.runWithoutTenantScope(
        'test: global database probe',
        () => prisma.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`,
      );

      expect(rows).toEqual([{ value: 1 }]);
    });

    it('preserves explicit target predicates when the surrounding request already has a tenant', async () => {
      cls.setTenant(tenantAId);

      const rows = await prisma.runWithoutTenantScope(
        'test: platform request reads an explicit target tenant',
        () =>
          prisma.class.findMany({
            where: { tenantId: tenantBId, name: { contains: SUFFIX } },
          }),
      );

      expect(rows.map((row) => row.id)).toEqual([classBId]);

      const restoredRows = await prisma.class.findMany({
        where: { name: { contains: SUFFIX } },
      });
      expect(restoredRows.map((row) => row.id)).toEqual([classAId]);
    });

    it('restores fail-closed behaviour after the region exits', async () => {
      await prisma.runWithoutTenantScope('test: sweep', async () => {
        await prisma.class.findMany({ where: { name: { contains: SUFFIX } } });
      });

      await expect(
        prisma.class.findMany({ where: { name: { contains: SUFFIX } } }),
      ).rejects.toThrow(MissingTenantScopeError);
    });

    it('requires a non-empty reason', async () => {
      await expect(
        prisma.runWithoutTenantScope('  ', async () => 'x'),
      ).rejects.toThrow(/non-empty reason/);
    });
  });
});
