const DB_NAME = "schoolos-offline-read-cache";
const DB_VERSION = 1;
const STORE_NAME = "reads";
const MAX_RECORDS = 64;
const MAX_RECORD_BYTES = 256 * 1024;
export const OFFLINE_READ_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type OfflineReadCacheRecord = {
  cacheKey: string;
  tenantId: string;
  userId: string;
  savedAt: string;
  payload: unknown;
};

function openReadCacheDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function writeOfflineReadCache(
  record: OfflineReadCacheRecord,
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > MAX_RECORD_BYTES) {
    return;
  }
  const db = await openReadCacheDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const existing = (request.result ?? []) as OfflineReadCacheRecord[];
      existing
        .filter((item) => item.cacheKey !== record.cacheKey)
        .sort(
          (left, right) =>
            Date.parse(right.savedAt) - Date.parse(left.savedAt),
        )
        .slice(MAX_RECORDS - 1)
        .forEach((item) => store.delete(item.cacheKey));
      store.put(record);
    };
  });
}

export async function readOfflineReadCache<T>(
  cacheKey: string,
  identity: { tenantId: string; userId: string },
  now = new Date(),
): Promise<T | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  const db = await openReadCacheDb();
  const record = await new Promise<OfflineReadCacheRecord | undefined>(
    (resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(cacheKey);
      request.onsuccess = () =>
        resolve(request.result as OfflineReadCacheRecord | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  if (
    !record ||
    record.tenantId !== identity.tenantId ||
    record.userId !== identity.userId ||
    !isOfflineReadCacheRecordFresh(record, now)
  ) {
    return null;
  }
  return record.payload as T;
}

export async function clearOfflineReadCache(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openReadCacheDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).clear();
  });
}

export async function withOfflineReadCache<T>(
  cacheKey: string,
  identity: { tenantId: string; userId: string } | null,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const payload = await fetcher();
    if (identity) {
      try {
        await writeOfflineReadCache({
          cacheKey,
          tenantId: identity.tenantId,
          userId: identity.userId,
          savedAt: new Date().toISOString(),
          payload,
        });
      } catch {
        // Cache persistence must not hide a successful authoritative response.
      }
    }
    return payload;
  } catch (error) {
    if (!identity || !isOfflineReadTransportError(error)) {
      throw error;
    }
    const cached = await readOfflineReadCache<T>(cacheKey, identity);
    if (cached == null) {
      throw error;
    }
    return cached;
  }
}

export function isOfflineReadTransportError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "TypeError" || error.name === "AbortError";
}

export function isOfflineReadCacheRecordFresh(
  record: Pick<OfflineReadCacheRecord, "savedAt">,
  now = new Date(),
) {
  const savedAt = Date.parse(record.savedAt);
  return (
    Number.isFinite(savedAt) &&
    savedAt <= now.getTime() &&
    now.getTime() - savedAt <= OFFLINE_READ_MAX_AGE_MS
  );
}
