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
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const overrideTenantId = resolveHeader(
      request.headers['x-schoolos-tenant-id'],
    );
    const canOverrideTenant = payload.roles.includes('super_admin');

    if (overrideTenantId && !canOverrideTenant) {
      throw new ForbiddenException('Tenant override requires super admin');
    }

    const effectiveTenantId = overrideTenantId
      ? await this.resolveOverrideTenantId(overrideTenantId)
      : payload.tenantId;

    request.auth = {
      userId: payload.sub,
      tenantId: effectiveTenantId,
      tenantSlug: payload.tenantSlug,
      email: payload.email,
      authMethod: payload.authMethod,
      roles: payload.roles,
      permissions: payload.permissions,
    };
    if (this.cls.isActive()) {
      this.cls.set(TENANT_ID_KEY, effectiveTenantId);
    }

    if (overrideTenantId) {
      await this.auditService.record({
        action: 'tenant_override',
        resource: 'auth',
        tenantId: payload.tenantId,
        userId: payload.sub,
        after: {
          originalTenantId: payload.tenantId,
          effectiveTenantId,
        },
      });
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
