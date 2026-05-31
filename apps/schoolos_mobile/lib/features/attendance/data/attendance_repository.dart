import '../../../core/network/api_client.dart';
import '../domain/attendance_models.dart';

class AttendanceRepository {
  const AttendanceRepository(this._client);

  final ApiClient _client;

  Future<AttendanceSummary> getAttendanceSummary(
    String studentId,
    DateTimeRangeValue range,
  ) async {
    final response = await _client.get(
      '/attendance/students/$studentId/summary',
      queryParameters: {'month': range.start.month, 'year': range.start.year},
    );
    final data = response.data as Map<String, dynamic>;
    final monthSummary =
        data['monthSummary'] as Map<String, dynamic>? ?? const {};
    final present = monthSummary['present'] as int? ?? 0;
    final absent = monthSummary['absent'] as int? ?? 0;
    final late = monthSummary['late'] as int? ?? 0;
    final leave = monthSummary['leave'] as int? ?? 0;

    return AttendanceSummary(
      studentId: studentId,
      studentName: 'Student',
      todayStatus: present > 0
          ? AttendanceStatus.present
          : absent > 0
          ? AttendanceStatus.absent
          : AttendanceStatus.present,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      leaveCount: leave,
      lastUpdated: DateTime.now(),
    );
  }

  Future<List<AttendanceDay>> getMonthlyAttendance(
    String studentId,
    DateTime month,
  ) async {
    final first = DateTime(month.year, month.month);
    final last = DateTime(month.year, month.month + 1, 0);
    final response = await _client.get(
      '/attendance/students/$studentId/history',
      queryParameters: {
        'startDate': _dateOnly(first),
        'endDate': _dateOnly(last),
      },
    );
    final items = response.data as List<dynamic>? ?? const [];

    return items.whereType<Map<String, dynamic>>().map((item) {
      return AttendanceDay(
        date: DateTime.tryParse(item['date'] as String? ?? '') ?? first,
        status: _statusFromApi(item['status'] as String?),
      );
    }).toList();
  }

  String _dateOnly(DateTime value) {
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '${value.year}-$month-$day';
  }

  AttendanceStatus _statusFromApi(String? status) {
    switch (status) {
      case 'ABSENT':
        return AttendanceStatus.absent;
      case 'LATE':
        return AttendanceStatus.late;
      case 'LEAVE':
      case 'SICK_LEAVE':
      case 'EXCUSED_LEAVE':
      case 'UNEXCUSED_LEAVE':
        return AttendanceStatus.leave;
      case 'HOLIDAY':
        return AttendanceStatus.holiday;
      case 'PRESENT':
      default:
        return AttendanceStatus.present;
    }
  }

  Future<List<TeacherClassSection>> getTeacherAssignedClasses() async {
    // Purpose-limited teacher class APIs are not exposed yet. Keep this empty
    // instead of reusing admin-shaped class/timetable data in mobile.
    return const [];
  }

  Future<List<AttendanceStudentEntry>> getClassAttendanceSheet(
    String classSectionId,
    DateTime date,
  ) async {
    // Purpose-limited teacher attendance sheet APIs are not exposed yet.
    return const [];
  }

  Future<AttendanceSyncStatus> submitAttendance(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    // Purpose-limited teacher attendance submission APIs are not exposed yet.
    return AttendanceSyncStatus.failed;
  }

  Future<void> saveDraftAttendanceLocally(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {}

  Future<List<AttendanceStudentEntry>> loadDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    return const [];
  }
}

class DateTimeRangeValue {
  const DateTimeRangeValue({required this.start, required this.end});

  final DateTime start;
  final DateTime end;
}
