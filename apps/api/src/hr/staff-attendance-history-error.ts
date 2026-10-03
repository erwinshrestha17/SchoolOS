import { ConflictException } from '@nestjs/common';

/** Translate only named database history guards, without exposing SQL details. */
export function staffAttendanceHistoryError(
  error: unknown,
): ConflictException | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.message.includes('STAFF_ATTENDANCE_PAYROLL_LOCKED'))
    return new ConflictException(
      'Attendance belongs to a fixed payroll period. Submit a correction request for a future payroll adjustment.',
    );
  if (error.message.includes('STAFF_ATTENDANCE_CORRECTED_USE_WORKFLOW'))
    return new ConflictException(
      'Attendance has approved correction history. Submit a new correction request.',
    );
  if (
    error.message.includes('STAFF_ATTENDANCE_CORRECTION_HISTORY_IMMUTABLE') ||
    error.message.includes('STAFF_ATTENDANCE_IDENTITY_IMMUTABLE')
  )
    return new ConflictException(
      'Attendance history is immutable. Refresh and use the correction workflow.',
    );
  return undefined;
}
