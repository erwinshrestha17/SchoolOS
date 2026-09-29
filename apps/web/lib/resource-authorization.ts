import { isActionAllowed, isSectionAuthorized } from '@schoolos/core';

/**
 * Phase 3A Web consumer of the canonical server authorization contract.
 *
 * Presentation only: every protected request is re-authorized by the API.
 * Missing, malformed, unknown-version or non-ENABLED projections deny every
 * action and section (the readers live in @schoolos/core so Web and future
 * consumers share one interpretation).
 */
export type ResourceAccess<
  Action extends string = string,
  Section extends string = string,
> = {
  can: (action: Action) => boolean;
  sees: (section: Section) => boolean;
};

export function resourceAccess<
  Action extends string = string,
  Section extends string = string,
>(authorization: unknown): ResourceAccess<Action, Section> {
  return {
    can: (action) => isActionAllowed(authorization, action),
    sees: (section) => isSectionAuthorized(authorization, section),
  };
}

type SessionIdentity = {
  tenant?: { id?: string | null } | null;
  user?: {
    id?: string | null;
    tenantId?: string | null;
    isSupportOverride?: boolean | null;
    roles?: readonly string[] | null;
    permissions?: readonly string[] | null;
  } | null;
} | null;

/**
 * Cache partition for server-projected resources. A projection fetched for one
 * identity/authority must never be served after the user, tenant, support
 * override, roles or permissions change, so the query key carries all of them.
 * An unauthenticated or incomplete session gets a scope no other session
 * shares.
 */
export function authorizationCacheScope(session: SessionIdentity): string {
  const user = session?.user;
  const tenantId = session?.tenant?.id ?? user?.tenantId ?? '';
  if (!user?.id || !tenantId) return 'anonymous';
  const roles = [...(user.roles ?? [])].sort().join(',');
  const permissions = [...(user.permissions ?? [])].sort().join(',');
  return [
    tenantId,
    user.id,
    user.isSupportOverride === true ? 'support' : 'school',
    roles,
    permissions,
  ].join('|');
}
