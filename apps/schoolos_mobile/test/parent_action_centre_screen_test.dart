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
import 'package:schoolos_mobile/features/parent/domain/parent_action_centre_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_action_centre_screen.dart';

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
    required ParentActionCentre centre,
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
          parentActionCentreProvider.overrideWith(
            (ref, studentId) async => centre,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ParentActionCentreScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows live actions and honest partial source coverage', (
    tester,
  ) async {
    await pump(tester, isOnline: true, centre: _centre());

    expect(find.text('Action Centre'), findsOneWidget);
    expect(find.text('1 visible action'), findsOneWidget);
    expect(find.text('1 marked urgent'), findsOneWidget);
    expect(find.textContaining('partial view'), findsOneWidget);
    expect(find.textContaining('Fees are not enabled'), findsOneWidget);
    expect(find.text('Holiday notice'), findsOneWidget);
    expect(find.text('Asha Rai'), findsWidgets);
    expect(find.textContaining('BS'), findsWidgets);
    expect(find.text('Review notice'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('does not show actionable task data while offline', (
    tester,
  ) async {
    await pump(tester, isOnline: false, centre: _centre());

    expect(find.text('Reconnect to view current actions'), findsOneWidget);
    expect(find.textContaining('live-only'), findsOneWidget);
    expect(find.text('Holiday notice'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('disables an unsafe backend task destination', (tester) async {
    final json = _centreJson();
    final item =
        (json['items'] as List<dynamic>).single as Map<String, dynamic>;
    item['action'] = {
      'label': 'Open',
      'route': 'https://untrusted.test/parent/fees',
    };

    await pump(
      tester,
      isOnline: true,
      centre: ParentActionCentre.fromJson(json),
    );

    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Action unavailable'),
    );
    expect(button.onPressed, isNull);
  });
}

ParentActionCentre _centre() => ParentActionCentre.fromJson(_centreJson());

Map<String, dynamic> _centreJson() {
  return {
    'generatedAt': '2026-07-26T10:00:00.000Z',
    'dataState': 'LIVE',
    'scope': {
      'selectedStudentId': null,
      'children': [
        {'id': 'child-1', 'name': 'Asha Rai', 'classSection': 'Grade 4 - A'},
      ],
    },
    'summary': {
      'visibleActionCount': 1,
      'urgentCount': 1,
      'returnedCount': 1,
      'isPartial': true,
    },
    'items': [
      {
        'id': 'notice-ack:notice-1',
        'source': 'notices',
        'type': 'NOTICE_ACKNOWLEDGEMENT',
        'priority': 'URGENT',
        'title': 'Holiday notice',
        'description': 'Review and confirm this school notice.',
        'child': {
          'id': 'child-1',
          'name': 'Asha Rai',
          'classSection': 'Grade 4 - A',
        },
        'dueAt': '2026-07-30T00:00:00.000Z',
        'isOverdue': false,
        'action': {
          'label': 'Review notice',
          'route': '/notices/notification-1',
        },
      },
    ],
    'truncated': false,
    'sources': {
      'notices': {'status': 'available', 'reason': null},
      'fees': {
        'status': 'locked',
        'reason': 'Fees are not enabled for this school.',
      },
    },
  };
}
