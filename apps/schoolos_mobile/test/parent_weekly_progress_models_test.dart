import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_weekly_progress_models.dart';

void main() {
  test('maps a live weekly digest without manufacturing unavailable rates', () {
    final progress = ParentWeeklyProgress.fromJson(_progressJson());

    expect(progress.isLive, isTrue);
    expect(progress.student.id, 'child-1');
    expect(progress.period.days, 7);
    expect(progress.attendance.attendanceRate, 66.67);
    expect(progress.homework.completionRate, 50);
    expect(progress.academicTrend.hasComparableEvidence, isTrue);
    expect(progress.academicTrend.direction, 'IMPROVED');
    expect(progress.teacherComments.single.comment, 'Strong working.');
    expect(
      progress.requiredActions.single.route,
      '/parent/more/calendar?child=child-1',
    );
    expect(progress.sources['actions']?.hasIssue, isFalse);
  });

  test('keeps locked summaries nullable and rejects unsafe action routes', () {
    final json = _progressJson();
    json['attendance'] = {
      'availability': 'LOCKED',
      'recordedDays': 0,
      'presentDays': 0,
      'absentDays': 0,
      'lateDays': 0,
      'excusedDays': 0,
      'attendanceRate': null,
    };
    json['academicTrend'] = {
      'availability': 'UNAVAILABLE',
      'direction': null,
      'changePoints': null,
      'current': null,
      'previous': null,
      'reason': 'Comparable published results are not available.',
    };
    final action =
        (json['requiredActions'] as List<dynamic>).single
            as Map<String, dynamic>;
    action['action'] = {
      'label': 'Open',
      'route': 'https://untrusted.test/parent/fees',
    };

    final progress = ParentWeeklyProgress.fromJson(json);

    expect(progress.attendance.attendanceRate, isNull);
    expect(progress.academicTrend.hasComparableEvidence, isFalse);
    expect(progress.academicTrend.direction, isNull);
    expect(progress.requiredActions.single.route, isNull);
  });
}

Map<String, dynamic> _progressJson() {
  return {
    'generatedAt': '2026-07-26T10:00:00.000Z',
    'dataState': 'LIVE',
    'student': {
      'id': 'child-1',
      'name': 'Asha Rai',
      'classSection': 'Grade 4 - A',
    },
    'period': {
      'startAt': '2026-07-19T10:00:00.000Z',
      'endAt': '2026-07-26T10:00:00.000Z',
      'upcomingEndAt': '2026-08-02T10:00:00.000Z',
      'days': 7,
    },
    'attendance': {
      'availability': 'AVAILABLE',
      'recordedDays': 3,
      'presentDays': 2,
      'absentDays': 1,
      'lateDays': 1,
      'excusedDays': 0,
      'attendanceRate': 66.67,
    },
    'homework': {
      'availability': 'AVAILABLE',
      'requiredCount': 2,
      'completedCount': 1,
      'needsFollowUpCount': 1,
      'completionRate': 50,
    },
    'academicTrend': {
      'availability': 'AVAILABLE',
      'direction': 'IMPROVED',
      'changePoints': 5,
      'current': {
        'reportCardId': 'report-2',
        'termName': 'Second Term',
        'percentage': 80,
        'publishedAt': '2026-07-20T00:00:00.000Z',
      },
      'previous': {
        'reportCardId': 'report-1',
        'termName': 'First Term',
        'percentage': 75,
        'publishedAt': '2026-05-20T00:00:00.000Z',
      },
      'reason': null,
    },
    'teacherComments': [
      {
        'id': 'feedback-1',
        'subject': 'Mathematics',
        'title': 'Fractions review',
        'comment': 'Strong working.',
        'sharedAt': '2026-07-25T00:00:00.000Z',
      },
    ],
    'upcomingDeadlines': [_actionJson()],
    'requiredActions': [_actionJson()],
    'sources': {
      'attendance': {'status': 'available', 'reason': null},
      'homework': {'status': 'available', 'reason': null},
      'academics': {'status': 'available', 'reason': null},
      'comments': {'status': 'available', 'reason': null},
      'actions': {'status': 'available', 'reason': null},
    },
    'isPartial': false,
  };
}

Map<String, dynamic> _actionJson() {
  return {
    'id': 'exam:child-1:exam-1',
    'source': 'exams',
    'type': 'UPCOMING_EXAM',
    'priority': 'HIGH',
    'title': 'Mathematics examination',
    'description': 'Second Term is coming up.',
    'child': {
      'id': 'child-1',
      'name': 'Asha Rai',
      'classSection': 'Grade 4 - A',
    },
    'dueAt': '2026-07-28T00:00:00.000Z',
    'isOverdue': false,
    'action': {
      'label': 'View calendar',
      'route': '/parent/more/calendar?child=child-1',
    },
  };
}
