import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/attendance_models.dart';

class AttendanceRepository {
  const AttendanceRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<AttendanceSnapshot> getParentAttendanceSnapshot(
    String studentId,
    DateTime month,
  ) async {
    final cacheKey = 'attendance_${studentId}_${month.year}_${month.month}';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/students/$studentId/attendance-summary',
        queryParameters: {'month': month.month, 'year': month.year},
      );
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    final today = _asMap(data['today']);
    final monthSummary = _asMap(data['monthSummary']);
    final history = _asList(data['monthHistory']).isNotEmpty
        ? _asList(data['monthHistory'])
        : _asList(data['recentHistory']);

    return AttendanceSnapshot(
      summary: AttendanceSummary(
        studentId: studentId,
        studentName: 'Student',
        todayStatus: attendanceStatusFromApi(today?['status'] as String?),
        todayLabel: today?['label'] as String?,
        presentCount: _asInt(monthSummary?['present']),
        absentCount: _asInt(monthSummary?['absent']),
        lateCount: _asInt(monthSummary?['late']),
        leaveCount: _asInt(monthSummary?['leave']),
        lastUpdated:
            DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
            DateTime.now(),
      ),
      days: history.whereType<Map<String, dynamic>>().map((item) {
        return AttendanceDay(
          date: DateTime.tryParse(item['date'] as String? ?? '') ?? month,
          status: attendanceStatusFromApi(item['status'] as String?),
        );
      }).toList(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
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
    final response = await _client.get('/mobile/teacher/attendance/classes');
    final data = response.data as Map<String, dynamic>;
    return _asList(data['items'])
        .whereType<Map<String, dynamic>>()
        .map(TeacherClassSection.fromJson)
        .toList();
  }

  Future<List<AttendanceStudentEntry>> getClassAttendanceSheet(
    TeacherClassSection classSection,
    DateTime date,
  ) async {
    final response = await _client.get(
      '/mobile/teacher/attendance/roster',
      queryParameters: {
        'academicYearId': classSection.academicYearId,
        'classId': classSection.classId,
        if (classSection.sectionId != null) 'sectionId': classSection.sectionId,
        'attendanceDate': _dateOnly(date),
      },
    );
    final data = response.data as Map<String, dynamic>;
    return _asList(data['students'])
        .whereType<Map<String, dynamic>>()
        .map(AttendanceStudentEntry.fromJson)
        .toList();
  }

  Future<AttendanceSyncStatus> submitAttendance(
    TeacherClassSection classSection,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    await _client.post(
      '/mobile/teacher/attendance/submit',
      data: {
        'academicYearId': classSection.academicYearId,
        'classId': classSection.classId,
        if (classSection.sectionId != null) 'sectionId': classSection.sectionId,
        'attendanceDate': _dateOnly(date),
        'exceptions': [
          for (final entry in entries)
            if (entry.status != AttendanceStatus.present)
              {
                'studentId': entry.studentId,
                'status': _statusToApi(entry.status),
              },
        ],
      },
    );
    await _removeDraft(classSection.id, date);
    return AttendanceSyncStatus.synced;
  }

  Future<void> saveDraftAttendanceLocally(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _draftKey(classSectionId, date),
      jsonEncode({
        'savedAt': DateTime.now().toIso8601String(),
        'entries': [
          for (final entry in entries)
            {
              'studentId': entry.studentId,
              'studentName': entry.studentName,
              'rollNumber': entry.rollNumber,
              'status': _statusToApi(entry.status),
            },
        ],
      }),
    );
  }

  Future<List<AttendanceStudentEntry>> loadDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_draftKey(classSectionId, date));
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    try {
      final decoded = jsonDecode(raw);
      final data = decoded is Map<String, dynamic> ? decoded : const {};
      return _asList(data['entries'])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentEntry.fromJson)
          .toList();
    } catch (_) {
      await prefs.remove(_draftKey(classSectionId, date));
      return const [];
    }
  }

  Future<void> _removeDraft(String classSectionId, DateTime date) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey(classSectionId, date));
  }
}

String _dateOnly(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}

String _draftKey(String classSectionId, DateTime date) {
  return 'schoolos.teacher_attendance_draft.$classSectionId.${_dateOnly(date)}';
}

String _statusToApi(AttendanceStatus status) {
  switch (status) {
    case AttendanceStatus.absent:
      return 'ABSENT';
    case AttendanceStatus.late:
      return 'LATE';
    case AttendanceStatus.leave:
      return 'EXCUSED_LEAVE';
    case AttendanceStatus.festival:
    case AttendanceStatus.holiday:
      return 'HOLIDAY';
    case AttendanceStatus.present:
      return 'PRESENT';
  }
}

class DateTimeRangeValue {
  const DateTimeRangeValue({required this.start, required this.end});

  final DateTime start;
  final DateTime end;
}
