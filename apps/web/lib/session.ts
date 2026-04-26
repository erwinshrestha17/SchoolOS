import type { AuthSession, PermissionKey } from '@schoolos/core';

const SESSION_STORAGE_KEY = 'schoolos.auth-session';

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  storeSession(null);
}

export function hasPermission(
  session: AuthSession | null,
  permission: PermissionKey,
) {
  return session?.user.permissions.includes(permission) ?? false;
}

export function hasAllPermissions(
  session: AuthSession | null,
  permissions: PermissionKey[],
) {
  return permissions.every((permission) => hasPermission(session, permission));
}
