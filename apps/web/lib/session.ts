import type { AuthSession, PermissionKey } from "@schoolos/core";
import {
  clearRecentlyViewed as clearRecentlyViewedEntries,
  readRecentlyViewed as readRecentlyViewedEntries,
  recordRecentlyViewed as recordRecentlyViewedEntry,
  type RecentlyViewedEntry,
} from "./recently-viewed";
import { canStorePendingAttendanceDraft } from "./offline-policy";

export const SESSION_STORAGE_KEY = "schoolos.auth-session";
const ATTENDANCE_DRAFT_KEY_PREFIX = "schoolos.attendance-draft:";
export const SESSION_CLEARED_EVENT = "schoolos:session-cleared";

// Pilot note: browser-persisted session state is metadata-only. API auth is
// backed by httpOnly cookies; future BFF work should also remove access tokens
// from browser-visible login/refresh response bodies.
export type BrowserSession = Omit<AuthSession, "accessToken">;
export type AttendanceDraftStorageValue = {
  clientSubmissionId: string;
  academicYearId: string;
  academicYearLabel?: string;
  classId: string;
  classLabel?: string;
  sectionId: string;
  sectionLabel?: string;
  attendanceDate: string;
  exceptions: Record<string, string>;
  remarks: Record<string, string>;
  savedAt: string;
  serverSessionId: string | null;
  serverSubmittedAt: string | null;
  lastSyncStatus?: string;
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
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AuthSession>;

    if ("accessToken" in parsed) {
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
  if (typeof window === "undefined") {
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
    "accessToken" in session ? toBrowserSession(session) : session;

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(browserSession),
  );
}

export function clearStoredSession() {
  storeSession(null);
}

export function isSessionStorageEvent(event: StorageEvent) {
  if (
    typeof window === "undefined" ||
    event.storageArea !== window.localStorage
  ) {
    return false;
  }

  return event.key === SESSION_STORAGE_KEY || event.key === null;
}

export function readRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  return readRecentlyViewedEntries(window.localStorage);
}

export function recordRecentlyViewed(
  entry: Omit<RecentlyViewedEntry, "viewedAt">,
): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  return recordRecentlyViewedEntry(window.localStorage, entry);
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  clearRecentlyViewedEntries(window.localStorage);
}

export async function readAttendanceDraft(key: string | null) {
  if (typeof window === "undefined" || !key) {
    return null;
  }

  try {
    const parsed = await readIndexedDbDraft(key);

    if (parsed && isInvalidStoredAttendanceDraft(parsed)) {
      await clearAttendanceDraft(key);
      return null;
    }

    if (parsed && isExpiredAttendanceDraft(parsed)) {
      await clearAttendanceDraft(key);
      return null;
    }

    if (parsed && !parsed.clientSubmissionId) {
      const upgraded = {
        ...parsed,
        clientSubmissionId: createAttendanceDraftSubmissionId(),
      };
      assertAttendanceDraftWithinStoragePolicy(upgraded);
      await writeIndexedDbDraftWithinCapacity(key, upgraded);
      return upgraded;
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
  if (typeof window === "undefined" || !key) {
    return;
  }

  assertAttendanceDraftWithinStoragePolicy(draft);
  await writeIndexedDbDraftWithinCapacity(key, draft);
}

export async function clearAttendanceDraft(key: string | null) {
  if (typeof window === "undefined" || !key) {
    return;
  }

  await deleteIndexedDbDraft(key);
  window.localStorage.removeItem(key);
}

export async function clearAllAttendanceDrafts() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await clearIndexedDbDrafts();
  } catch {
    // Session cleanup must still finish if IndexedDB is unavailable.
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(ATTENDANCE_DRAFT_KEY_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
}

export async function listAttendanceDraftsForCurrentBrowser(scope: {
  tenantId: string;
  userId: string;
}) {
  if (
    typeof window === "undefined" ||
    !scope.tenantId.trim() ||
    !scope.userId.trim()
  ) {
    return [] as StoredAttendanceDraft[];
  }

  const authenticatedKeyPrefix = `${ATTENDANCE_DRAFT_KEY_PREFIX}${scope.tenantId}:${scope.userId}:`;
  const drafts = await listIndexedDbDrafts();
  const discardedDrafts = drafts.filter(
    (draft) =>
      isInvalidStoredAttendanceDraft(draft) || isExpiredAttendanceDraft(draft),
  );
  await Promise.all(
    discardedDrafts.map((draft) => deleteIndexedDbDraft(draft.key)),
  );

  return drafts.filter(
    (draft) =>
      !isInvalidStoredAttendanceDraft(draft) &&
      !isExpiredAttendanceDraft(draft) &&
      draft.key.startsWith(authenticatedKeyPrefix),
  );
}

export function createAttendanceDraftSubmissionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `web-attendance-${globalThis.crypto.randomUUID()}`;
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `web-attendance-${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  }

  throw new Error("Secure attendance draft IDs are unavailable");
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

/**
 * ANY-match permission check shared by nav visibility (sidebar.tsx) and
 * route gating (app/dashboard/layout.tsx) so both stay in sync instead of
 * maintaining two separate implementations of the same "does the session
 * hold at least one of these alternative permissions" rule.
 */
export function hasAnyPermission(
  session: BrowserSession | null,
  permissions: PermissionKey[],
) {
  if (permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(session, permission));
}

export function getSupportOverrideTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("x-schoolos-tenant-id");
}

export function getSupportOverrideReason(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("x-schoolos-tenant-override-reason");
}

export function setSupportOverride(tenantId: string, reason: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem("x-schoolos-tenant-id", tenantId);
  window.sessionStorage.setItem("x-schoolos-tenant-override-reason", reason);
}

export function clearSupportOverride() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("x-schoolos-tenant-id");
  window.sessionStorage.removeItem("x-schoolos-tenant-override-reason");
}

const ATTENDANCE_DRAFT_DB_NAME = "schoolos-attendance-drafts";
const ATTENDANCE_DRAFT_STORE_NAME = "drafts";
const ATTENDANCE_DRAFT_DB_VERSION = 1;
const ATTENDANCE_DRAFT_TTL_MS = 48 * 60 * 60 * 1000;
const ATTENDANCE_DRAFT_MAX_RECORDS = 20;
const ATTENDANCE_DRAFT_MAX_BYTES = 64 * 1024;

export class AttendanceDraftCapacityError extends Error {
  constructor() {
    super(
      `This browser already has ${ATTENDANCE_DRAFT_MAX_RECORDS} pending attendance drafts. Sync or remove one before saving another.`,
    );
    this.name = "AttendanceDraftCapacityError";
  }
}

function openAttendanceDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      ATTENDANCE_DRAFT_DB_NAME,
      ATTENDANCE_DRAFT_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTENDANCE_DRAFT_STORE_NAME)) {
        db.createObjectStore(ATTENDANCE_DRAFT_STORE_NAME, { keyPath: "key" });
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
    const request = callback(
      transaction.objectStore(ATTENDANCE_DRAFT_STORE_NAME),
    );
    let requestResult: T;
    let requestError: DOMException | null = null;

    request.onsuccess = () => {
      requestResult = request.result;
    };
    request.onerror = () => {
      requestError = request.error;
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(requestResult);
    };
    transaction.onabort = () => {
      db.close();
      reject(
        requestError ??
          transaction.error ??
          new Error("Attendance draft storage transaction was aborted"),
      );
    };
  });
}

async function readIndexedDbDraft(key: string) {
  const stored = await withDraftStore<StoredAttendanceDraft | undefined>(
    "readonly",
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
    const upgraded = {
      ...legacy,
      clientSubmissionId:
        legacy.clientSubmissionId || createAttendanceDraftSubmissionId(),
    };
    assertAttendanceDraftWithinStoragePolicy(upgraded);
    await writeIndexedDbDraftWithinCapacity(key, upgraded);
    window.localStorage.removeItem(key);
    return { ...upgraded, key };
  } catch (error) {
    if (!(error instanceof AttendanceDraftCapacityError)) {
      window.localStorage.removeItem(key);
    }
    return null;
  }
}

async function writeIndexedDbDraftWithinCapacity(
  key: string,
  draft: AttendanceDraftStorageValue,
) {
  const db = await openAttendanceDraftDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      ATTENDANCE_DRAFT_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(ATTENDANCE_DRAFT_STORE_NAME);
    const request = store.getAll();
    let capacityExceeded = false;

    request.onsuccess = () => {
      const validKeys: string[] = [];

      for (const storedDraft of request.result as StoredAttendanceDraft[]) {
        if (
          isInvalidStoredAttendanceDraft(storedDraft) ||
          isExpiredAttendanceDraft(storedDraft)
        ) {
          store.delete(storedDraft.key);
          continue;
        }

        validKeys.push(storedDraft.key);
      }

      if (
        !canStorePendingAttendanceDraft(
          validKeys,
          key,
          ATTENDANCE_DRAFT_MAX_RECORDS,
        )
      ) {
        capacityExceeded = true;
        return;
      }

      store.put({ ...draft, key });
    };

    transaction.oncomplete = () => {
      db.close();

      if (capacityExceeded) {
        reject(new AttendanceDraftCapacityError());
        return;
      }

      resolve();
    };
    transaction.onabort = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Attendance draft could not be saved on this browser"),
      );
    };
  });
}

function deleteIndexedDbDraft(key: string) {
  return withDraftStore<undefined>("readwrite", (store) => store.delete(key));
}

function clearIndexedDbDrafts() {
  return withDraftStore<undefined>("readwrite", (store) => store.clear());
}

function listIndexedDbDrafts() {
  return withDraftStore<StoredAttendanceDraft[]>("readonly", (store) =>
    store.getAll(),
  );
}

function isExpiredAttendanceDraft(
  draft: Pick<AttendanceDraftStorageValue, "savedAt">,
) {
  const savedAt = new Date(draft.savedAt).getTime();
  return (
    !Number.isFinite(savedAt) || Date.now() - savedAt > ATTENDANCE_DRAFT_TTL_MS
  );
}

function isInvalidStoredAttendanceDraft(draft: StoredAttendanceDraft) {
  return (
    !draft ||
    typeof draft.key !== "string" ||
    !draft.key.trim() ||
    typeof draft.academicYearId !== "string" ||
    !draft.academicYearId.trim() ||
    typeof draft.classId !== "string" ||
    !draft.classId.trim() ||
    typeof draft.attendanceDate !== "string" ||
    !draft.attendanceDate.trim() ||
    typeof draft.savedAt !== "string" ||
    !draft.savedAt.trim() ||
    !draft.exceptions ||
    typeof draft.exceptions !== "object" ||
    Array.isArray(draft.exceptions) ||
    !draft.remarks ||
    typeof draft.remarks !== "object" ||
    Array.isArray(draft.remarks)
  );
}

function assertAttendanceDraftWithinStoragePolicy(
  draft: AttendanceDraftStorageValue,
) {
  if (
    typeof draft.clientSubmissionId !== "string" ||
    !draft.clientSubmissionId.trim() ||
    typeof draft.academicYearId !== "string" ||
    !draft.academicYearId.trim() ||
    typeof draft.classId !== "string" ||
    !draft.classId.trim() ||
    typeof draft.attendanceDate !== "string" ||
    !draft.attendanceDate.trim() ||
    typeof draft.savedAt !== "string" ||
    !draft.savedAt.trim() ||
    !draft.exceptions ||
    typeof draft.exceptions !== "object" ||
    Array.isArray(draft.exceptions) ||
    !draft.remarks ||
    typeof draft.remarks !== "object" ||
    Array.isArray(draft.remarks)
  ) {
    throw new Error("Attendance draft is not valid for browser storage");
  }

  if (isExpiredAttendanceDraft(draft)) {
    throw new Error("Attendance draft has expired");
  }

  const sizeBytes = new TextEncoder().encode(JSON.stringify(draft)).byteLength;
  if (sizeBytes > ATTENDANCE_DRAFT_MAX_BYTES) {
    throw new Error("Attendance draft is too large for browser storage");
  }
}
