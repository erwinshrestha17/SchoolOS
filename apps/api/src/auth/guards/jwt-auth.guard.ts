import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '../../config/config.service';
import { PrismaService, TENANT_ID_KEY } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth-request.interface';
import { JwtAccessPayload } from '../auth.types';
import { parseCookie } from '../auth.utils';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.resolveAccessToken(request);

    let payload: JwtAccessPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.configService.jwtSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.iss !== this.configService.jwtIssuer) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    const userAgent = (request.headers['user-agent'] as string | undefined)?.toLowerCase() ?? '';
    const isMobile = userAgent.includes('dart') || userAgent.includes('flutter');
    const expectedAudience = isMobile ? this.configService.jwtAudienceMobile : this.configService.jwtAudienceWeb;

    if (payload.aud !== expectedAudience) {
      throw new UnauthorizedException('Invalid token audience');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
        userRoles: {
          where: {
            tenantId: payload.tenantId, // Use the user's home tenant for role lookup
          },
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

    if (user?.status !== 'ACTIVE' || !user.tenant.isActive) {
      throw new UnauthorizedException('User or tenant is inactive');
    }

    if (user.tenantId !== payload.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    const permissionKeys = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map(
        ({ permission }) => `${permission.resource}:${permission.action}`,
      ),
    );

    const roles = user.userRoles.map((ur) => ur.role.name);

    const overrideTenantId = resolveHeader(
      request.headers['x-schoolos-tenant-id'],
    );
    const isPlatformUser = roles.includes('platform_super_admin');

    let effectiveTenantId = payload.tenantId;

    if (overrideTenantId) {
      if (!isPlatformUser) {
        throw new ForbiddenException(
          'Tenant override requires platform super admin',
        );
      }

      const activeOverride = await this.prisma.supportOverride.findFirst({
        where: {
          platformUserId: user.id,
          tenantId: overrideTenantId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (!activeOverride) {
        throw new ForbiddenException(
          'No active support override session found or session expired',
        );
      }

      const reason = resolveHeader(
        request.headers['x-schoolos-tenant-override-reason'],
      );

      if (!reason || reason.trim().length < 5) {
        throw new ForbiddenException(
          'Tenant override requires an explicit reason of at least 5 characters',
        );
      }

      await this.auditService.record({
        action: 'tenant_override',
        resource: 'auth',
        tenantId: payload.tenantId,
        userId: user.id,
        after: {
          originalTenantId: payload.tenantId,
          effectiveTenantId: overrideTenantId,
          reason,
        },
      });

      effectiveTenantId = await this.resolveOverrideTenantId(overrideTenantId);
    }

    request.auth = {
      userId: user.id,
      tenantId: effectiveTenantId,
      originalTenantId: payload.tenantId,
      isSupportOverride: effectiveTenantId !== payload.tenantId,
      tenantSlug: payload.tenantSlug,
      email: user.email,
      authMethod: payload.authMethod,
      roles: Array.from(new Set(roles)),
      permissions: Array.from(new Set(permissionKeys)),
    };
    const hasActiveCls =
      typeof this.cls.isActive === 'function' ? this.cls.isActive() : true;

    if (hasActiveCls) {
      this.cls.set(TENANT_ID_KEY, effectiveTenantId);
    }

    return true;
  }

  private resolveAccessToken(request: AuthenticatedRequest) {
    const header = request.headers.authorization;

    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const cookieToken = parseCookie(
      resolveHeader(request.headers.cookie),
      this.configService.accessCookieName,
    );

    if (cookieToken) {
      return cookieToken;
    }

    throw new UnauthorizedException('Missing access token');
  }

  private async resolveOverrideTenantId(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!tenant?.isActive) {
      throw new ForbiddenException('Tenant override is not allowed');
    }

    return tenant.id;
  }
}

function resolveHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
