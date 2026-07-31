import type { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';

export type AuthorizationDenialReason =
  | 'cross_tenant_attempt'
  | 'missing_tenant_context'
  | 'tenant_suspended'
  | 'entitlement_disabled'
  | 'entitlement_missing'
  | 'entitlement_invalid'
  | 'entitlement_lookup_failed'
  | 'capability_missing'
  | 'guardian_relationship_inactive'
  | 'guardian_capability_denied'
  | 'teacher_scope_denied'
  | 'platform_plane_denied'
  | 'protected_file_denied'
  | 'export_scope_denied'
  | 'session_revoked';

/**
 * Records high-value authorization denials without logging secrets, tokens,
 * passwords, or unnecessary PII. Safe metadata only.
 */
export async function recordAuthorizationDenial(
  audit: Pick<AuditService, 'record'>,
  input: {
    actor: Pick<AuthContext, 'tenantId' | 'userId'>;
    reason: AuthorizationDenialReason;
    resource: string;
    resourceId?: string | null;
    capability?: string;
    attemptedTenantId?: string;
  },
): Promise<void> {
  await audit.record({
    action: 'authorization.denied',
    resource: input.resource,
    tenantId: input.actor.tenantId,
    userId: input.actor.userId,
    resourceId: input.resourceId ?? null,
    after: {
      reason: input.reason,
      ...(input.capability ? { capability: input.capability } : {}),
      ...(input.attemptedTenantId
        ? { attemptedTenantId: input.attemptedTenantId }
        : {}),
    },
  });
}

export async function recordAuthorizationEvent(
  audit: Pick<AuditService, 'record'>,
  input: {
    actor: Pick<AuthContext, 'tenantId' | 'userId'>;
    action:
      | 'guardian_access.granted'
      | 'guardian_access.suspended'
      | 'guardian_access.revoked'
      | 'teacher_assignment.removed'
      | 'permission_capability.changed'
      | 'support_impersonation.started'
      | 'support_impersonation.ended'
      | 'protected_file.accessed'
      | 'sensitive_export.generated'
      | 'session_device.revoked';
    resource: string;
    resourceId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await audit.record({
    action: input.action,
    resource: input.resource,
    tenantId: input.actor.tenantId,
    userId: input.actor.userId,
    resourceId: input.resourceId ?? null,
    after: input.metadata ?? undefined,
  });
}
