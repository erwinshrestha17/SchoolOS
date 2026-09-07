import {
  AuthMethod,
  OtpPurpose,
  UserStatus,
  type Prisma,
  type SecurityDomain,
  type Tenant,
  type User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isPlatformRoleName } from '@schoolos/core';
import * as bcrypt from 'bcrypt';
import type { CookieOptions, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthContext,
  JwtAccessPayload,
  JwtChallengePayload,
} from './auth.types';
import {
  generateOtpCode,
  generateRefreshToken,
  hashOtpCode,
  hashToken,
  hmacToken,
  generateCsrfToken,
  parseCookie,
} from './auth.utils';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmMfaSetupDto } from './dto/confirm-mfa-setup.dto';
import { ConfirmPasswordRecoveryDto } from './dto/confirm-password-recovery.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RequestOtpLoginDto } from './dto/request-otp-login.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { VerifyOtpLoginDto } from './dto/verify-otp-login.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { assertPasswordsMatch, assertStrongPassword } from './password-policy';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async login(dto: LoginDto, response: Response, requestMeta?: RequestMeta) {
    const { tenant, user } = await this.resolveTenantAndUser(
      dto.tenantSlug,
      dto.email,
    );

    if (user.authMethod === AuthMethod.OTP) {
      throw new UnauthorizedException(
        'This account uses OTP-only login. Request an OTP login challenge first.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.recordFailedPasswordLogin(user, requestMeta);
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    if (user.authMethod === AuthMethod.BOTH) {
      const challenge = await this.issueOtpChallenge({
        user,
        tenant,
        purpose: OtpPurpose.LOGIN,
        ttlMinutes: this.configService.otpTtlMinutes,
        emailPurpose: 'login',
      });

      await this.auditService.record({
        action: 'login_challenge',
        resource: 'auth',
        tenantId: user.tenantId,
        userId: user.id,
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
        requestId: requestMeta?.requestId,
      });

      return {
        requiresMfa: true,
        challengeToken: challenge.challengeToken,
        challengeExpiresAt: challenge.expiresAt,
        delivery: 'email_otp',
      };
    }

    return this.completeAuthenticatedSession(
      user,
      tenant,
      response,
      requestMeta,
      {
        action: 'login',
      },
    );
  }

  async requestOtpLogin(dto: RequestOtpLoginDto) {
    const { tenant, user } = await this.resolveTenantAndUser(
      dto.tenantSlug,
      dto.email,
    );

    if (user.authMethod !== AuthMethod.OTP) {
      throw new UnauthorizedException(
        'This account does not support OTP-only login',
      );
    }

    const challenge = await this.issueOtpChallenge({
      user,
      tenant,
      purpose: OtpPurpose.LOGIN,
      ttlMinutes: this.configService.otpTtlMinutes,
      emailPurpose: 'login',
    });

    await this.auditService.record({
      action: 'otp_login_request',
      resource: 'auth',
      tenantId: user.tenantId,
      userId: user.id,
    });

    return {
      challengeToken: challenge.challengeToken,
      challengeExpiresAt: challenge.expiresAt,
      delivery: 'email_otp',
    };
  }

  async verifyOtpLogin(
    dto: VerifyOtpLoginDto,
    response: Response,
    requestMeta?: RequestMeta,
  ) {
    const challenge = await this.verifyChallengeToken(
      dto.challengeToken,
      OtpPurpose.LOGIN,
    );
    const { tenant, user } = await this.resolveTenantAndUserById(
      challenge.tenantId,
      challenge.sub,
    );

    return this.completeAuthenticatedSession(
      user,
      tenant,
      response,
      requestMeta,
      {
        action: user.authMethod === AuthMethod.BOTH ? 'login_mfa' : 'login_otp',
        otpCode: dto.code,
      },
    );
  }

  async requestPasswordRecovery(dto: RequestPasswordRecoveryDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant?.isActive) {
      return { success: true };
    }

    const user = await this.preAuth(() =>
      this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: dto.email,
          },
        },
      }),
    );

    if (
      user?.status !== UserStatus.ACTIVE ||
      !user.email ||
      user.authMethod === AuthMethod.OTP
    ) {
      return { success: true };
    }

    const resetUrl = `${this.configService.passwordResetAppUrl.replace(/\/$/, '')}?tenantSlug=${encodeURIComponent(dto.tenantSlug)}&email=${encodeURIComponent(dto.email)}`;

    await this.issueOtpEmail({
      user,
      tenant,
      purpose: OtpPurpose.RESET,
      ttlMinutes: this.configService.passwordResetTtlMinutes,
      emailPurpose: 'password_recovery',
      resetUrl,
    });

    await this.auditService.record({
      action: 'password_recovery_request',
      resource: 'auth',
      tenantId: user.tenantId,
      userId: user.id,
    });

    return { success: true };
  }

  async confirmPasswordRecovery(dto: ConfirmPasswordRecoveryDto) {
    assertPasswordsMatch(dto.newPassword, dto.confirmNewPassword);
    const { tenant, user } = await this.resolveTenantAndUser(
      dto.tenantSlug,
      dto.email,
    );

    await this.withAuthUserTransaction(
      tenant.id,
      user.id,
      async (tx, currentUser) => {
        if (
          !currentUser.passwordHash ||
          currentUser.authMethod === AuthMethod.OTP ||
          currentUser.email !== dto.email
        ) {
          throw new UnauthorizedException('Invalid recovery code');
        }

        // A rejected password or a failed revocation/audit must roll back code
        // consumption too. The same code can then be corrected and retried.
        await this.consumeOtpCode(
          user.id,
          OtpPurpose.RESET,
          dto.code,
          'Your reset link is invalid or expired.',
          tx,
        );
        if (await bcrypt.compare(dto.newPassword, currentUser.passwordHash)) {
          throw new BadRequestException(
            'New password cannot be the same as current password.',
          );
        }
        assertStrongPassword(
          dto.newPassword,
          await this.getPasswordIdentityHints(user.id, currentUser.email, tx),
        );
        const recoveredPasswordHash = await bcrypt.hash(
          dto.newPassword,
          this.configService.bcryptRounds,
        );
        await tx.user.update({
          where: { id: user.id, tenantId: tenant.id },
          data: {
            passwordHash: recoveredPasswordHash,
            mustChangePassword: false,
          },
        });
        await this.revokeUserSessions(
          user.id,
          { reason: 'password_recovery' },
          tx,
        );
        // Outstanding login/MFA challenges and registered push destinations from
        // before recovery must not survive the credential reset.
        await tx.otpCode.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.mobilePushToken.deleteMany({
          where: { tenantId: tenant.id, userId: user.id },
        });
        await this.auditService.record(
          {
            action: 'password_recovery_complete',
            resource: 'auth',
            tenantId: tenant.id,
            userId: user.id,
          },
          tx,
        );
      },
    );

    return { success: true };
  }

  async verifyPassword(auth: AuthContext, dto: VerifyPasswordDto) {
    const { tenant, user } = await this.resolveTenantAndUserById(
      auth.tenantId,
      auth.userId,
    );

    if (!user.passwordHash) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new BadRequestException('Current password is incorrect.');
    }

    await this.auditService.record({
      action: 'verify_password',
      resource: 'auth',
      tenantId: tenant.id,
      userId: user.id,
    });

    return { success: true, message: 'Password verified.' };
  }

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    assertPasswordsMatch(dto.newPassword, dto.confirmNewPassword);
    const logoutOtherDevices = dto.logoutOtherDevices ?? true;
    await this.withAuthUserTransaction(
      auth.tenantId,
      auth.userId,
      async (tx, user) => {
        const current = await this.resolveCurrentSession(
          auth,
          cookieHeader,
          undefined,
          tx,
        );
        if (auth.sessionFamilyId && !current)
          throw new UnauthorizedException('Session has ended');
        if (
          !user.passwordHash ||
          !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
        ) {
          throw new BadRequestException('Current password is incorrect.');
        }
        if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
          throw new BadRequestException(
            'New password cannot be the same as current password.',
          );
        }
        assertStrongPassword(
          dto.newPassword,
          await this.getPasswordIdentityHints(user.id, user.email, tx),
        );
        await tx.user.update({
          where: { id: user.id, tenantId: user.tenantId },
          data: {
            passwordHash: await bcrypt.hash(
              dto.newPassword,
              this.configService.bcryptRounds,
            ),
            mustChangePassword: false,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
        // Do not leave a pre-change recovery/login challenge as a credential bypass.
        await tx.otpCode.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (logoutOtherDevices)
          await this.revokeUserSessions(
            user.id,
            {
              exceptRefreshTokenId: current?.id,
              reason: 'password_change',
            },
            tx,
          );
        await this.auditService.record(
          {
            action: 'change_password',
            resource: 'auth',
            tenantId: user.tenantId,
            userId: user.id,
            after: {
              logoutOtherDevices,
              otherSessionsRevoked: logoutOtherDevices,
            },
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
            requestId: requestMeta?.requestId,
          },
          tx,
        );
      },
    );
    this.clearAccessCookie(response);
    return {
      success: true,
      message: logoutOtherDevices
        ? 'Password changed successfully. For your security, other sessions have been signed out.'
        : 'Password changed successfully.',
    };
  }

  async requestMfaSetup(auth: AuthContext) {
    const { tenant, user } = await this.resolveTenantAndUserById(
      auth.tenantId,
      auth.userId,
    );

    if (!user.email) {
      throw new BadRequestException(
        'An email address is required to configure MFA',
      );
    }

    await this.issueOtpEmail({
      user,
      tenant,
      purpose: OtpPurpose.VERIFY,
      ttlMinutes: this.configService.otpTtlMinutes,
      emailPurpose: 'mfa_setup',
    });

    await this.auditService.record({
      action: 'mfa_setup_request',
      resource: 'auth',
      tenantId: tenant.id,
      userId: user.id,
    });

    return { success: true };
  }

  async confirmMfaSetup(auth: AuthContext, dto: ConfirmMfaSetupDto) {
    if (
      ![AuthMethod.PASSWORD, AuthMethod.BOTH, AuthMethod.OTP].includes(
        dto.authMethod,
      )
    ) {
      throw new BadRequestException('Invalid auth method');
    }

    await this.withAuthUserTransaction(
      auth.tenantId,
      auth.userId,
      async (tx, user) => {
        if (
          auth.sessionFamilyId &&
          !(await this.resolveCurrentSession(auth, undefined, undefined, tx))
        ) {
          throw new UnauthorizedException('Session has ended');
        }
        await this.consumeOtpCode(
          user.id,
          OtpPurpose.VERIFY,
          dto.code,
          undefined,
          tx,
        );
        await tx.user.update({
          where: { id: user.id, tenantId: user.tenantId },
          data: { authMethod: dto.authMethod },
        });
        await this.revokeUserSessions(user.id, { reason: 'mfa_change' }, tx);
        await tx.otpCode.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await this.auditService.record(
          {
            action: 'mfa_setup_confirm',
            resource: 'auth',
            tenantId: user.tenantId,
            userId: user.id,
            before: { authMethod: user.authMethod },
            after: { authMethod: dto.authMethod },
          },
          tx,
        );
      },
    );
    return { authMethod: dto.authMethod, success: true };
  }

  async refresh(
    dto: RefreshSessionDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    const rawToken =
      dto.refreshToken ??
      parseCookie(cookieHeader, this.getRefreshCookieName());
    if (!rawToken) throw new UnauthorizedException('Refresh token is required');
    const existingSession = await this.prisma.refreshToken.findFirst({
      where: {
        OR: [
          {
            tokenHash: hmacToken(rawToken, this.configService.tokenHashPepper),
            hashVersion: 2,
          },
          { tokenHash: hashToken(rawToken), hashVersion: 1 },
        ],
      },
      include: { user: { include: this.userAuthInclude } },
    });
    if (!existingSession)
      throw new UnauthorizedException('Refresh token is invalid');

    const result = await this.withAuthUserTransaction(
      existingSession.user.tenantId,
      existingSession.userId,
      async (tx, user) => {
        const current = await tx.refreshToken.findFirst({
          where: { id: existingSession.id, userId: user.id },
        });
        if (!current) return { invalid: true as const };
        if (current.revokedAt) {
          const familyId = current.familyId ?? current.id;
          await this.revokeRefreshTokenFamily(familyId, user.id, tx);
          await this.auditService.record(
            {
              action: 'suspicious_refresh_token_reuse',
              resource: 'auth',
              tenantId: user.tenantId,
              userId: user.id,
              ipAddress: requestMeta?.ipAddress,
              userAgent: requestMeta?.userAgent,
              requestId: requestMeta?.requestId,
              after: {
                tokenId: current.id,
                familyId,
                revokedAt: current.revokedAt.toISOString(),
              },
            },
            tx,
          );
          // Return, don't throw here: the family revocation must commit.
          return { invalid: true as const };
        }
        if (current.expiresAt.getTime() <= Date.now())
          return { invalid: true as const };
        const tenant = await tx.tenant.findUnique({
          where: { id: user.tenantId },
        });
        if (!tenant?.isActive)
          throw new UnauthorizedException('Tenant is not active');
        const authContext = this.buildAuthContext(
          user,
          tenant.slug,
          tenant.securityDomain,
        );
        const claimed = await tx.refreshToken.updateMany({
          where: {
            id: current.id,
            userId: user.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date(), revokedReason: 'rotated' },
        });
        if (claimed.count !== 1) return { invalid: true as const };
        const session = await this.issueSession(
          authContext,
          requestMeta,
          { id: current.id, familyId: current.familyId ?? current.id },
          tx,
        );
        await tx.refreshToken.update({
          where: { id: current.id, userId: user.id },
          data: { replacedByTokenId: session.id },
        });
        await this.auditService.record(
          {
            action: 'refresh',
            resource: 'auth',
            tenantId: user.tenantId,
            userId: user.id,
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
            requestId: requestMeta?.requestId,
          },
          tx,
        );
        return {
          invalid: false as const,
          session,
          authContext,
          tenant,
          guardianName: user.guardian?.fullName,
        };
      },
    );
    if (result.invalid)
      throw new UnauthorizedException('Refresh token is invalid');
    const { session, authContext, tenant } = result;
    this.attachRefreshCookie(response, session.refreshToken);
    this.attachAccessCookie(response, session.accessToken);
    this.attachCsrfCookie(
      response,
      generateCsrfToken(this.configService.jwtSecret),
    );
    const userAgent = requestMeta?.userAgent?.toLowerCase();
    const isMobile = userAgent
      ? userAgent.includes('dart') || userAgent.includes('flutter')
      : undefined;
    return this.buildAuthSession(
      session.accessToken,
      authContext,
      tenant,
      session.refreshToken,
      isMobile,
      result.guardianName,
    );
  }

  async logout(
    dto: RefreshSessionDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    try {
      const rawToken =
        dto.refreshToken ??
        parseCookie(cookieHeader, this.getRefreshCookieName());
      const session = rawToken
        ? await this.prisma.refreshToken.findFirst({
            where: {
              OR: [
                {
                  tokenHash: hmacToken(
                    rawToken,
                    this.configService.tokenHashPepper,
                  ),
                  hashVersion: 2,
                },
                { tokenHash: hashToken(rawToken), hashVersion: 1 },
              ],
            },
            include: { user: true },
          })
        : null;
      if (session?.user) {
        await this.withAuthUserTransaction(
          session.user.tenantId,
          session.userId,
          async (tx) => {
            // A cookie can carry the predecessor during an in-flight rotation.
            // End the family, not just the particular refresh-token row.
            await this.revokeRefreshTokenFamily(
              session.familyId ?? session.id,
              session.userId,
              tx,
              'logout',
            );
            const removed = dto.installationId
              ? await tx.mobilePushToken.deleteMany({
                  where: {
                    tenantId: session.user.tenantId,
                    userId: session.userId,
                    installationId: dto.installationId,
                  },
                })
              : null;
            await this.auditService.record(
              {
                action: 'logout',
                resource: 'auth',
                tenantId: session.user.tenantId,
                userId: session.userId,
                ipAddress: requestMeta?.ipAddress,
                userAgent: requestMeta?.userAgent,
                requestId: requestMeta?.requestId,
                ...(dto.installationId
                  ? {
                      after: {
                        installationId: dto.installationId,
                        pushTokenRevoked: (removed?.count ?? 0) > 0,
                      },
                    }
                  : {}),
              },
              tx,
            );
          },
          true,
        );
      }
      return { success: true };
    } finally {
      this.clearRefreshCookie(response);
      this.clearAccessCookie(response);
    }
  }

  async listSessions(auth: AuthContext) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return { items: sessions };
  }

  async revokeSession(sessionId: string, auth: AuthContext) {
    await this.withAuthUserTransaction(
      auth.tenantId,
      auth.userId,
      async (tx) => {
        if (
          auth.sessionFamilyId &&
          !(await this.resolveCurrentSession(auth, undefined, undefined, tx))
        ) {
          throw new UnauthorizedException('Session has ended');
        }
        const selected = await tx.refreshToken.findFirst({
          where: { id: sessionId, userId: auth.userId },
        });
        if (!selected)
          throw new NotFoundException('Active session was not found');
        const familyId = selected.familyId ?? selected.id;
        const result = await this.revokeRefreshTokenFamily(
          familyId,
          auth.userId,
          tx,
          'user_revoked_session',
        );
        if (result.count === 0)
          throw new NotFoundException('Active session was not found');
        await this.auditService.record(
          {
            action: 'revoke_session',
            resource: 'auth',
            tenantId: auth.tenantId,
            userId: auth.userId,
            resourceId: sessionId,
          },
          tx,
        );
      },
    );
    return { success: true as const };
  }

  async revokeOtherSessions(
    auth: AuthContext,
    dto: { refreshToken?: string },
    cookieHeader?: string,
  ) {
    await this.withAuthUserTransaction(
      auth.tenantId,
      auth.userId,
      async (tx) => {
        const current = await this.resolveCurrentSession(
          auth,
          cookieHeader,
          dto.refreshToken,
          tx,
        );
        if (!current)
          throw new BadRequestException(
            'Your current session could not be identified. Sign in again and retry.',
          );
        await this.revokeUserSessions(
          auth.userId,
          {
            exceptRefreshTokenId: current.id,
            reason: 'user_revoked_other_sessions',
          },
          tx,
        );
        await this.auditService.record(
          {
            action: 'revoke_other_sessions',
            resource: 'auth',
            tenantId: auth.tenantId,
            userId: auth.userId,
            after: { keptSessionId: current.id },
          },
          tx,
        );
      },
    );
    return { success: true as const };
  }

  async getProfile(auth: AuthContext) {
    const homeTenantId = auth.isSupportOverride
      ? (auth.originalTenantId ?? auth.tenantId)
      : auth.tenantId;

    const user = await this.prisma.runWithoutTenantScope(
      'authentication: read home identity while presenting an effective support tenant',
      () =>
        this.prisma.user.findFirst({
          where: { id: auth.userId, tenantId: homeTenantId },
          include: {
            tenant: true,
            staff: true,
            // Guardians had no profile block at all, so a parent account resolved
            // to a nameless `user` and every client fell back to the email local
            // part - the mobile app greeted guardians as "guardian.c01a001".
            // Selected, not `true`: a guardian row also carries phone numbers and
            // a home address, none of which a session profile needs.
            guardian: {
              select: { id: true, fullName: true, relation: true },
            },
            student: {
              include: {
                class: true,
              },
            },
            userRoles: {
              where: auth.isSupportOverride
                ? { tenantId: homeTenantId }
                : undefined,
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
    );

    if (!user || user.tenantId !== homeTenantId) {
      throw new NotFoundException('Authenticated user was not found');
    }

    const effectiveTenant = auth.isSupportOverride
      ? await this.prisma.tenant.findUnique({
          where: { id: auth.tenantId },
        })
      : user.tenant;

    if (!effectiveTenant) {
      throw new NotFoundException('Authenticated tenant was not found');
    }

    const currentAuth = this.buildAuthContext(
      user,
      user.tenant.slug,
      user.tenant.securityDomain,
    );

    return {
      ...currentAuth,
      tenantId: auth.tenantId,
      originalTenantId: auth.originalTenantId,
      isSupportOverride: auth.isSupportOverride,
      supportOverrideScopes: auth.supportOverrideScopes,
      supportOverrideReadOnly: auth.supportOverrideReadOnly,
      securityDomain: auth.securityDomain,
      roles: auth.isSupportOverride ? auth.roles : currentAuth.roles,
      permissions: auth.isSupportOverride
        ? auth.permissions
        : currentAuth.permissions,
      tenantSlug: effectiveTenant.slug,
      tenant: {
        id: effectiveTenant.id,
        name: effectiveTenant.name,
        slug: effectiveTenant.slug,
        plan: effectiveTenant.plan,
      },
      profileType: user.staff ? 'staff' : user.student ? 'student' : 'user',
      staff: user.staff
        ? {
            id: user.staff.id,
            employeeId: user.staff.employeeId,
            firstName: user.staff.firstName,
            lastName: user.staff.lastName,
          }
        : null,
      student: user.student
        ? {
            id: user.student.id,
            studentSystemId: user.student.studentSystemId,
            firstNameEn: user.student.firstNameEn,
            lastNameEn: user.student.lastNameEn,
            class: {
              id: user.student.class.id,
              name: user.student.class.name,
            },
          }
        : null,
      // Additive: existing clients that do not read it are unaffected, and
      // `profileType` keeps its current values so nothing switching on it
      // changes behaviour.
      guardian: user.guardian
        ? {
            id: user.guardian.id,
            fullName: user.guardian.fullName,
            relation: user.guardian.relation,
          }
        : null,
    };
  }

  private async completeAuthenticatedSession(
    user: UserWithRoles,
    tenant: Tenant,
    response: Response,
    requestMeta?: RequestMeta,
    audit?: { action: string; otpCode?: string },
  ) {
    const { authContext, session } = await this.withAuthUserTransaction(
      tenant.id,
      user.id,
      async (tx, currentUser) => {
        if (
          currentUser.passwordHash !== user.passwordHash ||
          currentUser.authMethod !== user.authMethod ||
          currentUser.email !== user.email
        ) {
          throw new UnauthorizedException(
            'Credentials changed. Sign in again.',
          );
        }
        if (audit?.otpCode !== undefined) {
          await this.consumeOtpCode(
            user.id,
            OtpPurpose.LOGIN,
            audit.otpCode,
            undefined,
            tx,
          );
        }
        await tx.user.update({
          where: { id: user.id, tenantId: tenant.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
        const authContext = this.buildAuthContext(
          currentUser,
          tenant.slug,
          tenant.securityDomain,
        );
        const session = await this.issueSession(
          authContext,
          requestMeta,
          undefined,
          tx,
        );
        await this.auditService.record(
          {
            action: audit?.action ?? 'login',
            resource: 'auth',
            tenantId: tenant.id,
            userId: user.id,
            after: {
              email: authContext.email,
              authMethod: authContext.authMethod,
            },
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
            requestId: requestMeta?.requestId,
          },
          tx,
        );
        return { authContext, session };
      },
    );
    this.attachRefreshCookie(response, session.refreshToken);
    this.attachAccessCookie(response, session.accessToken);
    this.attachCsrfCookie(
      response,
      generateCsrfToken(this.configService.jwtSecret),
    );

    const userAgent = requestMeta?.userAgent?.toLowerCase();
    const isMobile = userAgent
      ? userAgent.includes('dart') || userAgent.includes('flutter')
      : undefined;

    return this.buildAuthSession(
      session.accessToken,
      authContext,
      tenant,
      session.refreshToken,
      isMobile,
      user.guardian?.fullName,
    );
  }

  /**
   * Authentication runs before any tenant context exists -- the tenant is only
   * established once credentials are resolved. `Tenant`, `RefreshToken` and
   * `OtpCode` are already tenant-scope-excluded for exactly this reason; `User`
   * is not, so pre-authentication user access declares the region explicitly
   * instead of depending on an absent tenant context.
   */
  private preAuth<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.runWithoutTenantScope(
      'authentication: user lookup before tenant context is established',
      fn,
    );
  }

  private withAuthUserTransaction<T>(
    tenantId: string,
    userId: string,
    work: (tx: Prisma.TransactionClient, user: UserWithRoles) => Promise<T>,
    allowInactive = false,
  ): Promise<T> {
    return this.prisma.runWithTenantScope(tenantId, () =>
      this.prisma.$transaction(
        async (tx) => {
          // Liveness and the resolved tenant are rechecked after acquiring locks.
          // This does not authorize a caller-supplied tenant or user identifier.
          const tenants = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} AND ("isActive" = true OR ${allowInactive}) FOR SHARE
        `;
          if (tenants.length !== 1)
            throw new UnauthorizedException('Invalid authentication context');
          const users = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "User" WHERE "id" = ${userId} AND "tenantId" = ${tenantId} FOR UPDATE
        `;
          if (users.length !== 1)
            throw new UnauthorizedException('Invalid authentication context');
          const user = await tx.user.findUnique({
            where: { id: userId, tenantId },
            include: this.userAuthInclude,
          });
          if (!user)
            throw new UnauthorizedException('Invalid authentication context');
          if (!allowInactive) this.assertUserIsActive(user);
          return work(tx, user);
        },
        { timeout: 10000 },
      ),
    );
  }

  private async resolveTenantAndUser(tenantSlug: string, email: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant?.isActive) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const user = await this.preAuth(() =>
      this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email,
          },
        },
        include: this.userAuthInclude,
      }),
    );

    if (!user) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    this.assertUserIsActive(user);

    return { tenant, user };
  }

  private async resolveTenantAndUserById(tenantId: string, userId: string) {
    const [tenant, user] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
      }),
      this.preAuth(() =>
        this.prisma.user.findFirst({
          where: {
            id: userId,
            tenantId,
          },
          include: this.userAuthInclude,
        }),
      ),
    ]);

    if (!tenant?.isActive || !user) {
      throw new UnauthorizedException('Invalid authentication context');
    }

    this.assertUserIsActive(user);

    return { tenant, user };
  }

  private assertUserIsActive(user: {
    status: UserStatus;
    lockedUntil?: Date | null;
  }) {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('User is temporarily locked');
    }
  }

  private async recordFailedPasswordLogin(
    user: UserWithRoles,
    requestMeta?: RequestMeta,
  ) {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)
        : null;

    await this.preAuth(() =>
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil,
        },
      }),
    );

    if (lockedUntil) {
      await this.revokeUserSessions(user.id);
    }

    await this.auditService.record({
      action: lockedUntil ? 'login_locked' : 'login_failed',
      resource: 'auth',
      tenantId: user.tenantId,
      userId: user.id,
      after: {
        failedLoginCount,
        lockedUntil,
      },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      requestId: requestMeta?.requestId,
    });
  }

  private async issueOtpChallenge(input: IssueOtpInput) {
    const code = await this.issueOtpEmail(input);
    const challengeToken = await this.jwtService.signAsync<JwtChallengePayload>(
      {
        sub: input.user.id,
        tenantId: input.tenant.id,
        tenantSlug: input.tenant.slug,
        purpose: input.purpose,
      },
      {
        secret: this.configService.challengeSecret,
        expiresIn: this.configService.challengeTokenTtl as never,
      },
    );

    return {
      challengeToken,
      expiresAt: code.expiresAt,
    };
  }

  private async issueOtpEmail(input: IssueOtpInput) {
    if (!input.user.email) {
      throw new BadRequestException(
        'An email address is required for OTP delivery',
      );
    }

    const code = generateOtpCode(this.configService.otpLength);
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000);
    await this.withAuthUserTransaction(
      input.tenant.id,
      input.user.id,
      async (tx, currentUser) => {
        if (
          currentUser.email !== input.user.email ||
          (input.purpose === OtpPurpose.RESET &&
            currentUser.authMethod === AuthMethod.OTP)
        ) {
          throw new UnauthorizedException('Invalid authentication context');
        }
        // Serialize limit checking and replacement with recovery, including when
        // multiple API processes handle simultaneous requests for this account.
        await this.assertOtpIssueAllowed(input.user.id, input.purpose, tx);
        await this.invalidateActiveOtps(input.user.id, input.purpose, tx);
        await tx.otpCode.create({
          data: {
            userId: input.user.id,
            codeHash: hashOtpCode(code),
            purpose: input.purpose,
            expiresAt,
          },
        });
      },
    );

    await this.notificationsService.sendAuthCodeEmail({
      tenantId: input.tenant.id,
      to: input.user.email,
      tenantName: input.tenant.name,
      code,
      purpose: input.emailPurpose,
      resetUrl: input.resetUrl,
    });

    return { code, expiresAt };
  }

  private async verifyChallengeToken(token: string, purpose: OtpPurpose) {
    let payload: JwtChallengePayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtChallengePayload>(token, {
        secret: this.configService.challengeSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }

    if (payload.purpose !== purpose) {
      throw new UnauthorizedException('Invalid challenge token purpose');
    }

    return payload;
  }

  private async consumeOtpCode(
    userId: string,
    purpose: OtpPurpose,
    code: string,
    invalidMessage = 'Invalid or expired verification code',
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const otpCode = await client.otpCode.findFirst({
      where: {
        userId,
        purpose,
        usedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (
      !otpCode ||
      otpCode.codeHash !== hashOtpCode(code) ||
      otpCode.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(invalidMessage);
    }

    // A compare-and-set, not an unconditional update: only one concurrent
    // verifier may win, and expiry/replacement is rechecked at the write.
    const consumed = await client.otpCode.updateMany({
      where: {
        id: otpCode.id,
        userId,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException(invalidMessage);

    return otpCode;
  }

  private async invalidateActiveOtps(
    userId: string,
    purpose: OtpPurpose,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    await client.otpCode.updateMany({
      where: {
        userId,
        purpose,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  private async assertOtpIssueAllowed(
    userId: string,
    purpose: OtpPurpose,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const recentOtpCount = await client.otpCode.count({
      where: {
        userId,
        purpose,
        createdAt: {
          gte: new Date(
            Date.now() - this.configService.otpIssueWindowMinutes * 60 * 1000,
          ),
        },
      },
    });

    if (recentOtpCount >= this.configService.otpIssueLimit) {
      throw new HttpException(
        'Too many verification codes were requested. Please try again later.',
        429,
      );
    }
  }

  private async revokeUserSessions(
    userId: string,
    options: {
      exceptRefreshTokenId?: string | null;
      reason?: string;
    } = {},
    client: Prisma.TransactionClient = this.prisma,
  ) {
    return client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptRefreshTokenId
          ? { id: { not: options.exceptRefreshTokenId } }
          : {}),
      },
      data: {
        revokedAt: new Date(),
        ...(options.reason ? { revokedReason: options.reason } : {}),
      },
    });
  }

  private async resolveCurrentSession(
    auth: AuthContext,
    cookieHeader?: string,
    refreshToken?: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    if (auth.sessionFamilyId) {
      return client.refreshToken.findFirst({
        where: {
          userId: auth.userId,
          familyId: auth.sessionFamilyId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
    }
    const rawToken =
      refreshToken?.trim() ||
      parseCookie(cookieHeader, this.getRefreshCookieName());
    if (!rawToken) {
      return null;
    }

    const session = await client.refreshToken.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          {
            tokenHash: hmacToken(rawToken, this.configService.tokenHashPepper),
            hashVersion: 2,
          },
          { tokenHash: hashToken(rawToken), hashVersion: 1 },
        ],
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return session;
  }

  private async getPasswordIdentityHints(
    userId: string,
    email: string | null,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    // Reached from both the unauthenticated recovery flow and authenticated
    // password change; the bypass only takes effect when no tenant context
    // exists, so the authenticated path stays tenant-scoped.
    const user = await this.preAuth(() =>
      client.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          staff: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          student: {
            select: {
              firstNameEn: true,
              lastNameEn: true,
            },
          },
          guardian: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    );

    return [
      email,
      user?.email,
      user?.staff?.firstName,
      user?.staff?.lastName,
      user?.student?.firstNameEn,
      user?.student?.lastNameEn,
      user?.guardian?.fullName,
    ];
  }

  private get userAuthInclude() {
    return {
      // Only the display name. A guardian row also holds phone numbers and a
      // home address, which a session payload has no business carrying.
      guardian: { select: { fullName: true } },
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }

  private buildAuthContext(
    user: {
      id: string;
      tenantId: string;
      email: string | null;
      authMethod: AuthMethod;
      mustChangePassword: boolean;
      userRoles: Array<{
        tenantId: string;
        scopeId: string | null;
        expiresAt: Date | null;
        revokedAt: Date | null;
        role: {
          tenantId: string;
          name: string;
          rolePermissions: Array<{
            permission: {
              resource: string;
              action: string;
            };
          }>;
        };
      }>;
    },
    tenantSlug: string,
    securityDomain: SecurityDomain,
  ): AuthContext {
    const now = Date.now();
    const eligibleAssignments = user.userRoles.filter(
      ({ tenantId, role, scopeId, expiresAt, revokedAt }) =>
        tenantId === user.tenantId &&
        role.tenantId === user.tenantId &&
        !revokedAt &&
        (!expiresAt || expiresAt.getTime() > now) &&
        (securityDomain === 'PLATFORM'
          ? isPlatformRoleName(role.name) && scopeId === 'global'
          : !isPlatformRoleName(role.name)),
    );
    const roles = Array.from(
      new Set(eligibleAssignments.map(({ role }) => role.name)),
    );
    const permissions = Array.from(
      new Set(
        eligibleAssignments.flatMap(({ role }) =>
          role.rolePermissions.map(
            ({ permission }) => `${permission.resource}:${permission.action}`,
          ),
        ),
      ),
    );

    return {
      userId: user.id,
      tenantId: user.tenantId,
      tenantSlug,
      securityDomain,
      email: user.email,
      authMethod: user.authMethod,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
    };
  }

  private async issueSession(
    authContext: AuthContext,
    requestMeta?: RequestMeta,
    parentSession?: { id: string; familyId: string | null },
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const userAgent = requestMeta?.userAgent?.toLowerCase();
    const isMobile = ['dart', 'flutter'].some(
      (pattern) => userAgent?.includes(pattern) ?? false,
    );
    const audience = isMobile
      ? this.configService.jwtAudienceMobile
      : this.configService.jwtAudienceWeb;

    const tokenId = randomUUID();
    const familyId = parentSession?.familyId ?? tokenId;
    const payload: JwtAccessPayload = {
      sub: authContext.userId,
      sid: familyId,
      tenantId: authContext.tenantId,
      tenantSlug: authContext.tenantSlug,
      securityDomain: authContext.securityDomain,
      email: authContext.email,
      authMethod: authContext.authMethod,
      mustChangePassword: authContext.mustChangePassword ?? false,
      roles: authContext.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.accessTokenTtl as never,
      issuer: this.configService.jwtIssuer,
      audience,
      algorithm: 'HS256',
      jwtid: randomUUID(),
    });
    const refreshToken = generateRefreshToken();
    const tokenHash = hmacToken(
      refreshToken,
      this.configService.tokenHashPepper,
    );

    await client.refreshToken.create({
      data: {
        id: tokenId,
        userId: authContext.userId,
        tokenHash,
        hashVersion: 2,
        expiresAt: this.getRefreshTokenExpiry(),
        familyId,
        parentTokenId: parentSession?.id ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        ipAddress: requestMeta?.ipAddress ?? null,
        lastUsedAt: new Date(),
      },
    });

    return { accessToken, refreshToken, id: tokenId };
  }

  private buildAuthSession(
    accessToken: string,
    authContext: AuthContext,
    tenant: Tenant,
    refreshToken?: string,
    isMobile?: boolean,
    displayName?: string | null,
  ) {
    const decoded: unknown =
      typeof this.jwtService.decode === 'function'
        ? (this.jwtService.decode(accessToken) ?? null)
        : null;
    const decodedExp =
      decoded && typeof decoded === 'object' && 'exp' in decoded
        ? (decoded as { exp?: unknown }).exp
        : undefined;

    const hideTokens = isMobile === false;

    return {
      accessToken: hideTokens ? undefined : accessToken,
      refreshToken: hideTokens ? undefined : refreshToken,
      accessTokenExpiresAt:
        typeof decodedExp === 'number'
          ? new Date(decodedExp * 1000).toISOString()
          : null,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        mode: tenant.mode,
        isActive: tenant.isActive,
      },
      user: {
        id: authContext.userId,
        tenantId: authContext.tenantId,
        originalTenantId: authContext.originalTenantId,
        isSupportOverride: authContext.isSupportOverride,
        supportOverrideScopes: authContext.supportOverrideScopes,
        supportOverrideReadOnly: authContext.supportOverrideReadOnly,
        securityDomain: authContext.securityDomain,
        tenantSlug: authContext.tenantSlug,
        email: authContext.email,
        authMethod: authContext.authMethod,
        mustChangePassword: authContext.mustChangePassword ?? false,
        roles: authContext.roles,
        permissions: authContext.permissions,
        // Guardian accounts carry no name on the user row, so without this
        // the login response has nothing for a client to greet them by and
        // the mobile app fell back to the email local part
        // ("guardian.c01a004"). Absent for every other role, and additive:
        // clients that ignore it are unaffected.
        ...(displayName ? { name: displayName } : {}),
      },
    };
  }

  private getAccessCookieName() {
    return this.configService.isProduction
      ? `__Host-${this.configService.accessCookieName}`
      : this.configService.accessCookieName;
  }

  private getRefreshCookieName() {
    return this.configService.isProduction
      ? `__Host-${this.configService.refreshCookieName}`
      : this.configService.refreshCookieName;
  }

  private attachRefreshCookie(response: Response, refreshToken: string) {
    const cookieName = this.getRefreshCookieName();
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
    };
    if (!this.configService.isProduction) {
      options.domain = this.configService.cookieDomain;
    }
    response.cookie(cookieName, refreshToken, {
      ...options,
      maxAge: this.configService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private attachAccessCookie(response: Response, accessToken: string) {
    const cookieName = this.getAccessCookieName();
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
    };
    if (!this.configService.isProduction) {
      options.domain = this.configService.cookieDomain;
    }
    response.cookie(cookieName, accessToken, {
      ...options,
      maxAge: resolveAccessTokenMaxAge(this.configService.accessTokenTtl),
    });
  }

  private attachCsrfCookie(response: Response, csrfToken: string) {
    const cookieName = this.configService.isProduction
      ? '__Host-schoolos_csrf'
      : 'schoolos_csrf';

    const options: CookieOptions = {
      httpOnly: false, // Must be readable by Javascript/Next.js client!
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
    };
    if (!this.configService.isProduction) {
      options.domain = this.configService.cookieDomain;
    }
    response.cookie(cookieName, csrfToken, options);
  }

  private clearRefreshCookie(response: Response) {
    const cookieName = this.getRefreshCookieName();
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
    };
    if (!this.configService.isProduction) {
      options.domain = this.configService.cookieDomain;
    }
    response.clearCookie(cookieName, options);
  }

  private clearAccessCookie(response: Response) {
    const cookieName = this.getAccessCookieName();
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
    };
    if (!this.configService.isProduction) {
      options.domain = this.configService.cookieDomain;
    }
    response.clearCookie(cookieName, options);
  }

  private async revokeRefreshTokenFamily(
    familyId: string,
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
    reason = 'family_theft',
  ) {
    return client.refreshToken.updateMany({
      where: {
        userId,
        OR: [{ familyId }, { id: familyId }],
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  private getRefreshTokenExpiry() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.configService.refreshTokenTtlDays);
    return expiry;
  }
}

function resolveAccessTokenMaxAge(ttl: string) {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());

  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

  return value * multiplier;
}

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

type UserWithRoles = User & {
  guardian: {
    fullName: string;
  } | null;
  userRoles: Array<{
    tenantId: string;
    scopeId: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    role: {
      tenantId: string;
      name: string;
      rolePermissions: Array<{
        permission: {
          resource: string;
          action: string;
        };
      }>;
    };
  }>;
};

interface IssueOtpInput {
  user: {
    id: string;
    email: string | null;
  };
  tenant: Tenant;
  purpose: OtpPurpose;
  ttlMinutes: number;
  emailPurpose: 'login' | 'password_recovery' | 'mfa_setup';
  resetUrl?: string;
}
