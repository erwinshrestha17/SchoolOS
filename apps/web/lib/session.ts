import type { AuthSession, PermissionKey } from '@schoolos/core';
import {
  clearRecentlyViewed as clearRecentlyViewedEntries,
  readRecentlyViewed as readRecentlyViewedEntries,
  recordRecentlyViewed as recordRecentlyViewedEntry,
  type RecentlyViewedEntry,
} from './recently-viewed';

const SESSION_STORAGE_KEY = 'schoolos.auth-session';
export const SESSION_CLEARED_EVENT = 'schoolos:session-cleared';

// Pilot note: browser-persisted session state is metadata-only. API auth is
// backed by httpOnly cookies; future BFF work should also remove access tokens
// from browser-visible login/refresh response bodies.
export type BrowserSession = Omit<AuthSession, 'accessToken'>;
export type AttendanceDraftStorageValue = {
  academicYearId: string;
  classId: string;
  sectionId: string;
  attendanceDate: string;
  exceptions: Record<string, string>;
  remarks: Record<string, string>;
  savedAt: string;
  serverSessionId: string | null;
  serverSubmittedAt: string | null;
};

export type StoredAttendanceDraft = AttendanceDraftStorageValue & {
  key: string;
};

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

export function readRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  return readRecentlyViewedEntries(window.localStorage);
}

export function recordRecentlyViewed(
  entry: Omit<RecentlyViewedEntry, 'viewedAt'>,
): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  return recordRecentlyViewedEntry(window.localStorage, entry);
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  clearRecentlyViewedEntries(window.localStorage);
}

export async function readAttendanceDraft(key: string | null) {
  if (typeof window === 'undefined' || !key) {
    return null;
  }

  try {
    const parsed = await readIndexedDbDraft(key);

    if (
      parsed &&
      (!parsed.academicYearId || !parsed.classId || !parsed.attendanceDate)
    ) {
      await clearAttendanceDraft(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function storeAttendanceDraft(
  key: string | null,
  draft: AttendanceDraftStorageValue,
) {
  if (typeof window === 'undefined' || !key) {
    return;
  }

  await writeIndexedDbDraft(key, draft);
}

export async function clearAttendanceDraft(key: string | null) {
  if (typeof window === 'undefined' || !key) {
    return;
  }

  await deleteIndexedDbDraft(key);
  window.localStorage.removeItem(key);
}

export async function listAttendanceDraftsForCurrentBrowser() {
  if (typeof window === 'undefined') {
    return [] as StoredAttendanceDraft[];
  }

  return listIndexedDbDrafts();
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

const ATTENDANCE_DRAFT_DB_NAME = 'schoolos-attendance-drafts';
const ATTENDANCE_DRAFT_STORE_NAME = 'drafts';
const ATTENDANCE_DRAFT_DB_VERSION = 1;

function openAttendanceDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      ATTENDANCE_DRAFT_DB_NAME,
      ATTENDANCE_DRAFT_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTENDANCE_DRAFT_STORE_NAME)) {
        db.createObjectStore(ATTENDANCE_DRAFT_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withDraftStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openAttendanceDraftDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(ATTENDANCE_DRAFT_STORE_NAME, mode);
    const request = callback(transaction.objectStore(ATTENDANCE_DRAFT_STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function readIndexedDbDraft(key: string) {
  const stored = await withDraftStore<StoredAttendanceDraft | undefined>(
    'readonly',
    (store) => store.get(key),
  );

  if (stored) {
    return stored;
  }

  const legacyRaw = window.localStorage.getItem(key);
  if (!legacyRaw) {
    return null;
  }

  try {
    const legacy = JSON.parse(legacyRaw) as AttendanceDraftStorageValue;
    await writeIndexedDbDraft(key, legacy);
    window.localStorage.removeItem(key);
    return { ...legacy, key };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeIndexedDbDraft(key: string, draft: AttendanceDraftStorageValue) {
  return withDraftStore<IDBValidKey>('readwrite', (store) =>
    store.put({ ...draft, key }),
  );
}

function deleteIndexedDbDraft(key: string) {
  return withDraftStore<undefined>('readwrite', (store) => store.delete(key));
}

function listIndexedDbDrafts() {
  return withDraftStore<StoredAttendanceDraft[]>('readonly', (store) =>
    store.getAll(),
  );
}
