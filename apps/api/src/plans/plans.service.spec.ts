import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { EntitlementsService } from './entitlements.service';
import { createPassThroughRequestCache } from '../../test/helpers/request-cache';
import { createPassThroughRedisCache } from '../../test/helpers/redis-cache';

describe('PlansService entitlement and usage enforcement', () => {
  let service: PlansService;
  let entitlementsService: EntitlementsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ isActive: true }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantSubscription: {
        findFirst: jest.fn(),
      },
    };

    const requestCache = createPassThroughRequestCache();
    entitlementsService = new EntitlementsService(
      prisma as any,
      requestCache,
      createPassThroughRedisCache(),
    );
    service = new PlansService(
      prisma as any,
      entitlementsService,
      requestCache,
    );
  });

  it('rejects entitlement checks for missing tenants', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.attendance'),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks entitlements for inactive tenants before checking plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: false });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.attendance'),
    ).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: 'tenant_inactive' }),
    );
  });

  it('uses tenant feature override before subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findMany.mockResolvedValue([
      { featureKey: 'module.fees', enabled: false },
    ]);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'starter',
        features: [{ featureKey: 'module.fees', enabled: true }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.fees'),
    ).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: 'feature_locked' }),
    );
  });

  it('allows enabled feature keys from active subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findMany.mockResolvedValue([]);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'custom-plan',
        features: [{ featureKey: 'module.students', enabled: true }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.students'),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }));
  });

  it('maps legacy communication entitlement data to M12 and M15 without surfacing chat', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'custom-plan',
        features: [
          { featureKey: 'module.communications', enabled: true },
          { featureKey: 'module.messaging', enabled: true },
          { featureKey: 'module.chat', enabled: true },
          {
            featureKey: 'feature.mobile.parent_teacher_chat',
            enabled: true,
          },
        ],
      },
    });

    await expect(
      entitlementsService.getEntitlements('tenant-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        modules: expect.arrayContaining(['notifications', 'notices']),
        features: [],
      }),
    );
    const entitlements = await entitlementsService.getEntitlements('tenant-1');
    expect(entitlements.modules).not.toEqual(
      expect.arrayContaining(['communications', 'messaging', 'chat']),
    );
  });

  it('keeps deferred Learning disabled by default while preserving explicit enablement', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'professional',
        features: [],
      },
    });

    await expect(
      entitlementsService.getEntitlements('tenant-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        modules: expect.not.arrayContaining(['learning']),
        features: expect.not.arrayContaining([
          'feature.learning.basic',
          'feature.learning.full',
        ]),
      }),
    );

    prisma.tenantFeatureOverride.findMany.mockResolvedValue([
      { featureKey: 'module.learning', enabled: true },
      { featureKey: 'feature.learning.basic', enabled: true },
    ]);

    await expect(
      entitlementsService.getEntitlements('tenant-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        modules: expect.arrayContaining(['learning']),
        features: expect.arrayContaining(['feature.learning.basic']),
      }),
    );
  });

  it('blocks disabled or missing feature keys from active subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findMany.mockResolvedValue([]);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'custom-plan',
        features: [{ featureKey: 'module.library', enabled: false }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.library'),
    ).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: 'feature_locked' }),
    );
  });

  it('maps legacy plan feature keys to modules and honors module overrides', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findMany.mockResolvedValue([
      { featureKey: 'module.library', enabled: false },
    ]);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        key: 'standard',
        features: [{ featureKey: 'library', enabled: true }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.library'),
    ).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: 'feature_locked' }),
    );

    const entitlements = await entitlementsService.getEntitlements('tenant-1');
    expect(entitlements.modules).not.toContain('library');
    expect(entitlements.features).not.toContain('library');
  });

  it('grants module.reports on every customer tier so report exports are reachable', async () => {
    // Regression guard: ReportsController enforces `module.reports`, but no
    // tier declared a `reports` module and the plan feature keys are
    // `feature.reports.*`, so the whole report/export registry -- every P0
    // financial report included -- was refused on every plan.
    for (const planKey of [
      'starter',
      'standard',
      'professional',
      'enterprise',
    ]) {
      prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
      prisma.tenantFeatureOverride.findMany.mockResolvedValue([]);
      prisma.tenantSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        plan: { key: planKey, features: [] },
      });

      await expect(
        service.checkFeatureEnabled('tenant-1', 'module.reports'),
      ).resolves.toEqual(expect.objectContaining({ allowed: true }));
    }
  });

  it('still fails closed on module.reports when a tenant override disables it', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findMany.mockResolvedValue([
      { featureKey: 'module.reports', enabled: false },
    ]);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: { key: 'enterprise', features: [] },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.reports'),
    ).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: 'feature_locked' }),
    );
  });

  it('rejects usage when there is no active subscription', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue(null);

    await expect(
      service.validateLimit('tenant-1', 'students.count', 10),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects usage at or above configured plan limit', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        usageLimits: [{ usageKey: 'students.count', limit: 100 }],
      },
    });

    await expect(
      service.validateLimit('tenant-1', 'students.count', 100),
    ).rejects.toThrow(/Plan limit reached/);
  });

  it('allows usage below configured plan limit', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'TRIAL',
      plan: {
        usageLimits: [{ usageKey: 'students.count', limit: 100 }],
      },
    });

    await expect(
      service.validateLimit('tenant-1', 'students.count', 99),
    ).resolves.toBeUndefined();
  });

  it('rejects usage limit checks for suspended tenants', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: false });

    await expect(
      service.validateLimit('tenant-1', 'students.count', 5),
    ).rejects.toThrow(ForbiddenException);
  });

  it('assertTenantActive skips the platform control-plane tenant id', async () => {
    await expect(
      service.assertTenantActive('platform'),
    ).resolves.toBeUndefined();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('assertTenantActive rejects suspended school tenants with the standard message', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      isActive: false,
    });

    await expect(service.assertTenantActive('tenant-1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertTenantActive('tenant-1')).rejects.toThrow(
      /currently suspended/,
    );
  });

  it('shouldProcessTenantJob returns true for platform and active tenants', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });

    await expect(service.shouldProcessTenantJob('platform')).resolves.toBe(
      true,
    );
    await expect(service.shouldProcessTenantJob('tenant-1')).resolves.toBe(
      true,
    );
    await expect(service.shouldProcessTenantJob(null)).resolves.toBe(true);
  });

  it('shouldProcessTenantJob returns false for suspended or missing tenants', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-suspended',
      isActive: false,
    });

    await expect(
      service.shouldProcessTenantJob('tenant-suspended'),
    ).resolves.toBe(false);

    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(service.shouldProcessTenantJob('missing')).resolves.toBe(
      false,
    );
  });
});

/**
 * The plan-entitlement cache is cross-request, so these tests pin the one
 * property that makes it safe: the tenant suspension check is evaluated LIVE
 * on every call and is never served from the cache.
 */
describe('EntitlementsService suspension is never cached', () => {
  function build() {
    const store = new Map<string, unknown>();
    const redisCache = {
      resolve: async <T>(
        key: string,
        _ttl: number,
        loader: () => Promise<T>,
      ) => {
        if (store.has(key)) return store.get(key) as T;
        const value = await loader();
        store.set(key, value);
        return value;
      },
      invalidate: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      invalidatePrefix: jest.fn(async (prefix: string) => {
        for (const key of [...store.keys()]) {
          if (key.startsWith(prefix)) store.delete(key);
        }
      }),
    };
    const prisma: any = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      tenantFeatureOverride: { findMany: jest.fn().mockResolvedValue([]) },
      tenantSubscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          plan: {
            key: 'professional',
            features: [{ featureKey: 'module.students', enabled: true }],
          },
        }),
      },
    };
    const service = new EntitlementsService(
      prisma,
      createPassThroughRequestCache(),
      redisCache as never,
    );
    return { service, prisma, redisCache, store };
  }

  it('caches the plan projection across calls', async () => {
    const { service, prisma } = build();

    await service.getEntitlements('tenant-1');
    await service.getEntitlements('tenant-1');

    // The plan half is resolved once...
    expect(prisma.tenantSubscription.findFirst).toHaveBeenCalledTimes(1);
    // ...but the suspension check is re-read every time.
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(2);
  });

  it('fails closed the moment a tenant is suspended, with the cache warm', async () => {
    const { service, prisma } = build();

    await expect(service.getEntitlements('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        modules: expect.arrayContaining(['students']),
      }),
    );

    // Suspend, with no invalidation call at all — the cached plan entry is
    // deliberately left in place.
    prisma.tenant.findUnique.mockResolvedValue({ isActive: false });

    await expect(service.getEntitlements('tenant-1')).resolves.toEqual({
      tier: null,
      modules: [],
      features: [],
      addOns: [],
    });
  });

  it('restores entitlements when the tenant is reactivated', async () => {
    const { service, prisma } = build();

    prisma.tenant.findUnique.mockResolvedValue({ isActive: false });
    await expect(service.getEntitlements('tenant-1')).resolves.toEqual(
      expect.objectContaining({ modules: [] }),
    );

    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    await expect(service.getEntitlements('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        modules: expect.arrayContaining(['students']),
      }),
    );
  });

  it('re-reads the plan after invalidation', async () => {
    const { service, prisma } = build();

    await service.getEntitlements('tenant-1');
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: { key: 'starter', features: [] },
    });

    // Without invalidation the old projection stands...
    await expect(service.getEntitlements('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        modules: expect.arrayContaining(['students']),
      }),
    );

    await service.invalidateTenantEntitlements('tenant-1');

    // ...and after it, the new plan is visible.
    const after = await service.getEntitlements('tenant-1');
    expect(after.tier).toBe('STARTER');
  });

  it('scopes invalidation to one tenant', async () => {
    const { service, redisCache } = build();

    await service.invalidateTenantEntitlements('tenant-1');
    expect(redisCache.invalidate).toHaveBeenCalledWith(
      'entitlements:plan:tenant-1',
    );

    await service.invalidateAllTenantEntitlements();
    expect(redisCache.invalidatePrefix).toHaveBeenCalledWith(
      'entitlements:plan:',
    );
  });

  it('never leaks hasActiveSubscription into the public response', async () => {
    const { service } = build();

    const entitlements = await service.getEntitlements('tenant-1');
    expect(entitlements).not.toHaveProperty('hasActiveSubscription');
  });

  it('reports subscription_missing without a separate subscription query', async () => {
    const { service, prisma } = build();
    prisma.tenantSubscription.findFirst.mockResolvedValue(null);

    const state = await service.getPlanEntitlementState('tenant-1');
    expect(state.hasActiveSubscription).toBe(false);
    expect(prisma.tenantSubscription.findFirst).toHaveBeenCalledTimes(1);
  });
});
