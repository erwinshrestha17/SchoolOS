const DB_NAME = "schoolos-offline-module-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

export type OfflineModuleDraftModule =
  | "homework"
  | "notices"
  | "fees"
  | "marks";

export type OfflineModuleDraftRecord = {
  module: OfflineModuleDraftModule;
  operationId: string;
  tenantId: string;
  userId: string;
  status: "queued" | "syncing" | "accepted" | "rejected" | "conflicted";
  payload: Record<string, unknown>;
  savedAt: string;
  rejectionReason?: string | null;
};

function recordKey(record: Pick<OfflineModuleDraftRecord, "module" | "operationId">) {
  return `${record.module}:${record.operationId}`;
}

function openDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function upsertOfflineModuleDraft(
  record: OfflineModuleDraftRecord,
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).put({
      ...record,
      key: recordKey(record),
    });
  });
}

export async function listOfflineModuleDrafts(
  module: OfflineModuleDraftModule,
  identity: { tenantId: string; userId: string },
): Promise<OfflineModuleDraftRecord[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }
  const db = await openDraftDb();
  const records = await new Promise<
    Array<OfflineModuleDraftRecord & { key: string }>
  >((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () =>
      resolve(
        (request.result ?? []) as Array<OfflineModuleDraftRecord & { key: string }>,
      );
    request.onerror = () => reject(request.error);
  });
  return records
    .filter(
      (record) =>
        record.module === module &&
        record.tenantId === identity.tenantId &&
        record.userId === identity.userId,
    )
    .map(({ key: _key, ...record }) => record);
}

export async function deleteOfflineModuleDraft(
  module: OfflineModuleDraftModule,
  operationId: string,
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).delete(recordKey({ module, operationId }));
  });
}

export async function clearOfflineModuleDrafts(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).clear();
  });
}
