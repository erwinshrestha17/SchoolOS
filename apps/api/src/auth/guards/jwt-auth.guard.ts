import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '../../config/config.service';
import { AuthenticatedRequest } from '../auth-request.interface';
import { JwtAccessPayload } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice(7);
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
    const canOverrideTenant =
      Boolean(overrideTenantId) && payload.roles.includes('super_admin');
    const effectiveTenantId = canOverrideTenant
      ? overrideTenantId!
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

    if (canOverrideTenant) {
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
}

function resolveHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
