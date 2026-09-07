import { randomUUID } from 'node:crypto';
import { AuthMethod, OtpPurpose, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../src/audit/audit.service';
import { AuthService } from '../src/auth/auth.service';
import { hashOtpCode, hashToken } from '../src/auth/auth.utils';
import type { AuthContext, JwtAccessPayload } from '../src/auth/auth.types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '../src/auth/guards/must-change-password.guard';
import { AuthzCacheService } from '../src/auth/authz-cache.service';
import { createPassThroughRedisCache } from './helpers/redis-cache';
import { createPassThroughRequestCache } from './helpers/request-cache';
import { ConfigService } from '../src/config/config.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  authTestDatabaseUrl as databaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

const describeDatabase = databaseUrl ? describe : describe.skip;
describeDatabase(
  'Auth recovery concurrency (real PostgreSQL, isolated fixtures)',
  () => {
    const originalUrl = process.env.DATABASE_URL;
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    let prisma: PrismaService;
    let audit: AuditService;
    let service: AuthService;
    let guard: JwtAuthGuard;
    const jwt = new JwtService();
    let tenantId: string;
    let userId: string;
    let otherTenantId: string;
    let otherUserId: string;
    let tenantSlug: string;
    let originalPasswordHash: string;
    const email = 'synthetic-persona@example.invalid';
    const oldPassword = 'Qz72!mV8';
    const newPassword = 'Lw94!nS6';
    const code = '123456';
    const delivered: { code: string }[] = [];
    const config = {
      bcryptRounds: 4,
      otpLength: 6,
      otpIssueLimit: 3,
      otpIssueWindowMinutes: 15,
      passwordResetTtlMinutes: 15,
      passwordResetAppUrl: 'https://example.invalid/reset-password',
      jwtSecret: 'synthetic-local-session-test-secret-only',
      jwtIssuer: 'schoolos-test',
      jwtAudienceWeb: 'schoolos-test-web',
      jwtAudienceMobile: 'schoolos-test-mobile',
      tokenHashPepper: 'synthetic-local-pepper-only',
      challengeSecret: 'synthetic-local-challenge-only',
      accessTokenTtl: '15m',
      challengeTokenTtl: '5m',
      otpTtlMinutes: 5,
      refreshTokenTtlDays: 14,
      refreshCookieName: 'refresh_token',
      accessCookieName: 'access_token',
      cookieSameSite: 'lax',
      isProduction: false,
    } as ConfigService;

    const scoped = <T>(fn: () => Promise<T>) =>
      prisma.runWithTenantScope(tenantId, fn);
    const confirm = (password = newPassword, recoveryCode = code) =>
      service.confirmPasswordRecovery({
        tenantSlug,
        email,
        code: recoveryCode,
        newPassword: password,
        confirmNewPassword: password,
      });
    const addCode = (
      purpose: OtpPurpose = OtpPurpose.RESET,
      data: Partial<Prisma.OtpCodeUncheckedCreateInput> = {},
    ) =>
      prisma.otpCode.create({
        data: {
          userId,
          purpose,
          codeHash: hashOtpCode(code),
          expiresAt: new Date(Date.now() + 60000),
          ...data,
        },
      });

    beforeAll(async () => {
      process.env.DATABASE_URL = databaseUrl;
      prisma = new PrismaService(cls);
      audit = new AuditService(prisma, cls);
      service = new AuthService(prisma, jwt, config, audit, {
        sendAuthCodeEmail: (input: { code: string }) => {
          delivered.push(input);
          return Promise.resolve();
        },
      } as unknown as NotificationsService);
      guard = new JwtAuthGuard(
        jwt,
        config,
        audit,
        prisma,
        cls,
        { canActivate: () => true } as unknown as MustChangePasswordGuard,
        new AuthzCacheService(prisma, createPassThroughRedisCache()),
        createPassThroughRequestCache(),
        new Reflector(),
      );
      originalPasswordHash = await bcrypt.hash(oldPassword, 4);
    });

    beforeEach(async () => {
      delivered.length = 0;
      const suffix = randomUUID();
      tenantSlug = `auth-recovery-${suffix}`;
      const tenant = await prisma.tenant.create({
        data: { name: 'Synthetic auth recovery', slug: tenantSlug },
      });
      tenantId = tenant.id;
      const user = await scoped(() =>
        prisma.user.create({
          data: {
            tenantId,
            email,
            passwordHash: originalPasswordHash,
            status: UserStatus.ACTIVE,
          },
        }),
      );
      userId = user.id;
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Synthetic other tenant', slug: `auth-other-${suffix}` },
      });
      otherTenantId = otherTenant.id;
      const otherUser = await prisma.runWithTenantScope(otherTenantId, () =>
        prisma.user.create({
          data: {
            tenantId: otherTenantId,
            email,
            passwordHash: originalPasswordHash,
            status: UserStatus.ACTIVE,
          },
        }),
      );
      otherUserId = otherUser.id;
      for (const [ownerTenantId, ownerId] of [
        [tenantId, userId],
        [otherTenantId, otherUserId],
      ]) {
        await prisma.refreshToken.create({
          data: {
            userId: ownerId,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        await prisma.runWithTenantScope(ownerTenantId, () =>
          prisma.mobilePushToken.create({
            data: {
              tenantId: ownerTenantId,
              userId: ownerId,
              installationId: randomUUID(),
              tokenHash: randomUUID(),
              tokenEncrypted: 'synthetic-not-a-provider-token',
              platform: 'android',
            },
          }),
        );
      }
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      // Remove only the two exact fixtures created by this case, not shared data.
      for (const [ownerTenantId, ownerId] of [
        [tenantId, userId],
        [otherTenantId, otherUserId],
      ]) {
        if (!ownerTenantId) continue;
        await prisma.runWithTenantScope(ownerTenantId, async () => {
          await prisma.auditLog.deleteMany({
            where: { tenantId: ownerTenantId },
          });
          if (ownerId)
            await prisma.user.deleteMany({
              where: { id: ownerId, tenantId: ownerTenantId },
            });
        });
        await prisma.tenant.delete({ where: { id: ownerTenantId } });
      }
    });
    afterAll(async () => {
      await prisma?.$disconnect();
      if (originalUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalUrl;
    });

    async function expectUnchanged(otpId: string) {
      expect(
        (await prisma.otpCode.findUniqueOrThrow({ where: { id: otpId } }))
          .usedAt,
      ).toBeNull();
      expect(
        (
          await scoped(() =>
            prisma.user.findUniqueOrThrow({ where: { id: userId } }),
          )
        ).passwordHash,
      ).toBe(originalPasswordHash);
      expect(
        await prisma.refreshToken.count({ where: { userId, revokedAt: null } }),
      ).toBe(1);
      expect(
        await scoped(() => prisma.mobilePushToken.count({ where: { userId } })),
      ).toBe(1);
      expect(
        await scoped(() =>
          prisma.auditLog.count({
            where: { userId, action: 'password_recovery_complete' },
          }),
        ),
      ).toBe(0);
    }

    function responseStub() {
      return { cookie: jest.fn(), clearCookie: jest.fn() };
    }

    async function login(response = responseStub()) {
      const session = await service.login(
        { tenantSlug, email, password: oldPassword },
        response as unknown as Response,
        { userAgent: 'Dart/3 synthetic-test' },
      );
      if (
        !('accessToken' in session) ||
        !session.accessToken ||
        !session.refreshToken
      )
        throw new Error('Expected a mobile session');
      return {
        ...session,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    }

    async function authorize(accessToken: string) {
      return cls.run(async () => {
        const request: {
          headers: Record<string, string>;
          method: string;
          auth?: AuthContext;
        } = {
          headers: {
            authorization: `Bearer ${accessToken}`,
            'user-agent': 'Dart/3 synthetic-test',
          },
          method: 'GET',
        };
        const context = {
          switchToHttp: () => ({ getRequest: () => request }),
          getHandler: () => authorize,
          getClass: () => AuthService,
        } as unknown as ExecutionContext;
        await guard.canActivate(context);
        if (!request.auth?.sessionFamilyId)
          throw new Error('Expected an authenticated context');
        return {
          ...request.auth,
          sessionFamilyId: request.auth.sessionFamilyId,
        };
      });
    }

    const rotate = async (refreshToken: string, response = responseStub()) => {
      const session = await service.refresh(
        { refreshToken },
        response as unknown as Response,
        undefined,
        { userAgent: 'Dart/3 synthetic-test' },
      );
      if (!session.accessToken || !session.refreshToken)
        throw new Error('Expected a mobile refresh session');
      return {
        ...session,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    };
    const logout = (refreshToken: string) =>
      service.logout({ refreshToken }, responseStub() as unknown as Response);
    const activeFamily = (familyId: string) =>
      prisma.refreshToken.count({
        where: {
          userId,
          familyId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

    describe('session-bound access and serialized credential lifecycle', () => {
      it('binds access JWTs to a persisted family and retains it across rotation', async () => {
        const first = await login();
        const auth = await authorize(first.accessToken);
        expect(auth.sessionFamilyId).toEqual(expect.any(String));
        expect(await activeFamily(auth.sessionFamilyId)).toBe(1);
        const second = await rotate(first.refreshToken);
        expect((await authorize(second.accessToken)).sessionFamilyId).toBe(
          auth.sessionFamilyId,
        );
        await expect(authorize(first.accessToken)).resolves.toMatchObject({
          userId,
        });
        expect(await activeFamily(auth.sessionFamilyId)).toBe(1);
      });

      it('logout with a rotated predecessor ends the entire family, not another login', async () => {
        const first = await login();
        const independent = await login();
        const second = await rotate(first.refreshToken);
        await logout(first.refreshToken);
        await expect(authorize(first.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(authorize(second.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(authorize(independent.accessToken)).resolves.toMatchObject(
          { userId },
        );
        await expect(rotate(second.refreshToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });

      it('password recovery invalidates every pre-recovery access token on its next request', async () => {
        const first = await login();
        const second = await login();
        const staleAuth = await authorize(first.accessToken);
        await addCode();
        await confirm();
        await expect(authorize(first.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(authorize(second.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(rotate(first.refreshToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(
          service.changePassword(
            staleAuth,
            {
              currentPassword: newPassword,
              newPassword: 'Gt65!xB3',
              confirmNewPassword: 'Gt65!xB3',
            },
            responseStub() as unknown as Response,
          ),
        ).rejects.toThrow('Session has ended');
      });

      it('password change identifies the mobile current session by verified JWT without a cookie', async () => {
        const current = await login();
        const other = await login();
        const auth = await authorize(current.accessToken);
        await addCode();
        await service.changePassword(
          auth,
          {
            currentPassword: oldPassword,
            newPassword,
            confirmNewPassword: newPassword,
          },
          responseStub() as unknown as Response,
        );
        await expect(authorize(current.accessToken)).resolves.toMatchObject({
          userId,
        });
        await expect(authorize(other.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(
          await prisma.otpCode.count({ where: { userId, usedAt: null } }),
        ).toBe(0);
        await expect(rotate(current.refreshToken)).resolves.toHaveProperty(
          'accessToken',
        );
      });

      it('session removal using a rotated list entry revokes its live successor', async () => {
        const current = await login();
        const other = await login();
        const auth = await authorize(current.accessToken);
        const targetId = (await authorize(other.accessToken)).sessionFamilyId;
        const successor = await rotate(other.refreshToken);
        await service.revokeSession(targetId, auth);
        await expect(authorize(successor.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(authorize(current.accessToken)).resolves.toMatchObject({
          userId,
        });
      });

      it('revoke-other-sessions uses verified identity rather than a supplied other-session token', async () => {
        const current = await login();
        const other = await login();
        const auth = await authorize(current.accessToken);
        await service.revokeOtherSessions(auth, {
          refreshToken: other.refreshToken,
        });
        await expect(authorize(current.accessToken)).resolves.toMatchObject({
          userId,
        });
        await expect(authorize(other.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });

      it('MFA changes consume the code and revoke all sessions atomically', async () => {
        const current = await login();
        const auth = await authorize(current.accessToken);
        await addCode(OtpPurpose.VERIFY);
        await service.confirmMfaSetup(auth, {
          code,
          authMethod: AuthMethod.BOTH,
        });
        await expect(authorize(current.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(
          (
            await scoped(() =>
              prisma.user.findUniqueOrThrow({ where: { id: userId } }),
            )
          ).authMethod,
        ).toBe(AuthMethod.BOTH);
        expect(
          await prisma.otpCode.count({ where: { userId, usedAt: null } }),
        ).toBe(0);
      });

      it('concurrent refresh issues only one successor and replay commits family revocation', async () => {
        const first = await login();
        const independent = await login();
        const familyId = (await authorize(first.accessToken)).sessionFamilyId;
        const results = await Promise.allSettled([
          rotate(first.refreshToken),
          rotate(first.refreshToken),
        ]);
        expect(
          results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          results.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        expect(
          await prisma.refreshToken.count({ where: { userId, familyId } }),
        ).toBe(2);
        expect(await activeFamily(familyId)).toBe(0);
        await expect(authorize(first.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        const winner = results.find((result) => result.status === 'fulfilled');
        if (winner?.status !== 'fulfilled')
          throw new Error('Expected one refresh winner');
        await expect(
          authorize(winner.value.accessToken),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(
          await scoped(() =>
            prisma.auditLog.count({
              where: { userId, action: 'suspicious_refresh_token_reuse' },
            }),
          ),
        ).toBe(1);
        await expect(authorize(independent.accessToken)).resolves.toMatchObject(
          { userId },
        );
      });

      it('refresh audit failure rolls back token consumption and never attaches success cookies', async () => {
        const first = await login();
        const familyId = (await authorize(first.accessToken)).sessionFamilyId;
        const response = responseStub();
        const failingAudit = jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(rotate(first.refreshToken, response)).rejects.toThrow(
          'Synthetic audit failure',
        );
        expect(response.cookie).not.toHaveBeenCalled();
        expect(
          await prisma.refreshToken.count({ where: { userId, familyId } }),
        ).toBe(1);
        expect(await activeFamily(familyId)).toBe(1);
        failingAudit.mockRestore();
        await expect(rotate(first.refreshToken)).resolves.toHaveProperty(
          'accessToken',
        );
      });

      it('login audit failure rolls back session issuance before response cookies', async () => {
        const before = await prisma.refreshToken.count({ where: { userId } });
        const response = responseStub();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(login(response)).rejects.toThrow(
          'Synthetic audit failure',
        );
        expect(response.cookie).not.toHaveBeenCalled();
        expect(await prisma.refreshToken.count({ where: { userId } })).toBe(
          before,
        );
      });

      it('a login that already checked the old password cannot issue after recovery commits', async () => {
        // Hold the production completion seam only after bcrypt has accepted the
        // old credential. All actual locking, recovery, and token writes are real.
        interface Completion {
          completeAuthenticatedSession: (
            ...args: unknown[]
          ) => Promise<unknown>;
        }
        const internal = service as unknown as Completion;
        const original = internal.completeAuthenticatedSession;
        let release!: () => void;
        let arrived!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const ready = new Promise<void>((resolve) => {
          arrived = resolve;
        });
        jest
          .spyOn(internal, 'completeAuthenticatedSession')
          .mockImplementationOnce(async (...args) => {
            arrived();
            await held;
            return Reflect.apply(original, service, args) as Promise<unknown>;
          });
        const response = responseStub();
        const pending = login(response);
        const denied = expect(pending).rejects.toThrow(
          'Credentials changed. Sign in again.',
        );
        await ready;
        try {
          await addCode();
          await confirm();
        } finally {
          release();
          await denied;
        }
        expect(response.cookie).not.toHaveBeenCalled();
        expect(
          await prisma.refreshToken.count({
            where: { userId, revokedAt: null },
          }),
        ).toBe(0);
      });

      it.each(['logout', 'recovery'] as const)(
        'refresh racing with %s leaves no surviving family',
        async (action) => {
          const first = await login();
          const familyId = (await authorize(first.accessToken)).sessionFamilyId;
          if (action === 'recovery') await addCode();
          const results = await Promise.allSettled([
            rotate(first.refreshToken),
            action === 'recovery' ? confirm() : logout(first.refreshToken),
          ]);
          expect(results[1].status).toBe('fulfilled');
          expect(await activeFamily(familyId)).toBe(0);
          await expect(authorize(first.accessToken)).rejects.toBeInstanceOf(
            UnauthorizedException,
          );
          if (
            results[0].status === 'fulfilled' &&
            'accessToken' in results[0].value
          )
            await expect(
              authorize(results[0].value.accessToken),
            ).rejects.toBeInstanceOf(UnauthorizedException);
        },
      );

      it('legacy access tokens fail closed but a valid legacy refresh upgrades to a bound family', async () => {
        const legacyId = randomUUID();
        const raw = randomUUID();
        await prisma.refreshToken.create({
          data: {
            id: legacyId,
            userId,
            tokenHash: hashToken(raw),
            hashVersion: 1,
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        const current = await login();
        const payload = jwt.decode<JwtAccessPayload>(current.accessToken);
        const legacy = await jwt.signAsync(
          { ...payload, sid: undefined },
          { secret: config.jwtSecret },
        );
        await expect(authorize(legacy)).rejects.toThrow(
          'Session must be renewed',
        );
        const upgraded = await rotate(raw);
        expect((await authorize(upgraded.accessToken)).sessionFamilyId).toBe(
          legacyId,
        );
        await logout(raw);
        await expect(authorize(upgraded.accessToken)).rejects.toThrow(
          'Session has ended',
        );
      });

      it('a valid signature cannot bind this user to another tenant user session', async () => {
        const current = await login();
        const otherFamily = randomUUID();
        await prisma.refreshToken.create({
          data: {
            userId: otherUserId,
            familyId: otherFamily,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        const payload = jwt.decode<JwtAccessPayload>(current.accessToken);
        const forgedBinding = await jwt.signAsync(
          { ...payload, sid: otherFamily },
          { secret: config.jwtSecret },
        );
        await expect(authorize(forgedBinding)).rejects.toThrow(
          'Session has ended',
        );
      });

      it('five simultaneous bad passwords accumulate five failures and revoke access at lockout', async () => {
        const current = await login();
        const results = await Promise.allSettled(
          Array.from({ length: 5 }, () =>
            service.login(
              { tenantSlug, email, password: 'not-the-password' },
              responseStub() as unknown as Response,
            ),
          ),
        );
        expect(results.every((result) => result.status === 'rejected')).toBe(
          true,
        );
        const user = await scoped(() =>
          prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        );
        expect(user.failedLoginCount).toBe(5);
        if (!user.lockedUntil) throw new Error('Expected a persisted lockout');
        expect(user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
        expect(
          await scoped(() =>
            prisma.auditLog.count({
              where: { userId, action: 'login_failed' },
            }),
          ),
        ).toBe(4);
        expect(
          await scoped(() =>
            prisma.auditLog.count({
              where: { userId, action: 'login_locked' },
            }),
          ),
        ).toBe(1);
        await expect(authorize(current.accessToken)).rejects.toThrow(
          'Session has ended',
        );
      });

      it('a failed-login audit failure rolls back lockout and session revocation', async () => {
        const current = await login();
        await scoped(() =>
          prisma.user.update({
            where: { id: userId },
            data: { failedLoginCount: 4 },
          }),
        );
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(
          service.login(
            { tenantSlug, email, password: 'not-the-password' },
            responseStub() as unknown as Response,
          ),
        ).rejects.toThrow('Synthetic audit failure');
        const user = await scoped(() =>
          prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        );
        expect(user.failedLoginCount).toBe(4);
        expect(user.lockedUntil).toBeNull();
        await expect(authorize(current.accessToken)).resolves.toMatchObject({
          userId,
        });
      });

      it('a revoked authenticated context cannot request another MFA setup code', async () => {
        const current = await login();
        const auth = await authorize(current.accessToken);
        await logout(current.refreshToken);
        await expect(service.requestMfaSetup(auth)).rejects.toThrow(
          'Session has ended',
        );
        expect(
          await prisma.otpCode.count({
            where: { userId, purpose: OtpPurpose.VERIFY },
          }),
        ).toBe(0);
        expect(delivered).toHaveLength(0);
      });

      it('a password-verified MFA request cannot issue a code after recovery changes credentials', async () => {
        await scoped(() =>
          prisma.user.update({
            where: { id: userId },
            data: { authMethod: AuthMethod.BOTH },
          }),
        );
        interface Issue {
          issueOtpChallenge: (...args: unknown[]) => Promise<unknown>;
        }
        const internal = service as unknown as Issue;
        const original = internal.issueOtpChallenge;
        let release!: () => void;
        let arrived!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const ready = new Promise<void>((resolve) => {
          arrived = resolve;
        });
        jest
          .spyOn(internal, 'issueOtpChallenge')
          .mockImplementationOnce(async (...args) => {
            arrived();
            await held;
            return Reflect.apply(original, service, args) as Promise<unknown>;
          });
        const pending = service.login(
          { tenantSlug, email, password: oldPassword },
          responseStub() as unknown as Response,
        );
        const denied = expect(pending).rejects.toThrow(
          'Invalid authentication context',
        );
        await ready;
        try {
          await addCode();
          await confirm();
        } finally {
          release();
          await denied;
        }
        expect(
          await prisma.otpCode.count({
            where: { userId, purpose: OtpPurpose.LOGIN },
          }),
        ).toBe(0);
        expect(delivered).toHaveLength(0);
      });

      it('OTP login consumes its code and issues a session in one transaction', async () => {
        await scoped(() =>
          prisma.user.update({
            where: { id: userId },
            data: { authMethod: AuthMethod.OTP },
          }),
        );
        const otp = await addCode(OtpPurpose.LOGIN);
        const challengeToken = await jwt.signAsync(
          { sub: userId, tenantId, tenantSlug, purpose: OtpPurpose.LOGIN },
          { secret: config.challengeSecret, expiresIn: '5m' },
        );
        const verify = (response = responseStub()) =>
          service.verifyOtpLogin(
            { challengeToken, code },
            response as unknown as Response,
            { userAgent: 'Dart/3 synthetic-test' },
          );
        const response = responseStub();
        const failingAudit = jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(verify(response)).rejects.toThrow(
          'Synthetic audit failure',
        );
        expect(response.cookie).not.toHaveBeenCalled();
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).toBeNull();
        failingAudit.mockRestore();
        const results = await Promise.allSettled([verify(), verify()]);
        expect(
          results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          results.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        const winner = results.find((result) => result.status === 'fulfilled');
        if (winner?.status !== 'fulfilled')
          throw new Error('Expected one OTP login winner');
        if (!winner.value.accessToken)
          throw new Error('Expected an OTP access token');
        await expect(
          authorize(winner.value.accessToken),
        ).resolves.toMatchObject({ userId });
      });

      it.each(['password', 'mfa', 'logout', 'revoke-other'] as const)(
        '%s audit failure rolls back security mutation and revocation',
        async (operation) => {
          const current = await login();
          const other = await login();
          const auth = await authorize(current.accessToken);
          const otp = await addCode(OtpPurpose.VERIFY);
          jest
            .spyOn(audit, 'record')
            .mockRejectedValueOnce(new Error('Synthetic audit failure'));
          const action =
            operation === 'password'
              ? service.changePassword(
                  auth,
                  {
                    currentPassword: oldPassword,
                    newPassword,
                    confirmNewPassword: newPassword,
                  },
                  responseStub() as unknown as Response,
                )
              : operation === 'mfa'
                ? service.confirmMfaSetup(auth, {
                    code,
                    authMethod: AuthMethod.BOTH,
                  })
                : operation === 'logout'
                  ? logout(current.refreshToken)
                  : service.revokeOtherSessions(auth, {});
          await expect(action).rejects.toThrow('Synthetic audit failure');
          const user = await scoped(() =>
            prisma.user.findUniqueOrThrow({ where: { id: userId } }),
          );
          expect(user.passwordHash).toBe(originalPasswordHash);
          expect(user.authMethod).toBe(AuthMethod.PASSWORD);
          expect(
            (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
              .usedAt,
          ).toBeNull();
          await expect(authorize(current.accessToken)).resolves.toMatchObject({
            userId,
          });
          await expect(authorize(other.accessToken)).resolves.toMatchObject({
            userId,
          });
        },
      );

      it('logout remains possible after tenant suspension', async () => {
        const current = await login();
        const familyId = (await authorize(current.accessToken)).sessionFamilyId;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { isActive: false },
        });
        await expect(logout(current.refreshToken)).resolves.toEqual({
          success: true,
        });
        expect(await activeFamily(familyId)).toBe(0);
      });
    });

    it('only one of two simultaneous confirmations commits', async () => {
      await addCode();
      await addCode(OtpPurpose.LOGIN);
      await addCode(OtpPurpose.VERIFY);
      const results = await Promise.allSettled([
        confirm(),
        confirm('Ab47!yT2'),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const loser = results.find((result) => result.status === 'rejected');
      if (!loser) throw new Error('Expected exactly one rejected reset');
      expect(loser.reason).toBeInstanceOf(UnauthorizedException);
      const saved = await scoped(() =>
        prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      );
      const winner =
        results[0].status === 'fulfilled' ? newPassword : 'Ab47!yT2';
      if (!saved.passwordHash)
        throw new Error('Expected a saved password hash');
      expect(await bcrypt.compare(winner, saved.passwordHash)).toBe(true);
      expect(
        await prisma.otpCode.count({ where: { userId, usedAt: null } }),
      ).toBe(0);
      expect(
        await prisma.refreshToken.count({ where: { userId, revokedAt: null } }),
      ).toBe(0);
      expect(
        await scoped(() => prisma.mobilePushToken.count({ where: { userId } })),
      ).toBe(0);
      expect(
        await scoped(() =>
          prisma.auditLog.count({
            where: { userId, action: 'password_recovery_complete' },
          }),
        ),
      ).toBe(1);
      expect(
        await prisma.refreshToken.count({
          where: { userId: otherUserId, revokedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.runWithTenantScope(otherTenantId, () =>
          prisma.mobilePushToken.count({ where: { userId: otherUserId } }),
        ),
      ).toBe(1);
      await expect(confirm()).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([OtpPurpose.LOGIN, OtpPurpose.VERIFY])(
      'one-time consumption is atomic for %s challenges too',
      async (purpose) => {
        await addCode(purpose);
        // Exercise the same helper called by OTP login and MFA setup, with real
        // SQL but without creating an unrelated session/response fixture.
        const consumer = service as unknown as {
          consumeOtpCode(
            userId: string,
            purpose: OtpPurpose,
            code: string,
          ): Promise<unknown>;
        };
        const attempts = await Promise.allSettled([
          consumer.consumeOtpCode(userId, purpose, code),
          consumer.consumeOtpCode(userId, purpose, code),
        ]);
        expect(
          attempts.filter((attempt) => attempt.status === 'fulfilled'),
        ).toHaveLength(1);
        const rejected = attempts.find(
          (attempt) => attempt.status === 'rejected',
        );
        if (!rejected)
          throw new Error('Expected exactly one rejected code consumption');
        expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
      },
    );

    it.each(['expired', 'used', 'incorrect'])(
      'rejects an %s recovery code without changing credentials',
      async (state) => {
        const otp = await addCode(
          OtpPurpose.RESET,
          state === 'expired'
            ? { expiresAt: new Date(Date.now() - 1) }
            : state === 'used'
              ? { usedAt: new Date() }
              : {},
        );
        await expect(
          confirm(newPassword, state === 'incorrect' ? '654321' : code),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        if (state !== 'used') await expectUnchanged(otp.id);
        expect(
          (
            await scoped(() =>
              prisma.user.findUniqueOrThrow({ where: { id: userId } }),
            )
          ).passwordHash,
        ).toBe(originalPasswordHash);
      },
    );

    it('a suspended tenant cannot request or confirm recovery', async () => {
      const otp = await addCode();
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });
      await expect(
        service.requestPasswordRecovery({ tenantSlug, email }),
      ).resolves.toEqual({ success: true });
      expect(delivered).toHaveLength(0);
      await expect(confirm()).rejects.toBeInstanceOf(UnauthorizedException);
      await expectUnchanged(otp.id);
    });

    it.each([oldPassword, 'weak-password', 'Xsynthetic7!'])(
      'a rejected password does not burn its code: %s',
      async (password) => {
        const otp = await addCode();
        await expect(confirm(password)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expectUnchanged(otp.id);
        await expect(confirm()).resolves.toEqual({ success: true });
      },
    );

    it('an audit failure rolls back password, code, revocation and push cleanup together', async () => {
      const otp = await addCode();
      const record = jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic audit failure'));
      await expect(confirm()).rejects.toThrow('Synthetic audit failure');
      await expectUnchanged(otp.id);
      record.mockRestore();
      await expect(confirm()).resolves.toEqual({ success: true });
    });

    it('concurrent resend requests obey the account limit and leave one usable code', async () => {
      const requests = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          service.requestPasswordRecovery({ tenantSlug, email }),
        ),
      );
      expect(
        requests.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(3);
      for (const result of requests) {
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(HttpException);
          expect((result.reason as HttpException).getStatus()).toBe(429);
        }
      }
      expect(delivered).toHaveLength(3);
      expect(await prisma.otpCode.count({ where: { userId } })).toBe(3);
      const active = await prisma.otpCode.findMany({
        where: { userId, purpose: OtpPurpose.RESET, usedAt: null },
      });
      expect(active).toHaveLength(1);
      const latest = delivered.find(
        (item) => hashOtpCode(item.code) === active[0].codeHash,
      );
      if (!latest)
        throw new Error('Expected the active code in the delivery stub');
      for (const prior of delivered.filter(
        (item) => item.code !== latest.code,
      )) {
        await expect(confirm(newPassword, prior.code)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      }
      await expect(confirm(newPassword, latest.code)).resolves.toEqual({
        success: true,
      });
    });

    it('an expired latest code cannot fall back to an older legacy unused code', async () => {
      const old = await addCode(OtpPurpose.RESET, {
        createdAt: new Date(Date.now() - 60000),
      });
      await addCode(OtpPurpose.RESET, {
        codeHash: hashOtpCode('654321'),
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(confirm()).rejects.toBeInstanceOf(UnauthorizedException);
      await expectUnchanged(old.id);
    });

    it('a code belonging to another tenant is not consumed', async () => {
      const otp = await addCode();
      await expect(
        service.confirmPasswordRecovery({
          tenantSlug: (
            await prisma.tenant.findUniqueOrThrow({
              where: { id: otherTenantId },
            })
          ).slug,
          email,
          code,
          newPassword,
          confirmNewPassword: newPassword,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expectUnchanged(otp.id);
    });

    it('user suspension while recovery waits for its lock is rechecked', async () => {
      const otp = await addCode();
      let release!: () => void;
      let acquired!: () => void;
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const blocker = scoped(() =>
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
          acquired();
          await held;
          await tx.user.update({
            where: { id: userId },
            data: { status: UserStatus.SUSPENDED },
          });
        }),
      );
      await ready;
      const pending = confirm();
      const denied = expect(pending).rejects.toThrow('User is not active');
      try {
        // Prove the reset has passed its initial account lookup and is actually
        // waiting on PostgreSQL, rather than relying on promise scheduling.
        let waiting = false;
        const deadline = Date.now() + 2000;
        while (!waiting && Date.now() < deadline) {
          const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND cardinality(pg_blocking_pids(pid)) > 0
                AND query LIKE '%FROM "User"%' AND query LIKE '%FOR UPDATE%'
            ) AS waiting
          `;
          waiting = rows[0].waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
        await blocker;
        await denied;
      }
      await expectUnchanged(otp.id);
    });

    it('OTP-only accounts cannot reset a preserved password hash', async () => {
      const otp = await addCode();
      await scoped(() =>
        prisma.user.update({
          where: { id: userId },
          data: { authMethod: AuthMethod.OTP },
        }),
      );
      await expect(confirm()).rejects.toBeInstanceOf(UnauthorizedException);
      await expectUnchanged(otp.id);
    });
  },
);
