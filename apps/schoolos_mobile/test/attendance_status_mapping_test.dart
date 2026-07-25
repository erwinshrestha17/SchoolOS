import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';

/// Attendance is the reading a parent is most likely to act on, and the worst
/// one to get wrong. The parser used to fall through to `present`, so a child
/// recorded HALF_DAY or ON_LEAVE was shown as present for the whole day.
void main() {
  // Mirrors AttendanceStatus in prisma/schema.prisma.
  const backendValues = [
    'PRESENT',
    'ABSENT',
    'LATE',
    'HALF_DAY',
    'LEAVE',
    'ON_LEAVE',
    'HOLIDAY',
    'SICK_LEAVE',
    'EXCUSED_LEAVE',
    'UNEXCUSED_LEAVE',
  ];

  test('no backend status is silently read as present', () {
    for (final value in backendValues.where((v) => v != 'PRESENT')) {
      expect(
        attendanceStatusFromApi(value),
        isNot(AttendanceStatus.present),
        reason:
            '$value must never tell a parent their child attended a full day',
      );
    }
  });

  test('every backend status maps to a real state', () {
    for (final value in backendValues) {
      expect(
        attendanceStatusFromApi(value),
        isNot(AttendanceStatus.unknown),
        reason: '$value is a real backend status and must be mapped',
      );
    }
  });

  test('the two previously unmapped values are distinct now', () {
    expect(attendanceStatusFromApi('HALF_DAY'), AttendanceStatus.halfDay);
    expect(attendanceStatusFromApi('ON_LEAVE'), AttendanceStatus.leave);
  });

  test('leave variants collapse to leave', () {
    for (final value in [
      'LEAVE',
      'ON_LEAVE',
      'SICK_LEAVE',
      'EXCUSED_LEAVE',
      'UNEXCUSED_LEAVE',
    ]) {
      expect(attendanceStatusFromApi(value), AttendanceStatus.leave);
    }
  });

  test('an unrecognised or missing status reads as unknown', () {
    // A newly added backend status, or a corrupted payload. Saying "not
    // recorded" is honest; saying "present" is a lie the parent may act on.
    expect(
      attendanceStatusFromApi('SOME_FUTURE_STATUS'),
      AttendanceStatus.unknown,
    );
    expect(attendanceStatusFromApi(null), AttendanceStatus.unknown);
    expect(attendanceStatusFromApi(''), AttendanceStatus.unknown);
  });
}
