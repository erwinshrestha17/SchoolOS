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

const permissionAliases: Record<string, string[]> = {
  'academics:create': ['academics:manage'],
  'academics:update': ['academics:manage'],
  'academics:delete': ['academics:manage'],
  'cas-records:read': ['academics:read'],
  'cas-records:manage': ['academics:manage'],
  'hr:staff:read': ['staff:read', 'hr:read'],
  'hr:staff:create': ['staff:create', 'hr:manage'],
  'hr:staff:update': ['hr:manage'],
  'hr:staff:lifecycle': ['hr:manage'],
  'hr:attendance:read': ['attendance:read', 'hr:read'],
  'hr:attendance:write': ['attendance:mark', 'hr:manage'],
  'hr:attendance:correct': ['attendance:review_conflicts', 'hr:manage'],
  'hr:leave:read': ['hr:read'],
  'hr:leave:request': ['staff:read', 'hr:manage'],
  'hr:leave:approve': ['hr:manage'],
  'hr:leave:adjust': ['hr:manage'],
  'payroll:salary:read': ['payroll:read'],
  'payroll:salary:write': ['payroll:manage'],
  'payroll:run:create': ['payroll:manage'],
  'payroll:run:read': ['payroll:read'],
  'payroll:run:review': ['payroll:manage'],
  'payroll:run:approve': ['payroll:manage'],
  'payroll:run:post': ['payroll:manage'],
  'payroll:run:pay': ['payroll:manage'],
  'payroll:payslip:read': ['payroll:read', 'staff:read'],
  'payroll:reports:read': ['payroll:read'],
  'payroll:exports:create': ['payroll:manage', 'reports:export'],
  'accounting:accounts:read': ['accounting:read'],
  'accounting:accounts:write': ['accounting:close'],
  'accounting:fiscal:manage': ['accounting:close'],
  'accounting:journals:read': ['accounting:read', 'ledger:read'],
  'accounting:journals:manual': ['accounting:close'],
  'accounting:journals:reverse': ['accounting:reverse'],
  'accounting:reports:read': ['accounting:read'],
  'accounting:exports:create': ['reports:export', 'accounting:close'],
  'library:books:create': ['library:manage'],
  'library:books:read': ['library:read'],
  'library:books:update': ['library:manage'],
  'library:copies:create': ['library:manage'],
  'library:copies:read': ['library:read'],
  'library:copies:update': ['library:manage'],
  'library:issues:create': ['library:manage'],
  'library:issues:read': ['library:read'],
  'library:issues:return': ['library:manage'],
  'library:reports:read': ['library:read'],
  'transport:routes:create': ['transport:manage'],
  'transport:routes:read': ['transport:read'],
  'transport:routes:update': ['transport:manage'],
  'transport:vehicles:create': ['transport:manage'],
  'transport:vehicles:read': ['transport:read'],
  'transport:vehicles:update': ['transport:manage'],
  'transport:assignments:create': ['transport:manage'],
  'transport:assignments:read': ['transport:read'],
  'transport:assignments:update': ['transport:manage'],
  'transport:trips:create': ['transport:operate', 'transport:manage'],
  'transport:trips:read': ['transport:read', 'transport:operate'],
  'transport:trips:update': ['transport:operate', 'transport:manage'],
  'transport:location:read': ['transport:read', 'transport:operate'],
  'transport:location:update': ['transport:operate', 'transport:manage'],
  'transport:tracking:parent': ['transport:read'],
  'transport:reports:read': ['transport:read'],
};

function hasRequiredPermission(
  actualPermissions: string[] | undefined,
  requiredPermission: string,
) {
  const permissions = actualPermissions ?? [];
  return (
    permissions.includes(requiredPermission) ||
    (permissionAliases[requiredPermission] ?? []).some((alias) =>
      permissions.includes(alias),
    )
  );
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
