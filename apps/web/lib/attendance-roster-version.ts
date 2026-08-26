export const ATTENDANCE_ROSTER_VERSION_PATTERN = /^[a-f0-9]{64}$/;

export type AttendanceRosterReplayDecision =
  | { allowed: true; mode: "current_roster" | "original_receipt" }
  | {
      allowed: false;
      reason: "missing_draft_version" | "current_roster_unavailable" | "roster_changed";
    };

export function normalizeAttendanceRosterVersion(value: unknown) {
  return typeof value === "string" &&
    ATTENDANCE_ROSTER_VERSION_PATTERN.test(value)
    ? value
    : null;
}

/**
 * A protected queued/processing receipt must replay its exact original
 * precondition so the server can return the durable outcome. An editable or
 * rejected draft may submit only when its snapshot still matches the current
 * roster read; a current roster is never attached to an older intent.
 */
export function decideAttendanceRosterReplay(input: {
  draftRosterVersion: unknown;
  currentRosterVersion: unknown;
  isProtectedReceiptReplay: boolean;
}): AttendanceRosterReplayDecision {
  if (input.isProtectedReceiptReplay) {
    return { allowed: true, mode: "original_receipt" };
  }

  const draftRosterVersion = normalizeAttendanceRosterVersion(
    input.draftRosterVersion,
  );
  if (!draftRosterVersion) {
    return { allowed: false, reason: "missing_draft_version" };
  }

  const currentRosterVersion = normalizeAttendanceRosterVersion(
    input.currentRosterVersion,
  );
  if (!currentRosterVersion) {
    return { allowed: false, reason: "current_roster_unavailable" };
  }

  if (draftRosterVersion !== currentRosterVersion) {
    return { allowed: false, reason: "roster_changed" };
  }

  return { allowed: true, mode: "current_roster" };
}
