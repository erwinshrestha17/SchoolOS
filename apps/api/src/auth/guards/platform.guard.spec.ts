import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlatformGuard } from './platform.guard';

const makeExecutionContext = (auth: any) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ auth }),
    }),
    getHandler: () => 'handler',
    getClass: () => 'controller',
  }) as any;

describe('PlatformGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: PlatformGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PlatformGuard(reflector as any);
  });

  it('rejects unauthenticated requests to platform routes', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(() => guard.canActivate(makeExecutionContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects school users from platform routes even if they have tenant permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:dashboard:read']);

    expect(() =>
      guard.canActivate(
        makeExecutionContext({
          userId: 'school-user-1',
          tenantId: 'tenant-1',
          roles: ['school_admin'],
          permissions: ['platform:dashboard:read', 'students:read'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows platform super admin regardless of explicit route permission metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:billing:manage']);

    expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-super-admin-1',
          roles: ['platform_super_admin'],
          permissions: [],
        }),
      ),
    ).toBe(true);
  });

  it('allows platform support users only when required platform permissions are present', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:queues:read']);

    expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-support-1',
          roles: ['platform_support'],
          permissions: ['platform:queues:read'],
        }),
      ),
    ).toBe(true);
  });

  it('rejects platform support users missing required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:queues:retry']);

    expect(() =>
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-support-1',
          roles: ['platform_support'],
          permissions: ['platform:queues:read'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows platform billing admins only through platform role plus matching permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:billing:manage']);

    expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-billing-1',
          roles: ['platform_billing_admin'],
          permissions: ['platform:billing:manage'],
        }),
      ),
    ).toBe(true);
  });
});
