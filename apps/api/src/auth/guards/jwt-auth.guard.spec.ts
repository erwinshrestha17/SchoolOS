import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthMethod } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '../../config/config.service';
import { PrismaService, TENANT_ID_KEY } from '../../prisma/prisma.service';
import { AuthContext, JwtAccessPayload } from '../auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let auditService: { record: jest.Mock };
  let prisma: { tenant: { findUnique: jest.Mock } };
  let cls: { set: jest.Mock; isActive: jest.Mock<boolean, []> };

  const basePayload: JwtAccessPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'default-school',
    email: 'admin@schoolos.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['students:read'],
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(basePayload),
    };
    auditService = {
      record: jest.fn(),
    };
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
    };
    cls = {
      set: jest.fn(),
      isActive: jest.fn(() => true),
    };

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      {
        jwtSecret: 'test-secret',
        accessCookieName: 'access_token',
      } as ConfigService,
      auditService as unknown as AuditService,
      prisma as unknown as PrismaService,
      cls as unknown as ClsService,
    );
  });

  it('hydrates auth context and CLS tenant context from a valid token', async () => {
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.auth).toEqual({
      userId: basePayload.sub,
      tenantId: basePayload.tenantId,
      tenantSlug: basePayload.tenantSlug,
      email: basePayload.email,
      authMethod: basePayload.authMethod,
      roles: basePayload.roles,
      permissions: basePayload.permissions,
    });
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-1');
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
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
    });
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

  it('rejects tenant override attempts from non-super-admin users', async () => {
    const { context } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(cls.set).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('allows super admins to override to an active tenant and audits it', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      ...basePayload,
      roles: ['super_admin'],
    });
    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-2',
      isActive: true,
    });
    const { context, request } = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-2' },
      select: { id: true, isActive: true },
    });
    expect(request.auth?.tenantId).toBe('tenant-2');
    expect(cls.set).toHaveBeenCalledWith(TENANT_ID_KEY, 'tenant-2');
    expect(auditService.record).toHaveBeenCalledWith({
      action: 'tenant_override',
      resource: 'auth',
      tenantId: 'tenant-1',
      userId: 'user-1',
      after: {
        originalTenantId: 'tenant-1',
        effectiveTenantId: 'tenant-2',
      },
    });
  });

  it('rejects super-admin overrides to missing or inactive tenants', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      ...basePayload,
      roles: ['super_admin'],
    });
    prisma.tenant.findUnique.mockResolvedValueOnce(null);
    const missingTenant = createContext({ 'x-schoolos-tenant-id': 'missing' });

    await expect(
      guard.canActivate(missingTenant.context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-2',
      isActive: false,
    });
    const inactiveTenant = createContext({
      'x-schoolos-tenant-id': 'tenant-2',
    });

    await expect(
      guard.canActivate(inactiveTenant.context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cls.set).not.toHaveBeenCalled();
  });
});

function createContext(
  extraHeaders: Record<string, string> = {},
  includeAuthorization = true,
) {
  const request: {
    headers: Record<string, string>;
    auth?: AuthContext;
  } = {
    headers: {
      ...(includeAuthorization ? { authorization: 'Bearer access-token' } : {}),
      ...extraHeaders,
    },
  };

  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}
