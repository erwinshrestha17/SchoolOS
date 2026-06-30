import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

class _MockParentRepository extends Mock implements ParentRepository {}

void main() {
  const childA = GuardianChild(
    id: 'child-a',
    name: 'Asha Rai',
    classSection: 'Grade 4 - A',
    rollNumber: '7',
    academicYear: '2083',
    relationship: 'Daughter',
  );
  const childB = GuardianChild(
    id: 'child-b',
    name: 'Bikash Rai',
    classSection: 'Grade 2 - B',
    rollNumber: '11',
    academicYear: '2083',
    relationship: 'Son',
  );

  late _MockParentRepository repository;
  late AppPreferencesService preferences;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    repository = _MockParentRepository();
    preferences = AppPreferencesService(await SharedPreferences.getInstance());
    when(
      () => repository.getGuardianChildren(),
    ).thenAnswer((_) async => const [childA, childB]);
    when(
      () => repository.getParentDashboardSummaryForChild(childA),
    ).thenAnswer((_) async => _summary(childA));
    when(
      () => repository.getChildProfileForChild(childA),
    ).thenAnswer((_) async => _profile(childA));
    when(
      () => repository.getChildProfileForChild(childB),
    ).thenAnswer((_) async => _profile(childB));
  });

  test(
    'child switch clears the previous child before refetch completes',
    () async {
      final controller = ParentController(
        repository: repository,
        preferences: preferences,
        isOnline: true,
      );
      await _waitForSuccess(controller);
      expect(controller.state.dashboard?.child.id, childA.id);

      final started = Completer<void>();
      final result = Completer<ParentDashboardSummary>();
      when(
        () => repository.getParentDashboardSummaryForChild(childB),
      ).thenAnswer((_) {
        if (!started.isCompleted) started.complete();
        return result.future;
      });

      final switching = controller.selectChild(childB.id);
      await started.future;

      expect(controller.state.status, ParentDataStatus.loading);
      expect(controller.state.selectedChildId, childB.id);
      expect(controller.state.dashboard, isNull);
      expect(controller.state.profile, isNull);

      result.complete(_summary(childB));
      await switching;

      expect(controller.state.status, ParentDataStatus.success);
      expect(controller.state.dashboard?.child.id, childB.id);
      expect(controller.state.profile?.child.id, childB.id);
    },
  );

  test('a late child response cannot replace the latest selection', () async {
    final controller = ParentController(
      repository: repository,
      preferences: preferences,
      isOnline: true,
    );
    await _waitForSuccess(controller);

    final started = Completer<void>();
    final delayed = Completer<ParentDashboardSummary>();
    when(() => repository.getParentDashboardSummaryForChild(childB)).thenAnswer(
      (_) {
        if (!started.isCompleted) started.complete();
        return delayed.future;
      },
    );

    final selectB = controller.selectChild(childB.id);
    await started.future;
    await controller.selectChild(childA.id);

    delayed.complete(_summary(childB));
    await selectB;

    expect(controller.state.status, ParentDataStatus.success);
    expect(controller.state.selectedChildId, childA.id);
    expect(controller.state.dashboard?.child.id, childA.id);
    expect(controller.state.profile?.child.id, childA.id);
  });
}

Future<void> _waitForSuccess(ParentController controller) async {
  for (var attempt = 0; attempt < 20; attempt++) {
    if (controller.state.status == ParentDataStatus.success) return;
    await Future<void>.delayed(Duration.zero);
  }
  fail('ParentController did not reach success.');
}

ParentDashboardSummary _summary(GuardianChild child) {
  return ParentDashboardSummary(
    child: child,
    attendanceToday: 'Present today',
    homeworkPending: 0,
    feesDue: 0,
    overdueFeesCount: 0,
    unreadNotices: 0,
    transportStatus: 'No active trip',
    canteenBalance: 0,
    canteenIsLowBalance: false,
    latestActivity: 'No activity yet.',
    lastUpdated: DateTime.utc(2026, 6, 30),
  );
}

ChildProfile _profile(GuardianChild child) {
  return ChildProfile(
    child: child,
    classTeacher: 'Class teacher',
    guardianSummary: 'Guardian link verified.',
    canViewGuardianSummary: true,
    attendanceSummary: 'Attendance available.',
    homeworkSummary: 'Homework available.',
    feesSummary: 'Fees available.',
    qrLabel: 'Student identity verified.',
  );
}
