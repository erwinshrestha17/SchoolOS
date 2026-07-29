import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { TenantsController } from './tenants.controller';

const makeExecutionContext = (auth: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ auth }),
    }),
    getHandler: () => TenantsController.prototype.register,
    getClass: () => TenantsController,
  }) as unknown as ExecutionContext;

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
    const guard = new PlatformGuard(new Reflector());

    it('rejects unauthenticated requests', () => {
      expect(() => guard.canActivate(makeExecutionContext(undefined))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects school tenant admins even with broad tenant permissions', () => {
      expect(() =>
        guard.canActivate(
          makeExecutionContext({
            userId: 'school-admin-1',
            tenantId: 'tenant-1',
            roles: ['admin', 'school_config_owner'],
            permissions: ['users:create', 'settings:manage'],
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('rejects platform support users, who lack tenants:manage', () => {
      expect(() =>
        guard.canActivate(
          makeExecutionContext({
            userId: 'platform-support-1',
            tenantId: 'platform-tenant',
            roles: ['platform_support'],
            permissions: ['platform:tenants:read'],
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('allows platform super admins to provision tenants', () => {
      expect(
        guard.canActivate(
          makeExecutionContext({
            userId: 'platform-super-admin-1',
            tenantId: 'platform-tenant',
            roles: ['platform_super_admin'],
            permissions: [],
          }),
        ),
      ).toBe(true);
    });
  });
});
