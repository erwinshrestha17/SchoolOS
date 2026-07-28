import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';
import 'package:schoolos_mobile/features/parent/data/parent_portal_repository.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

/// Parent Today is the first screen a guardian sees. Fetching each child's
/// dashboard, profile and homework one after another made the wait scale with
/// the number of linked children - ten round trips for a three-child account
/// on the low-bandwidth connections this app targets.
void main() {
  setUpAll(() {
    registerFallbackValue(_childA);
  });

  late _MockParentRepository parentRepository;
  late _MockNoticesRepository noticesRepository;
  late ParentPortalRepository repository;

  setUp(() {
    parentRepository = _MockParentRepository();
    noticesRepository = _MockNoticesRepository();
    repository = ParentPortalRepository(
      parentRepository: parentRepository,
      noticesRepository: noticesRepository,
      parentName: 'Sita Rai',
      schoolName: 'Everest School',
    );

    when(
      () => parentRepository.getGuardianChildren(),
    ).thenAnswer((_) async => const [_childA, _childB, _childC]);
    when(
      () => noticesRepository.getNotificationCenter(limit: any(named: 'limit')),
    ).thenAnswer(
      (_) async => const ParentNotificationPage(items: [], unreadCount: 0),
    );
  });

  test('loads every child and the notice feed concurrently', () async {
    // Each call parks until released, so the number in flight at once is
    // exactly what the repository issued in parallel.
    final gate = Completer<void>();
    var inFlight = 0;
    var peakInFlight = 0;

    Future<T> tracked<T>(T value) async {
      inFlight++;
      peakInFlight = peakInFlight > inFlight ? peakInFlight : inFlight;
      await gate.future;
      inFlight--;
      return value;
    }

    when(
      () => parentRepository.getParentDashboardSummaryForChild(any()),
    ).thenAnswer((invocation) {
      final child = invocation.positionalArguments.first as GuardianChild;
      return tracked(_dashboardFor(child));
    });
    when(() => parentRepository.getChildProfileForChild(any())).thenAnswer((
      invocation,
    ) {
      final child = invocation.positionalArguments.first as GuardianChild;
      return tracked(_profileFor(child));
    });

    final load = repository.load(activeChildId: 'child-b');
    // Let the repository issue everything it can before anything resolves.
    await Future<void>.delayed(Duration.zero);

    expect(
      peakInFlight,
      greaterThanOrEqualTo(6),
      reason:
          'three children x (dashboard + profile) should be in flight at once, '
          'not issued one round trip at a time',
    );

    gate.complete();
    final data = await load;

    expect(
      data.children.map((child) => child.id),
      ['child-a', 'child-b', 'child-c'],
      reason: 'parallel fetching must not disturb the declared child order',
    );
    expect(data.activeChildId, 'child-b');
    verify(() => noticesRepository.getNotificationCenter(limit: 30)).called(1);
  });

  test(
    'surfaces a per-child failure instead of hanging or swallowing it',
    () async {
      when(
        () => parentRepository.getParentDashboardSummaryForChild(any()),
      ).thenAnswer((invocation) async {
        final child = invocation.positionalArguments.first as GuardianChild;
        if (child.id == 'child-b') {
          throw StateError('dashboard unavailable');
        }
        return _dashboardFor(child);
      });
      when(() => parentRepository.getChildProfileForChild(any())).thenAnswer((
        invocation,
      ) async {
        // A sibling call also fails. Both futures must stay handled, otherwise
        // the second error escapes as an unhandled async error.
        throw StateError('profile unavailable');
      });

      await expectLater(repository.load(), throwsA(isA<StateError>()));
      // Give any orphaned future a chance to surface as an unhandled error.
      await Future<void>.delayed(const Duration(milliseconds: 20));
    },
  );
}

const _childA = GuardianChild(
  id: 'child-a',
  name: 'Asha Rai',
  classSection: 'Grade 4 - A',
  rollNumber: '7',
  academicYear: '2083',
  relationship: 'Daughter',
  capabilities: {'ACADEMICS_VIEW'},
);
const _childB = GuardianChild(
  id: 'child-b',
  name: 'Bikash Rai',
  classSection: 'Grade 2 - B',
  rollNumber: '11',
  academicYear: '2083',
  relationship: 'Son',
  capabilities: {'ACADEMICS_VIEW'},
);
const _childC = GuardianChild(
  id: 'child-c',
  name: 'Chandra Rai',
  classSection: 'Grade 6 - A',
  rollNumber: '3',
  academicYear: '2083',
  relationship: 'Daughter',
  capabilities: {'ACADEMICS_VIEW'},
);

ParentDashboardSummary _dashboardFor(GuardianChild child) {
  return ParentDashboardSummary(
    child: child,
    attendanceToday: 'Present',
    homeworkPending: 0,
    feesDue: 0,
    overdueFeesCount: 0,
    unreadNotices: 0,
    transportStatus: 'No active trip',
    canteenBalance: 0,
    canteenIsLowBalance: false,
    latestActivity: 'No recent activity',
    lastUpdated: DateTime(2026, 7, 25, 9),
    // Homework stays locked so the fixture exercises the dashboard-gated
    // branch without needing a third stub per child.
    homeworkEnabled: false,
  );
}

ChildProfile _profileFor(GuardianChild child) {
  return ChildProfile(
    child: child,
    classTeacher: 'Class teacher',
    guardianSummary: 'verified',
    canViewGuardianSummary: true,
    attendanceSummary: '',
    homeworkSummary: '',
    feesSummary: '',
    qrLabel: '',
  );
}

class _MockParentRepository extends Mock implements ParentRepository {}

class _MockNoticesRepository extends Mock implements NoticesRepository {}
