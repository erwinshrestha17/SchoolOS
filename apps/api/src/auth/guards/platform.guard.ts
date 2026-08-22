import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth-request.interface';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { SecurityDomain } from '@prisma/client';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    if (!auth) {
      throw new UnauthorizedException('Authentication required');
    }

    const roles = auth.roles;
    if (
      auth.securityDomain !== SecurityDomain.PLATFORM ||
      auth.isSupportOverride
    ) {
      throw new ForbiddenException(
        'Access restricted to platform administrators only: account is outside the Platform security domain',
      );
    }

    const isPlatformAdmin = roles.includes('platform_super_admin');
    const isPlatformSupport = roles.includes('platform_support');
    const isPlatformBilling = roles.includes('platform_billing_admin');

    if (!isPlatformAdmin && !isPlatformSupport && !isPlatformBilling) {
      throw new ForbiddenException(
        'Access restricted to platform administrators only',
      );
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      auth.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'Insufficient platform permissions for this action',
      );
    }

    return true;
  }
}
