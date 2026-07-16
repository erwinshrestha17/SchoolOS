const UNSAFE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CLEARABLE_ATTENDANCE_SYNC_STATUSES = new Set([
  "ACCEPTED",
  "SYNCED",
  "CONFLICTED",
]);
const EDITABLE_ATTENDANCE_SYNC_HTTP_STATUSES = new Set([400, 403, 404, 422]);

export const OFFLINE_MUTATION_MESSAGE =
  "This action needs an internet connection. Nothing was sent or queued.";

export type BrowserSessionIdentity = {
  tenantId: string;
  userId: string;
};

export function getBrowserSessionIdentity(
  session: unknown,
): BrowserSessionIdentity | null {
  if (!session || typeof session !== "object") {
    return null;
  }

  const candidate = session as {
    tenant?: { id?: unknown } | null;
    user?: { id?: unknown } | null;
  };
  const tenantId = candidate.tenant?.id;
  const userId = candidate.user?.id;

  if (
    typeof tenantId !== "string" ||
    !tenantId.trim() ||
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    return null;
  }

  return { tenantId, userId };
}

export function hasSameBrowserSessionIdentity(left: unknown, right: unknown) {
  const leftIdentity = getBrowserSessionIdentity(left);
  const rightIdentity = getBrowserSessionIdentity(right);

  return Boolean(
    leftIdentity &&
      rightIdentity &&
      leftIdentity.tenantId === rightIdentity.tenantId &&
      leftIdentity.userId === rightIdentity.userId,
  );
}

export function canStorePendingAttendanceDraft(
  existingKeys: readonly string[],
  targetKey: string,
  maxRecords: number,
) {
  if (!targetKey || !Number.isInteger(maxRecords) || maxRecords < 1) {
    return false;
  }

  const uniqueKeys = new Set(existingKeys);
  return uniqueKeys.has(targetKey) || uniqueKeys.size < maxRecords;
}

export function isUnsafeHttpMethod(method: string) {
  return UNSAFE_HTTP_METHODS.has(method.toUpperCase());
}

export function shouldRejectOfflineMutation(method: string, isOnline: boolean) {
  return !isOnline && isUnsafeHttpMethod(method);
}

export function isConfirmedSessionFailureStatus(statusCode: number) {
  // Only an explicit unauthenticated response proves that the cookie-backed
  // session has expired. A 403 can also mean suspended tenant, stale support
  // override, or a policy denial, so it must fail closed without deleting
  // browser-private state as though the user had logged out.
  return statusCode === 401;
}

export function shouldClearLocalAttendanceDraft(syncStatus: string) {
  return CLEARABLE_ATTENDANCE_SYNC_STATUSES.has(syncStatus.toUpperCase());
}

export function canRestoreEditableAttendanceDraftAfterSyncError(
  error: unknown,
) {
  if (error instanceof OfflineMutationError) {
    return true;
  }

  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return false;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return (
    typeof statusCode === "number" &&
    EDITABLE_ATTENDANCE_SYNC_HTTP_STATUSES.has(statusCode)
  );
}

export class OfflineMutationError extends Error {
  constructor() {
    super(OFFLINE_MUTATION_MESSAGE);
    this.name = "OfflineMutationError";
  }
}

export function assertOnlineForMutation(method: string) {
  const isOnline =
    typeof navigator === "undefined" ? true : navigator.onLine !== false;

  if (shouldRejectOfflineMutation(method, isOnline)) {
    throw new OfflineMutationError();
  }
}
