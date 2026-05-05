import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth-request.interface';

const permissionAliases: Record<string, string[]> = {
  'academics:create': ['academics:manage'],
  'academics:update': ['academics:manage'],
  'academics:delete': ['academics:manage'],
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
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

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

    if (auth.roles.includes('super_admin')) {
      request.auth = {
        ...auth,
        roles: Array.from(new Set(auth.roles)),
        permissions: Array.from(new Set(auth.permissions)),
      };
      return true;
    }

    const memberships = await this.prisma.userRole.findMany({
      where: {
        userId: auth.userId,
        tenantId: auth.tenantId,
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
    });

    const roleNames = memberships.map((membership) => membership.role.name);
    const permissionKeys = memberships.flatMap((membership) =>
      membership.role.rolePermissions.map(
        ({ permission }) => `${permission.resource}:${permission.action}`,
      ),
    );

    request.auth = {
      ...auth,
      roles: Array.from(new Set(roleNames)),
      permissions: Array.from(new Set(permissionKeys)),
    };

    const hasRole =
      requiredRoles.length === 0 ||
      requiredRoles.some((role) => request.auth?.roles.includes(role));
    const hasPermission =
      requiredPermissions.length === 0 ||
      requiredPermissions.every((permission) =>
        hasRequiredPermission(request.auth?.permissions, permission),
      );

    if (!hasRole || !hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
