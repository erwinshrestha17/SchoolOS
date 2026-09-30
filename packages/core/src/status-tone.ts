/**
 * The ONE semantic status → tone table for SchoolOS (Phase 4G). Web renders it
 * through <StatusBadge>, mobile mirrors it in `status_tone.dart`; a contract
 * test fails if the two drift, so "overdue" can never be red on one surface
 * and amber on the other.
 */

export type StatusTone =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "published"
  | "locked"
  | "paid"
  | "partial"
  | "unpaid"
  | "overdue"
  | "waived"
  | "refunded"
  | "conflict"
  | "info";

export const STATUS_TONE_MAP: Readonly<Record<string, StatusTone>> = {
  ACTIVE: "active",
  OPEN: "active",
  RESOLVED: "approved",
  INACTIVE: "inactive",
  CLOSED: "locked",
  CANCELLED: "inactive",
  PENDING: "pending",
  QUEUED: "pending",
  PENDING_CONFIRMATION: "pending",
  RETRYING: "pending",
  RETRIED: "pending",
  SUBMITTED: "pending",
  PROCESSING: "pending",
  DISPATCHING: "pending",
  SCHEDULED: "pending",
  APPROVAL_PENDING: "pending",
  SUCCEEDED: "approved",
  APPROVED: "approved",
  REVIEWED: "approved",
  ACTION_TAKEN: "approved",
  REJECTED: "rejected",
  ACCESS_DENIED: "rejected",
  ACCESS_REVOKED: "rejected",
  LOCAL_DRAFT_UNAVAILABLE: "rejected",
  NEEDS_CORRECTION: "partial",
  PARTIALLY_SUCCEEDED: "partial",
  PARTIALLY_DELIVERED: "partial",
  DISMISSED: "rejected",
  FAILED: "rejected",
  EXPIRED: "rejected",
  SKIPPED: "inactive",
  ARCHIVED: "inactive",
  DRAFT: "draft",
  SENT: "published",
  DELIVERED: "published",
  PUBLISHED: "published",
  READ: "approved",
  LOCKED: "locked",
  POSTED: "locked",
  FINALIZED: "locked",
  REVERSED: "refunded",
  RETURNED: "partial",
  RESUBMITTED: "pending",
  CORRECTED: "info",
  CORRECTION_REQUESTED: "partial",
  CONFLICTED: "conflict",
  PAID: "paid",
  PARTIAL: "partial",
  UNPAID: "unpaid",
  OVERDUE: "overdue",
  WAIVED: "waived",
  REFUNDED: "refunded",
  CONFLICT: "conflict",
  ESCALATED: "conflict",
  TRANSFERRED: "pending",
  ALUMNI: "published",
  GRADUATED: "published",
  DEACTIVATED: "inactive",
  WITHDRAWN: "inactive",
  PRESENT: "approved",
  ABSENT: "rejected",
  LATE: "partial",
  SICK_LEAVE: "info",
  EXCUSED_LEAVE: "info",
  UNEXCUSED_LEAVE: "partial",
  DUE: "pending",
  NOT_RECORDED: "draft",
  SYNCING: "pending",
  SYNCED: "approved",
  UNAVAILABLE: "inactive",
};

/** Tone for a backend status string; unknown statuses read as neutral info. */
export function resolveStatusTone(status: string): StatusTone {
  return STATUS_TONE_MAP[status.trim().toUpperCase()] ?? "info";
}
