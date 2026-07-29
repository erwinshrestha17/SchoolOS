import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';
import 'package:schoolos_mobile/features/parent/data/parent_dashboard_snapshot_store.dart';
import 'package:schoolos_mobile/features/parent/data/parent_portal_repository.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';

/// Offline behaviour for the parent Today dashboard.
///
/// These run against the real [PrivateReadCache] over an in-memory secure
/// store rather than a mocked cache: the isolation guarantees being asserted
/// here (tenant, guardian, child, schema, expiry) are largely *implemented*
/// by that class, and a mock would assert only that the test agrees with
/// itself.
void main() {
  setUpAll(() {
    registerFallbackValue(_childA);
  });

  late _MemorySecureStore storage;
  late _MockParentRepository parentRepository;
  late _MockNoticesRepository noticesRepository;
  late DateTime now;

  setUp(() {
    storage = _MemorySecureStore();
    parentRepository = _MockParentRepository();
    noticesRepository = _MockNoticesRepository();
    now = DateTime.utc(2026, 7, 26, 3);

    when(
      () => parentRepository.getGuardianChildren(),
    ).thenAnswer((_) async => const [_childA, _childB]);
    when(
      () => noticesRepository.getNotificationCenter(limit: any(named: 'limit')),
    ).thenAnswer(
      (_) async => const ParentNotificationPage(items: [], unreadCount: 0),
    );
    when(() => parentRepository.getChildProfileForChild(any())).thenAnswer((
      invocation,
    ) async {
      return _profileFor(invocation.positionalArguments.first as GuardianChild);
    });
    when(
      () =>
          parentRepository.getHomeworkForChild(any(), take: any(named: 'take')),
    ).thenAnswer((_) async => const <ParentHomeworkItem>[]);
  });

  PrivateReadCache cacheFor({
    String tenantId = 'tenant-1',
    String userId = 'guardian-1',
    String role = MobileRole.parent,
  }) {
    return PrivateReadCache(
      storage,
      scope: PrivateReadCacheScope(
        tenantId: tenantId,
        userId: userId,
        role: role,
      ),
      now: () => now,
    );
  }

  ParentDashboardSnapshotStore storeFor({
    String tenantId = 'tenant-1',
    String guardianId = 'guardian-1',
  }) {
    return ParentDashboardSnapshotStore(
      cache: cacheFor(tenantId: tenantId, userId: guardianId),
      identity: ParentDashboardSnapshotIdentity(
        tenantId: tenantId,
        guardianId: guardianId,
      ),
    );
  }

  ParentPortalRepository repositoryWith(ParentDashboardSnapshotStore? store) {
    return ParentPortalRepository(
      parentRepository: parentRepository,
      noticesRepository: noticesRepository,
      parentName: 'Sita Rai',
      schoolName: 'Everest School',
      snapshots: store,
    );
  }

  /// Every dashboard call answers normally.
  void networkOnline({num feesDue = 0, String attendance = 'Present today'}) {
    when(
      () => parentRepository.getParentDashboardSummaryForChild(any()),
    ).thenAnswer((invocation) async {
      final child = invocation.positionalArguments.first as GuardianChild;
      return _dashboardFor(child, feesDue: feesDue, attendance: attendance);
    });
  }

  /// Every dashboard call fails the way a dropped connection does.
  void networkOffline() {
    when(
      () => parentRepository.getParentDashboardSummaryForChild(any()),
    ).thenAnswer((_) async => throw const NetworkException('offline'));
  }

  group('write on success', () {
    test('a successful load stores a snapshot for the active child', () async {
      networkOnline();
      final store = storeFor();

      final live = await repositoryWith(store).load(activeChildId: 'child-a');
      expect(live.fromCache, isFalse);

      final snapshot = await store.load(childId: 'child-a');
      expect(snapshot, isNotNull);
      expect(snapshot!.data.activeChild?.id, 'child-a');
      expect(snapshot.cachedAt, now);
    });

    test('the snapshot round-trips the fields the dashboard renders', () async {
      networkOnline(feesDue: 7100, attendance: 'Absent today');
      when(
        () => parentRepository.getHomeworkForChild(
          any(),
          take: any(named: 'take'),
        ),
      ).thenAnswer((_) async => const [_homeworkItem]);
      when(
        () =>
            noticesRepository.getNotificationCenter(limit: any(named: 'limit')),
      ).thenAnswer((_) async => _notificationPage);

      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      final restored = (await store.load(childId: 'child-a'))!.data;
      final child = restored.activeChild!;
      expect(child.attendance, 'Absent today');
      expect(child.feesDue, 7100);
      expect(child.feesStatus, 'DUE');
      // Only the cached child's own work is stored - a sibling's is dead
      // weight against the record quota and is never rendered from here.
      expect(restored.homework, hasLength(1));
      expect(restored.homework.single.childId, 'child-a');
      expect(restored.homework.single.title, 'Algebra Worksheet #1');
      expect(restored.homework.single.dueAt, isNotNull);
      expect(restored.updates.single.title, 'Parent-teacher meeting');
      expect(restored.children, hasLength(2));
    });

    test('a heavy multi-child account still fits the record quota', () async {
      // Three children x twenty assignments each is what used to blow the
      // 64KB budget, and an over-quota write leaves no offline dashboard at
      // all. Only the active child's work, capped, reaches disk.
      when(
        () => parentRepository.getGuardianChildren(),
      ).thenAnswer((_) async => const [_childA, _childB, _childC]);
      networkOnline();
      when(
        () => parentRepository.getHomeworkForChild(
          any(),
          take: any(named: 'take'),
        ),
      ).thenAnswer(
        (_) async => [
          for (var index = 0; index < 20; index++)
            ParentHomeworkItem(
              id: 'hw-$index',
              title: 'A long assignment title for item number $index',
              subjectName: 'Mathematics',
              submissionStatus: 'NOT_SUBMITTED',
              attachmentCount: 0,
              dueAt: '2099-07-${(index % 28) + 1}T04:00:00.000Z',
              feedback: 'A paragraph of teacher feedback ' * 6,
            ),
        ],
      );

      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      final snapshot = await store.load(childId: 'child-a');
      expect(snapshot, isNotNull, reason: 'the write must not be rejected');
      expect(snapshot!.data.homework, hasLength(12));
      expect(
        snapshot.data.homework.every((item) => item.childId == 'child-a'),
        isTrue,
      );
      expect(
        storage.values.values.single.length,
        lessThan(PrivateReadCache.defaultMaxRecordBytes),
      );
    });

    test(
      'the stored assignments are the soonest, not an arbitrary slice',
      () async {
        networkOnline();
        when(
          () => parentRepository.getHomeworkForChild(
            any(),
            take: any(named: 'take'),
          ),
        ).thenAnswer(
          (_) async => [
            for (var day = 20; day >= 1; day--)
              ParentHomeworkItem(
                id: 'hw-$day',
                title: 'Day $day',
                subjectName: 'Mathematics',
                submissionStatus: 'NOT_SUBMITTED',
                attachmentCount: 0,
                dueAt:
                    '2099-07-${day.toString().padLeft(2, '0')}T04:00:00.000Z',
              ),
          ],
        );

        final store = storeFor();
        await repositoryWith(store).load(activeChildId: 'child-a');

        final stored = (await store.load(childId: 'child-a'))!.data.homework;
        expect(stored.first.title, 'Day 1');
        expect(stored.last.title, 'Day 12');
      },
    );

    test('a load answered from cache is not re-saved', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      // Six hours later the dashboard is offline; the cached copy is served
      // but must not refresh its own timestamp, or it would live for ever.
      now = now.add(const Duration(hours: 6));
      networkOffline();
      final cached = await repositoryWith(store).load(activeChildId: 'child-a');

      expect(cached.fromCache, isTrue);
      final snapshot = await store.load(childId: 'child-a');
      expect(
        snapshot!.cachedAt,
        DateTime.utc(2026, 7, 26, 3),
        reason: 'the saved copy keeps the age of the last real fetch',
      );
    });
  });

  group('read on failure', () {
    test('a network failure serves the same child from cache', () async {
      networkOnline(feesDue: 7100);
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      networkOffline();
      final offline = await repositoryWith(
        store,
      ).load(activeChildId: 'child-a');

      expect(offline.fromCache, isTrue);
      expect(offline.activeChild?.id, 'child-a');
      expect(offline.activeChild?.feesDue, 7100);
      expect(offline.lastUpdated, now);
    });

    test('no cache leaves the error in place', () async {
      networkOffline();

      expect(
        () => repositoryWith(storeFor()).load(activeChildId: 'child-a'),
        throwsA(isA<NetworkException>()),
      );
    });

    test(
      'no snapshot store at all behaves as before caching existed',
      () async {
        networkOffline();

        expect(
          () => repositoryWith(null).load(activeChildId: 'child-a'),
          throwsA(isA<NetworkException>()),
        );
      },
    );

    test('an expired children list still serves the named child', () async {
      // `parent_children` caches for six hours, the snapshot for twelve, so
      // the list can lapse while a usable snapshot survives. The guardian
      // named a child, so there is nothing to guess.
      networkOnline(feesDue: 7100);
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      when(
        () => parentRepository.getGuardianChildren(),
      ).thenAnswer((_) async => throw const NetworkException('offline'));
      networkOffline();

      final offline = await repositoryWith(
        store,
      ).load(activeChildId: 'child-a');
      expect(offline.fromCache, isTrue);
      expect(offline.activeChild?.id, 'child-a');
      expect(offline.activeChild?.feesDue, 7100);
      expect(offline.children, isNotEmpty, reason: 'the switcher still works');
    });

    test(
      'an expired children list guesses nothing without a named child',
      () async {
        networkOnline();
        final store = storeFor();
        await repositoryWith(store).load(activeChildId: 'child-a');

        when(
          () => parentRepository.getGuardianChildren(),
        ).thenAnswer((_) async => throw const NetworkException('offline'));

        expect(
          () => repositoryWith(store).load(),
          throwsA(isA<NetworkException>()),
          reason: '"probably the first child" is how a sibling leaks',
        );
      },
    );

    test('an expired children list never serves a different child', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      when(
        () => parentRepository.getGuardianChildren(),
      ).thenAnswer((_) async => throw const NetworkException('offline'));

      expect(
        () => repositoryWith(store).load(activeChildId: 'child-b'),
        throwsA(isA<NetworkException>()),
      );
    });

    test('a non-connectivity failure is never answered from cache', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      when(
        () => parentRepository.getParentDashboardSummaryForChild(any()),
      ).thenAnswer((_) async => throw const PermissionException('forbidden'));

      expect(
        () => repositoryWith(store).load(activeChildId: 'child-a'),
        throwsA(isA<PermissionException>()),
        reason: 'a 403 is a real answer and must not be papered over',
      );
    });

    test('retry replaces the cached copy with live data', () async {
      networkOnline(feesDue: 7100);
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      networkOffline();
      final offline = await repositoryWith(
        store,
      ).load(activeChildId: 'child-a');
      expect(offline.fromCache, isTrue);
      expect(offline.activeChild?.feesDue, 7100);

      // The parent pays, then pulls to refresh once back online.
      now = now.add(const Duration(minutes: 30));
      networkOnline(feesDue: 0);
      final retried = await repositoryWith(
        store,
      ).load(activeChildId: 'child-a');

      expect(retried.fromCache, isFalse);
      expect(retried.activeChild?.feesDue, 0);
      final snapshot = await store.load(childId: 'child-a');
      expect(snapshot!.data.activeChild?.feesDue, 0);
      expect(snapshot.cachedAt, now);
    });
  });

  group('screens reachable from a cached dashboard', () {
    test('the fee summary answers offline from its own cached read', () async {
      // Fees reads `getParentDashboardSummary`, which shares the read-through
      // cache added for the dashboard. Before that key existed this was the
      // one leg that could not answer offline, so tapping Fees from a cached
      // dashboard hit a connection error.
      final cache = cacheFor();
      final repository = ParentRepository(
        _StubApiClient(
          responses: {
            '/mobile/me/dashboard': {
              'fees': {'totalOutstanding': 7100, 'status': 'DUE'},
            },
          },
        ),
        cache: cache,
      );

      final live = await repository.getParentDashboardSummaryForChild(_childA);
      expect(live.feesDue, 7100);
      expect(live.fromCache, isFalse);

      final offlineRepository = ParentRepository(
        _StubApiClient(responses: const {}, offline: true),
        cache: cache,
      );
      final offline = await offlineRepository.getParentDashboardSummaryForChild(
        _childA,
      );

      expect(offline.feesDue, 7100);
      expect(offline.fromCache, isTrue);
    });

    test('a fee read for another child is never substituted', () async {
      final cache = cacheFor();
      await ParentRepository(
        _StubApiClient(
          responses: {
            '/mobile/me/dashboard': {
              'fees': {'totalOutstanding': 7100, 'status': 'DUE'},
            },
          },
        ),
        cache: cache,
      ).getParentDashboardSummaryForChild(_childA);

      final offlineRepository = ParentRepository(
        _StubApiClient(responses: const {}, offline: true),
        cache: cache,
      );

      expect(
        () => offlineRepository.getParentDashboardSummaryForChild(_childB),
        throwsA(isA<NetworkException>()),
        reason:
            'each child has its own key; a sibling balance is not a stand-in',
      );
    });
  });

  group('isolation', () {
    test('a snapshot never crosses tenants', () async {
      networkOnline();
      await repositoryWith(
        storeFor(tenantId: 'tenant-1'),
      ).load(activeChildId: 'child-a');

      final otherTenant = storeFor(tenantId: 'tenant-2');
      expect(await otherTenant.load(childId: 'child-a'), isNull);

      networkOffline();
      expect(
        () => repositoryWith(otherTenant).load(activeChildId: 'child-a'),
        throwsA(isA<NetworkException>()),
      );
    });

    test('a snapshot never crosses guardians', () async {
      networkOnline();
      await repositoryWith(
        storeFor(guardianId: 'guardian-1'),
      ).load(activeChildId: 'child-a');

      final otherGuardian = storeFor(guardianId: 'guardian-2');
      expect(await otherGuardian.load(childId: 'child-a'), isNull);
    });

    test('a snapshot never crosses children', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      expect(
        await store.load(childId: 'child-b'),
        isNull,
        reason: 'a sibling has their own snapshot or none at all',
      );
    });

    test('switching child offline cannot render the previous child', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      networkOffline();
      final repository = repositoryWith(store);
      expect(
        () => repository.load(activeChildId: 'child-b'),
        throwsA(isA<NetworkException>()),
        reason: 'child B has no snapshot; child A\'s must never stand in',
      );
    });

    test('each child keeps its own snapshot side by side', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');
      await repositoryWith(store).load(activeChildId: 'child-b');

      networkOffline();
      final a = await repositoryWith(store).load(activeChildId: 'child-a');
      final b = await repositoryWith(store).load(activeChildId: 'child-b');

      expect(a.activeChild?.id, 'child-a');
      expect(b.activeChild?.id, 'child-b');
    });
  });

  group('integrity and freshness', () {
    test('a corrupted record is ignored', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');
      expect(await store.load(childId: 'child-a'), isNotNull);

      // Whatever the cause - a half-written file, a truncated value - the
      // record must be treated as absent, not partially parsed.
      final key = storage.values.keys.single;
      storage.values[key] = '{"schemaVersion":1,"namespace":"broken"';

      expect(await store.load(childId: 'child-a'), isNull);

      networkOffline();
      expect(
        () => repositoryWith(store).load(activeChildId: 'child-a'),
        throwsA(isA<NetworkException>()),
      );
    });

    test('a snapshot from an older payload schema is ignored', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      // Target the payload's own version, not the cache envelope's, so the
      // rejection under test is the store's and not PrivateReadCache's.
      final key = storage.values.keys.single;
      final tampered = storage.values[key]!.replaceFirst(
        '"data":{"schemaVersion":2',
        '"data":{"schemaVersion":0',
      );
      expect(tampered, isNot(storage.values[key]), reason: 'tamper must apply');
      storage.values[key] = tampered;

      expect(
        await store.load(childId: 'child-a'),
        isNull,
        reason: 'an older shape may be missing fields the dashboard reads',
      );
    });

    test('a snapshot older than the freshness window is discarded', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      now = now.add(const Duration(hours: 11, minutes: 59));
      expect(
        await store.load(childId: 'child-a'),
        isNotNull,
        reason: 'inside the twelve-hour window a saved copy is still useful',
      );

      now = now.add(const Duration(minutes: 2));
      expect(
        await store.load(childId: 'child-a'),
        isNull,
        reason: 'past twelve hours it could misreport today entirely',
      );
    });

    test('a restored snapshot always declares itself as cached', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');

      final snapshot = await store.load(childId: 'child-a');
      expect(snapshot!.data.fromCache, isTrue);
      expect(
        snapshot.data.lastUpdated,
        snapshot.cachedAt,
        reason: 'the age shown must be the age of the copy, not of the render',
      );
    });

    test('no authentication material is written to disk', () async {
      networkOnline();
      await repositoryWith(storeFor()).load(activeChildId: 'child-a');

      final serialized = storage.values.values.join().toLowerCase();
      for (final forbidden in [
        'accesstoken',
        'refreshtoken',
        'authorization',
        'bearer',
        'password',
      ]) {
        expect(
          serialized,
          isNot(contains(forbidden)),
          reason: '"$forbidden" must never reach the snapshot',
        );
      }
    });
  });

  group('lifecycle', () {
    test('logout clears the snapshot', () async {
      SharedPreferences.setMockInitialValues({});
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');
      expect(await store.load(childId: 'child-a'), isNotNull);

      await PrivateDataCleanupService(
        AppPreferencesService(await SharedPreferences.getInstance()),
        storage,
      ).clearPrivateData();

      expect(await store.load(childId: 'child-a'), isNull);
      expect(storage.values, isEmpty);
    });

    test('unlinking a child drops that child\'s saved copy', () async {
      networkOnline();
      final store = storeFor();
      await repositoryWith(store).load(activeChildId: 'child-a');
      await repositoryWith(store).load(activeChildId: 'child-b');
      expect(await store.load(childId: 'child-a'), isNotNull);
      expect(await store.load(childId: 'child-b'), isNotNull);

      // The school removes the guardian link to child B.
      when(
        () => parentRepository.getGuardianChildren(),
      ).thenAnswer((_) async => const [_childA]);
      await repositoryWith(store).load(activeChildId: 'child-a');

      expect(await store.load(childId: 'child-a'), isNotNull);
      expect(
        await store.load(childId: 'child-b'),
        isNull,
        reason: 'an unlinked child must not wait out the expiry window',
      );
    });

    test('pruning never reaches another guardian\'s records', () async {
      networkOnline();
      final mine = storeFor(guardianId: 'guardian-1');
      final theirs = storeFor(guardianId: 'guardian-2');
      await repositoryWith(mine).load(activeChildId: 'child-a');
      await repositoryWith(theirs).load(activeChildId: 'child-b');

      // Guardian 1 now has no linked children at all.
      when(
        () => parentRepository.getGuardianChildren(),
      ).thenAnswer((_) async => const [_childA]);
      await mine.pruneUnlinked(const []);

      expect(await mine.load(childId: 'child-a'), isNull);
      expect(
        await theirs.load(childId: 'child-b'),
        isNotNull,
        reason: 'a prune is scoped to the caller\'s own namespace',
      );
    });

    test('a restart with the same identity restores the dashboard', () async {
      networkOnline(feesDue: 7100);
      await repositoryWith(storeFor()).load(activeChildId: 'child-a');

      // A relaunch builds fresh objects over the same storage; only the
      // secure store survives, exactly as on a real cold start.
      final afterRestart = storeFor();
      networkOffline();
      final restored = await repositoryWith(
        afterRestart,
      ).load(activeChildId: 'child-a');

      expect(restored.fromCache, isTrue);
      expect(restored.activeChild?.feesDue, 7100);
    });
  });

  group('concurrency', () {
    test('simultaneous refreshes share one fan-out', () async {
      final gate = Completer<void>();
      var dashboardCalls = 0;
      when(
        () => parentRepository.getParentDashboardSummaryForChild(any()),
      ).thenAnswer((invocation) async {
        dashboardCalls++;
        await gate.future;
        return _dashboardFor(
          invocation.positionalArguments.first as GuardianChild,
        );
      });

      final repository = repositoryWith(storeFor());
      final first = repository.load(activeChildId: 'child-a');
      final second = repository.load(activeChildId: 'child-a');
      expect(identical(first, second), isTrue);

      gate.complete();
      await Future.wait([first, second]);

      expect(
        dashboardCalls,
        2,
        reason: 'two linked children, fetched once - not once per caller',
      );
    });

    test('a second load after the first settles does fetch again', () async {
      networkOnline();
      final repository = repositoryWith(storeFor());

      await repository.load(activeChildId: 'child-a');
      await repository.load(activeChildId: 'child-a');

      verify(
        () => parentRepository.getParentDashboardSummaryForChild(any()),
      ).called(4);
    });

    test('a different child is never served the in-flight request', () async {
      final gate = Completer<void>();
      when(
        () => parentRepository.getParentDashboardSummaryForChild(any()),
      ).thenAnswer((invocation) async {
        await gate.future;
        return _dashboardFor(
          invocation.positionalArguments.first as GuardianChild,
        );
      });

      final repository = repositoryWith(storeFor());
      final forA = repository.load(activeChildId: 'child-a');
      final forB = repository.load(activeChildId: 'child-b');
      expect(identical(forA, forB), isFalse);

      gate.complete();
      final results = await Future.wait([forA, forB]);
      expect(results[0].activeChild?.id, 'child-a');
      expect(results[1].activeChild?.id, 'child-b');
    });

    test('a failed write never fails a load that already succeeded', () async {
      networkOnline();
      storage.failWrites = true;

      final live = await repositoryWith(
        storeFor(),
      ).load(activeChildId: 'child-a');

      expect(live.fromCache, isFalse);
      expect(live.activeChild?.id, 'child-a');
    });
  });
}

// ---------------------------------------------------------------------------

const _childA = GuardianChild(
  id: 'child-a',
  name: 'Aarav Adhikari',
  classSection: 'Class 1 - A',
  rollNumber: '1',
  academicYear: '2083/84',
  relationship: 'Son',
);

const _childB = GuardianChild(
  id: 'child-b',
  name: 'Sunita Bhattarai',
  classSection: 'Class 1 - B',
  rollNumber: '2',
  academicYear: '2083/84',
  relationship: 'Daughter',
);

const _childC = GuardianChild(
  id: 'child-c',
  name: 'Rita Bhattarai',
  classSection: 'Class 2 - A',
  rollNumber: '3',
  academicYear: '2083/84',
  relationship: 'Daughter',
);

const _homeworkItem = ParentHomeworkItem(
  id: 'hw-1',
  title: 'Algebra Worksheet #1',
  subjectName: 'Mathematics',
  submissionStatus: 'NOT_SUBMITTED',
  attachmentCount: 0,
  dueAt: '2099-07-28T04:00:00.000Z',
);

final _notificationPage = ParentNotificationPage(
  items: [
    ParentNotification(
      id: 'u1',
      type: ParentNotificationType.notice,
      title: 'Parent-teacher meeting',
      body: 'Friday, 10:00 AM to 2:00 PM.',
      createdAt: DateTime.utc(2026, 7, 26, 2),
      targetId: 'u1',
      audience: const ParentNotificationAudience(label: 'Whole school'),
      route: '/notices/u1',
    ),
  ],
  unreadCount: 1,
);

ParentDashboardSummary _dashboardFor(
  GuardianChild child, {
  num feesDue = 0,
  String attendance = 'Present today',
}) {
  return ParentDashboardSummary(
    child: child,
    attendanceToday: attendance,
    homeworkPending: 0,
    feesDue: feesDue,
    feesStatus: feesDue > 0 ? 'DUE' : 'PAID',
    feesTotalAmount: 12000,
    overdueFeesCount: 0,
    unreadNotices: 0,
    transportStatus: 'No active trip',
    canteenBalance: 0,
    canteenIsLowBalance: false,
    latestActivity: 'No recent activity',
    lastUpdated: DateTime.utc(2026, 7, 26, 3),
  );
}

ChildProfile _profileFor(GuardianChild child) {
  return ChildProfile(
    child: child,
    classTeacher: 'Ramesh Gurung',
    guardianSummary: '',
    canViewGuardianSummary: false,
    attendanceSummary: '',
    homeworkSummary: '',
    feesSummary: '',
    qrLabel: '',
  );
}

class _MockParentRepository extends Mock implements ParentRepository {}

/// Answers a fixed map per path, or fails the way a dropped connection does.
class _StubApiClient implements ApiClient {
  _StubApiClient({required this.responses, this.offline = false});

  final Map<String, Map<String, dynamic>> responses;
  final bool offline;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    if (offline) throw const NetworkException('offline');
    final body = responses[path];
    if (body == null) throw const NetworkException('offline');
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: body as T,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} is not stubbed');
}

class _MockNoticesRepository extends Mock implements NoticesRepository {}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};

  /// Simulates storage that rejects writes - a full disk, a locked keystore.
  bool failWrites = false;

  @override
  Future<void> write(String key, String value) async {
    if (failWrites) throw StateError('secure storage unavailable');
    values[key] = value;
  }

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }

  @override
  Future<void> clearAll() async {
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}
