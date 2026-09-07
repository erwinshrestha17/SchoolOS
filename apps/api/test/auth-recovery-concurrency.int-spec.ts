import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { AuthMethod, OtpPurpose, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../src/audit/audit.service';
import { AuthService } from '../src/auth/auth.service';
import { hashOtpCode } from '../src/auth/auth.utils';
import { ConfigService } from '../src/config/config.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

// This suite never inherits DATABASE_URL/.env: use a disposable local database
// named schoolos_auth_recovery_test*. No existing school data is read or seeded.
const databaseUrl = process.env.SCHOOLOS_AUTH_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/schoolos_auth_recovery_test(?:_[a-z0-9]+)?$/.test(target.pathname)
  ) {
    throw new Error(
      'Auth recovery tests require a dedicated loopback test database.',
    );
  }
}

class IsolatedCls {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();
  get(key: string) {
    return this.storage.getStore()?.get(key);
  }
  set(key: string, value: unknown) {
    const store = this.storage.getStore();
    if (!store) throw new Error('Test CLS context missing');
    store.set(key, value);
  }
  isActive() {
    return this.storage.getStore() !== undefined;
  }
  run<T>(fn: () => Promise<T>) {
    return this.storage.run(new Map(this.storage.getStore()), fn);
  }
}

const describeDatabase = databaseUrl ? describe : describe.skip;
describeDatabase(
  'Auth recovery concurrency (real PostgreSQL, isolated fixtures)',
  () => {
    const originalUrl = process.env.DATABASE_URL;
    const cls = new IsolatedCls() as unknown as ClsService;
    let prisma: PrismaService;
    let audit: AuditService;
    let service: AuthService;
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
      service = new AuthService(prisma, new JwtService(), config, audit, {
        sendAuthCodeEmail: (input: { code: string }) => {
          delivered.push(input);
          return Promise.resolve();
        },
      } as unknown as NotificationsService);
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
