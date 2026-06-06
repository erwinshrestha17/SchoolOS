import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantActiveGuard } from './tenant-active.guard';
import { SUSPENDED_TENANT_MESSAGE } from '../../plans/tenant-access.constants';

describe('TenantActiveGuard', () => {
  const plansService = {
    assertTenantActive: jest.fn(),
  };

  const guard = new TenantActiveGuard(plansService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication context', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: undefined }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows platform control-plane requests without tenant activation checks', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: { tenantId: 'platform' } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(plansService.assertTenantActive).not.toHaveBeenCalled();
  });

  it('denies suspended school tenants with the standard message', async () => {
    plansService.assertTenantActive.mockRejectedValue(
      new ForbiddenException(SUSPENDED_TENANT_MESSAGE),
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: { tenantId: 'tenant-suspended' } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      SUSPENDED_TENANT_MESSAGE,
    );
  });
});
