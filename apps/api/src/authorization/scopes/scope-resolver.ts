import {
  hasEffectivePermission,
  getCanonicalPermissionForLegacyKey,
  getCanonicalPermissionByCode,
} from '@schoolos/core';
import type { RoleAccessGrant, ScopeGrant, ResourceScope } from './scope.types';

export function scopeIsActive(scope: ScopeGrant, now = Date.now()): boolean {
  const start = new Date(scope.effectiveFrom).getTime();
  const end =
    scope.expiresAt === null ? Infinity : new Date(scope.expiresAt).getTime();
  return (
    !scope.revokedAt &&
    Number.isFinite(start) &&
    start <= now &&
    end > now &&
    end > start
  );
}

/** Same-type grants union; different dimensions intersect. TENANT cannot mask a restriction. */
export function scopesMatch(
  scopes: readonly ScopeGrant[],
  tenantId: string,
  resource?: ResourceScope,
  now = Date.now(),
): boolean {
  if (!scopes.length || scopes.some((s) => !s.scopeId)) return false;
  if (scopes.some((s) => s.scopeType === 'TENANT')) {
    return (
      scopes.length === 1 &&
      scopes[0].scopeId === tenantId &&
      scopeIsActive(scopes[0], now)
    );
  }
  const types = new Set(scopes.map((s) => s.scopeType));
  return [...types].every(
    (type) =>
      !!resource?.[type] &&
      scopes.some(
        (s) =>
          s.scopeType === type &&
          scopeIsActive(s, now) &&
          s.scopeId === resource[type],
      ),
  );
}

export function grantAllows(
  grant: RoleAccessGrant,
  permission: string,
  tenantId: string,
  resource?: ResourceScope,
): boolean {
  const definition =
    getCanonicalPermissionForLegacyKey(permission) ??
    getCanonicalPermissionByCode(permission);
  if (!definition || grant.tenantId !== tenantId) return false;
  const normalized = grant.permissions.map(
    (key) =>
      (
        getCanonicalPermissionForLegacyKey(key) ??
        getCanonicalPermissionByCode(key)
      )?.legacyKey ?? key,
  );
  return (
    hasEffectivePermission(normalized, definition.legacyKey) &&
    grant.scopes.every((s) =>
      definition.allowedScopeTypes.includes(s.scopeType),
    ) &&
    scopesMatch(grant.scopes, tenantId, resource)
  );
}
