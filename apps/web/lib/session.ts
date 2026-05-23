import type { AuthSession, PermissionKey } from '@schoolos/core';

const SESSION_STORAGE_KEY = 'schoolos.auth-session';
export const SESSION_CLEARED_EVENT = 'schoolos:session-cleared';

// Pilot note: browser-persisted session state is metadata-only. API auth is
// backed by httpOnly cookies; future BFF work should also remove access tokens
// from browser-visible login/refresh response bodies.
export type BrowserSession = Omit<AuthSession, 'accessToken'>;

export function toBrowserSession(session: AuthSession): BrowserSession {
  return {
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    user: session.user,
    tenant: session.tenant,
  };
}

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AuthSession>;

    if ('accessToken' in parsed) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return parsed as BrowserSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function storeSession(
  session: BrowserSession | AuthSession | null,
  options: { notify?: boolean } = {},
) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);

    if (options.notify ?? true) {
      window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
    }

    return;
  }

  const browserSession =
    'accessToken' in session ? toBrowserSession(session) : session;

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(browserSession),
  );
}

export function clearStoredSession() {
  storeSession(null);
}

export function hasPermission(
  session: BrowserSession | null,
  permission: PermissionKey,
) {
  return session?.user.permissions.includes(permission) ?? false;
}

export function hasAllPermissions(
  session: BrowserSession | null,
  permissions: PermissionKey[],
) {
  return permissions.every((permission) => hasPermission(session, permission));
}

export function getSupportOverrideTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('x-schoolos-tenant-id');
}

export function getSupportOverrideReason(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('x-schoolos-tenant-override-reason');
}

export function setSupportOverride(tenantId: string, reason: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('x-schoolos-tenant-id', tenantId);
  window.sessionStorage.setItem('x-schoolos-tenant-override-reason', reason);
}

export function clearSupportOverride() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('x-schoolos-tenant-id');
  window.sessionStorage.removeItem('x-schoolos-tenant-override-reason');
}
