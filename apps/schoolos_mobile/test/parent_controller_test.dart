import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

class _MockParentRepository extends Mock implements ParentRepository {}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async =>
      Map<String, String>.from(values);

  @override
  Future<void> delete(String key) async => values.remove(key);

  @override
  Future<void> clearAll() async => values.clear();

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}

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
  late PrivateDataCleanupService cleanup;
  late PrivateReadCache cache;

  ParentController buildController({required bool isOnline}) {
    return ParentController(
      repository: repository,
      preferences: preferences,
      privateDataCleanup: cleanup,
      privateReadCache: cache,
      isOnline: isOnline,
    );
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    repository = _MockParentRepository();
    preferences = AppPreferencesService(await SharedPreferences.getInstance());
    final secure = _MemorySecureStore();
    cleanup = PrivateDataCleanupService(preferences, secure);
    cache = PrivateReadCache(
      secure,
      preferences: preferences,
      scope: PrivateReadCacheScope(
        tenantId: 'tenant-1',
        userId: 'parent-1',
        role: 'parent',
      ),
    );
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
      final controller = buildController(isOnline: true);
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

  test(
    'stays usable offline when only the cached children list survives',
    () async {
      when(
        () => repository.getParentDashboardSummaryForChild(childA),
      ).thenAnswer((_) async => throw const NetworkException());
      when(
        () => repository.getChildProfileForChild(childA),
      ).thenAnswer((_) async => throw const NetworkException());

      final controller = buildController(isOnline: false);
      await _waitForSettled(controller);

      expect(
        controller.state.status,
        ParentDataStatus.success,
        reason: 'cached children are enough to keep the screen usable',
      );
      expect(controller.state.children, hasLength(2));
      expect(controller.state.selectedChild?.id, childA.id);
      expect(controller.state.isOffline, isTrue);
      expect(controller.state.message, contains('offline'));
      expect(controller.state.dashboard, isNull);
    },
  );

  test('a definite failure is still surfaced, not swallowed', () async {
    when(
      () => repository.getParentDashboardSummaryForChild(childA),
    ).thenAnswer((_) async => throw const PermissionException());

    final controller = buildController(isOnline: true);
    await _waitForSettled(controller);

    expect(
      controller.state.status,
      ParentDataStatus.forbidden,
      reason:
          'only network and timeout failures degrade; a permission failure '
          'must reach the permission-denied surface',
    );
  });

  test(
    'guardian access revocation clears caches and shows access-changed',
    () async {
      when(
        () => repository.getParentDashboardSummaryForChild(childA),
      ).thenAnswer(
        (_) async => throw const PermissionException(
          'Your access to this school data changed. Cached information was cleared.',
          'GUARDIAN_CAPABILITY_DENIED',
        ),
      );

      final controller = buildController(isOnline: true);
      await _waitForSettled(controller);

      expect(controller.state.status, ParentDataStatus.accessChanged);
      expect(controller.state.children, isEmpty);
      expect(controller.state.dashboard, isNull);
      expect(controller.state.message, contains('access'));
    },
  );

  test('a late child response cannot replace the latest selection', () async {
    final controller = buildController(isOnline: true);
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

  group('activity read acknowledgement', () {
    test('submits SEEN once and keeps the successful state', () async {
      when(
        () => repository.markActivitySeen(
          postId: 'post-1',
          guardianId: 'guardian-1',
        ),
      ).thenAnswer((_) async {});
      final controller = ParentActivitySeenController(repository, true);

      await expectLater(
        controller.markSeen(postId: 'post-1', guardianId: 'guardian-1'),
        completion(isTrue),
      );
      await expectLater(
        controller.markSeen(postId: 'post-1', guardianId: 'guardian-1'),
        completion(isTrue),
      );

      expect(controller.state.status, ParentActivitySeenStatus.seen);
      verify(
        () => repository.markActivitySeen(
          postId: 'post-1',
          guardianId: 'guardian-1',
        ),
      ).called(1);
    });

    test('does not queue acknowledgement while offline', () async {
      final controller = ParentActivitySeenController(repository, false);

      await expectLater(
        controller.markSeen(postId: 'post-1', guardianId: 'guardian-1'),
        completion(isFalse),
      );

      expect(controller.state.status, ParentActivitySeenStatus.failed);
      expect(controller.state.error, isA<NetworkException>());
      verifyNever(
        () => repository.markActivitySeen(
          postId: any(named: 'postId'),
          guardianId: any(named: 'guardianId'),
        ),
      );
    });

    test('keeps permission denial retryable and school-friendly', () async {
      when(
        () => repository.markActivitySeen(
          postId: 'post-1',
          guardianId: 'guardian-1',
        ),
      ).thenThrow(const PermissionException());
      final controller = ParentActivitySeenController(repository, true);

      await expectLater(
        controller.markSeen(postId: 'post-1', guardianId: 'guardian-1'),
        completion(isFalse),
      );

      expect(controller.state.status, ParentActivitySeenStatus.failed);
      expect(controller.state.error, isA<PermissionException>());
    });
  });
}

Future<void> _waitForSuccess(ParentController controller) async {
  for (var attempt = 0; attempt < 20; attempt++) {
    if (controller.state.status == ParentDataStatus.success) return;
    await Future<void>.delayed(Duration.zero);
  }
  fail('ParentController did not reach success.');
}

Future<void> _waitForSettled(ParentController controller) async {
  for (var i = 0; i < 50; i++) {
    if (controller.state.status != ParentDataStatus.loading) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
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
