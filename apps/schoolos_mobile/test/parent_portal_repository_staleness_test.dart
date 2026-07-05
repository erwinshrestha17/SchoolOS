import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';
import 'package:schoolos_mobile/features/parent/data/parent_portal_repository.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

class _MockParentRepository extends Mock implements ParentRepository {}

class _MockNoticesRepository extends Mock implements NoticesRepository {}

void main() {
  late _MockParentRepository parentRepository;
  late _MockNoticesRepository noticesRepository;
  late ParentPortalRepository repository;

  const childA = GuardianChild(
    id: 'child-a',
    name: 'Asha Rai',
    classSection: 'Grade 4 - A',
    rollNumber: '1',
    academicYear: '2024',
    relationship: 'Daughter',
  );
  const childB = GuardianChild(
    id: 'child-b',
    name: 'Bikash Rai',
    classSection: 'Grade 2 - B',
    rollNumber: '2',
    academicYear: '2024',
    relationship: 'Son',
  );

  ParentDashboardSummary dashboardFor(
    GuardianChild child, {
    required DateTime lastUpdated,
    required bool fromCache,
  }) {
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
      latestActivity: 'No recent activity',
      lastUpdated: lastUpdated,
      fromCache: fromCache,
    );
  }

  ChildProfile profileFor(GuardianChild child) {
    return ChildProfile(
      child: child,
      classTeacher: 'Class teacher',
      guardianSummary: '',
      canViewGuardianSummary: false,
      attendanceSummary: '',
      homeworkSummary: '',
      feesSummary: '',
      qrLabel: '',
    );
  }

  setUp(() {
    parentRepository = _MockParentRepository();
    noticesRepository = _MockNoticesRepository();
    repository = ParentPortalRepository(
      parentRepository: parentRepository,
      noticesRepository: noticesRepository,
      parentName: 'Parent',
      schoolName: 'School',
    );

    when(
      () => parentRepository.getGuardianChildren(),
    ).thenAnswer((_) async => [childA, childB]);
    when(
      () => parentRepository.getChildProfileForChild(childA),
    ).thenAnswer((_) async => profileFor(childA));
    when(
      () => parentRepository.getChildProfileForChild(childB),
    ).thenAnswer((_) async => profileFor(childB));
    when(() => noticesRepository.getNotificationCenter(limit: 30)).thenAnswer(
      (_) async => const ParentNotificationPage(items: [], unreadCount: 0),
    );
    when(
      () => parentRepository.getHomeworkForChild(any(), take: 20),
    ).thenAnswer((_) async => const []);
  });

  test(
    'reports fresh, non-cached data when every child dashboard is live',
    () async {
      final freshTime = DateTime(2026, 7, 6, 9, 0);
      when(
        () => parentRepository.getParentDashboardSummaryForChild(childA),
      ).thenAnswer(
        (_) async =>
            dashboardFor(childA, lastUpdated: freshTime, fromCache: false),
      );
      when(
        () => parentRepository.getParentDashboardSummaryForChild(childB),
      ).thenAnswer(
        (_) async =>
            dashboardFor(childB, lastUpdated: freshTime, fromCache: false),
      );

      final data = await repository.load();

      expect(data.fromCache, isFalse);
      expect(data.lastUpdated, freshTime);
    },
  );

  test(
    'marks the portal stale and surfaces the oldest timestamp when any child fell back to cache',
    () async {
      final staleTime = DateTime(2026, 7, 6, 7, 15);
      final freshTime = DateTime(2026, 7, 6, 9, 0);
      when(
        () => parentRepository.getParentDashboardSummaryForChild(childA),
      ).thenAnswer(
        (_) async =>
            dashboardFor(childA, lastUpdated: staleTime, fromCache: true),
      );
      when(
        () => parentRepository.getParentDashboardSummaryForChild(childB),
      ).thenAnswer(
        (_) async =>
            dashboardFor(childB, lastUpdated: freshTime, fromCache: false),
      );

      final data = await repository.load();

      expect(data.fromCache, isTrue);
      expect(data.lastUpdated, staleTime);
    },
  );
}
