import { AuthorizationService } from '../../authorization/authorization.service';
import { recordTestAuthorizationIdentity } from '../../../test/helpers/authorization-test-helpers';
import type { AuthContext } from '../auth.types';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { SecurityDomain } from '@prisma/client';
import { PlatformGuard } from './platform.guard';

const makeExecutionContext = (auth: unknown): ExecutionContext => {
  const req = {
    auth: auth
      ? {
          ...(auth as AuthContext),
          tenantId: (auth as AuthContext).tenantId ?? 'platform-tenant',
        }
      : undefined,
  };
  recordTestAuthorizationIdentity(req);
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => 'handler',
    getClass: () => 'controller',
  } as unknown as ExecutionContext;
};

describe('PlatformGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: PlatformGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PlatformGuard(
      reflector as unknown as ConstructorParameters<typeof PlatformGuard>[0],
      new AuthorizationService(),
    );
  });

  it('rejects unauthenticated requests to platform routes', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(
      guard.canActivate(makeExecutionContext(undefined)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects school users from platform routes even if they have tenant permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:dashboard:read']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'school-user-1',
          tenantId: 'tenant-1',
          securityDomain: SecurityDomain.SCHOOL,
          isSupportOverride: false,
          roles: ['school_admin'],
          permissions: ['platform:dashboard:read', 'students:read'],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not give platform super admins a permission bypass', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:billing:manage']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-super-admin-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: false,
          roles: ['platform_super_admin'],
          permissions: [],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows platform super admins only with the explicit route permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:billing:manage']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-super-admin-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: false,
          roles: ['platform_super_admin'],
          permissions: ['platform:billing:manage'],
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows platform support users only when required platform permissions are present', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:queues:read']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-support-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: false,
          roles: ['platform_support'],
          permissions: ['platform:queues:read'],
        }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects platform support users missing required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:queues:retry']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-support-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: false,
          roles: ['platform_support'],
          permissions: ['platform:queues:read'],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows platform billing admins only through platform role plus matching permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:billing:manage']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-billing-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: false,
          roles: ['platform_billing_admin'],
          permissions: ['platform:billing:manage'],
        }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects a support override from returning to platform routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(['platform:dashboard:read']);

    await expect(
      guard.canActivate(
        makeExecutionContext({
          userId: 'platform-super-admin-1',
          securityDomain: SecurityDomain.PLATFORM,
          isSupportOverride: true,
          roles: [],
          permissions: ['platform:dashboard:read'],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
