import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '../src/config/config.service';
import { AuditService } from '../src/audit/audit.service';
import { createPrismaMock, PrismaMock } from './test-helpers';
import { AuthenticatedRequest } from '../src/auth/auth-request.interface';

describe('Auth Security Hardening (Regression)', () => {
  let guard: JwtAuthGuard;
  let prisma: PrismaMock;
  let jwtService: JwtService;

  const mockConfig = {
    jwtSecret: 'test-secret',
    accessCookieName: 'access_token',
  };

  const mockAudit = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockCls = {
    set: jest.fn(),
    isActive: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should throw ForbiddenException if user tenantId does not match token tenantId', async () => {
    const payload = {
      sub: 'user-1',
      tenantId: 'tenant-B',
      tenantSlug: 'school-b',
    };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-A', // Mismatch!
      status: 'ACTIVE',
      tenant: { isActive: true },
      userRoles: [],
    });

    const request = {
      headers: { authorization: 'Bearer valid-token' },
    } as any;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow('Tenant mismatch');
  });

  it('should throw UnauthorizedException if user or tenant is inactive', async () => {
    const payload = { sub: 'user-1', tenantId: 'tenant-A' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-A',
      status: 'SUSPENDED', // Inactive user
      tenant: { isActive: true },
    });

    const request = { headers: { authorization: 'Bearer valid-token' } } as any;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'User or tenant is inactive',
    );
  });

  it('should deny platform users from overriding tenant without an active SupportOverride session', async () => {
    const payload = {
      sub: 'platform-user',
      tenantId: 'platform-tenant',
      roles: ['platform_super_admin'],
    };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    prisma.user.findUnique.mockResolvedValue({
      id: 'platform-user',
      tenantId: 'platform-tenant',
      status: 'ACTIVE',
      tenant: { isActive: true },
      userRoles: [
        { role: { name: 'platform_super_admin', rolePermissions: [] } },
      ],
    });

    // No active override in DB
    prisma.supportOverride.findFirst.mockResolvedValue(null);

    const request = {
      headers: {
        authorization: 'Bearer valid-token',
        'x-schoolos-tenant-id': 'school-tenant-1',
      },
    } as any;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'No active support override session found',
    );
  });

  it('should throw ForbiddenException if override reason is shorter than 5 characters', async () => {
    const payload = { sub: 'platform-user', tenantId: 'platform-tenant' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    prisma.user.findUnique.mockResolvedValue({
      id: 'platform-user',
      tenantId: 'platform-tenant',
      status: 'ACTIVE',
      tenant: { isActive: true },
      userRoles: [
        { role: { name: 'platform_super_admin', rolePermissions: [] } },
      ],
    });

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'school-tenant-1',
      isActive: true,
    });
    prisma.supportOverride.findFirst.mockResolvedValue({
      id: 'override-1',
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const request = {
      headers: {
        authorization: 'Bearer valid-token',
        'x-schoolos-tenant-id': 'school-tenant-1',
        'x-schoolos-tenant-override-reason': 'shrt',
      },
    } as any;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Tenant override requires an explicit reason of at least 5 characters',
    );
  });

  it('should allow platform users to override tenant with an active SupportOverride session', async () => {
    const payload = { sub: 'platform-user', tenantId: 'platform-tenant' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    prisma.user.findUnique.mockResolvedValue({
      id: 'platform-user',
      tenantId: 'platform-tenant',
      status: 'ACTIVE',
      tenant: { isActive: true },
      userRoles: [
        { role: { name: 'platform_super_admin', rolePermissions: [] } },
      ],
    });

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'school-tenant-1',
      isActive: true,
    });
    prisma.supportOverride.findFirst.mockResolvedValue({
      id: 'override-1',
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const request = {
      headers: {
        authorization: 'Bearer valid-token',
        'x-schoolos-tenant-id': 'school-tenant-1',
        'x-schoolos-tenant-override-reason': 'Support ticket #123',
      },
    } as any;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.auth.tenantId).toBe('school-tenant-1');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_override',
        after: expect.objectContaining({
          effectiveTenantId: 'school-tenant-1',
          reason: 'Support ticket #123',
        }),
      }),
    );
  });

  it('should throw UnauthorizedException for expired tokens', async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
      new Error('TokenExpiredError'),
    );

    const request = {
      headers: { authorization: 'Bearer expired-token' },
    } as any;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid access token',
    );
  });
});
