import type {
  OfflineOutboxModule,
  OfflineOutboxRecord,
  OfflineOutboxStatus,
  OfflineSyncEnvelope,
} from "@schoolos/core";

const DB_NAME = "schoolos-offline-outbox";
const DB_VERSION = 1;
const STORE_NAME = "records";

export function offlineOutboxRecordKey(
  record: Pick<
    OfflineOutboxRecord,
    "tenantId" | "userId" | "module" | "operationId"
  >,
) {
  return `${record.tenantId}:${record.userId}:${record.module}:${record.operationId}`;
}

export function isOfflineOutboxRecordOwnedBy(
  record: Pick<OfflineOutboxRecord, "tenantId" | "userId">,
  identity: { tenantId: string; userId: string },
) {
  return (
    record.tenantId === identity.tenantId && record.userId === identity.userId
  );
}

function openOutboxDb() {
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

export function toOfflineSyncEnvelope(input: {
  operationId: string;
  authorizationVersion?: string | null;
  expectedVersion?: string | null;
  authorityNodeId?: string | null;
  authorityEpoch?: number | null;
}): OfflineSyncEnvelope {
  return {
    operationId: input.operationId,
    ...(input.authorizationVersion
      ? { authorizationVersion: input.authorizationVersion }
      : {}),
    ...(input.expectedVersion ? { expectedVersion: input.expectedVersion } : {}),
    ...(input.authorityNodeId ? { authorityNodeId: input.authorityNodeId } : {}),
    ...(input.authorityEpoch != null
      ? { authorityEpoch: input.authorityEpoch }
      : {}),
  };
}

export async function upsertOfflineOutboxRecord(
  record: OfflineOutboxRecord,
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).put({
      ...record,
      key: offlineOutboxRecordKey(record),
    });
  });
}

export async function listOfflineOutboxRecords(
  identity: { tenantId: string; userId: string },
  module?: OfflineOutboxModule,
): Promise<OfflineOutboxRecord[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }
  const db = await openOutboxDb();
  const records = await new Promise<Array<OfflineOutboxRecord & { key: string }>>(
    (resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () =>
        resolve((request.result ?? []) as Array<OfflineOutboxRecord & { key: string }>);
      request.onerror = () => reject(request.error);
    },
  );
  return records
    .filter(
      (record) =>
        isOfflineOutboxRecordOwnedBy(record, identity) &&
        (!module || record.module === module),
    )
    .map(({ key: _key, ...record }) => record);
}

export async function clearOfflineOutbox(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).clear();
  });
}

export function outboxStatusFromSyncReceipt(status: string): OfflineOutboxStatus {
  switch (status.toUpperCase()) {
    case "ACCEPTED":
    case "SYNCED":
      return "accepted";
    case "CONFLICTED":
      return "conflicted";
    case "REJECTED":
      return "rejected";
    case "AUTHORIZATION_DENIED":
    case "SCOPE_REVOKED":
      return "revoked";
    case "QUEUED":
      return "queued";
    default:
      return "syncing";
  }
}
