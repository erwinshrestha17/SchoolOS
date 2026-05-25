import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { EntitlementsService } from './entitlements.service';

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

    entitlementsService = new EntitlementsService(prisma as any);
    service = new PlansService(prisma as any, entitlementsService);
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
});
