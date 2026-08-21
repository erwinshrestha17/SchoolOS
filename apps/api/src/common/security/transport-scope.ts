import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';

const TENANT_TRANSPORT_MANAGEMENT_ROLES = new Set([
  'platform_super_admin',
  'admin',
  'principal',
]);

export function canManageTenantTransport(actor: AuthContext) {
  return (
    actor.roles.some((role) => TENANT_TRANSPORT_MANAGEMENT_ROLES.has(role)) ||
    actor.permissions.includes('transport:manage')
  );
}

/**
 * Driver/conductor identities are purpose-limited even when a legacy or
 * custom role also carries broad Transport read permissions. Management
 * reads must use a management identity; driver workflows use /driver/*.
 */
export function isAssignedTransportOperator(actor: AuthContext) {
  return (
    !canManageTenantTransport(actor) &&
    (actor.roles.includes('driver') ||
      actor.permissions.includes('transport:operate'))
  );
}

export function assertTenantWideTransportAccess(
  actor: AuthContext,
  action: string,
) {
  if (isAssignedTransportOperator(actor)) {
    throw new ForbiddenException(
      `Driver access is limited to assigned-trip workflows and cannot ${action}`,
    );
  }
}
