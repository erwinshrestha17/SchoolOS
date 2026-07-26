import 'parent_action_centre_models.dart';

class ParentWeeklyProgress {
  const ParentWeeklyProgress({
    required this.generatedAt,
    required this.dataState,
    required this.student,
    required this.period,
    required this.attendance,
    required this.homework,
    required this.academicTrend,
    required this.teacherComments,
    required this.upcomingDeadlines,
    required this.requiredActions,
    required this.sources,
    required this.isPartial,
  });

  final DateTime generatedAt;
  final String dataState;
  final ParentWeeklyProgressStudent student;
  final ParentWeeklyProgressPeriod period;
  final ParentWeeklyAttendance attendance;
  final ParentWeeklyHomework homework;
  final ParentAcademicTrend academicTrend;
  final List<ParentTeacherComment> teacherComments;
  final List<ParentActionItem> upcomingDeadlines;
  final List<ParentActionItem> requiredActions;
  final Map<String, ParentWeeklySourceState> sources;
  final bool isPartial;

  bool get isLive => dataState == 'LIVE';

  factory ParentWeeklyProgress.fromJson(Map<String, dynamic> json) {
    return ParentWeeklyProgress(
      generatedAt: _date(json['generatedAt']),
      dataState: _string(json['dataState'], fallback: 'UNAVAILABLE'),
      student: ParentWeeklyProgressStudent.fromJson(
        _map(json['student']) ?? const {},
      ),
      period: ParentWeeklyProgressPeriod.fromJson(
        _map(json['period']) ?? const {},
      ),
      attendance: ParentWeeklyAttendance.fromJson(
        _map(json['attendance']) ?? const {},
      ),
      homework: ParentWeeklyHomework.fromJson(
        _map(json['homework']) ?? const {},
      ),
      academicTrend: ParentAcademicTrend.fromJson(
        _map(json['academicTrend']) ?? const {},
      ),
      teacherComments: _list(json['teacherComments'])
          .whereType<Map<String, dynamic>>()
          .map(ParentTeacherComment.fromJson)
          .toList(),
      upcomingDeadlines: _list(json['upcomingDeadlines'])
          .whereType<Map<String, dynamic>>()
          .map(ParentActionItem.fromJson)
          .toList(),
      requiredActions: _list(json['requiredActions'])
          .whereType<Map<String, dynamic>>()
          .map(ParentActionItem.fromJson)
          .toList(),
      sources:
          _map(json['sources'])?.map(
            (key, value) => MapEntry(
              key,
              ParentWeeklySourceState.fromJson(_map(value) ?? const {}),
            ),
          ) ??
          const {},
      isPartial: json['isPartial'] == true,
    );
  }
}

class ParentWeeklyProgressStudent {
  const ParentWeeklyProgressStudent({
    required this.id,
    required this.name,
    required this.classSection,
  });

  final String id;
  final String name;
  final String classSection;

  factory ParentWeeklyProgressStudent.fromJson(Map<String, dynamic> json) {
    return ParentWeeklyProgressStudent(
      id: _string(json['id']),
      name: _string(json['name'], fallback: 'Linked child'),
      classSection: _string(json['classSection']),
    );
  }
}

class ParentWeeklyProgressPeriod {
  const ParentWeeklyProgressPeriod({
    required this.startAt,
    required this.endAt,
    required this.upcomingEndAt,
    required this.days,
  });

  final DateTime startAt;
  final DateTime endAt;
  final DateTime upcomingEndAt;
  final int days;

  factory ParentWeeklyProgressPeriod.fromJson(Map<String, dynamic> json) {
    return ParentWeeklyProgressPeriod(
      startAt: _date(json['startAt']),
      endAt: _date(json['endAt']),
      upcomingEndAt: _date(json['upcomingEndAt']),
      days: _integer(json['days']),
    );
  }
}

class ParentWeeklyAttendance {
  const ParentWeeklyAttendance({
    required this.availability,
    required this.recordedDays,
    required this.presentDays,
    required this.absentDays,
    required this.lateDays,
    required this.excusedDays,
    required this.attendanceRate,
  });

  final String availability;
  final int recordedDays;
  final int presentDays;
  final int absentDays;
  final int lateDays;
  final int excusedDays;
  final double? attendanceRate;

  bool get hasData => availability == 'AVAILABLE';

  factory ParentWeeklyAttendance.fromJson(Map<String, dynamic> json) {
    return ParentWeeklyAttendance(
      availability: _availability(json['availability']),
      recordedDays: _integer(json['recordedDays']),
      presentDays: _integer(json['presentDays']),
      absentDays: _integer(json['absentDays']),
      lateDays: _integer(json['lateDays']),
      excusedDays: _integer(json['excusedDays']),
      attendanceRate: _nullableDouble(json['attendanceRate']),
    );
  }
}

class ParentWeeklyHomework {
  const ParentWeeklyHomework({
    required this.availability,
    required this.requiredCount,
    required this.completedCount,
    required this.needsFollowUpCount,
    required this.completionRate,
  });

  final String availability;
  final int requiredCount;
  final int completedCount;
  final int needsFollowUpCount;
  final double? completionRate;

  bool get hasData => availability == 'AVAILABLE';

  factory ParentWeeklyHomework.fromJson(Map<String, dynamic> json) {
    return ParentWeeklyHomework(
      availability: _availability(json['availability']),
      requiredCount: _integer(json['requiredCount']),
      completedCount: _integer(json['completedCount']),
      needsFollowUpCount: _integer(json['needsFollowUpCount']),
      completionRate: _nullableDouble(json['completionRate']),
    );
  }
}

class ParentAcademicTrend {
  const ParentAcademicTrend({
    required this.availability,
    required this.direction,
    required this.changePoints,
    required this.current,
    required this.previous,
    required this.reason,
  });

  final String availability;
  final String? direction;
  final double? changePoints;
  final ParentAcademicTrendPoint? current;
  final ParentAcademicTrendPoint? previous;
  final String? reason;

  bool get hasComparableEvidence =>
      availability == 'AVAILABLE' &&
      direction != null &&
      current != null &&
      previous != null;

  factory ParentAcademicTrend.fromJson(Map<String, dynamic> json) {
    final current = _map(json['current']);
    final previous = _map(json['previous']);
    final direction = _nullableString(json['direction']);
    return ParentAcademicTrend(
      availability: _availability(json['availability']),
      direction: const {'IMPROVED', 'DECLINED', 'STABLE'}.contains(direction)
          ? direction
          : null,
      changePoints: _nullableDouble(json['changePoints']),
      current: current == null
          ? null
          : ParentAcademicTrendPoint.fromJson(current),
      previous: previous == null
          ? null
          : ParentAcademicTrendPoint.fromJson(previous),
      reason: _nullableString(json['reason']),
    );
  }
}

class ParentAcademicTrendPoint {
  const ParentAcademicTrendPoint({
    required this.reportCardId,
    required this.termName,
    required this.percentage,
    required this.publishedAt,
  });

  final String reportCardId;
  final String termName;
  final double percentage;
  final DateTime? publishedAt;

  factory ParentAcademicTrendPoint.fromJson(Map<String, dynamic> json) {
    return ParentAcademicTrendPoint(
      reportCardId: _string(json['reportCardId']),
      termName: _string(json['termName'], fallback: 'Published result'),
      percentage: _nullableDouble(json['percentage']) ?? 0,
      publishedAt: _nullableDate(json['publishedAt']),
    );
  }
}

class ParentTeacherComment {
  const ParentTeacherComment({
    required this.id,
    required this.subject,
    required this.title,
    required this.comment,
    required this.sharedAt,
  });

  final String id;
  final String subject;
  final String title;
  final String comment;
  final DateTime sharedAt;

  factory ParentTeacherComment.fromJson(Map<String, dynamic> json) {
    return ParentTeacherComment(
      id: _string(json['id']),
      subject: _string(json['subject'], fallback: 'School'),
      title: _string(json['title'], fallback: 'Teacher feedback'),
      comment: _string(json['comment']),
      sharedAt: _date(json['sharedAt']),
    );
  }
}

class ParentWeeklySourceState {
  const ParentWeeklySourceState({required this.status, this.reason});

  final String status;
  final String? reason;

  bool get hasIssue =>
      status == 'partial' || status == 'locked' || status == 'unavailable';

  factory ParentWeeklySourceState.fromJson(Map<String, dynamic> json) {
    final status = _string(json['status'], fallback: 'unavailable');
    return ParentWeeklySourceState(
      status:
          const {
            'available',
            'empty',
            'partial',
            'locked',
            'unavailable',
          }.contains(status)
          ? status
          : 'unavailable',
      reason: _nullableString(json['reason']),
    );
  }
}

Map<String, dynamic>? _map(Object? value) =>
    value is Map<String, dynamic> ? value : null;

List<dynamic> _list(Object? value) => value is List<dynamic> ? value : const [];

String _string(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _string(value);
  return text.isEmpty ? null : text;
}

int _integer(Object? value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

double? _nullableDouble(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value');
}

String _availability(Object? value) {
  final status = _string(value, fallback: 'UNAVAILABLE');
  return const {'AVAILABLE', 'EMPTY', 'LOCKED', 'UNAVAILABLE'}.contains(status)
      ? status
      : 'UNAVAILABLE';
}

DateTime _date(Object? value) =>
    _nullableDate(value) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

DateTime? _nullableDate(Object? value) {
  if (value is DateTime) return value;
  if (value is! String) return null;
  return DateTime.tryParse(value);
}
