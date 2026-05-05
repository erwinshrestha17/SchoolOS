import {
  AuthMethod,
  OtpPurpose,
  UserStatus,
  type Tenant,
  type User,
} from '@prisma/client';
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
import type { Response } from 'express';
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
  parseCookie,
} from './auth.utils';
import { ConfirmMfaSetupDto } from './dto/confirm-mfa-setup.dto';
import { ConfirmPasswordRecoveryDto } from './dto/confirm-password-recovery.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RequestOtpLoginDto } from './dto/request-otp-login.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { VerifyOtpLoginDto } from './dto/verify-otp-login.dto';

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
    const { tenant, user } = await this.resolveTenantAndUser(
      dto.tenantSlug,
      dto.email,
    );

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid recovery code');
    }

    await this.consumeOtpCode(user.id, OtpPurpose.RESET, dto.code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          dto.newPassword,
          this.configService.bcryptRounds,
        ),
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
      if (!cookieHeader && !dto.refreshToken) {
        throw new UnauthorizedException('Refresh token is required');
      }

      const rawToken =
        dto.refreshToken ??
        parseCookie(cookieHeader, this.configService.refreshCookieName);

      if (!rawToken) {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      const existingSession = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(rawToken) },
        include: {
          user: {
            include: this.userAuthInclude,
          },
        },
      });

      if (
        !existingSession ||
        existingSession.revokedAt ||
        existingSession.expiresAt.getTime() < Date.now()
      ) {
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

      await this.prisma.refreshToken.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() },
      });

      const authContext = this.buildAuthContext(
        existingSession.user,
        tenant.slug,
      );

      const session = await this.issueSession(authContext);

      this.attachRefreshCookie(response, session.refreshToken);
      this.attachAccessCookie(response, session.accessToken);

      await this.auditService.record({
        action: 'refresh',
        resource: 'auth',
        tenantId: authContext.tenantId,
        userId: authContext.userId,
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });

      return this.buildAuthSession(session.accessToken, authContext, tenant);
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
    const rawToken =
      dto.refreshToken ??
      parseCookie(cookieHeader, this.configService.refreshCookieName);

    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: hashToken(rawToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    this.clearRefreshCookie(response);
    this.clearAccessCookie(response);

    const session = rawToken
      ? await this.prisma.refreshToken.findUnique({
          where: { tokenHash: hashToken(rawToken) },
          include: { user: true },
        })
      : null;

    if (session?.user) {
      await this.auditService.record({
        action: 'logout',
        resource: 'auth',
        tenantId: session.user.tenantId,
        userId: session.userId,
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
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
    const session = await this.issueSession(authContext);
    this.attachRefreshCookie(response, session.refreshToken);
    this.attachAccessCookie(response, session.accessToken);

    await this.auditService.record({
      action: audit?.action ?? 'login',
      resource: 'auth',
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      after: { email: authContext.email, authMethod: authContext.authMethod },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return this.buildAuthSession(session.accessToken, authContext, tenant);
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
      throw new UnauthorizedException('Invalid or expired verification code');
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

  private async revokeUserSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
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
      roles,
      permissions,
    };
  }

  private async issueSession(authContext: AuthContext) {
    const payload: JwtAccessPayload = {
      sub: authContext.userId,
      tenantId: authContext.tenantId,
      tenantSlug: authContext.tenantSlug,
      email: authContext.email,
      authMethod: authContext.authMethod,
      roles: authContext.roles,
      permissions: authContext.permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.accessTokenTtl as never,
    });
    const refreshToken = generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: authContext.userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });

    return { accessToken, refreshToken };
  }

  private buildAuthSession(
    accessToken: string,
    authContext: AuthContext,
    tenant: Tenant,
  ) {
    const decoded =
      typeof this.jwtService.decode === 'function'
        ? (this.jwtService.decode(accessToken) ?? null)
        : null;

    return {
      accessToken,
      accessTokenExpiresAt: decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
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
        tenantSlug: authContext.tenantSlug,
        email: authContext.email,
        authMethod: authContext.authMethod,
        roles: authContext.roles,
        permissions: authContext.permissions,
      },
    };
  }

  private attachRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(this.configService.refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
      domain: this.configService.cookieDomain,
      maxAge: this.configService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private attachAccessCookie(response: Response, accessToken: string) {
    response.cookie(this.configService.accessCookieName, accessToken, {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
      domain: this.configService.cookieDomain,
      maxAge: resolveAccessTokenMaxAge(this.configService.accessTokenTtl),
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(this.configService.refreshCookieName, {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
      domain: this.configService.cookieDomain,
    });
  }

  private clearAccessCookie(response: Response) {
    response.clearCookie(this.configService.accessCookieName, {
      httpOnly: true,
      sameSite: this.configService.cookieSameSite,
      secure: this.configService.isProduction,
      path: '/',
      domain: this.configService.cookieDomain,
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
