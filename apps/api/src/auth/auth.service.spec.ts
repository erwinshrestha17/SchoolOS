import {
  AuthMethod,
  OtpPurpose,
  SecurityDomain,
  UserStatus,
} from '@prisma/client';
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
    mustChangePassword: false,
    status: UserStatus.ACTIVE,
    userRoles: [
      {
        tenantId: 'tenant-1',
        scopeId: null,
        expiresAt: null,
        revokedAt: null,
        role: {
          tenantId: 'tenant-1',
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
      mobilePushToken: {
        deleteMany: jest.fn(),
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

  it('issues Platform authority only from an active global Platform assignment', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'platform-tenant',
      slug: 'platform',
      name: 'SchoolOS Platform',
      isActive: true,
      securityDomain: SecurityDomain.PLATFORM,
    });
    prisma.user.findUnique.mockResolvedValue({
      ...authUser,
      tenantId: 'platform-tenant',
      userRoles: [
        {
          tenantId: 'platform-tenant',
          scopeId: 'global',
          expiresAt: null,
          revokedAt: null,
          role: {
            tenantId: 'platform-tenant',
            name: 'platform_super_admin',
            rolePermissions: [
              { permission: { resource: 'platform', action: 'manage' } },
            ],
          },
        },
        {
          tenantId: 'platform-tenant',
          scopeId: 'global',
          expiresAt: null,
          revokedAt: new Date(),
          role: {
            tenantId: 'platform-tenant',
            name: 'platform_support',
            rolePermissions: [
              { permission: { resource: 'platform', action: 'read' } },
            ],
          },
        },
        {
          tenantId: 'platform-tenant',
          scopeId: 'platform-tenant',
          expiresAt: null,
          revokedAt: null,
          role: {
            tenantId: 'platform-tenant',
            name: 'platform_billing_admin',
            rolePermissions: [
              {
                permission: { resource: 'platform:billing', action: 'manage' },
              },
            ],
          },
        },
        {
          tenantId: 'platform-tenant',
          scopeId: null,
          expiresAt: null,
          revokedAt: null,
          role: {
            tenantId: 'platform-tenant',
            name: 'admin',
            rolePermissions: [
              { permission: { resource: 'users', action: 'create' } },
            ],
          },
        },
      ],
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = asSession(
      await service.login(
        {
          tenantSlug: 'platform',
          email: authUser.email,
          password: 'password123',
        },
        response,
      ),
    );

    expect(result.user.securityDomain).toBe(SecurityDomain.PLATFORM);
    expect(result.user.roles).toEqual(['platform_super_admin']);
    expect(result.user.permissions).toEqual(['platform:manage']);
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
        tenantId: 'tenant-1',
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
      newPassword: 'Newpassword123!',
      confirmNewPassword: 'Newpassword123!',
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

  it('revokes other sessions while keeping the current refresh session', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'session-current' });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.revokeOtherSessions(
      {
        userId: authUser.id,
        tenantId: authUser.tenantId,
        tenantSlug: 'school-a',
        email: authUser.email,
        authMethod: AuthMethod.PASSWORD,
        mustChangePassword: false,
        roles: ['parent'],
        permissions: [],
      },
      { refreshToken: 'refresh-token' },
    );

    expect(result).toEqual({ success: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: authUser.id,
        revokedAt: null,
        id: { not: 'session-current' },
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'user_revoked_other_sessions',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'revoke_other_sessions',
        tenantId: 'tenant-1',
        userId: authUser.id,
      }),
    );
  });

  it('verifies current password without rotating sessions', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);

    const result = await service.verifyPassword(
      {
        userId: authUser.id,
        tenantId: authUser.tenantId,
        tenantSlug: 'school-a',
        email: authUser.email,
        authMethod: AuthMethod.PASSWORD,
        mustChangePassword: false,
        roles: ['admin'],
        permissions: [],
      },
      { currentPassword: 'password123' },
    );

    expect(result).toEqual({
      success: true,
      message: 'Password verified.',
    });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'verify_password',
        tenantId: 'tenant-1',
        userId: authUser.id,
      }),
    );
  });

  it('rejects wrong current password during verify password', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);

    await expect(
      service.verifyPassword(
        {
          userId: authUser.id,
          tenantId: authUser.tenantId,
          tenantSlug: 'school-a',
          email: authUser.email,
          authMethod: AuthMethod.PASSWORD,
          mustChangePassword: false,
          roles: ['admin'],
          permissions: [],
        },
        { currentPassword: 'wrong-password' },
      ),
    ).rejects.toThrow('Current password is incorrect.');
  });

  it('changes password with correct current password and revokes other sessions', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);
    prisma.user.findUnique.mockResolvedValue(authUser);
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'session-current' });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.changePassword(
      {
        userId: authUser.id,
        tenantId: authUser.tenantId,
        tenantSlug: 'school-a',
        email: authUser.email,
        authMethod: AuthMethod.PASSWORD,
        mustChangePassword: false,
        roles: ['admin'],
        permissions: [],
      },
      {
        currentPassword: 'password123',
        newPassword: 'BetterPassword1!',
        confirmNewPassword: 'BetterPassword1!',
        logoutOtherDevices: true,
      },
      response,
      'refresh_token=refresh-token',
    );

    expect(result).toEqual({
      success: true,
      message:
        'Password changed successfully. For your security, other sessions have been signed out.',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: authUser.id },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          mustChangePassword: false,
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: authUser.id,
        revokedAt: null,
        id: { not: 'session-current' },
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'password_change',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'change_password',
        tenantId: 'tenant-1',
        userId: authUser.id,
      }),
    );
  });

  it('rejects wrong current password during change password', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);

    await expect(
      service.changePassword(
        {
          userId: authUser.id,
          tenantId: authUser.tenantId,
          tenantSlug: 'school-a',
          email: authUser.email,
          authMethod: AuthMethod.PASSWORD,
          mustChangePassword: false,
          roles: ['admin'],
          permissions: [],
        },
        {
          currentPassword: 'wrong-password',
          newPassword: 'BetterPassword1!',
          confirmNewPassword: 'BetterPassword1!',
          logoutOtherDevices: true,
        },
        response,
      ),
    ).rejects.toThrow('Current password is incorrect.');
  });

  it('rejects weak password during change password', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);

    await expect(
      service.changePassword(
        {
          userId: authUser.id,
          tenantId: authUser.tenantId,
          tenantSlug: 'school-a',
          email: authUser.email,
          authMethod: AuthMethod.PASSWORD,
          mustChangePassword: false,
          roles: ['admin'],
          permissions: [],
        },
        {
          currentPassword: 'password123',
          newPassword: 'password123',
          confirmNewPassword: 'password123',
          logoutOtherDevices: true,
        },
        response,
      ),
    ).rejects.toThrow('New password cannot be the same as current password.');
  });

  it('keeps other sessions when logoutOtherDevices is false', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'school-a',
      name: 'School A',
      isActive: true,
    });
    prisma.user.findFirst.mockResolvedValue(authUser);
    prisma.user.findUnique.mockResolvedValue(authUser);
    prisma.user.update.mockResolvedValue({});

    await service.changePassword(
      {
        userId: authUser.id,
        tenantId: authUser.tenantId,
        tenantSlug: 'school-a',
        email: authUser.email,
        authMethod: AuthMethod.PASSWORD,
        mustChangePassword: false,
        roles: ['admin'],
        permissions: [],
      },
      {
        currentPassword: 'password123',
        newPassword: 'BetterPassword1!',
        confirmNewPassword: 'BetterPassword1!',
        logoutOtherDevices: false,
      },
      response,
    );

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
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

  it('revokes only the logging-out mobile installation push token', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.findFirst.mockResolvedValue({
      userId: authUser.id,
      user: { tenantId: authUser.tenantId },
    });
    prisma.mobilePushToken.deleteMany.mockResolvedValue({ count: 1 });

    await service.logout(
      {
        refreshToken: 'refresh-token',
        installationId: '3b53ee2c-f356-477d-8b2c-7a35918590ab',
      },
      response,
    );

    expect(prisma.mobilePushToken.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        installationId: '3b53ee2c-f356-477d-8b2c-7a35918590ab',
      },
    });
    expect(prisma.runWithTenantScope).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'logout',
        tenantId: 'tenant-1',
        userId: 'user-1',
        after: {
          installationId: '3b53ee2c-f356-477d-8b2c-7a35918590ab',
          pushTokenRevoked: true,
        },
      }),
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
  describe('getProfile', () => {
    it('exposes a guardian name so parent clients need not read the email', async () => {
      // Without this block a guardian account has no name anywhere in the
      // session payload, and the mobile app greeted parents with their login
      // handle ("guardian.c01a004").
      prisma.user.findFirst.mockResolvedValue({
        ...authUser,
        tenant: {
          id: 'tenant-1',
          name: 'School',
          slug: 'default-school',
          plan: 'STANDARD',
        },
        staff: null,
        student: null,
        guardian: {
          id: 'guardian-1',
          fullName: 'Narayan Lama',
          relation: 'Guardian',
        },
      });

      const profile: any = await service.getProfile({
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'default-school',
      } as any);

      expect(profile.guardian).toEqual({
        id: 'guardian-1',
        fullName: 'Narayan Lama',
        relation: 'Guardian',
      });
    });

    it('leaves guardian null for non-guardian accounts', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...authUser,
        tenant: {
          id: 'tenant-1',
          name: 'School',
          slug: 'default-school',
          plan: 'STANDARD',
        },
        staff: null,
        student: null,
        guardian: null,
      });

      const profile: any = await service.getProfile({
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'default-school',
      } as any);

      expect(profile.guardian).toBeNull();
      // profileType keeps its existing values; nothing switching on it moves.
      expect(profile.profileType).toBe('user');
    });

    it('never selects a guardian home address or phone number', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...authUser,
        tenant: {
          id: 'tenant-1',
          name: 'School',
          slug: 'default-school',
          plan: 'STANDARD',
        },
        staff: null,
        student: null,
        guardian: { id: 'g1', fullName: 'Narayan Lama', relation: 'Guardian' },
      });

      await service.getProfile({
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'default-school',
      } as any);

      const include = prisma.user.findFirst.mock.calls.at(-1)[0].include;
      expect(include.guardian).toEqual({
        select: { id: true, fullName: true, relation: true },
      });
    });

    it('returns the effective school tenant during platform support override', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...authUser,
        tenantId: 'platform-tenant',
        tenant: {
          id: 'platform-tenant',
          name: 'SchoolOS Platform',
          slug: 'platform',
          plan: 'PLATFORM',
        },
        staff: null,
        student: null,
        guardian: null,
        userRoles: authUser.userRoles,
      });
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'school-tenant-2',
        name: 'Pilot Rehearsal School',
        slug: 'pilot-rehearsal-1',
        plan: 'STANDARD',
      });

      const profile: any = await service.getProfile({
        userId: 'user-1',
        tenantId: 'school-tenant-2',
        originalTenantId: 'platform-tenant',
        isSupportOverride: true,
        tenantSlug: 'pilot-rehearsal-1',
      } as any);

      expect(profile.isSupportOverride).toBe(true);
      expect(profile.tenantId).toBe('school-tenant-2');
      expect(profile.tenant).toEqual({
        id: 'school-tenant-2',
        name: 'Pilot Rehearsal School',
        slug: 'pilot-rehearsal-1',
        plan: 'STANDARD',
      });
    });
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
