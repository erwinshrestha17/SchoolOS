import type { OwnedResource } from './resource-ownership';
import type { ResourceScope } from './scopes/scope.types';
import type { SecurityDomain } from '@prisma/client';
import type {
  CanonicalPermissionCode,
  CanonicalPermissionDefinition,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';

export const AUTHORIZATION_STAGES = Object.freeze([
  'AUTHENTICATION',
  'ACTIVE_USER_SESSION',
  'SECURITY_DOMAIN',
  'TENANT',
  'RESOURCE_TENANT',
  'ENTITLEMENT',
  'HARD_RESTRICTION',
  'PERMISSION',
  'SCOPE',
  'RELATIONSHIP',
  'LIFECYCLE',
  'SEPARATION_OF_DUTIES',
  'APPROVAL_STEP_UP',
  'SENSITIVE_PROJECTION',
  'AUDIT',
] as const);
export type AuthorizationStage = (typeof AUTHORIZATION_STAGES)[number];

export const AUTHORIZATION_REASON_CODES = Object.freeze([
  'ALLOWED',
  'AUTHENTICATION_REQUIRED',
  'USER_OR_SESSION_INACTIVE',
  'SECURITY_DOMAIN_MISMATCH',
  'TENANT_MISMATCH',
  'TENANT_INACTIVE',
  'ENTITLEMENT_MISSING',
  'PERMISSION_MISSING',
  'ROLE_MISSING',
  'UNKNOWN_PERMISSION',
  'RESOURCE_TENANT_MISMATCH',
  'RESOURCE_NOT_FOUND',
  'POLICY_DENIED',
  'SCOPE_MISMATCH',
  'AUTHORIZATION_EVALUATION_ERROR',
] as const);
export type AuthorizationReasonCode =
  (typeof AUTHORIZATION_REASON_CODES)[number];
/** Reserved future outcomes are not enforceable or returnable in Phase 1B. */
export type FutureAuthorizationOutcome = 'REQUIRE_APPROVAL' | 'REQUIRE_STEP_UP';
export type AuthorizationOutcome = 'ALLOW' | 'DENY';

/** Facts obtained by authentication guards, never by decoding request bodies. */
export interface VerifiedAuthorizationIdentity {
  readonly securityDomain: SecurityDomain;
  readonly tenantId: string;
  readonly userSessionActive: boolean;
  readonly tenantActive: boolean;
  readonly supportOverrideApproved?: boolean;
}

/** Server-only input. Resource ownership, when supplied, must come from persistence. */
export interface AuthorizationContext {
  readonly actor?: AuthContext | null;
  readonly identity?: VerifiedAuthorizationIdentity;
  readonly securityDomain: SecurityDomain;
  readonly trustedTenantId?: string;
  readonly requestedPermissions: readonly string[];
  readonly requiredRoles?: readonly string[];
  readonly canonicalPermissions?: readonly CanonicalPermissionDefinition[];
  readonly routeAction?: string;
  readonly method?: string;
  readonly requestId?: string;
  readonly resource?: Readonly<{ id?: string; tenantId?: string }>;
  readonly resourceScope?: ResourceScope;
  readonly resourceLookup?: () => Promise<OwnedResource | null>;
  readonly serviceAuthorizationPolicy?: string;
  readonly entitlement?: Readonly<{
    keys: readonly string[];
    evaluate: () => boolean | Promise<boolean>;
  }>;
}

/** Safe public decision: no actor/resource IDs, secrets or exception details. */
export interface AuthorizationDecision {
  readonly outcome: AuthorizationOutcome;
  readonly reasonCode: AuthorizationReasonCode;
  readonly stage: AuthorizationStage;
  readonly policyId: string;
  readonly canonicalPermission?: CanonicalPermissionCode;
}

export type PolicyEvaluation = Readonly<{
  outcome: 'ALLOW' | 'DENY' | 'NOT_APPLICABLE';
  reasonCode?: AuthorizationReasonCode;
}>;

export interface PolicyEvaluator {
  readonly id: string;
  readonly stage: AuthorizationStage;
  evaluate(
    context: AuthorizationContext,
  ): PolicyEvaluation | Promise<PolicyEvaluation>;
}
