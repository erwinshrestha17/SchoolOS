import '../../../core/network/api_client.dart';
import '../domain/attendance_models.dart';

class AttendanceRepository {
  const AttendanceRepository(this._client);

  final ApiClient _client;

  Future<AttendanceSnapshot> getParentAttendanceSnapshot(
    String studentId,
    DateTime month,
  ) async {
    final response = await _client.get(
      '/mobile/students/$studentId/attendance-summary',
      queryParameters: {'month': month.month, 'year': month.year},
    );
    final data = response.data as Map<String, dynamic>;
    final today = _asMap(data['today']);
    final monthSummary = _asMap(data['monthSummary']);
    final history = _asList(data['monthHistory']).isNotEmpty
        ? _asList(data['monthHistory'])
        : _asList(data['recentHistory']);

    return AttendanceSnapshot(
      summary: AttendanceSummary(
        studentId: studentId,
        studentName: 'Student',
        todayStatus: _statusFromApi(today?['status'] as String?),
        todayLabel: today?['label'] as String?,
        presentCount: _asInt(monthSummary?['present']),
        absentCount: _asInt(monthSummary?['absent']),
        lateCount: _asInt(monthSummary?['late']),
        leaveCount: _asInt(monthSummary?['leave']),
        lastUpdated: DateTime.now(),
      ),
      days: history.whereType<Map<String, dynamic>>().map((item) {
        return AttendanceDay(
          date: DateTime.tryParse(item['date'] as String? ?? '') ?? month,
          status: _statusFromApi(item['status'] as String?),
        );
      }).toList(),
    );
  }

  Future<AttendanceSummary> getAttendanceSummary(
    String studentId,
    DateTimeRangeValue range,
  ) async {
    final snapshot = await getParentAttendanceSnapshot(studentId, range.start);
    return snapshot.summary;
  }

  Future<List<AttendanceDay>> getMonthlyAttendance(
    String studentId,
    DateTime month,
  ) async {
    final snapshot = await getParentAttendanceSnapshot(studentId, month);
    return snapshot.days;
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

  Map<String, dynamic>? _asMap(Object? value) {
    return value is Map<String, dynamic> ? value : null;
  }

  List<dynamic> _asList(Object? value) {
    return value is List<dynamic> ? value : const [];
  }

  int _asInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.toInt();
    }
    return 0;
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
