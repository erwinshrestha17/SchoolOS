import {
  AuthorizationForbiddenException,
  AuthorizationUnauthorizedException,
} from '../../authorization/authorization-denied.exception';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { SecurityDomain } from '@prisma/client';
import { AuthorizationService } from '../../authorization/authorization.service';
import { readVerifiedAuthorizationIdentity } from '../../authorization/authorization-request-identity';
import { SERVICE_AUTHORIZATION_KEY } from '../../authorization/service-authorization.decorator';
import type { AuthorizationContext } from '../../authorization/authorization.types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ENTITLEMENT_KEY } from '../decorators/entitlement.decorator';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { REQUIRED_FEATURE_KEY } from '../decorators/required-feature.decorator';
import { AuthenticatedRequest } from '../auth-request.interface';
import { EntitlementGuard } from './entitlement.guard';

@Injectable()
export class RolesPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
    private readonly entitlementGuard: EntitlementGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ??
      [];
    // Method-only compatibility. No class-wide metadata-less bypass.
    const serviceAuthorizationPolicy = this.reflector.get<string>(
      SERVICE_AUTHORIZATION_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    const guards = targets.flatMap((target) => {
      if (typeof target !== 'function') return [];
      const value: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
      return Array.isArray(value) ? (value as unknown[]) : [];
    });
    let expectedEntitlementFailure: HttpException | undefined;
    const entitlement: AuthorizationContext['entitlement'] = guards.includes(
      EntitlementGuard,
    )
      ? {
          keys: [REQUIRED_MODULE_KEY, REQUIRED_FEATURE_KEY, ENTITLEMENT_KEY]
            .map((key) =>
              this.reflector.getAllAndOverride<string>(key, targets),
            )
            .filter((key): key is string => typeof key === 'string'),
          evaluate: async () => {
            try {
              return await this.entitlementGuard.canActivate(context);
            } catch (error) {
              // Preserve established, controlled entitlement denials. Unexpected
              // failures reach the kernel and are logged without exception data.
              if (
                error instanceof HttpException &&
                [401, 403, 404].includes(error.getStatus())
              ) {
                expectedEntitlementFailure = error;
                return false;
              }
              throw error;
            }
          },
        }
      : undefined;
    const decision = await this.authorization.evaluate({
      actor: auth,
      identity: readVerifiedAuthorizationIdentity(request, auth),
      securityDomain: SecurityDomain.SCHOOL,
      trustedTenantId: auth?.tenantId,
      requestedPermissions: requiredPermissions,
      requiredRoles,
      serviceAuthorizationPolicy,
      entitlement,
      routeAction: `${context.getClass().name}.${context.getHandler().name}`,
      method: request.method,
      requestId: request.requestId,
    });
    if (decision.outcome === 'ALLOW') return true;
    if (expectedEntitlementFailure) throw expectedEntitlementFailure;
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
    if (
      auth?.securityDomain === SecurityDomain.PLATFORM &&
      !auth.isSupportOverride
    ) {
      throw new AuthorizationForbiddenException(
        decision,
        'Platform identities require an active support override on school routes',
      );
    }
    if (auth?.isSupportOverride && decision.reasonCode === 'POLICY_DENIED') {
      throw new AuthorizationForbiddenException(
        decision,
        'Support override requires an explicitly permissioned read route',
      );
    }
    throw new AuthorizationForbiddenException(
      decision,
      'Insufficient permissions',
    );
  }
}
