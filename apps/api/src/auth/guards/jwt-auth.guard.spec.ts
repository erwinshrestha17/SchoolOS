import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthMethod, SecurityDomain } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '../../config/config.service';
import { PrismaService, TENANT_ID_KEY } from '../../prisma/prisma.service';
import { AuthContext, JwtAccessPayload } from '../auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { AuthzCacheService } from '../authz-cache.service';
import { createPassThroughRedisCache } from '../../../test/helpers/redis-cache';
import { createPassThroughRequestCache } from '../../../test/helpers/request-cache';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let auditService: { record: jest.Mock };
  let prisma: {
    runWithoutTenantScope: jest.Mock;
    runWithTenantScope: jest.Mock;
    tenant: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    supportOverride: { findFirst: jest.Mock };
    userRole: { findMany: jest.Mock };
  };
  let cls: { set: jest.Mock; isActive: jest.Mock<boolean, []> };
  let reflector: { getAllAndOverride: jest.Mock };

  const basePayload: JwtAccessPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'stale-signed-slug',
    securityDomain: SecurityDomain.PLATFORM,
    email: 'admin@schoolos.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    iss: 'schoolos',
    aud: 'schoolos-web',
  };

  const mockUser = {
    id: 'user-1',
    status: 'ACTIVE',
    email: 'admin@schoolos.com',
    tenantId: 'tenant-1',
    mustChangePassword: false,
    tenant: {
      id: 'tenant-1',
      slug: 'default-school',
      isActive: true,
      securityDomain: SecurityDomain.SCHOOL,
    },
  };

  const mockPlatformUser = {
    ...mockUser,
    tenant: {
      id: 'tenant-1',
      slug: 'platform',
      isActive: true,
      securityDomain: SecurityDomain.PLATFORM,
    },
  };

  // Roles and permissions are resolved by AuthzCacheService from a nested
  // userRole.findMany select instead of a flat rolePermission query.
  const mockUserRoles = [
    {
      scopeId: null,
      expiresAt: null,
      role: {
        name: 'admin',
        rolePermissions: [
          { permission: { resource: 'students', action: 'read' } },
        ],
      },
    },
  ];

  function mockPlatformSuperAdminRoles() {
    prisma.user.findUnique.mockResolvedValue(mockPlatformUser);
    prisma.userRole.findMany.mockResolvedValue([
      {
        scopeId: 'global',
        expiresAt: null,
        role: {
          name: 'platform_super_admin',
          rolePermissions: [],
        },
      },
    ]);
  }

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(basePayload),
    };
    auditService = {
      record: jest.fn(),
    };
    prisma = {
      // Pass-throughs: the mock has no CLS/extension, so tenant-scope regions
      // just execute. Real enforcement is proven in tenant-isolation.int-spec.ts.
      runWithoutTenantScope: jest.fn(
        async (_reason: string, fn: () => Promise<unknown>) => fn(),
      ),
      runWithTenantScope: jest.fn(
        async (_tenantId: string, fn: () => Promise<unknown>) => fn(),
      ),
      tenant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      supportOverride: {
        findFirst: jest.fn(),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue(mockUserRoles),
      },
    };
    cls = {
      set: jest.fn(),
      isActive: jest.fn(() => true),
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['STUDENT_RECORDS']),
    };

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      {
        jwtSecret: 'test-secret',
        jwtIssuer: 'schoolos',
        jwtAudienceWeb: 'schoolos-web',
        jwtAudienceMobile: 'schoolos-mobile',
        accessCookieName: 'access_token',
      } as ConfigService,
      auditService as unknown as AuditService,
      prisma as unknown as PrismaService,
      cls as unknown as ClsService,
      {
        canActivate: jest.fn().mockReturnValue(true),
      } as unknown as MustChangePasswordGuard,
      new AuthzCacheService(
        prisma as unknown as PrismaService,
        createPassThroughRedisCache(),
      ),
      createPassThroughRequestCache(),
      reflector as unknown as Reflector,
    );
  });

  it('hydrates auth context and CLS tenant context from a valid token and database lookup', async () => {
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.auth).toEqual({
      userId: mockUser.id,
      tenantId: basePayload.tenantId,
      originalTenantId: basePayload.tenantId,
      isSupportOverride: false,
      supportOverrideScopes: undefined,
      supportOverrideReadOnly: undefined,
      securityDomain: SecurityDomain.SCHOOL,
      tenantSlug: mockUser.tenant.slug,
      email: mockUser.email,
      authMethod: basePayload.authMethod,
      mustChangePassword: false,
      roles: ['admin'],
      permissions: ['students:read'],
    });
    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-1');
  });

  it('hydrates auth context from the httpOnly access cookie when no bearer token is present', async () => {
    const { context, request } = createContext(
      {
        cookie: 'access_token=access-cookie-token; other=value',
      },
      false,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-cookie-token', {
      secret: 'test-secret',
      algorithms: ['HS256'],
    });
    expect(request.auth?.tenantId).toBe('tenant-1');
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-1');
  });

  it('rejects tokens with the wrong issuer before tenant lookup', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...basePayload,
      iss: 'unexpected-issuer',
    });
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token issuer'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(cls.set).not.toHaveBeenCalled();
  });

  it('rejects browser tokens with the mobile audience before tenant lookup', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...basePayload,
      aud: 'schoolos-mobile',
    });
    const { context } = createContext({
      'user-agent': 'Mozilla/5.0',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token audience'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(cls.set).not.toHaveBeenCalled();
  });

  it('accepts Flutter client tokens only with the mobile audience', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...basePayload,
      aud: 'schoolos-mobile',
    });
    const { context, request } = createContext({
      'user-agent': 'Dart/3.4 (Flutter)',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.auth?.tenantId).toBe('tenant-1');
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-1');
  });

  it('rejects invalid access tokens before tenant context is created', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad token'));
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cls.set).not.toHaveBeenCalled();
  });

  it('rejects tenant override attempts from tenant users including principals', async () => {
    prisma.userRole.findMany.mockResolvedValueOnce([
      {
        scopeId: null,
        expiresAt: null,
        role: { name: 'principal', rolePermissions: [] },
      },
      {
        scopeId: 'global',
        expiresAt: null,
        role: { name: 'platform_super_admin', rolePermissions: [] },
      },
    ]);
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Tenant override requires platform super admin'),
    );
    expect(prisma.supportOverride.findFirst).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(cls.set).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('requires a global platform super-admin assignment for support override', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(mockPlatformUser);
    prisma.userRole.findMany.mockResolvedValueOnce([
      {
        scopeId: 'tenant-2',
        expiresAt: null,
        role: { name: 'platform_super_admin', rolePermissions: [] },
      },
    ]);
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Tenant override requires platform super admin'),
    );
    expect(prisma.supportOverride.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an override target without the exact support session identifier', async () => {
    mockPlatformSuperAdminRoles();
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Tenant override requires the active support session identifier',
      ),
    );
    expect(prisma.supportOverride.findFirst).not.toHaveBeenCalled();
  });

  it('rejects platform overrides without an active support session', async () => {
    mockPlatformSuperAdminRoles();
    prisma.supportOverride.findFirst.mockResolvedValueOnce(null);
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-wrong',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'No active support override session found or session expired',
      ),
    );
    expect(prisma.supportOverride.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'override-wrong',
        platformUserId: 'user-1',
        tenantId: 'tenant-2',
        isActive: true,
        expiresAt: { gt: expect.any(Date) },
      },
      select: {
        id: true,
        reason: true,
        permissionScopes: true,
        readOnly: true,
        expiresAt: true,
      },
    });
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(cls.set).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a reason that does not exactly match the active support session', async () => {
    mockPlatformSuperAdminRoles();
    prisma.supportOverride.findFirst.mockResolvedValueOnce({
      id: 'override-1',
      reason: 'Support ticket SCH-123',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Different investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Tenant override reason does not match the active support session',
      ),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'writable',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: false,
    },
    { label: 'unscoped', permissionScopes: [], readOnly: true },
    {
      label: 'unknown-scoped',
      permissionScopes: ['EVERYTHING'],
      readOnly: true,
    },
  ])('rejects a $label support session', async (session) => {
    mockPlatformSuperAdminRoles();
    prisma.supportOverride.findFirst.mockResolvedValueOnce({
      id: 'override-1',
      reason: 'Support investigation',
      expiresAt: new Date(Date.now() + 60_000),
      ...session,
    });
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Support override is missing an approved read-only scope',
      ),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unsafe HTTP methods before resolving the target tenant', async () => {
    mockPlatformSuperAdminRoles();
    prisma.supportOverride.findFirst.mockResolvedValueOnce({
      id: 'override-1',
      reason: 'Support investigation',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { context } = createContext(
      {
        'x-schoolos-tenant-id': 'tenant-2',
        'x-schoolos-tenant-override-reason': 'Support investigation',
        'x-schoolos-support-override-id': 'override-1',
      },
      true,
      'POST',
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Support override is read-only'),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
    expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
  });

  it('denies and audits a valid override on an unapproved read route', async () => {
    mockPlatformSuperAdminRoles();
    reflector.getAllAndOverride.mockReturnValueOnce([]);
    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-2',
      slug: 'school-two',
      isActive: true,
      securityDomain: SecurityDomain.SCHOOL,
    });
    prisma.supportOverride.findFirst.mockResolvedValueOnce({
      id: 'override-1',
      reason: 'Support investigation',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { context, handler } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Support override is not approved for this route'),
    );
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      'supportOverrideReadScopes',
      [handler],
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_override_denied',
        resource: 'auth',
        tenantId: 'tenant-1',
        userId: 'user-1',
        after: expect.objectContaining({
          requestedTenantId: 'tenant-2',
          overrideId: 'override-1',
          requestMethod: 'GET',
          routeController: 'ControllerClass',
          routeHandler: 'handler',
          denialReason: 'route_not_approved_for_support_override',
        }),
      }),
    );
    expect(cls.set).not.toHaveBeenCalled();
  });

  it('allows platform super admins to override to an active tenant and audits it', async () => {
    mockPlatformSuperAdminRoles();
    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-2',
      slug: 'school-two',
      isActive: true,
      securityDomain: SecurityDomain.SCHOOL,
    });
    prisma.supportOverride.findFirst.mockResolvedValueOnce({
      id: 'override-1',
      reason: 'Support investigation',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { context, request } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-2' },
      select: {
        id: true,
        slug: true,
        isActive: true,
        securityDomain: true,
      },
    });
    expect(request.auth?.tenantId).toBe('tenant-2');
    expect(request.auth?.originalTenantId).toBe('tenant-1');
    expect(request.auth?.isSupportOverride).toBe(true);
    expect(request.auth?.securityDomain).toBe(SecurityDomain.PLATFORM);
    expect(request.auth?.tenantSlug).toBe('school-two');
    expect(request.auth?.roles).toEqual([]);
    expect(request.auth?.supportOverrideScopes).toEqual(['STUDENT_RECORDS']);
    expect(request.auth?.supportOverrideReadOnly).toBe(true);
    expect(request.auth?.permissions).toContain('students:read');
    expect(request.auth?.permissions).not.toContain('roles:read');
    expect(request.auth?.permissions).not.toContain('users:create');
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-2');
    expect(auditService.record).toHaveBeenCalledWith({
      action: 'tenant_override',
      resource: 'auth',
      tenantId: 'tenant-1',
      userId: 'user-1',
      after: {
        originalTenantId: 'tenant-1',
        effectiveTenantId: 'tenant-2',
        reason: 'Support investigation',
        permissionScopes: ['STUDENT_RECORDS'],
        readOnly: true,
        overrideId: 'override-1',
        requestMethod: 'GET',
        routeController: 'ControllerClass',
        routeHandler: 'handler',
      },
    });
  });

  it('rejects platform super admin overrides to missing or inactive tenants', async () => {
    // Both assertions below run a full canActivate, so this must be a
    // persistent mock: with `mockResolvedValueOnce` the second call would fall
    // back to a non-platform role and reject for the wrong reason.
    mockPlatformSuperAdminRoles();
    prisma.supportOverride.findFirst.mockResolvedValue({
      id: 'override-1',
      reason: 'Support investigation',
      permissionScopes: ['STUDENT_RECORDS'],
      readOnly: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.tenant.findUnique.mockResolvedValueOnce(null);
    const missingTenant = createContext({
      'x-schoolos-tenant-id': 'missing',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(
      guard.canActivate(missingTenant.context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-2',
      slug: 'school-two',
      isActive: false,
      securityDomain: SecurityDomain.SCHOOL,
    });
    const inactiveTenant = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(
      guard.canActivate(inactiveTenant.context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'platform-2',
      slug: 'another-platform-domain',
      isActive: true,
      securityDomain: SecurityDomain.PLATFORM,
    });
    const platformTenant = createContext({
      'x-schoolos-tenant-id': 'platform-2',
      'x-schoolos-tenant-override-reason': 'Support investigation',
      'x-schoolos-support-override-id': 'override-1',
    });

    await expect(
      guard.canActivate(platformTenant.context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cls.set).not.toHaveBeenCalled();
    // Both rejections must come from the tenant resolution, not from failing
    // the platform-super-admin check earlier in the guard — otherwise this test
    // would still pass while proving nothing about inactive tenants.
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(3);
  });

  it('rejects when user tenantId does not match token tenantId (tenant mismatch)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      tenantId: 'tenant-wrong',
    });
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Tenant mismatch'),
    );
    expect(cls.set).not.toHaveBeenCalled();
  });
});

function createContext(
  extraHeaders: Record<string, string> = {},
  includeAuthorization = true,
  method = 'GET',
) {
  function handler() {}
  class ControllerClass {}
  const request: {
    headers: Record<string, string>;
    method: string;
    auth?: AuthContext;
  } = {
    method,
    headers: {
      ...(includeAuthorization ? { authorization: 'Bearer access-token' } : {}),
      ...extraHeaders,
    },
  };

  return {
    request,
    handler,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler,
      getClass: () => ControllerClass,
    } as unknown as ExecutionContext,
  };
}
