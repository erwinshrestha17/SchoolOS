import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEntitlementGuard } from './feature-entitlement.guard';

describe('FeatureEntitlementGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const prisma = {
    tenantFeatureOverride: {
      findUnique: jest.fn(),
    },
    tenantSubscription: {
      findFirst: jest.fn(),
    },
  };

  const guard = new FeatureEntitlementGuard(reflector, prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(reflector.getAllAndOverride)
      .mockReturnValue(['module.students']);
    prisma.tenantFeatureOverride.findUnique.mockResolvedValue(null);
    prisma.tenantSubscription.findFirst.mockResolvedValue(null);
  });

  it('allows legacy pilot tenants with no subscription records yet', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('denies a real school-operation path when a tenant override disables the feature', async () => {
    prisma.tenantFeatureOverride.findUnique.mockResolvedValue({
      enabled: false,
    });

    await expect(guard.canActivate(context())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('denies when a configured subscription does not include the feature', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        status: 'ACTIVE',
        features: [],
      },
    });

    await expect(guard.canActivate(context())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows when active subscription and plan feature permit access', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      plan: {
        status: 'ACTIVE',
        features: [{ enabled: true }],
      },
    });

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});

function context() {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          permissions: ['students:read'],
          roles: ['admin'],
        },
      }),
    }),
  } as never;
}
