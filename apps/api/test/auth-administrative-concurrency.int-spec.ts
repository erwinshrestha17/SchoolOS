import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { JwtService } from '@nestjs/jwt';
import { AuthMethod, OtpPurpose, UserStatus } from '@prisma/client';
import { PERMISSION_CATALOG } from '../src/rbac/rbac.defaults';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../src/audit/audit.service';
import { AuthService } from '../src/auth/auth.service';
import type { AuthContext } from '../src/auth/auth.types';
import { hashOtpCode } from '../src/auth/auth.utils';
import { AuthzCacheService } from '../src/auth/authz-cache.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '../src/auth/guards/must-change-password.guard';
import { ConfigService } from '../src/config/config.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { UsersController } from '../src/users/users.controller';
import { RolesService } from '../src/roles/roles.service';
import { RolesController } from '../src/roles/roles.controller';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../src/auth/guards/tenant-active.guard';
import { PlansService } from '../src/plans/plans.service';
import { EntitlementsService } from '../src/plans/entitlements.service';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import { createPassThroughRedisCache } from './helpers/redis-cache';
import { createPassThroughRequestCache } from './helpers/request-cache';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase(
  'Administrative account revocation (real PostgreSQL, isolated fixtures)',
  () => {
    const previousUrl = process.env.DATABASE_URL;
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    const jwt = new JwtService();
    const config = {
      bcryptRounds: 4,
      otpLength: 6,
      otpIssueLimit: 10,
      otpIssueWindowMinutes: 15,
      otpTtlMinutes: 5,
      passwordResetTtlMinutes: 15,
      passwordResetAppUrl: 'https://example.invalid/reset-password',
      jwtSecret: 'synthetic-administrative-test-only',
      jwtIssuer: 'schoolos-test',
      jwtAudienceWeb: 'schoolos-test-web',
      jwtAudienceMobile: 'schoolos-test-mobile',
      tokenHashPepper: 'synthetic-administrative-pepper-only',
      challengeSecret: 'synthetic-administrative-challenge-only',
      accessTokenTtl: '15m',
      challengeTokenTtl: '5m',
      refreshTokenTtlDays: 14,
      refreshCookieName: 'refresh_token',
      accessCookieName: 'access_token',
      cookieSameSite: 'lax',
      isProduction: false,
    } as ConfigService;
    const oldPassword = 'Kp75!tM3';
    const newPassword = 'Rv92!wX6';
    const email = 'synthetic-target@example.invalid';
    const adminEmail = 'synthetic-administrator@example.invalid';
    const code = '123456';
    const metadata = { userAgent: 'Dart/3 synthetic-test' };
    const delivered: string[] = [];
    let prisma: PrismaService;
    let audit: AuditService;
    let auth: AuthService;
    let users: UsersService;
    let roles: RolesService;
    let guard: JwtAuthGuard;
    let httpApp: INestApplication;
    let tenantId: string;
    let tenantSlug: string;
    let targetId: string;
    let adminId: string;
    let otherTenantId: string;
    let otherId: string;
    let adminRoleId: string;
    let actor: AuthContext;
    let adminAccess: string;
    let originalHash: string;

    const scoped = <T>(fn: () => Promise<T>) =>
      prisma.runWithTenantScope(tenantId, fn);
    const response = () =>
      ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;
    const target = () =>
      scoped(() =>
        prisma.user.findUniqueOrThrow({ where: { id: targetId, tenantId } }),
      );
    const pendingCode = (purpose: OtpPurpose = OtpPurpose.RESET) =>
      prisma.otpCode.create({
        data: {
          userId: targetId,
          purpose,
          codeHash: hashOtpCode(code),
          expiresAt: new Date(Date.now() + 60000),
        },
      });
    const reset = (targetUserId = targetId, acting = actor) =>
      users.resetPassword(targetUserId, { password: newPassword }, acting);
    const force = (targetUserId = targetId, acting = actor) =>
      users.forceLogout(targetUserId, acting);
    const rotate = (refreshToken: string) =>
      auth.refresh({ refreshToken }, response(), undefined, metadata);

    async function login(loginEmail = email, password = oldPassword) {
      const session = await auth.login(
        { tenantSlug, email: loginEmail, password },
        response(),
        metadata,
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
            'user-agent': metadata.userAgent,
          },
          method: 'GET',
        };
        await guard.canActivate({
          switchToHttp: () => ({ getRequest: () => request }),
          getHandler: () => authorize,
          getClass: () => UsersService,
        } as unknown as ExecutionContext);
        if (!request.auth?.sessionFamilyId)
          throw new Error('Expected a bound auth context');
        return request.auth;
      });
    }

    beforeAll(async () => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      audit = new AuditService(prisma, cls);
      auth = new AuthService(prisma, jwt, config, audit, {
        sendAuthCodeEmail: (input: { code: string }) => {
          delivered.push(input.code);
          return Promise.resolve();
        },
      } as unknown as NotificationsService);
      users = new UsersService(prisma, config, audit);
      roles = new RolesService(
        prisma,
        audit,
        new AuthzCacheService(prisma, createPassThroughRedisCache()),
      );
      guard = new JwtAuthGuard(
        jwt,
        config,
        audit,
        prisma,
        cls,
        new MustChangePasswordGuard(new Reflector()),
        new AuthzCacheService(prisma, createPassThroughRedisCache()),
        createPassThroughRequestCache(),
        new Reflector(),
      );
      originalHash = await bcrypt.hash(oldPassword, 4);
      // Scoped HTTP harness: real controller, DTO validation, authorization and
      // PostgreSQL. This is not a staging deployment or full-app middleware test.
      const moduleRef = await Test.createTestingModule({
        controllers: [UsersController, RolesController],
        providers: [
          { provide: UsersService, useValue: users },
          { provide: RolesService, useValue: roles },
          { provide: JwtAuthGuard, useValue: guard },
          {
            provide: RolesPermissionsGuard,
            useValue: new RolesPermissionsGuard(new Reflector()),
          },
          {
            provide: TenantActiveGuard,
            useValue: new TenantActiveGuard(
              new PlansService(
                prisma,
                {} as EntitlementsService,
                createPassThroughRequestCache(),
              ),
            ),
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(guard)
        .overrideGuard(RolesPermissionsGuard)
        .useValue(new RolesPermissionsGuard(new Reflector()))
        .overrideGuard(TenantActiveGuard)
        .useValue(
          new TenantActiveGuard(
            new PlansService(
              prisma,
              {} as EntitlementsService,
              createPassThroughRequestCache(),
            ),
          ),
        )
        .compile();
      httpApp = moduleRef.createNestApplication({ logger: false });
      httpApp.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await httpApp.init();
    });
    beforeEach(async () => {
      delivered.length = 0;
      tenantSlug = `synthetic-admin-auth-${randomUUID()}`;
      tenantId = (
        await prisma.tenant.create({
          data: { name: 'Synthetic account test', slug: tenantSlug },
        })
      ).id;
      otherTenantId = (
        await prisma.tenant.create({
          data: { name: 'Synthetic other tenant', slug: `${tenantSlug}-other` },
        })
      ).id;
      adminId = (
        await scoped(() =>
          prisma.user.create({
            data: {
              tenantId,
              email: adminEmail,
              status: UserStatus.ACTIVE,
              passwordHash: originalHash,
            },
          }),
        )
      ).id;
      targetId = (
        await scoped(() =>
          prisma.user.create({
            data: {
              tenantId,
              email,
              status: UserStatus.ACTIVE,
              passwordHash: originalHash,
            },
          }),
        )
      ).id;
      otherId = (
        await prisma.runWithTenantScope(otherTenantId, () =>
          prisma.user.create({
            data: {
              tenantId: otherTenantId,
              email,
              status: UserStatus.ACTIVE,
              passwordHash: originalHash,
            },
          }),
        )
      ).id;
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: { resource: 'users', action: 'reset_password' },
        },
        create: { resource: 'users', action: 'reset_password' },
        update: {},
      });
      adminRoleId = (
        await scoped(() =>
          prisma.role.create({
            data: {
              tenantId,
              name: 'admin',
              rolePermissions: { create: { permissionId: permission.id } },
            },
          }),
        )
      ).id;
      await scoped(() =>
        prisma.userRole.create({
          data: { tenantId, userId: adminId, roleId: adminRoleId },
        }),
      );
      for (const key of [
        'users:update_status',
        'roles:assign',
        'roles:create',
        'roles:manage_permissions',
      ]) {
        const [resource, action] = key.split(':');
        const grant = await prisma.permission.upsert({
          where: { resource_action: { resource, action } },
          create: { resource, action },
          update: {},
        });
        await scoped(() =>
          prisma.rolePermission.create({
            data: { roleId: adminRoleId, permissionId: grant.id },
          }),
        );
      }
      for (const [ownerTenant, owner] of [
        [tenantId, targetId],
        [otherTenantId, otherId],
      ]) {
        await prisma.runWithTenantScope(ownerTenant, () =>
          prisma.mobilePushToken.create({
            data: {
              tenantId: ownerTenant,
              userId: owner,
              installationId: randomUUID(),
              tokenHash: randomUUID(),
              tokenEncrypted: 'synthetic-not-a-provider-token',
              platform: 'android',
            },
          }),
        );
      }
      adminAccess = (await login(adminEmail)).accessToken;
      actor = await authorize(adminAccess);
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      // Delete only exact per-case fixtures from this explicitly disposable DB.
      for (const ownerTenant of [tenantId, otherTenantId]) {
        if (!ownerTenant) continue;
        await prisma.runWithTenantScope(ownerTenant, async () => {
          await prisma.auditLog.deleteMany({
            where: { tenantId: ownerTenant },
          });
          await prisma.user.deleteMany({ where: { tenantId: ownerTenant } });
          await prisma.role.deleteMany({ where: { tenantId: ownerTenant } });
        });
        await prisma.tenant.delete({ where: { id: ownerTenant } });
      }
    });
    afterAll(async () => {
      await httpApp?.close();
      await prisma?.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    describe('administrative HTTP contract', () => {
      const post = (suffix: string, token = adminAccess, id = targetId) =>
        request(httpApp.getHttpServer() as Server)
          .post(`/users/${id}/${suffix}`)
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', metadata.userAgent);

      it.each(['reset-password', 'password-reset'])(
        'retains the %s alias and returns only authoritative success',
        async (route) => {
          const prior = await login();
          const result = await post(route)
            .send({ password: newPassword })
            .expect(201);
          expect(result.body).toEqual({ success: true });
          expect((await target()).authVersion).toBe(1);
          await expect(authorize(prior.accessToken)).rejects.toBeInstanceOf(
            UnauthorizedException,
          );
        },
      );

      it('force logout immediately denies a previously authenticated target', async () => {
        const prior = await login();
        await post('force-logout').send({}).expect(201, { success: true });
        await post('reset-password', prior.accessToken)
          .send({ password: newPassword })
          .expect(401);
      });

      it.each(['reset-password', 'password-reset', 'force-logout'])(
        'denies unprivileged direct calls to %s',
        async (route) => {
          const unprivileged = await login();
          await post(route, unprivileged.accessToken)
            .send(route === 'force-logout' ? {} : { password: newPassword })
            .expect(403);
          expect((await target()).authVersion).toBe(0);
        },
      );

      it.each(['tenantId', 'authVersion', 'sessionFamilyId'])(
        'rejects a caller-supplied %s during reset',
        async (field) => {
          await post('reset-password')
            .send({ password: newPassword, [field]: 'untrusted' })
            .expect(400);
          expect((await target()).authVersion).toBe(0);
        },
      );

      it('denies cross-tenant IDs and caller-selected tenant headers', async () => {
        await post('reset-password', adminAccess, otherId)
          .send({ password: newPassword })
          .expect(404);
        await post('reset-password')
          .set('x-schoolos-tenant-id', otherTenantId)
          .send({ password: newPassword })
          .expect(403);
        expect((await target()).authVersion).toBe(0);
      });

      it('rejects weak passwords without consuming challenges or revoking sessions', async () => {
        const prior = await login();
        const otp = await pendingCode();
        await post('reset-password')
          .send({ password: 'password123' })
          .expect(400);
        expect((await target()).authVersion).toBe(0);
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).toBeNull();
        await expect(authorize(prior.accessToken)).resolves.toMatchObject({
          userId: targetId,
        });
      });

      it('rejects a suspended tenant before any target mutation', async () => {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { isActive: false },
        });
        await post('reset-password')
          .send({ password: newPassword })
          .expect(401);
        expect((await target()).authVersion).toBe(0);
      });
    });

    it.each(['parent', 'teacher', 'principal'])(
      'admin reset revokes %s access and preserves other accounts',
      async (persona) => {
        await scoped(async () => {
          const role = await prisma.role.create({
            data: { tenantId, name: persona },
          });
          await prisma.userRole.create({
            data: { tenantId, userId: targetId, roleId: role.id },
          });
        });
        const first = await login();
        const second = await login();
        expect((await authorize(first.accessToken)).roles).toContain(persona);
        const otp = await pendingCode();
        await reset();
        const changed = await target();
        expect(changed.authVersion).toBe(1);
        expect(changed.mustChangePassword).toBe(true);
        expect(
          await bcrypt.compare(newPassword, changed.passwordHash ?? ''),
        ).toBe(true);
        await expect(authorize(first.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(authorize(second.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(rotate(first.refreshToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).not.toBeNull();
        expect(
          await scoped(() =>
            prisma.mobilePushToken.count({ where: { userId: targetId } }),
          ),
        ).toBe(0);
        expect(
          await prisma.runWithTenantScope(otherTenantId, () =>
            prisma.mobilePushToken.count({ where: { userId: otherId } }),
          ),
        ).toBe(1);
        expect(
          (
            await prisma.runWithTenantScope(otherTenantId, () =>
              prisma.user.findUniqueOrThrow({ where: { id: otherId } }),
            )
          ).passwordHash,
        ).toBe(originalHash);
        await expect(login(adminEmail)).resolves.toHaveProperty('accessToken');
      },
    );

    it('force logout invalidates sessions, challenges and push destinations but allows a fresh sign-in', async () => {
      const session = await login();
      for (const purpose of Object.values(OtpPurpose))
        await pendingCode(purpose);
      await force();
      expect((await target()).authVersion).toBe(1);
      expect((await target()).passwordHash).toBe(originalHash);
      expect(
        await prisma.otpCode.count({
          where: { userId: targetId, usedAt: null },
        }),
      ).toBe(0);
      expect(
        await scoped(() =>
          prisma.mobilePushToken.count({ where: { userId: targetId } }),
        ),
      ).toBe(0);
      await expect(authorize(session.accessToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        authorize((await login()).accessToken),
      ).resolves.toMatchObject({ userId: targetId });
    });

    it.each(['reset', 'force'] as const)(
      '%s racing with refresh leaves no surviving target session',
      async (operation) => {
        const session = await login();
        const results = await Promise.allSettled([
          rotate(session.refreshToken),
          operation === 'reset' ? reset() : force(),
        ]);
        expect(results[1].status).toBe('fulfilled');
        expect(
          await prisma.refreshToken.count({
            where: { userId: targetId, revokedAt: null },
          }),
        ).toBe(0);
        await expect(authorize(session.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it.each(['reset', 'force'] as const)(
      '%s audit failure rolls back every authentication change',
      async (operation) => {
        const session = await login();
        const otp = await pendingCode();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(operation === 'reset' ? reset() : force()).rejects.toThrow(
          'Synthetic audit failure',
        );
        expect((await target()).authVersion).toBe(0);
        expect((await target()).passwordHash).toBe(originalHash);
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).toBeNull();
        expect(
          await scoped(() =>
            prisma.mobilePushToken.count({ where: { userId: targetId } }),
          ),
        ).toBe(1);
        await expect(authorize(session.accessToken)).resolves.toMatchObject({
          userId: targetId,
        });
      },
    );

    it.each(['reset', 'force'] as const)(
      '%s cannot target another tenant',
      async (operation) => {
        await expect(
          operation === 'reset' ? reset(otherId) : force(otherId),
        ).rejects.toBeInstanceOf(NotFoundException);
        const other = await prisma.runWithTenantScope(otherTenantId, () =>
          prisma.user.findUniqueOrThrow({ where: { id: otherId } }),
        );
        expect(other.authVersion).toBe(0);
        expect(other.passwordHash).toBe(originalHash);
      },
    );

    it('rechecks the live permission instead of trusting actor claims', async () => {
      await scoped(() =>
        prisma.userRole.updateMany({
          where: { userId: adminId },
          data: { revokedAt: new Date() },
        }),
      );
      await expect(reset()).rejects.toBeInstanceOf(ForbiddenException);
      expect((await target()).authVersion).toBe(0);
    });

    it.each([
      'expired',
      'missing',
      'revoked',
      'suspended',
      'locked',
      'support',
    ] as const)('rejects an %s administrator context', async (kind) => {
      if (kind === 'expired')
        await scoped(() =>
          prisma.userRole.updateMany({
            where: { userId: adminId },
            data: { expiresAt: new Date(Date.now() - 1) },
          }),
        );
      if (kind === 'missing') actor.sessionFamilyId = undefined;
      if (kind === 'revoked')
        await prisma.refreshToken.updateMany({
          where: { userId: adminId },
          data: { revokedAt: new Date() },
        });
      if (kind === 'suspended')
        await scoped(() =>
          prisma.user.update({
            where: { id: adminId },
            data: { status: UserStatus.SUSPENDED },
          }),
        );
      if (kind === 'locked')
        await scoped(() =>
          prisma.user.update({
            where: { id: adminId },
            data: { lockedUntil: new Date(Date.now() + 60000) },
          }),
        );
      if (kind === 'support') actor.isSupportOverride = true;
      await expect(reset()).rejects.toThrow();
      expect((await target()).authVersion).toBe(0);
    });

    it('a password verified before force logout cannot mint a session after it commits', async () => {
      interface Completion {
        completeAuthenticatedSession: (...args: unknown[]) => Promise<unknown>;
      }
      const internal = auth as unknown as Completion;
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
          return Reflect.apply(original, auth, args) as Promise<unknown>;
        });
      const pending = login();
      const denied = expect(pending).rejects.toThrow(
        'Credentials changed. Sign in again.',
      );
      await ready;
      try {
        await force();
      } finally {
        release();
        await denied;
      }
      expect(
        await prisma.refreshToken.count({ where: { userId: targetId } }),
      ).toBe(0);
    });

    it('an old OTP challenge cannot borrow a post-revocation code', async () => {
      await scoped(() =>
        prisma.user.update({
          where: { id: targetId },
          data: { authMethod: AuthMethod.OTP },
        }),
      );
      const oldChallenge = await auth.requestOtpLogin({ tenantSlug, email });
      await force();
      const fresh = await auth.requestOtpLogin({ tenantSlug, email });
      const freshCode = delivered.at(-1);
      if (!freshCode) throw new Error('Expected synthetic code delivery');
      await expect(
        auth.verifyOtpLogin(
          { challengeToken: oldChallenge.challengeToken, code: freshCode },
          response(),
          metadata,
        ),
      ).rejects.toThrow('Credentials changed. Sign in again.');
      await expect(
        auth.verifyOtpLogin(
          { challengeToken: fresh.challengeToken, code: freshCode },
          response(),
          metadata,
        ),
      ).resolves.toHaveProperty('accessToken');
    });

    it('simultaneous resets to the same password produce one change and one audit', async () => {
      const results = await Promise.allSettled([reset(), reset()]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect((await target()).authVersion).toBe(1);
      expect(
        await scoped(() =>
          prisma.auditLog.count({
            where: { resourceId: targetId, action: 'reset_password' },
          }),
        ),
      ).toBe(1);
    });

    it('reciprocal force logout is serialized without deadlock and rejects the revoked actor', async () => {
      await scoped(() =>
        prisma.userRole.create({
          data: { tenantId, userId: targetId, roleId: adminRoleId },
        }),
      );
      const secondActor = await authorize((await login()).accessToken);
      const results = await Promise.allSettled([
        force(),
        force(adminId, secondActor),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected?.status !== 'rejected')
        throw new Error('Expected a revoked actor');
      expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
    });

    it('an administrator can revoke their own sessions without a duplicate-lock failure', async () => {
      await expect(force(adminId)).resolves.toEqual({ success: true });
      await expect(reset()).rejects.toThrow('Session has ended');
    });

    it('resetting a suspended target does not reactivate it', async () => {
      await scoped(() =>
        prisma.user.update({
          where: { id: targetId },
          data: { status: UserStatus.SUSPENDED },
        }),
      );
      await reset();
      expect((await target()).status).toBe(UserStatus.SUSPENDED);
      await expect(login(email, newPassword)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rechecks administrator suspension after actually waiting for its PostgreSQL lock', async () => {
      let release!: () => void;
      let arrived!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      const blocker = scoped(() =>
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${adminId} FOR UPDATE`;
          arrived();
          await held;
          await tx.user.update({
            where: { id: adminId },
            data: { status: UserStatus.SUSPENDED },
          });
        }),
      );
      await ready;
      const pending = reset();
      const denied = expect(pending).rejects.toThrow('User is not active');
      try {
        let waiting = false;
        const deadline = Date.now() + 2000;
        while (!waiting && Date.now() < deadline) {
          const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND cardinality(pg_blocking_pids(pid)) > 0
              AND query LIKE '%FROM "User"%' AND query LIKE '%FOR UPDATE%') AS waiting
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
      expect((await target()).authVersion).toBe(0);
    });

    describe('role and account-status governance', () => {
      const suspend = (id = targetId) =>
        users.updateStatus(
          id,
          { status: UserStatus.SUSPENDED, reason: 'Synthetic departure' },
          actor,
        );
      const removeRoles = (id: string) =>
        roles.assignRoles(
          { userId: id, roleIds: [], reason: 'Synthetic transfer' },
          actor,
        );
      async function ownerPair() {
        return scoped(async () => {
          const owner = await prisma.role.create({
            data: { tenantId, name: 'school_config_owner' },
          });
          const second = await prisma.user.create({
            data: {
              tenantId,
              email: 'second-owner@example.invalid',
              status: UserStatus.ACTIVE,
            },
          });
          await prisma.userRole.createMany({
            data: [targetId, second.id].map((userId) => ({
              tenantId,
              roleId: owner.id,
              userId,
            })),
          });
          return second.id;
        });
      }
      async function assertOneWinner(operations: Promise<unknown>[]) {
        const results = await Promise.allSettled(operations);
        expect(
          results.filter((entry) => entry.status === 'fulfilled'),
        ).toHaveLength(1);
        const failed = results.find((entry) => entry.status === 'rejected');
        if (failed?.status !== 'rejected')
          throw new Error('Expected a protected-owner rejection');
        expect(failed.reason).toBeInstanceOf(ForbiddenException);
        expect(
          await scoped(() =>
            prisma.userRole.count({
              where: {
                tenantId,
                revokedAt: null,
                role: { name: 'school_config_owner' },
                user: { status: UserStatus.ACTIVE },
              },
            }),
          ),
        ).toBe(1);
      }

      it('concurrent suspensions preserve the final active owner', async () => {
        const second = await ownerPair();
        await assertOneWinner([suspend(), suspend(second)]);
      });
      it('concurrent role removals preserve the final active owner', async () => {
        const second = await ownerPair();
        await assertOneWinner([removeRoles(targetId), removeRoles(second)]);
      });
      it('mixed role removal and suspension preserve the final active owner', async () => {
        const second = await ownerPair();
        await assertOneWinner([removeRoles(targetId), suspend(second)]);
      });
      it.each(['expired', 'revoked'] as const)(
        'does not count an %s alternate owner',
        async (state) => {
          const second = await ownerPair();
          await scoped(() =>
            prisma.userRole.updateMany({
              where: { userId: second, tenantId },
              data:
                state === 'expired'
                  ? { expiresAt: new Date(Date.now() - 1000) }
                  : { revokedAt: new Date() },
            }),
          );
          await expect(suspend()).rejects.toBeInstanceOf(ForbiddenException);
          await expect(removeRoles(targetId)).rejects.toBeInstanceOf(
            ForbiddenException,
          );
        },
      );
      it('suspension races refresh without leaving usable credentials, and reactivation cannot revive them', async () => {
        const session = await login();
        const otp = await pendingCode();
        const results = await Promise.allSettled([
          suspend(),
          rotate(session.refreshToken),
        ]);
        expect(results[0].status).toBe('fulfilled');
        expect(
          await prisma.refreshToken.count({
            where: { userId: targetId, revokedAt: null },
          }),
        ).toBe(0);
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).not.toBeNull();
        expect(
          await scoped(() =>
            prisma.mobilePushToken.count({ where: { userId: targetId } }),
          ),
        ).toBe(0);
        await users.updateStatus(
          targetId,
          { status: UserStatus.ACTIVE },
          actor,
        );
        expect((await target()).authVersion).toBe(2);
        await expect(authorize(session.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(rotate(session.refreshToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(login()).resolves.toHaveProperty('accessToken');
      });
      it('audit failure rolls suspension and credential revocation back together', async () => {
        const session = await login();
        const otp = await pendingCode();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(suspend()).rejects.toThrow('Synthetic audit failure');
        expect(await target()).toMatchObject({
          status: UserStatus.ACTIVE,
          authVersion: 0,
        });
        expect(
          (await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } }))
            .usedAt,
        ).toBeNull();
        expect(
          await scoped(() =>
            prisma.mobilePushToken.count({ where: { userId: targetId } }),
          ),
        ).toBe(1);
        await expect(authorize(session.accessToken)).resolves.toMatchObject({
          userId: targetId,
        });
      });
      it('audit failure preserves existing role assignments and their unrevoked history', async () => {
        await scoped(() =>
          prisma.userRole.create({
            data: { tenantId, userId: targetId, roleId: adminRoleId },
          }),
        );
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(removeRoles(targetId)).rejects.toThrow(
          'Synthetic audit failure',
        );
        expect(
          await scoped(() =>
            prisma.userRole.count({
              where: { userId: targetId, revokedAt: null },
            }),
          ),
        ).toBe(1);
      });
      it('permission replacement rolls back when its audit fails', async () => {
        const before = await scoped(() =>
          prisma.rolePermission.findMany({
            where: { roleId: adminRoleId },
            orderBy: { permissionId: 'asc' },
          }),
        );
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(
          roles.assignPermissions(adminRoleId, { permissionIds: [] }, actor),
        ).rejects.toThrow('Synthetic audit failure');
        expect(
          await scoped(() =>
            prisma.rolePermission.findMany({
              where: { roleId: adminRoleId },
              orderBy: { permissionId: 'asc' },
            }),
          ),
        ).toEqual(before);
      });
      it('concurrent complete role replacements do not combine grants or duplicate active assignments', async () => {
        const other = await roles.createRole(
          { name: 'synthetic-reader' },
          actor,
        );
        await Promise.all([
          roles.assignRoles(
            { userId: targetId, roleIds: [adminRoleId] },
            actor,
          ),
          roles.assignRoles({ userId: targetId, roleIds: [other.id] }, actor),
        ]);
        const assignments = await scoped(() =>
          prisma.userRole.findMany({ where: { userId: targetId } }),
        );
        expect(assignments.filter((entry) => !entry.revokedAt)).toHaveLength(1);
        expect(assignments.filter((entry) => entry.revokedAt)).toHaveLength(1);
        const selected = assignments.find((entry) => !entry.revokedAt);
        if (!selected) throw new Error('Expected one active assignment');
        await Promise.all(
          [1, 2].map(() =>
            roles.assignRoles(
              { userId: targetId, roleIds: [selected.roleId] },
              actor,
            ),
          ),
        );
        expect(
          await scoped(() =>
            prisma.userRole.count({
              where: { userId: targetId, revokedAt: null },
            }),
          ),
        ).toBe(1);
      });
      it('concurrent same-name role creation returns a conflict, not a partially created duplicate', async () => {
        const results = await Promise.allSettled(
          [1, 2].map(() =>
            roles.createRole({ name: 'synthetic-duplicate' }, actor),
          ),
        );
        expect(
          results.filter((entry) => entry.status === 'fulfilled'),
        ).toHaveLength(1);
        const rejected = results.find((entry) => entry.status === 'rejected');
        if (rejected?.status !== 'rejected')
          throw new Error('Expected role conflict');
        expect(rejected.reason).toMatchObject({ status: 409 });
      });
      it('a reset waiting behind role revocation rechecks committed permissions', async () => {
        let release!: () => void;
        let arrived!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const ready = new Promise<void>((resolve) => {
          arrived = resolve;
        });
        const record = audit.record.bind(audit) as AuditService['record'];
        jest
          .spyOn(audit, 'record')
          .mockImplementation(async (input, client) => {
            if (input.action === 'assign_roles') {
              arrived();
              await held;
            }
            return record(input, client);
          });
        const revocation = removeRoles(adminId);
        await ready;
        const denied = expect(reset()).rejects.toThrow(
          'Insufficient permissions',
        );
        try {
          let waiting = false;
          const deadline = Date.now() + 2000;
          while (!waiting && Date.now() < deadline) {
            const rows = await prisma.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0 AND query LIKE '%FROM "Tenant"%' AND query LIKE '%FOR SHARE%') AS waiting`;
            waiting = rows[0].waiting;
            if (!waiting)
              await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
        } finally {
          release();
          await revocation;
          await denied;
        }
        expect((await target()).authVersion).toBe(0);
      });
      it('role creation rolls back if its audit cannot be recorded', async () => {
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(
          roles.createRole({ name: 'synthetic-audit-rollback' }, actor),
        ).rejects.toThrow('Synthetic audit failure');
        expect(
          await scoped(() =>
            prisma.role.count({
              where: { tenantId, name: 'synthetic-audit-rollback' },
            }),
          ),
        ).toBe(0);
      });

      it('finance permission reconciliation rolls back its complete change set on audit failure', async () => {
        await prisma.permission.createMany({
          data: [...PERMISSION_CATALOG],
          skipDuplicates: true,
        });
        const before = await scoped(() =>
          prisma.rolePermission.findMany({
            where: { roleId: adminRoleId },
            orderBy: { permissionId: 'asc' },
          }),
        );
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic audit failure'));
        await expect(
          roles.reconcileFinancePermissions('Synthetic review', actor),
        ).rejects.toThrow('Synthetic audit failure');
        expect(
          await scoped(() =>
            prisma.rolePermission.findMany({
              where: { roleId: adminRoleId },
              orderBy: { permissionId: 'asc' },
            }),
          ),
        ).toEqual(before);
        await expect(
          roles.reconcileFinancePermissions('Synthetic review', actor),
        ).resolves.toMatchObject({
          status: 'BLOCKED',
          designatedFinanceUserCount: 0,
        });
      });

      it('a suspended Accountant assignment cannot make finance authority appear available', async () => {
        const accountant = await roles.createRole(
          { name: 'accountant' },
          actor,
        );
        await roles.assignRoles(
          { userId: targetId, roleIds: [accountant.id] },
          actor,
        );
        expect(
          (
            await scoped(() =>
              roles.previewFinancePermissionReconciliation(actor),
            )
          ).designatedFinanceUserCount,
        ).toBe(1);
        await suspend();
        await expect(
          scoped(() => roles.previewFinancePermissionReconciliation(actor)),
        ).resolves.toMatchObject({
          status: 'BLOCKED',
          designatedFinanceUserCount: 0,
        });
      });

      it.each([
        'status',
        'roles',
        'permissions',
        'create',
        'reconcile',
        'reset',
      ] as const)(
        'rejects a password-change-required actor in %s service calls',
        async (operation) => {
          await scoped(() =>
            prisma.user.update({
              where: { id: adminId },
              data: { mustChangePassword: true },
            }),
          );
          const execute = {
            status: () => suspend(),
            roles: () => removeRoles(targetId),
            permissions: () =>
              roles.assignPermissions(
                adminRoleId,
                { permissionIds: [] },
                actor,
              ),
            create: () =>
              roles.createRole({ name: 'synthetic-forbidden' }, actor),
            reconcile: () =>
              roles.reconcileFinancePermissions('Synthetic review', actor),
            reset: () => reset(),
          };
          await expect(execute[operation]()).rejects.toThrow(
            'Password change required',
          );
        },
      );
      it('HTTP status changes require real permissions and reject cross-tenant and forged fields', async () => {
        const patch = (id: string, token = adminAccess) =>
          request(httpApp.getHttpServer() as Server)
            .patch(`/users/${id}/status`)
            .set('Authorization', `Bearer ${token}`)
            .set('User-Agent', metadata.userAgent);
        const session = await login();
        await patch(targetId, session.accessToken)
          .send({ status: 'SUSPENDED' })
          .expect(403);
        await patch(otherId).send({ status: 'SUSPENDED' }).expect(404);
        await patch(targetId)
          .send({ status: 'SUSPENDED', authVersion: 0 })
          .expect(400);
        const result = await patch(targetId)
          .send({ status: 'SUSPENDED' })
          .expect(200);
        expect(result.body).toMatchObject({
          id: targetId,
          status: 'SUSPENDED',
        });
        expect(result.body).not.toHaveProperty('authVersion');
        await expect(authorize(session.accessToken)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });
      it('HTTP role assignment ignores client claims and confines assignment to the authenticated tenant', async () => {
        const post = (token = adminAccess) =>
          request(httpApp.getHttpServer() as Server)
            .post('/roles/assign')
            .set('Authorization', `Bearer ${token}`)
            .set('User-Agent', metadata.userAgent);
        await post((await login()).accessToken)
          .send({ userId: targetId, roleIds: [adminRoleId] })
          .expect(403);
        await post()
          .send({ userId: otherId, roleIds: [adminRoleId] })
          .expect(404);
        await post()
          .send({
            userId: targetId,
            roleIds: [adminRoleId],
            tenantId: otherTenantId,
          })
          .expect(400);
        await post()
          .send({ userId: targetId, roleIds: [adminRoleId] })
          .expect(201);
      });
    });

    it('the additive migration preserves old credential data and defaults old and new accounts to zero', async () => {
      const migration = readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20260907144000_auth_version_fence/migration.sql',
        ),
        'utf8',
      );
      // A connection-local temporary User table shadows the real table only in
      // this transaction. The actual migration is applied, never duplicated here.
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.$executeRaw`CREATE TEMP TABLE "User" ("id" TEXT PRIMARY KEY, "passwordHash" TEXT) ON COMMIT DROP`;
        await tx.$executeRaw`INSERT INTO "User" ("id", "passwordHash") VALUES ('old', 'synthetic-preserved-hash')`;
        await tx.$executeRawUnsafe(migration);
        await tx.$executeRaw`INSERT INTO "User" ("id", "passwordHash") VALUES ('new', 'synthetic-new-hash')`;
        expect(
          await tx.$queryRaw`SELECT "id", "passwordHash", "authVersion" FROM "User" ORDER BY "id"`,
        ).toEqual([
          { id: 'new', passwordHash: 'synthetic-new-hash', authVersion: 0 },
          {
            id: 'old',
            passwordHash: 'synthetic-preserved-hash',
            authVersion: 0,
          },
        ]);
      });
      expect((await target()).authVersion).toBe(0);
    });
  },
);
