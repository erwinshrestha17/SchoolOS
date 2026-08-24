export type AttendanceDraftReadResult<T> =
  | { status: "found"; draft: T }
  | { status: "missing" }
  | { status: "unavailable" };

/**
 * Keeps a missing draft distinct from storage that could not be read. Final
 * attendance intent may be receipt-protected in that unreadable record, so a
 * storage failure must never be treated as permission to create a new intent.
 */
export async function resolveAttendanceDraftRead<T>(
  read: () => Promise<T | null>,
): Promise<AttendanceDraftReadResult<T>> {
  try {
    const draft = await read();
    return draft === null ? { status: "missing" } : { status: "found", draft };
  } catch {
    return { status: "unavailable" };
  }
}
