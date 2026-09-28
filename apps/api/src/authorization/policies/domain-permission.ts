import { ForbiddenException } from '@nestjs/common';
import { hasEffectivePermission, isPlatformRoleName } from '@schoolos/core';
import type { AuthContext } from '../../auth/auth.types';
import { grantAllows } from '../scopes/scope-resolver';

/** Service boundary for school financial/HR actions. Roles cannot bypass it. */
export function hasDomainPermission(
  actor: AuthContext,
  permission: string,
): boolean {
  if (
    !actor.userId ||
    !actor.tenantId ||
    !Array.isArray(actor.roles) ||
    actor.isSupportOverride ||
    actor.securityDomain === 'PLATFORM' ||
    actor.roles.some(isPlatformRoleName)
  )
    return false;
  return actor.accessGrants
    ? actor.accessGrants.some((grant) =>
        grantAllows(grant, permission, actor.tenantId),
      )
    : hasEffectivePermission(actor.permissions, permission);
}

export function requireDomainPermission(
  actor: AuthContext,
  permission: string,
): void {
  if (!hasDomainPermission(actor, permission))
    throw new ForbiddenException({
      code: 'DOMAIN_AUTHORIZATION_DENIED',
      message: 'You are not authorized for this school action',
    });
}

export function requireIndependentActor(
  actor: AuthContext,
  initiators: ReadonlyArray<string | null | undefined>,
): void {
  if (!actor.userId || initiators.some((id) => id === actor.userId))
    throw new ForbiddenException({
      code: 'SELF_APPROVAL_PROHIBITED',
      message: 'A different authorized user must perform this action',
    });
}
