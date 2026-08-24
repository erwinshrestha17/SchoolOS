export type AttendanceDraftReceiptIdentity = {
  clientSubmissionId?: unknown;
  exceptions?: unknown;
  lastSyncStatus?: unknown;
  remarks?: unknown;
};

export type AttendanceDraftReceiptWriteRejectionReason =
  | "different_submission"
  | "authoritative_outcome_required"
  | "protected_status_downgrade"
  | "terminal_receipt_tombstone";

export type AttendanceDraftAuthoritativeReceipt = {
  clientSubmissionId?: unknown;
  syncStatus?: unknown;
};

export type AttendanceDraftReceiptDeleteDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "authoritative_receipt_required";
    };

export type AttendanceDraftReceiptWriteDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: AttendanceDraftReceiptWriteRejectionReason;
    };

const EDITABLE_ATTENDANCE_DRAFT_STATUSES = new Set([
  "",
  "DRAFT",
  "SAVED_LOCAL",
  "REJECTED",
]);

const AUTHORITATIVE_ATTENDANCE_DRAFT_STATUSES = new Set([
  "ACCEPTED",
  "SYNCED",
  "CONFLICTED",
]);

const TERMINAL_ATTENDANCE_RECEIPT_TOMBSTONES = new Set([
  ...AUTHORITATIVE_ATTENDANCE_DRAFT_STATUSES,
  "AUTHORIZATION_DENIED",
  "ACCESS_REVALIDATION_REQUIRED",
]);

function normalizeAttendanceDraftStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeAttendanceSubmissionId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasAttendanceDraftRosterData(value: unknown) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function isPurposeLimitedReceiptTombstone(
  draft: AttendanceDraftReceiptIdentity,
) {
  return (
    !hasAttendanceDraftRosterData(draft.exceptions) &&
    !hasAttendanceDraftRosterData(draft.remarks)
  );
}

function matchesAuthoritativeOutcome(
  draft: AttendanceDraftReceiptIdentity,
  authoritativeReceipt: AttendanceDraftAuthoritativeReceipt | undefined,
) {
  return (
    normalizeAttendanceSubmissionId(draft.clientSubmissionId) !== "" &&
    normalizeAttendanceSubmissionId(draft.clientSubmissionId) ===
      normalizeAttendanceSubmissionId(authoritativeReceipt?.clientSubmissionId) &&
    normalizeAttendanceDraftStatus(draft.lastSyncStatus) ===
      normalizeAttendanceDraftStatus(authoritativeReceipt?.syncStatus)
  );
}

/**
 * Every non-editable marker is receipt-protected, including authoritative
 * terminal outcomes. Keeping the terminal tombstone prevents a stale tab from
 * recreating an old editable intent after another tab receives the outcome.
 */
export function isAttendanceDraftReceiptProtected(
  draft: AttendanceDraftReceiptIdentity | null | undefined,
) {
  const status = normalizeAttendanceDraftStatus(draft?.lastSyncStatus);

  return !EDITABLE_ATTENDANCE_DRAFT_STATUSES.has(status);
}

export function isAttendanceDraftTerminalReceipt(
  draft: AttendanceDraftReceiptIdentity | null | undefined,
) {
  return TERMINAL_ATTENDANCE_RECEIPT_TOMBSTONES.has(
    normalizeAttendanceDraftStatus(draft?.lastSyncStatus),
  );
}

export function isPurposeLimitedAttendanceReceipt(
  draft: AttendanceDraftReceiptIdentity,
) {
  return isPurposeLimitedReceiptTombstone(draft);
}

export function decideAttendanceDraftReceiptWrite(
  existing: AttendanceDraftReceiptIdentity | null | undefined,
  incoming: AttendanceDraftReceiptIdentity,
  authoritativeReceipt?: AttendanceDraftAuthoritativeReceipt,
): AttendanceDraftReceiptWriteDecision {
  const incomingStatus = normalizeAttendanceDraftStatus(
    incoming.lastSyncStatus,
  );
  if (AUTHORITATIVE_ATTENDANCE_DRAFT_STATUSES.has(incomingStatus)) {
    if (
      !matchesAuthoritativeOutcome(incoming, authoritativeReceipt) ||
      !isPurposeLimitedReceiptTombstone(incoming)
    ) {
      return { allowed: false, reason: "authoritative_outcome_required" };
    }
  }

  if (!isAttendanceDraftReceiptProtected(existing)) {
    return { allowed: true };
  }

  const existingSubmissionId = normalizeAttendanceSubmissionId(
    existing?.clientSubmissionId,
  );
  const incomingSubmissionId = normalizeAttendanceSubmissionId(
    incoming.clientSubmissionId,
  );

  if (
    !existingSubmissionId ||
    !incomingSubmissionId ||
    existingSubmissionId !== incomingSubmissionId
  ) {
    return { allowed: false, reason: "different_submission" };
  }

  const existingStatus = normalizeAttendanceDraftStatus(
    existing?.lastSyncStatus,
  );
  if (
    TERMINAL_ATTENDANCE_RECEIPT_TOMBSTONES.has(existingStatus) ||
    AUTHORITATIVE_ATTENDANCE_DRAFT_STATUSES.has(existingStatus)
  ) {
    if (
      incomingStatus === existingStatus &&
      isPurposeLimitedReceiptTombstone(incoming)
    ) {
      return { allowed: true };
    }

    return { allowed: false, reason: "terminal_receipt_tombstone" };
  }

  if (
    incomingStatus === "REJECTED" &&
    matchesAuthoritativeOutcome(incoming, authoritativeReceipt)
  ) {
    return { allowed: true };
  }

  if (!isAttendanceDraftReceiptProtected(incoming)) {
    return { allowed: false, reason: "protected_status_downgrade" };
  }

  return { allowed: true };
}

export function decideAttendanceDraftReceiptDelete(
  existing: AttendanceDraftReceiptIdentity | null | undefined,
): AttendanceDraftReceiptDeleteDecision {
  if (!isAttendanceDraftReceiptProtected(existing)) {
    return { allowed: true };
  }

  // Protected rows transition to a purpose-limited terminal tombstone. Only
  // full session teardown clears them physically; otherwise a stale tab could
  // recreate the old final intent after deletion.
  return { allowed: false, reason: "authoritative_receipt_required" };
}

export class AttendanceDraftReceiptFenceError extends Error {
  readonly reason:
    | AttendanceDraftReceiptWriteRejectionReason
    | Exclude<
        AttendanceDraftReceiptDeleteDecision,
        { allowed: true }
      >["reason"];

  constructor(
    reason:
      | AttendanceDraftReceiptWriteRejectionReason
      | Exclude<
          AttendanceDraftReceiptDeleteDecision,
          { allowed: true }
        >["reason"],
  ) {
    super("Attendance receipt-protected draft mutation was rejected");
    this.name = "AttendanceDraftReceiptFenceError";
    this.reason = reason;
  }
}
