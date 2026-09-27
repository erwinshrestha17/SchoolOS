import type { CanonicalPermissionScopeType } from '@schoolos/core';

export type SchoolScopeType = Exclude<CanonicalPermissionScopeType, 'GLOBAL'>;
export interface ScopeGrant {
  readonly scopeType: SchoolScopeType;
  readonly scopeId: string;
  readonly effectiveFrom: Date | string;
  readonly expiresAt: Date | string | null;
  readonly revokedAt: Date | string | null;
}
export interface RoleAccessGrant {
  readonly assignmentId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly permissions: readonly string[];
  readonly scopes: readonly ScopeGrant[];
}
/** Server-resolved dimensions. Never copy these from query/body fields. */
export type ResourceScope = Readonly<Partial<Record<SchoolScopeType, string>>>;

export const SCHOOL_SCOPE_TYPES: readonly SchoolScopeType[] = Object.freeze([
  'TENANT',
  'BRANCH',
  'ACADEMIC_YEAR',
  'CLASS',
  'SECTION',
  'SUBJECT',
  'DEPARTMENT',
  'STUDENT',
  'STAFF',
  'FINANCE_ACCOUNT',
]);
