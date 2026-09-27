import {
  AuthorizationForbiddenException,
  AuthorizationUnauthorizedException,
} from '../../authorization/authorization-denied.exception';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityDomain } from '@prisma/client';
import { AuthorizationService } from '../../authorization/authorization.service';
import { readVerifiedAuthorizationIdentity } from '../../authorization/authorization-request-identity';
import { AuthenticatedRequest } from '../auth-request.interface';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const decision = await this.authorization.evaluate({
      actor: auth,
      identity: readVerifiedAuthorizationIdentity(request, auth),
      securityDomain: SecurityDomain.PLATFORM,
      trustedTenantId: auth?.tenantId,
      requestedPermissions: requiredPermissions,
      method: request.method,
      requestId: request.requestId,
    });
    if (decision.outcome === 'ALLOW') return true;
    if (decision.reasonCode === 'AUTHENTICATION_REQUIRED')
      throw new AuthorizationUnauthorizedException(
        decision,
        'Authentication required',
      );
    if (decision.reasonCode === 'USER_OR_SESSION_INACTIVE')
      throw new AuthorizationUnauthorizedException(
        decision,
        'User or session is inactive',
      );
    if (decision.reasonCode === 'SECURITY_DOMAIN_MISMATCH')
      throw new AuthorizationForbiddenException(
        decision,
        'Access restricted to platform administrators only: account is outside the Platform security domain',
      );
    throw new AuthorizationForbiddenException(
      decision,
      'Insufficient platform permissions for this action',
    );
  }
}
