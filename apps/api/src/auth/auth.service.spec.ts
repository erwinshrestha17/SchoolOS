import { AuthMethod, OtpPurpose, UserStatus } from '@prisma/client';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { hashOtpCode, hashToken } from './auth.utils';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let auditService: any;
  let notificationsService: any;
  let response: any;

  const authUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@school.com',
    passwordHash: '',
    authMethod: AuthMethod.PASSWORD,
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
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      otpCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation(async (payload: any) =>
          payload.purpose ? 'challenge-token' : 'access-token',
        ),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: authUser.id,
        tenantId: authUser.tenantId,
        tenantSlug: 'school-a',
        purpose: OtpPurpose.LOGIN,
      }),
    };
    configService = {
      jwtSecret: 'secret',
      tokenHashPepper: 'mock-pepper-for-tests-at-least-32-chars-long-12345',
      challengeSecret: 'challenge-secret',
      accessTokenTtl: '15m',
      challengeTokenTtl: '10m',
      refreshTokenTtlDays: 7,
      refreshCookieName: 'refresh_token',
      accessCookieName: 'access_token',
      cookieSameSite: 'lax',
      cookieDomain: undefined,
      isProduction: false,
      bcryptRounds: 4,
      otpTtlMinutes: 10,
      passwordResetTtlMinutes: 15,
      otpLength: 6,
      otpIssueLimit: 3,
      otpIssueWindowMinutes: 15,
      passwordResetAppUrl: 'http://localhost:5173/reset-password',
    };
    auditService = {
      record: jest.fn(),
    };
    notificationsService = {
      sendAuthCodeEmail: jest.fn(),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    service = new AuthService(
      prisma,
      jwtService,
      configService,
      auditService,
      notificationsService,
    );
  });

  it('logs in with valid tenant credentials for password-only users', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue(authUser);
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = asSession(
      await service.login(
        {
          tenantSlug: 'school-a',
          email: authUser.email,
          password: 'password123',
        },
        response,
      ),
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user.authMethod).toBe(AuthMethod.PASSWORD);
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      }),
    );
  });

  it('returns an MFA challenge for BOTH auth mode', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue({
      ...authUser,
      authMethod: AuthMethod.BOTH,
    });
    prisma.otpCode.create.mockResolvedValue({});
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

    const result = asChallenge(
      await service.login(
        {
          tenantSlug: 'school-a',
          email: authUser.email,
          password: 'password123',
        },
        response,
      ),
    );

    expect(result.requiresMfa).toBe(true);
    expect(result.challengeToken).toBe('challenge-token');
    expect(notificationsService.sendAuthCodeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: authUser.email,
        purpose: 'login',
      }),
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects wrong passwords', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
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
      name: 'School A',
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

  it('resets passwords with a valid recovery code', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue(authUser);
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      codeHash: hashOtpCode('123456'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmPasswordRecovery({
      tenantSlug: 'school-a',
      email: authUser.email,
      code: '123456',
      newPassword: 'newpassword123',
    });

    expect(result).toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: authUser.id },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: authUser.id,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('rotates refresh tokens on refresh', async () => {
    const rawRefreshToken = 'refresh-token';
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: authUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: authUser,
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
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
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'rotated',
        replacedByTokenId: expect.any(String),
      },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      'access-token',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('revokes refresh tokens on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.findFirst.mockResolvedValue({
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
        tokenHash: {
          in: [hashToken('refresh-token'), expect.any(String)],
        },
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'logout',
      },
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      'access_token',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('revokes active refresh tokens when the account gets locked', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findUnique.mockResolvedValue({
      ...authUser,
      failedLoginCount: 4,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

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

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: authUser.id },
        data: expect.objectContaining({
          failedLoginCount: 5,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: authUser.id,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('detects suspicious refresh token reuse, revokes all sessions for the user, and audits it', async () => {
    const rawRefreshToken = 'reused-refresh-token';
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: authUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: authUser,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.refresh({ refreshToken: rawRefreshToken }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        familyId: 'session-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'family_theft',
      },
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'suspicious_refresh_token_reuse',
        userId: authUser.id,
        tenantId: authUser.tenantId,
      }),
    );
  });
});

function asSession(
  result:
    | { accessToken?: string; refreshToken?: string; user: any }
    | { requiresMfa: boolean; challengeToken: string },
) {
  if (!('accessToken' in result) || !result.accessToken) {
    throw new Error('Expected a session response');
  }

  return result as { accessToken: string; refreshToken?: string; user: any };
}

function asChallenge(
  result:
    | { accessToken?: string; refreshToken?: string; user: any }
    | { requiresMfa: boolean; challengeToken: string },
) {
  if (!('challengeToken' in result)) {
    throw new Error('Expected an MFA challenge response');
  }

  return result;
}
