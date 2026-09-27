import { AuthorizationService } from '../authorization/authorization.service';
import { recordTestAuthorizationIdentity } from '../../test/helpers/authorization-test-helpers';
import type { AuthContext } from '../auth/auth.types';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { SecurityDomain } from '@prisma/client';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { TenantsController } from './tenants.controller';

const makeExecutionContext = (auth: unknown) => {
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
    getHandler: () => TenantsController.prototype.register,
    getClass: () => TenantsController,
  } as unknown as ExecutionContext;
};

describe('TenantsController tenant provisioning authorization (DEF-01)', () => {
  it('guards POST /tenants/register with JwtAuthGuard and PlatformGuard', () => {
    const guards = (Reflect.getMetadata(
      GUARDS_METADATA,
      TenantsController.prototype.register,
    ) ?? []) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(PlatformGuard);
  });

  it('requires the platform-only tenants:manage permission on register', () => {
    const permissions = (Reflect.getMetadata(
      PERMISSIONS_KEY,
      TenantsController.prototype.register,
    ) ?? []) as string[];

    expect(permissions).toEqual(['tenants:manage']);
  });

  describe('PlatformGuard evaluated against the real register metadata', () => {
    const guard = new PlatformGuard(
      new Reflector(),
      new AuthorizationService(),
    );

    it('rejects unauthenticated requests', async () => {
      await expect(
        guard.canActivate(makeExecutionContext(undefined)),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects school tenant admins even with broad tenant permissions', async () => {
      await expect(
        guard.canActivate(
          makeExecutionContext({
            userId: 'school-admin-1',
            tenantId: 'tenant-1',
            securityDomain: SecurityDomain.SCHOOL,
            roles: ['admin', 'school_config_owner'],
            permissions: ['users:create', 'settings:manage'],
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects platform support users, who lack tenants:manage', async () => {
      await expect(
        guard.canActivate(
          makeExecutionContext({
            userId: 'platform-support-1',
            tenantId: 'platform-tenant',
            securityDomain: SecurityDomain.PLATFORM,
            roles: ['platform_support'],
            permissions: ['platform:tenants:read'],
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows platform super admins to provision tenants', async () => {
      await expect(
        guard.canActivate(
          makeExecutionContext({
            userId: 'platform-super-admin-1',
            tenantId: 'platform-tenant',
            securityDomain: SecurityDomain.PLATFORM,
            roles: ['platform_super_admin'],
            permissions: ['tenants:manage'],
          }),
        ),
      ).resolves.toBe(true);
    });
  });
});
