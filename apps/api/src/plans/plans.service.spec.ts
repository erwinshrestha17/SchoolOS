import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';

describe('PlansService entitlement and usage enforcement', () => {
  let service: PlansService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      tenantFeatureOverride: {
        findUnique: jest.fn(),
      },
      tenantSubscription: {
        findFirst: jest.fn(),
      },
    };

    service = new PlansService(prisma);
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
    ).resolves.toBe(false);

    expect(prisma.tenantFeatureOverride.findUnique).not.toHaveBeenCalled();
    expect(prisma.tenantSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('uses tenant feature override before subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findUnique.mockResolvedValue({
      enabled: false,
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.fees'),
    ).resolves.toBe(false);

    expect(prisma.tenantFeatureOverride.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_featureKey: {
          tenantId: 'tenant-1',
          featureKey: 'module.fees',
        },
      },
    });
    expect(prisma.tenantSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('allows enabled feature keys from active subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findUnique.mockResolvedValue(null);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        features: [{ featureKey: 'module.students', enabled: true }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.students'),
    ).resolves.toBe(true);

    expect(prisma.tenantSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
        },
      }),
    );
  });

  it('blocks disabled or missing feature keys from active subscription plan features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ isActive: true });
    prisma.tenantFeatureOverride.findUnique.mockResolvedValue(null);
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        features: [{ featureKey: 'module.library', enabled: false }],
      },
    });

    await expect(
      service.checkFeatureEnabled('tenant-1', 'module.library'),
    ).resolves.toBe(false);
  });

  it('rejects usage when there is no active subscription', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue(null);

    await expect(
      service.validateLimit('tenant-1', 'students.count', 1),
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
});
