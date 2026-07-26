import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/core/network/connectivity_provider.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_weekly_progress_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_weekly_progress_screen.dart';

class _MockConnectivity extends Mock implements Connectivity {}

class _MockParentRepository extends Mock implements ParentRepository {}

class _MockPreferences extends Mock implements AppPreferencesService {}

class _StaticParentController extends ParentController {
  _StaticParentController(ParentState initial)
    : super(
        repository: _MockParentRepository(),
        preferences: _MockPreferences(),
        isOnline: true,
      ) {
    state = initial;
  }

  @override
  Future<void> load({String? childId}) async {}
}

void main() {
  Future<void> pump(
    WidgetTester tester, {
    required bool isOnline,
    ParentWeeklyProgress? progress,
  }) async {
    final connectivity = _MockConnectivity();
    when(
      () => connectivity.onConnectivityChanged,
    ).thenAnswer((_) => const Stream.empty());
    when(() => connectivity.checkConnectivity()).thenAnswer(
      (_) async =>
          isOnline ? [ConnectivityResult.wifi] : [ConnectivityResult.none],
    );
    final parentState = ParentState(
      status: ParentDataStatus.success,
      children: const [
        GuardianChild(
          id: 'child-1',
          name: 'Asha Rai',
          classSection: 'Grade 4 - A',
          rollNumber: '7',
          academicYear: '2083',
          relationship: 'Daughter',
        ),
      ],
      selectedChildId: 'child-1',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          connectivityProvider.overrideWith(
            (ref) => ConnectivityNotifier(connectivity)..setOnline(isOnline),
          ),
          parentControllerProvider.overrideWith(
            (ref) => _StaticParentController(parentState),
          ),
          parentWeeklyProgressProvider.overrideWith(
            (ref, childId) async =>
                progress ??
                ParentWeeklyProgress.fromJson(_weeklyProgressJson()),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ParentWeeklyProgressScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows live weekly evidence, BS dates, and partial coverage', (
    tester,
  ) async {
    await pump(tester, isOnline: true);

    expect(find.text('Weekly Progress'), findsOneWidget);
    expect(find.textContaining('66.67% attendance'), findsOneWidget);
    expect(find.text('1 of 2 completed'), findsOneWidget);
    expect(
      find.textContaining('Improved by 5 percentage points'),
      findsOneWidget,
    );
    expect(find.text('Strong working and improvement.'), findsOneWidget);
    expect(find.text('Upcoming deadlines'), findsOneWidget);
    expect(find.text('Required parent actions'), findsOneWidget);
    expect(find.textContaining('Some action sources'), findsOneWidget);
    expect(find.textContaining('BS'), findsWidgets);
    expect(find.textContaining('2026-'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('does not show private digest content while offline', (
    tester,
  ) async {
    await pump(tester, isOnline: false);

    expect(
      find.text('Reconnect to view current weekly progress'),
      findsOneWidget,
    );
    expect(find.textContaining('live attendance'), findsOneWidget);
    expect(find.textContaining('66.67% attendance'), findsNothing);
    expect(find.text('Strong working and improvement.'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('fails closed when the response child does not match', (
    tester,
  ) async {
    final json = _weeklyProgressJson();
    final student = json['student'] as Map<String, dynamic>;
    student['id'] = 'child-other';

    await pump(
      tester,
      isOnline: true,
      progress: ParentWeeklyProgress.fromJson(json),
    );

    expect(
      find.text(
        'Current weekly progress could not be confirmed for this child.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('66.67% attendance'), findsNothing);
  });
}

Map<String, dynamic> _weeklyProgressJson() {
  final action = {
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
        'comment': 'Strong working and improvement.',
        'sharedAt': '2026-07-25T00:00:00.000Z',
      },
    ],
    'upcomingDeadlines': [Map<String, dynamic>.from(action)],
    'requiredActions': [Map<String, dynamic>.from(action)],
    'sources': {
      'attendance': {'status': 'available', 'reason': null},
      'homework': {'status': 'available', 'reason': null},
      'academics': {'status': 'available', 'reason': null},
      'comments': {'status': 'available', 'reason': null},
      'actions': {
        'status': 'partial',
        'reason': 'Some action sources are locked or unavailable.',
      },
    },
    'isPartial': true,
  };
}
