import type { AttendanceDraftStorageValue } from "./session";

export type AttendanceAccessRevocationStatus =
  | "AUTHORIZATION_DENIED"
  | "ACCESS_REVALIDATION_REQUIRED";

export type AttendancePurposeLimitedReceiptStatus =
  | AttendanceAccessRevocationStatus
  | "ACCEPTED"
  | "SYNCED"
  | "CONFLICTED";

/**
 * Retains only the opaque receipt identity and scope needed to keep a denial
 * marker account-scoped. Student identifiers, remarks, display labels, and
 * server roster metadata are deliberately removed once access loss is known.
 */
export function createPurposeLimitedAttendanceReceipt(
  draft: AttendanceDraftStorageValue,
  status: AttendancePurposeLimitedReceiptStatus,
): AttendanceDraftStorageValue {
  return {
    clientSubmissionId: draft.clientSubmissionId,
    academicYearId: draft.academicYearId,
    classId: draft.classId,
    sectionId: draft.sectionId,
    attendanceDate: draft.attendanceDate,
    exceptions: {},
    remarks: {},
    savedAt: draft.savedAt,
    serverSessionId: null,
    serverSubmittedAt: null,
    lastSyncStatus: status,
  };
}

export function createAccessRevocationReceipt(
  draft: AttendanceDraftStorageValue,
  status: AttendanceAccessRevocationStatus,
): AttendanceDraftStorageValue {
  return createPurposeLimitedAttendanceReceipt(draft, status);
}

export function resolveAccessRevocationReceipt(
  liveDraft: AttendanceDraftStorageValue | null | undefined,
  fallbackDraft: AttendanceDraftStorageValue,
  status: AttendanceAccessRevocationStatus,
) {
  return createAccessRevocationReceipt(liveDraft ?? fallbackDraft, status);
}
