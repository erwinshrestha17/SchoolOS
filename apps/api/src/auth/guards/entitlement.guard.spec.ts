import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY } from '../decorators/entitlement.decorator';
import { NO_MODULE_ENTITLEMENT_KEY } from '../decorators/no-module-entitlement.decorator';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { REQUIRED_FEATURE_KEY } from '../decorators/required-feature.decorator';
import { EntitlementGuard } from './entitlement.guard';
import { SUSPENDED_TENANT_MESSAGE } from '../../plans/tenant-access.constants';

function makeContext(tenantId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        auth: tenantId ? { tenantId } : undefined,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as ExecutionContext;
}

describe('EntitlementGuard (DEF-06)', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const plansService = {
    getTenantStatus: jest.fn(),
    checkFeatureEnabled: jest.fn(),
  };

  const entitlementsService = {
    checkModuleEnabled: jest.fn(),
    checkFeatureEnabled: jest.fn(),
  };

  let guard: EntitlementGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new EntitlementGuard(
      reflector,
      plansService as never,
      entitlementsService as never,
    );
  });

  function mockMetadata(values: {
    requiredModule?: string;
    requiredFeature?: string;
    featureKey?: string;
    noModuleEntitlement?: string;
  }) {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === REQUIRED_MODULE_KEY) return values.requiredModule;
        if (key === REQUIRED_FEATURE_KEY) return values.requiredFeature;
        if (key === ENTITLEMENT_KEY) return values.featureKey;
        if (key === NO_MODULE_ENTITLEMENT_KEY)
          return values.noModuleEntitlement;
        return undefined;
      },
    );
  }

  it('throws when tenantId is missing', async () => {
    mockMetadata({ featureKey: 'module.students' });
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      new ForbiddenException('Tenant identification missing'),
    );
  });

  it('bypasses module checks for platform tenant but still requires tenantId', async () => {
    mockMetadata({ featureKey: 'module.students' });
    await expect(guard.canActivate(makeContext('platform'))).resolves.toBe(
      true,
    );
    expect(plansService.getTenantStatus).not.toHaveBeenCalled();
  });

  it('runs suspension check even when no module declaration is present', async () => {
    mockMetadata({});
    plansService.getTenantStatus.mockResolvedValue({
      id: 'tenant-1',
      isActive: false,
    });

    await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toThrow(
      new ForbiddenException(SUSPENDED_TENANT_MESSAGE),
    );
  });

  it('throws when EntitlementGuard is present but no module declaration or opt-out exists', async () => {
    mockMetadata({});
    plansService.getTenantStatus.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });

    await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toThrow(
      new ForbiddenException(
        'This route requires a module entitlement declaration.',
      ),
    );
  });

  it('passes with @NoModuleEntitlement after suspension check', async () => {
    mockMetadata({ noModuleEntitlement: 'Self-service profile route' });
    plansService.getTenantStatus.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });

    await expect(guard.canActivate(makeContext('tenant-1'))).resolves.toBe(
      true,
    );
    expect(plansService.checkFeatureEnabled).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when tenant does not exist', async () => {
    mockMetadata({ featureKey: 'module.students' });
    plansService.getTenantStatus.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('missing'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies disabled legacy @Entitlement feature keys', async () => {
    mockMetadata({ featureKey: 'module.students' });
    plansService.getTenantStatus.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });
    plansService.checkFeatureEnabled.mockResolvedValue({
      allowed: false,
      message: "Feature 'module.students' is not enabled for your tenant.",
    });

    await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toThrow(
      /is not enabled for your tenant/,
    );
  });

  it('denies disabled @RequiredModule short names', async () => {
    mockMetadata({ requiredModule: 'students' });
    plansService.getTenantStatus.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });
    entitlementsService.checkModuleEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toThrow(
      /The module 'students' is not included in your school's subscription plan/,
    );
  });
});
