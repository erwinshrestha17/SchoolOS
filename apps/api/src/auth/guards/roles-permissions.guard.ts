import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth-request.interface';
import { hasEffectivePermission } from '@schoolos/core';

/**
 * The alias table now lives in `@schoolos/core` (PERMISSION_ALIASES) so the
 * web can evaluate the exact rule this guard enforces instead of maintaining
 * a second, drifting copy. This guard remains the authorization authority.
 */
function hasRequiredPermission(
  actualPermissions: string[] | undefined,
  requiredPermission: string,
) {
  return hasEffectivePermission(actualPermissions ?? [], requiredPermission);
}

@Injectable()
export class RolesPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(RolesPermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    if (!auth) {
      throw new UnauthorizedException('Authentication required');
    }

    if (auth.roles.includes('platform_super_admin')) {
      return true;
    }

    const hasRole =
      requiredRoles.length === 0 ||
      requiredRoles.some((role) => auth.roles.includes(role));
    const hasPermission =
      requiredPermissions.length === 0 ||
      requiredPermissions.every((permission) =>
        hasRequiredPermission(auth.permissions, permission),
      );

    if (!hasRole || !hasPermission) {
      this.logger.warn(
        JSON.stringify({
          requestId: request.requestId,
          path: request.originalUrl ?? request.url,
          method: request.method,
          userId: auth.userId,
          tenantId: auth.tenantId,
          requiredRoles,
          requiredPermissions,
          roleMatched: hasRole,
          permissionMatched: hasPermission,
        }),
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
