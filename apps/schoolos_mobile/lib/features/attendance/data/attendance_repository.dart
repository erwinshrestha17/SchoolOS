import 'dart:convert';
import 'dart:math';

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

  Future<TeacherClassesSnapshot> getTeacherAssignedClasses() async {
    const cacheKey = 'teacher_assigned_classes';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get('/mobile/teacher/attendance/classes');
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    return TeacherClassesSnapshot(
      classes: _asList(data['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherClassSection.fromJson)
          .toList(),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherTodaySnapshot> getTeacherToday(DateTime date) async {
    final dateKey = _dateOnly(date);
    final cacheKey = 'teacher_today_$dateKey';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/teacher/attendance/today',
        queryParameters: {'date': dateKey},
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
    return TeacherTodaySnapshot(
      date: DateTime.tryParse(data['date'] as String? ?? '') ?? date,
      periods: _asList(data['periods'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherTodayPeriod.fromJson)
          .toList(),
      classes: _asList(data['classes'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherClassSection.fromJson)
          .toList(),
      pendingAttendanceCount: _asInt(data['pendingAttendanceCount']),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherRosterSnapshot> getClassAttendanceSheet(
    TeacherClassSection classSection,
    DateTime date,
  ) async {
    final cacheKey = 'teacher_roster_${classSection.id}_${_dateOnly(date)}';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/teacher/attendance/roster',
        queryParameters: {
          'academicYearId': classSection.academicYearId,
          'classId': classSection.classId,
          if (classSection.sectionId != null)
            'sectionId': classSection.sectionId,
          'attendanceDate': _dateOnly(date),
        },
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
    final attendance = data['attendanceState'] is Map<String, dynamic>
        ? TeacherAttendanceMeta.fromJson(
            data['attendanceState'] as Map<String, dynamic>,
          )
        : const TeacherAttendanceMeta(
            isSubmitted: false,
            isLocked: false,
            conflictStatus: 'NONE',
          );
    final calendar = data['calendarDay'] is Map<String, dynamic>
        ? data['calendarDay'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherRosterSnapshot(
      entries: _asList(data['students'])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentEntry.fromJson)
          .toList(),
      attendance: attendance,
      isWorkingDay: calendar['isWorkingDay'] as bool? ?? true,
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherStudentSummary> getTeacherStudentSummary(
    TeacherClassSection classSection,
    String studentId,
  ) async {
    final response = await _client.get(
      '/mobile/teacher/students/$studentId/summary',
      queryParameters: {
        'academicYearId': classSection.academicYearId,
        'classId': classSection.classId,
        if (classSection.sectionId != null) 'sectionId': classSection.sectionId,
      },
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherStudentSummary.fromJson(data);
  }

  Future<TeacherAttendanceSubmitResult> submitAttendance(
    TeacherClassSection classSection,
    DateTime date,
    List<AttendanceStudentEntry> entries,
    String clientSubmissionId,
    DateTime deviceTimestamp,
  ) async {
    final response = await _client.post(
      '/mobile/teacher/attendance/sync',
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
        'clientSubmissionId': clientSubmissionId,
        'deviceTimestamp': deviceTimestamp.toUtc().toIso8601String(),
      },
    );
    await _removeDraft(classSection.id, date);
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    final syncStatus = data['syncStatus'] as String? ?? 'ACCEPTED';
    return TeacherAttendanceSubmitResult(
      status: syncStatus == 'CONFLICTED'
          ? AttendanceSyncStatus.conflict
          : syncStatus == 'REJECTED'
          ? AttendanceSyncStatus.failed
          : AttendanceSyncStatus.synced,
      replayed: data['replayed'] as bool? ?? false,
    );
  }

  Future<TeacherAttendanceDraft> saveDraftAttendanceLocally(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = await loadDraftAttendance(classSectionId, date);
    final draft = TeacherAttendanceDraft(
      clientSubmissionId:
          existing?.clientSubmissionId ?? _newClientSubmissionId(),
      savedAt: DateTime.now(),
      entries: entries,
    );
    await prefs.setString(
      _draftKey(classSectionId, date),
      jsonEncode({
        'clientSubmissionId': draft.clientSubmissionId,
        'savedAt': draft.savedAt.toIso8601String(),
        'entries': [for (final entry in entries) entry.toJson()],
      }),
    );
    return draft;
  }

  Future<TeacherAttendanceDraft?> loadDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_draftKey(classSectionId, date));
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(raw);
      final data = decoded is Map<String, dynamic> ? decoded : const {};
      final entries = _asList(data['entries'])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentEntry.fromJson)
          .toList();
      if (entries.isEmpty) return null;
      return TeacherAttendanceDraft(
        clientSubmissionId:
            data['clientSubmissionId'] as String? ?? _newClientSubmissionId(),
        savedAt:
            DateTime.tryParse(data['savedAt'] as String? ?? '') ??
            DateTime.now(),
        entries: entries,
      );
    } catch (_) {
      await prefs.remove(_draftKey(classSectionId, date));
      return null;
    }
  }

  Future<void> _removeDraft(String classSectionId, DateTime date) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey(classSectionId, date));
  }

  Future<void> discardDraftAttendance(String classSectionId, DateTime date) =>
      _removeDraft(classSectionId, date);
}

String _newClientSubmissionId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  final token = base64UrlEncode(bytes).replaceAll('=', '');
  return 'mobile-attendance-${DateTime.now().microsecondsSinceEpoch}-$token';
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
