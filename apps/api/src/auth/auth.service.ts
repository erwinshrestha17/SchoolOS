import {
  AuthMethod,
  OtpPurpose,
  UserStatus,
  type Tenant,
  type User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { assertPasswordsMatch, assertStrongPassword } from './password-policy';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    await this.consumeOtpCode(user.id, OtpPurpose.LOGIN, dto.code);

    return this.completeAuthenticatedSession(
      user,
      tenant,
      response,
      requestMeta,
      {
        action: user.authMethod === AuthMethod.BOTH ? 'login_mfa' : 'login_otp',
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

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dto.email,
        },
      },
    });

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

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid recovery code');
    }

    await this.consumeOtpCode(
      user.id,
      OtpPurpose.RESET,
      dto.code,
      'Your reset link is invalid or expired.',
    );

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password cannot be the same as current password.',
      );
    }

    assertStrongPassword(
      dto.newPassword,
      await this.getPasswordIdentityHints(user.id, user.email),
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          dto.newPassword,
          this.configService.bcryptRounds,
        ),
        mustChangePassword: false,
      },
    });

    await this.revokeUserSessions(user.id);

    await this.auditService.record({
      action: 'password_recovery_complete',
      resource: 'auth',
      tenantId: tenant.id,
      userId: user.id,
    });

    return { success: true };
  }

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    assertPasswordsMatch(dto.newPassword, dto.confirmNewPassword);
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

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password cannot be the same as current password.',
      );
    }

    assertStrongPassword(
      dto.newPassword,
      await this.getPasswordIdentityHints(user.id, user.email),
    );

    const currentSessionId = await this.resolveRefreshSessionId(cookieHeader);
    const logoutOtherDevices = dto.logoutOtherDevices ?? true;

    await this.prisma.user.update({
      where: { id: user.id },
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

    if (logoutOtherDevices) {
      await this.revokeUserSessions(user.id, {
        exceptRefreshTokenId: currentSessionId,
        reason: 'password_change',
      });
    }

    await this.auditService.record({
      action: 'change_password',
      resource: 'auth',
      tenantId: tenant.id,
      userId: user.id,
      after: {
        logoutOtherDevices,
        otherSessionsRevoked: logoutOtherDevices,
      },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      requestId: requestMeta?.requestId,
    });

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

    const { tenant, user } = await this.resolveTenantAndUserById(
      auth.tenantId,
      auth.userId,
    );

    await this.consumeOtpCode(user.id, OtpPurpose.VERIFY, dto.code);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        authMethod: dto.authMethod,
      },
    });

    await this.revokeUserSessions(user.id);

    await this.auditService.record({
      action: 'mfa_setup_confirm',
      resource: 'auth',
      tenantId: tenant.id,
      userId: user.id,
      before: { authMethod: user.authMethod },
      after: { authMethod: dto.authMethod },
    });

    return {
      authMethod: updatedUser.authMethod,
      success: true,
    };
  }

  async refresh(
    dto: RefreshSessionDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    try {
      const cookieName = this.getRefreshCookieName();
      if (!cookieHeader && !dto.refreshToken) {
        throw new UnauthorizedException('Refresh token is required');
      }

      const rawToken =
        dto.refreshToken ?? parseCookie(cookieHeader, cookieName);

      if (!rawToken) {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      const hashV2 = hmacToken(rawToken, this.configService.tokenHashPepper);
      const hashV1 = hashToken(rawToken);

      const existingSession = await this.prisma.refreshToken.findFirst({
        where: {
          OR: [
            { tokenHash: hashV2, hashVersion: 2 },
            { tokenHash: hashV1, hashVersion: 1 },
          ],
        },
        include: {
          user: {
            include: this.userAuthInclude,
          },
        },
      });

      if (!existingSession) {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      if (existingSession.revokedAt) {
        // Suspicious refresh token reuse! Revoke all sessions in the family.
        const familyId = existingSession.familyId ?? existingSession.id;
        await this.revokeRefreshTokenFamily(familyId);

        await this.auditService.record({
          action: 'suspicious_refresh_token_reuse',
          resource: 'auth',
          tenantId: existingSession.user.tenantId,
          userId: existingSession.userId,
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
          requestId: requestMeta?.requestId,
          after: {
            tokenId: existingSession.id,
            familyId,
            revokedAt: existingSession.revokedAt.toISOString(),
          },
        });

        throw new UnauthorizedException('Refresh token is invalid');
      }

      if (existingSession.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      this.assertUserIsActive(existingSession.user);

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: existingSession.user.tenantId },
      });

      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }

      if (!tenant.isActive) {
        throw new UnauthorizedException('Tenant is not active');
      }

      const authContext = this.buildAuthContext(
        existingSession.user,
        tenant.slug,
      );

      const userAgent = requestMeta?.userAgent?.toLowerCase();
      const isMobile = userAgent
        ? userAgent.includes('dart') || userAgent.includes('flutter')
        : undefined;

      const session = await this.issueSession(authContext, requestMeta, {
        id: existingSession.id,
        familyId: existingSession.familyId ?? existingSession.id,
      });

      await this.prisma.refreshToken.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'rotated',
          replacedByTokenId: session.id,
        },
      });

      this.attachRefreshCookie(response, session.refreshToken);
      this.attachAccessCookie(response, session.accessToken);
      this.attachCsrfCookie(
        response,
        generateCsrfToken(this.configService.jwtSecret),
      );

      await this.auditService.record({
        action: 'refresh',
        resource: 'auth',
        tenantId: authContext.tenantId,
        userId: authContext.userId,
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
        requestId: requestMeta?.requestId,
      });

      return this.buildAuthSession(
        session.accessToken,
        authContext,
        tenant,
        session.refreshToken,
        isMobile,
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Refresh failed: ${error.message}`, error.stack);
      } else {
        this.logger.error('Refresh failed with a non-Error value');
      }
      throw error;
    }
  }

  async logout(
    dto: RefreshSessionDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    const cookieName = this.getRefreshCookieName();
    const rawToken = dto.refreshToken ?? parseCookie(cookieHeader, cookieName);

    if (rawToken) {
      const hashV2 = hmacToken(rawToken, this.configService.tokenHashPepper);
      const hashV1 = hashToken(rawToken);

      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: { in: [hashV1, hashV2] },
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      });
    }

    this.clearRefreshCookie(response);
    this.clearAccessCookie(response);

    const session = rawToken
      ? await this.prisma.refreshToken.findFirst({
          where: {
            tokenHash: {
              in: [
                hashToken(rawToken),
                hmacToken(rawToken, this.configService.tokenHashPepper),
              ],
            },
          },
          include: { user: true },
        })
      : null;

    if (session?.user) {
      let revokedPushTokenCount = 0;
      if (dto.installationId) {
        const result = await this.prisma.mobilePushToken.deleteMany({
          where: {
            tenantId: session.user.tenantId,
            userId: session.userId,
            installationId: dto.installationId,
          },
        });
        revokedPushTokenCount = result.count;
      }

      await this.auditService.record({
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
                pushTokenRevoked: revokedPushTokenCount > 0,
              },
            }
          : {}),
      });
    }

    return { success: true };
  }

  async getProfile(auth: AuthContext) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        tenant: true,
        staff: true,
        student: {
          include: {
            class: true,
          },
        },
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
      },
    });

    if (user?.tenantId !== auth.tenantId) {
      throw new NotFoundException('Authenticated user was not found');
    }

    const currentAuth = this.buildAuthContext(user, auth.tenantSlug);

    return {
      ...currentAuth,
      originalTenantId: auth.originalTenantId,
      isSupportOverride: auth.isSupportOverride,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
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
    };
  }

  private async completeAuthenticatedSession(
    user: UserWithRoles,
    tenant: Tenant,
    response: Response,
    requestMeta?: RequestMeta,
    audit?: { action: string },
  ) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    const authContext = this.buildAuthContext(user, tenant.slug);
    const session = await this.issueSession(authContext, requestMeta);
    this.attachRefreshCookie(response, session.refreshToken);
    this.attachAccessCookie(response, session.accessToken);
    this.attachCsrfCookie(
      response,
      generateCsrfToken(this.configService.jwtSecret),
    );

    await this.auditService.record({
      action: audit?.action ?? 'login',
      resource: 'auth',
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      after: { email: authContext.email, authMethod: authContext.authMethod },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      requestId: requestMeta?.requestId,
    });

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
    );
  }

  private async resolveTenantAndUser(tenantSlug: string, email: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant?.isActive) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
      include: this.userAuthInclude,
    });

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
      this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
        include: this.userAuthInclude,
      }),
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil,
      },
    });

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

    await this.assertOtpIssueAllowed(input.user.id, input.purpose);
    await this.invalidateActiveOtps(input.user.id, input.purpose);

    const code = generateOtpCode(this.configService.otpLength);
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        userId: input.user.id,
        codeHash: hashOtpCode(code),
        purpose: input.purpose,
        expiresAt,
      },
    });

    await this.notificationsService.sendAuthCodeEmail({
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
  ) {
    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        purpose,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (otpCode?.codeHash !== hashOtpCode(code)) {
      throw new UnauthorizedException(invalidMessage);
    }

    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { usedAt: new Date() },
    });

    return otpCode;
  }

  private async invalidateActiveOtps(userId: string, purpose: OtpPurpose) {
    await this.prisma.otpCode.updateMany({
      where: {
        userId,
        purpose,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  private async assertOtpIssueAllowed(userId: string, purpose: OtpPurpose) {
    const recentOtpCount = await this.prisma.otpCode.count({
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
  ) {
    await this.prisma.refreshToken.updateMany({
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

  private async resolveRefreshSessionId(cookieHeader?: string) {
    const rawToken = parseCookie(cookieHeader, this.getRefreshCookieName());
    if (!rawToken) {
      return null;
    }

    const session = await this.prisma.refreshToken.findFirst({
      where: {
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

    return session?.id ?? null;
  }

  private async getPasswordIdentityHints(userId: string, email: string | null) {
    const user = await this.prisma.user.findUnique({
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
    });

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
        role: {
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
  ): AuthContext {
    const roles = Array.from(
      new Set(user.userRoles.map(({ role }) => role.name)),
    );
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap(({ role }) =>
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
  ) {
    const userAgent = requestMeta?.userAgent?.toLowerCase();
    const isMobile = ['dart', 'flutter'].some(
      (pattern) => userAgent?.includes(pattern) ?? false,
    );
    const audience = isMobile
      ? this.configService.jwtAudienceMobile
      : this.configService.jwtAudienceWeb;

    const payload: JwtAccessPayload = {
      sub: authContext.userId,
      tenantId: authContext.tenantId,
      tenantSlug: authContext.tenantSlug,
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

    const tokenId = randomUUID();
    const familyId = parentSession?.familyId ?? tokenId;

    await this.prisma.refreshToken.create({
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
        tenantSlug: authContext.tenantSlug,
        email: authContext.email,
        authMethod: authContext.authMethod,
        mustChangePassword: authContext.mustChangePassword ?? false,
        roles: authContext.roles,
        permissions: authContext.permissions,
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

  private async revokeRefreshTokenFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'family_theft',
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
  userRoles: Array<{
    role: {
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
