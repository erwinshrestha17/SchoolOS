/**
 * Shared offline mutation envelope. Domain payloads sit beside these fields.
 * Attendance uses `clientSubmissionId` as `operationId` and teacher
 * `scopeVersion` as `authorizationVersion`.
 */
export type OfflineSyncEnvelope = {
  operationId: string;
  authorizationVersion?: string;
  expectedVersion?: string;
  authorityNodeId?: string;
  authorityEpoch?: number;
};

export type OfflineSyncReceiptStatus =
  | "PROCESSING"
  | "ACCEPTED"
  | "SYNCED"
  | "CONFLICTED"
  | "REJECTED";

export type OfflineSyncReceipt = {
  operationId: string;
  syncStatus: OfflineSyncReceiptStatus;
  replayed: boolean;
  rejectionReason: string | null;
};

export type OfflineOutboxModule =
  | "attendance"
  | "homework"
  | "notices"
  | "fees"
  | "marks";

export type OfflineOutboxStatus =
  | "queued"
  | "syncing"
  | "accepted"
  | "rejected"
  | "conflicted"
  | "revoked";

export type OfflineOutboxRecord = OfflineSyncEnvelope & {
  tenantId: string;
  userId: string;
  module: OfflineOutboxModule;
  status: OfflineOutboxStatus;
  replayed?: boolean;
  rejectionReason?: string | null;
};

export type SchoolAuthorityFence = {
  authorityNodeId: string;
  authorityEpoch: number;
};
