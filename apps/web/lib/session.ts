import type {
  AuthSession,
  PermissionKey,
  SupportOverrideBrowserContext,
} from "@schoolos/core";
import { hasEffectivePermission, isSupportOverrideScope } from "@schoolos/core";
import {
  clearRecentlyViewed as clearRecentlyViewedEntries,
  readRecentlyViewed as readRecentlyViewedEntries,
  recordRecentlyViewed as recordRecentlyViewedEntry,
  type RecentlyViewedEntry,
} from "./recently-viewed";
import { canStorePendingAttendanceDraft } from "./offline-policy";
import {
  AttendanceDraftStorageFence,
  type AttendanceDraftStorageTicket,
} from "./attendance-draft-storage-fence";
import { resolveAttendanceDraftRead } from "./attendance-draft-read-result";
import {
  AttendanceDraftReceiptFenceError,
  decideAttendanceDraftReceiptDelete,
  decideAttendanceDraftReceiptWrite,
  isAttendanceDraftReceiptProtected,
  isAttendanceDraftTerminalReceipt,
  isPurposeLimitedAttendanceReceipt,
  type AttendanceDraftAuthoritativeReceipt,
  type AttendanceDraftReceiptIdentity,
} from "./attendance-draft-receipt-fence";
import {
  resolveAccessRevocationReceipt,
  type AttendanceAccessRevocationStatus,
} from "./attendance-draft-access-revocation";

export const SESSION_STORAGE_KEY = "schoolos.auth-session";
const ATTENDANCE_DRAFT_KEY_PREFIX = "schoolos.attendance-draft:";
export const ATTENDANCE_DRAFT_RECEIPT_BARRIER_KEY_PREFIX =
  "schoolos.attendance-draft-receipt-barrier:";
export const SESSION_CLEARED_EVENT = "schoolos:session-cleared";
export const SUPPORT_OVERRIDE_STORAGE_KEY = "schoolos.support-override.v1";
const LEGACY_SUPPORT_OVERRIDE_TENANT_KEY = "x-schoolos-tenant-id";
const LEGACY_SUPPORT_OVERRIDE_REASON_KEY = "x-schoolos-tenant-override-reason";
const attendanceDraftStorageFence = new AttendanceDraftStorageFence();

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

type AttendanceDraftStorageOptions = {
  ticket?: AttendanceDraftStorageTicket;
};

type AttendanceDraftWriteOptions = AttendanceDraftStorageOptions & {
  authoritativeReceipt?: AttendanceDraftAuthoritativeReceipt;
};

type AttendanceDraftClearOptions = AttendanceDraftStorageOptions;

export type { AttendanceDraftStorageTicket };

export function captureAttendanceDraftStorageTicket() {
  return attendanceDraftStorageFence.captureTicket();
}

export function isAttendanceDraftStorageTicketCurrent(
  ticket: AttendanceDraftStorageTicket,
) {
  return attendanceDraftStorageFence.isCurrent(ticket);
}

export function isAttendanceDraftReceiptBarrierStorageEvent(
  event: StorageEvent,
  draftKey: string,
) {
  return (
    typeof window !== "undefined" &&
    event.storageArea === window.localStorage &&
    event.key === attendanceDraftReceiptBarrierKey(draftKey)
  );
}

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

export async function readAttendanceDraft(
  key: string | null,
  options: AttendanceDraftStorageOptions = {},
) {
  if (typeof window === "undefined" || !key) {
    return { status: "missing" } as const;
  }

  const ticket = options.ticket ?? attendanceDraftStorageFence.captureTicket();

  return resolveAttendanceDraftRead(() =>
    attendanceDraftStorageFence.run(ticket, async () => {
      const barrier = readAttendanceDraftReceiptBarrier(key);
      if (barrier) {
        return barrier;
      }

      const parsed = await readIndexedDbDraft(key);

      if (parsed && isInvalidStoredAttendanceDraft(parsed)) {
        await deleteAttendanceDraftStorage(key);
        return null;
      }

      if (parsed && isExpiredAttendanceDraft(parsed)) {
        if (isAttendanceDraftReceiptProtected(parsed)) {
          // An unresolved receipt is authority evidence, not an editable
          // cache entry. Keep it beyond the normal 48-hour draft TTL until a
          // matching authoritative receipt or session teardown clears it.
          return parsed;
        }

        await deleteAttendanceDraftStorage(key);
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
    }),
  );
}

export async function storeAttendanceDraft(
  key: string | null,
  draft: AttendanceDraftStorageValue,
  options: AttendanceDraftWriteOptions = {},
) {
  if (typeof window === "undefined" || !key) {
    return;
  }

  const ticket = options.ticket ?? attendanceDraftStorageFence.captureTicket();
  await attendanceDraftStorageFence.run(ticket, async () => {
    assertAttendanceDraftWithinStoragePolicy(draft);
    const barrier = readAttendanceDraftReceiptBarrier(key);
    const barrierDecision = decideAttendanceDraftReceiptWrite(
      barrier,
      draft,
      options.authoritativeReceipt,
    );
    if (!barrierDecision.allowed) {
      throw new AttendanceDraftReceiptFenceError(barrierDecision.reason);
    }

    if (isAttendanceDraftTerminalReceipt(draft)) {
      persistAttendanceDraftReceiptBarrier(key, draft);
    }

    await writeIndexedDbDraftWithinCapacity(
      key,
      draft,
      options.authoritativeReceipt,
    );
  });
}

export async function sanitizeAttendanceDraftForAccessRevocation(
  key: string | null,
  fallbackDraft: AttendanceDraftStorageValue,
  status: AttendanceAccessRevocationStatus,
  options: AttendanceDraftStorageOptions = {},
) {
  if (typeof window === "undefined" || !key) {
    return resolveAccessRevocationReceipt(null, fallbackDraft, status);
  }

  const ticket = options.ticket ?? attendanceDraftStorageFence.captureTicket();
  return attendanceDraftStorageFence.run(ticket, async () => {
    const legacyRaw = window.localStorage.getItem(key);
    const barrierDraft = resolveAccessRevocationReceipt(
      readAttendanceDraftReceiptBarrier(key),
      fallbackDraft,
      status,
    );

    // The synchronous browser marker is written before IndexedDB is touched.
    // If IDB is unavailable or the page closes mid-sanitization, subsequent
    // reads and stale tabs still fail closed instead of rehydrating roster PII.
    persistAttendanceDraftReceiptBarrier(key, barrierDraft);

    const tombstone = await writeIndexedDbAccessRevocationReceipt(
      key,
      barrierDraft,
      status,
    );
    persistAttendanceDraftReceiptBarrier(key, tombstone);

    if (legacyRaw !== null) {
      removeLegacyAttendanceDraftIfUnchanged(key, legacyRaw);
    }

    return tombstone;
  });
}

export async function clearAttendanceDraft(
  key: string | null,
  options: AttendanceDraftClearOptions = {},
) {
  if (typeof window === "undefined" || !key) {
    return;
  }

  const ticket = options.ticket ?? attendanceDraftStorageFence.captureTicket();
  await attendanceDraftStorageFence.run(ticket, () =>
    deleteAttendanceDraftStorage(key),
  );
}

export async function clearAllAttendanceDrafts() {
  const cleanupTicket = attendanceDraftStorageFence.invalidate();
  if (typeof window === "undefined") {
    return;
  }

  await attendanceDraftStorageFence.run(cleanupTicket, async () => {
    try {
      await clearIndexedDbDrafts();
    } catch {
      // Session cleanup must still finish if IndexedDB is unavailable.
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key?.startsWith(ATTENDANCE_DRAFT_KEY_PREFIX) ||
        key?.startsWith(ATTENDANCE_DRAFT_RECEIPT_BARRIER_KEY_PREFIX)
      ) {
        window.localStorage.removeItem(key);
      }
    }
  });
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

  const ticket = attendanceDraftStorageFence.captureTicket();
  return attendanceDraftStorageFence.run(ticket, async () => {
    const authenticatedKeyPrefix = `${ATTENDANCE_DRAFT_KEY_PREFIX}${scope.tenantId}:${scope.userId}:`;
    const drafts = await listIndexedDbDrafts();
    const barrierDrafts = listAttendanceDraftReceiptBarriers();
    const draftsByKey = new Map(
      drafts.map((draft) => [draft.key, draft] as const),
    );
    for (const barrierDraft of barrierDrafts) {
      draftsByKey.set(barrierDraft.key, barrierDraft);
    }
    const visibleDrafts = [...draftsByKey.values()];
    const discardedDrafts = drafts.filter(
      (draft) =>
        !isAttendanceDraftReceiptProtected(draft) &&
        (isInvalidStoredAttendanceDraft(draft) ||
          isExpiredAttendanceDraft(draft)),
    );
    await Promise.allSettled(
      discardedDrafts.map((draft) => deleteIndexedDbDraft(draft.key)),
    );

    return visibleDrafts.filter(
      (draft) =>
        !isInvalidStoredAttendanceDraft(draft) &&
        (!isExpiredAttendanceDraft(draft) ||
          isAttendanceDraftReceiptProtected(draft)) &&
        draft.key.startsWith(authenticatedKeyPrefix),
    );
  });
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

/**
 * Permission check that evaluates the same rule as the backend guard.
 * Ordinary school sessions keep compatibility aliases, while support
 * overrides are restricted to the exact permissions projected for their
 * approved scopes.
 */
export function hasPermission(
  session: BrowserSession | null,
  permission: PermissionKey,
) {
  const grantedPermissions = session?.user.permissions ?? [];

  if (session?.user.isSupportOverride) {
    return grantedPermissions.includes(permission);
  }

  return hasEffectivePermission(grantedPermissions, permission);
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

export function readSupportOverrideContext(): SupportOverrideBrowserContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SUPPORT_OVERRIDE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const candidate = JSON.parse(raw) as Partial<SupportOverrideBrowserContext>;
    const scopes = candidate.scopes;
    const expiresAt =
      typeof candidate.expiresAt === "string"
        ? Date.parse(candidate.expiresAt)
        : Number.NaN;
    const validScopes =
      Array.isArray(scopes) &&
      scopes.length > 0 &&
      new Set(scopes).size === scopes.length &&
      scopes.every(
        (scope) => typeof scope === "string" && isSupportOverrideScope(scope),
      );

    if (
      candidate.version !== 1 ||
      typeof candidate.overrideId !== "string" ||
      !candidate.overrideId.trim() ||
      typeof candidate.tenantId !== "string" ||
      !candidate.tenantId.trim() ||
      typeof candidate.reason !== "string" ||
      candidate.reason.trim().length < 5 ||
      candidate.reason !== candidate.reason.trim() ||
      candidate.readOnly !== true ||
      !validScopes ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      clearSupportOverride();
      return null;
    }

    return candidate as SupportOverrideBrowserContext;
  } catch {
    clearSupportOverride();
    return null;
  }
}

export function getSupportOverrideTenantId(): string | null {
  return readSupportOverrideContext()?.tenantId ?? null;
}

export function getSupportOverrideReason(): string | null {
  return readSupportOverrideContext()?.reason ?? null;
}

export function setSupportOverride(
  context: Omit<SupportOverrideBrowserContext, "version">,
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    SUPPORT_OVERRIDE_STORAGE_KEY,
    JSON.stringify({ version: 1, ...context }),
  );
  window.sessionStorage.removeItem(LEGACY_SUPPORT_OVERRIDE_TENANT_KEY);
  window.sessionStorage.removeItem(LEGACY_SUPPORT_OVERRIDE_REASON_KEY);
}

export function clearSupportOverride() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SUPPORT_OVERRIDE_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_SUPPORT_OVERRIDE_TENANT_KEY);
  window.sessionStorage.removeItem(LEGACY_SUPPORT_OVERRIDE_REASON_KEY);
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

  let upgraded: AttendanceDraftStorageValue;
  try {
    const legacy = JSON.parse(legacyRaw) as AttendanceDraftStorageValue;
    upgraded = {
      ...legacy,
      clientSubmissionId:
        legacy.clientSubmissionId || createAttendanceDraftSubmissionId(),
    };
    assertAttendanceDraftWithinStoragePolicy(upgraded);
  } catch {
    removeLegacyAttendanceDraftIfUnchanged(key, legacyRaw);
    return null;
  }

  try {
    await writeIndexedDbDraftWithinCapacity(key, upgraded);
    removeLegacyAttendanceDraftIfUnchanged(key, legacyRaw);
    return { ...upgraded, key };
  } catch (error) {
    // The parsed legacy copy is still the only durable draft. Preserve it and
    // surface storage as unavailable until migration can commit successfully.
    throw error;
  }
}

async function writeIndexedDbAccessRevocationReceipt(
  key: string,
  fallbackDraft: AttendanceDraftStorageValue,
  status: AttendanceAccessRevocationStatus,
) {
  const db = await openAttendanceDraftDb();

  return new Promise<AttendanceDraftStorageValue>((resolve, reject) => {
    const transaction = db.transaction(
      ATTENDANCE_DRAFT_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(ATTENDANCE_DRAFT_STORE_NAME);
    const request = store.get(key);
    let tombstone: AttendanceDraftStorageValue | null = null;
    let operationError: unknown = null;

    request.onsuccess = () => {
      try {
        const liveDraft = request.result as StoredAttendanceDraft | undefined;
        tombstone = resolveAccessRevocationReceipt(
          liveDraft,
          fallbackDraft,
          status,
        );
        assertAttendanceDraftStorageShapeAndSize(tombstone);
        store.put({ ...tombstone, key });
      } catch (error) {
        operationError = error;
        transaction.abort();
      }
    };

    transaction.oncomplete = () => {
      db.close();

      if (!tombstone) {
        reject(
          new Error("Attendance access revocation receipt was not stored"),
        );
        return;
      }

      resolve(tombstone);
    };
    transaction.onabort = () => {
      db.close();
      reject(
        operationError ??
          transaction.error ??
          new Error("Attendance access revocation receipt was not stored"),
      );
    };
  });
}

async function writeIndexedDbDraftWithinCapacity(
  key: string,
  draft: AttendanceDraftStorageValue,
  authoritativeReceipt?: AttendanceDraftAuthoritativeReceipt,
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
    let receiptFenceError: AttendanceDraftReceiptFenceError | null = null;

    request.onsuccess = () => {
      const storedDrafts = request.result as StoredAttendanceDraft[];
      const existingDraft = storedDrafts.find(
        (storedDraft) => storedDraft.key === key,
      );
      const receiptWriteDecision = decideAttendanceDraftReceiptWrite(
        existingDraft,
        draft,
        authoritativeReceipt,
      );

      if (!receiptWriteDecision.allowed) {
        receiptFenceError = new AttendanceDraftReceiptFenceError(
          receiptWriteDecision.reason,
        );
        return;
      }

      const validKeys: string[] = [];

      for (const storedDraft of storedDrafts) {
        if (isAttendanceDraftTerminalReceipt(storedDraft)) {
          // A terminal per-key receipt remains as a resurrection fence but no
          // longer consumes one of the bounded editable/pending draft slots.
          continue;
        }

        if (
          isInvalidStoredAttendanceDraft(storedDraft) ||
          isExpiredAttendanceDraft(storedDraft)
        ) {
          if (isAttendanceDraftReceiptProtected(storedDraft)) {
            validKeys.push(storedDraft.key);
            continue;
          }

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

      if (receiptFenceError) {
        reject(receiptFenceError);
        return;
      }

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

async function deleteIndexedDbDraft(
  key: string,
) {
  const db = await openAttendanceDraftDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      ATTENDANCE_DRAFT_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(ATTENDANCE_DRAFT_STORE_NAME);
    const request = store.get(key);
    let receiptFenceError: AttendanceDraftReceiptFenceError | null = null;

    request.onsuccess = () => {
      const storedDraft = request.result as StoredAttendanceDraft | undefined;
      const receiptDeleteDecision = decideAttendanceDraftReceiptDelete(storedDraft);
      if (!receiptDeleteDecision.allowed) {
        receiptFenceError = new AttendanceDraftReceiptFenceError(
          receiptDeleteDecision.reason,
        );
        return;
      }

      store.delete(key);
    };

    transaction.oncomplete = () => {
      db.close();

      if (receiptFenceError) {
        reject(receiptFenceError);
        return;
      }

      resolve();
    };
    transaction.onabort = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Attendance draft could not be removed from this browser"),
      );
    };
  });
}

async function deleteAttendanceDraftStorage(
  key: string,
) {
  const barrier = readAttendanceDraftReceiptBarrier(key);
  const barrierDeleteDecision = decideAttendanceDraftReceiptDelete(barrier);
  if (!barrierDeleteDecision.allowed) {
    throw new AttendanceDraftReceiptFenceError(barrierDeleteDecision.reason);
  }

  const legacyRaw = window.localStorage.getItem(key);
  if (legacyRaw) {
    try {
      const legacyDraft = JSON.parse(
        legacyRaw,
      ) as AttendanceDraftReceiptIdentity;
      const legacyDeleteDecision = decideAttendanceDraftReceiptDelete(legacyDraft);
      if (!legacyDeleteDecision.allowed) {
        throw new AttendanceDraftReceiptFenceError(legacyDeleteDecision.reason);
      }
    } catch (error) {
      if (error instanceof AttendanceDraftReceiptFenceError) {
        throw error;
      }
      // Invalid legacy JSON is not authoritative and may be removed once the
      // IndexedDB transaction confirms there is no protected current record.
    }
  }

  await deleteIndexedDbDraft(key);
  if (legacyRaw !== null) {
    removeLegacyAttendanceDraftIfUnchanged(key, legacyRaw);
  }
}

function attendanceDraftReceiptBarrierKey(draftKey: string) {
  return `${ATTENDANCE_DRAFT_RECEIPT_BARRIER_KEY_PREFIX}${draftKey}`;
}

function persistAttendanceDraftReceiptBarrier(
  draftKey: string,
  draft: AttendanceDraftStorageValue,
) {
  if (
    !isAttendanceDraftTerminalReceipt(draft) ||
    !isPurposeLimitedAttendanceReceipt(draft)
  ) {
    throw new Error("Attendance receipt barrier must be purpose-limited");
  }

  assertAttendanceDraftStorageShapeAndSize(draft);
  window.localStorage.setItem(
    attendanceDraftReceiptBarrierKey(draftKey),
    JSON.stringify(draft),
  );
}

function readAttendanceDraftReceiptBarrier(
  draftKey: string,
): StoredAttendanceDraft | null {
  const barrierKey = attendanceDraftReceiptBarrierKey(draftKey);
  const raw = window.localStorage.getItem(barrierKey);
  if (!raw) return null;

  try {
    const parsed = {
      ...(JSON.parse(raw) as AttendanceDraftStorageValue),
      key: draftKey,
    };
    if (
      isInvalidStoredAttendanceDraft(parsed) ||
      !isAttendanceDraftTerminalReceipt(parsed) ||
      !isPurposeLimitedAttendanceReceipt(parsed)
    ) {
      removeLegacyAttendanceDraftIfUnchanged(barrierKey, raw);
      return null;
    }
    return parsed;
  } catch {
    removeLegacyAttendanceDraftIfUnchanged(barrierKey, raw);
    return null;
  }
}

function listAttendanceDraftReceiptBarriers() {
  const barriers: StoredAttendanceDraft[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const barrierKey = window.localStorage.key(index);
    if (!barrierKey?.startsWith(ATTENDANCE_DRAFT_RECEIPT_BARRIER_KEY_PREFIX)) {
      continue;
    }

    const draftKey = barrierKey.slice(
      ATTENDANCE_DRAFT_RECEIPT_BARRIER_KEY_PREFIX.length,
    );
    if (!draftKey) continue;
    const barrier = readAttendanceDraftReceiptBarrier(draftKey);
    if (barrier) barriers.push(barrier);
  }

  return barriers;
}

function removeLegacyAttendanceDraftIfUnchanged(
  key: string,
  expectedValue: string,
) {
  if (window.localStorage.getItem(key) === expectedValue) {
    window.localStorage.removeItem(key);
  }
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
  assertAttendanceDraftStorageShapeAndSize(draft);

  if (isExpiredAttendanceDraft(draft)) {
    throw new Error("Attendance draft has expired");
  }
}

function assertAttendanceDraftStorageShapeAndSize(
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

  const sizeBytes = new TextEncoder().encode(JSON.stringify(draft)).byteLength;
  if (sizeBytes > ATTENDANCE_DRAFT_MAX_BYTES) {
    throw new Error("Attendance draft is too large for browser storage");
  }
}
