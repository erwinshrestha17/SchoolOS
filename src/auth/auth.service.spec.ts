import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { hashToken } from './auth.utils';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let auditService: any;
  let response: any;

  const authUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@school.com',
    passwordHash: '',
    status: UserStatus.ACTIVE,
    userRoles: [
      {
        role: {
          name: 'admin',
          rolePermissions: [
            {
              permission: { resource: 'users', action: 'create' },
            },
          ],
        },
      },
    ],
  };

  beforeEach(async () => {
    authUser.passwordHash = await bcrypt.hash('password123', 4);
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    configService = {
      jwtSecret: 'secret',
      accessTokenTtl: '15m',
      refreshTokenTtlDays: 7,
      refreshCookieName: 'refresh_token',
      isProduction: false,
    };
    auditService = {
      record: jest.fn(),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    service = new AuthService(prisma, jwtService, configService, auditService);
  });

  it('logs in with valid tenant credentials', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue(authUser);
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      {
        tenantSlug: 'school-a',
        email: authUser.email,
        password: 'password123',
      },
      response,
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.user.tenantSlug).toBe('school-a');
    expect(result.user.permissions).toEqual(['users:create']);
    expect(response.cookie).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: authUser.id },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });

  it('rejects wrong passwords', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue(authUser);

    await expect(
      service.login(
        {
          tenantSlug: 'school-a',
          email: authUser.email,
          password: 'wrong-password',
        },
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects suspended users', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue({
      ...authUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.login(
        {
          tenantSlug: 'school-a',
          email: authUser.email,
          password: 'password123',
        },
        response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotates refresh tokens on refresh', async () => {
    const rawRefreshToken = 'refresh-token';
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: authUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: authUser,
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      isActive: true,
    });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.refresh(
      { refreshToken: rawRefreshToken },
      response,
    );

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(response.cookie).toHaveBeenCalled();
  });

  it('revokes refresh tokens on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: authUser.id,
      user: { tenantId: authUser.tenantId },
    });

    const result = await service.logout(
      { refreshToken: 'refresh-token' },
      response,
    );

    expect(result).toEqual({ success: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken('refresh-token'),
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
