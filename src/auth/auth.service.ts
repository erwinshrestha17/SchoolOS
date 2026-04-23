import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { AuthContext, JwtAccessPayload } from './auth.types';
import {
  generateRefreshToken,
  hashToken,
  parseCookie,
} from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, response: Response, requestMeta?: RequestMeta) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dto.email,
        },
      },
      include: this.userAuthInclude,
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authContext = this.buildAuthContext(user, tenant.slug);
    const session = await this.issueSession(authContext);
    this.attachRefreshCookie(response, session.refreshToken);

    await this.auditService.record({
      action: 'login',
      resource: 'auth',
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      after: { email: authContext.email },
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return {
      accessToken: session.accessToken,
      user: authContext,
    };
  }

  async refresh(
    dto: RefreshSessionDto,
    response: Response,
    cookieHeader?: string,
    requestMeta?: RequestMeta,
  ) {
    const rawToken =
      dto.refreshToken ??
      parseCookie(cookieHeader, this.configService.refreshCookieName);

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is required');
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
      existingSession.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (existingSession.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: existingSession.user.tenantId },
    });

    if (!tenant?.isActive) {
      throw new UnauthorizedException('Tenant is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: existingSession.id },
      data: { revokedAt: new Date() },
    });

    const authContext = this.buildAuthContext(existingSession.user, tenant.slug);
    const session = await this.issueSession(authContext);
    this.attachRefreshCookie(response, session.refreshToken);

    await this.auditService.record({
      action: 'refresh',
      resource: 'auth',
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return {
      accessToken: session.accessToken,
      user: authContext,
    };
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
    const roles = Array.from(new Set(user.userRoles.map(({ role }) => role.name)));
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

  private attachRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(this.configService.refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.isProduction,
      path: '/',
      maxAge:
        this.configService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(this.configService.refreshCookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.isProduction,
      path: '/',
    });
  }

  private getRefreshTokenExpiry() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.configService.refreshTokenTtlDays);
    return expiry;
  }
}

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
