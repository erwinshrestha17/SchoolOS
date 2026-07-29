import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_portal_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_detail_screens.dart';

/// Parent detail screens are reachable by deep link, including from push
/// payloads that can outlive the record they point at. They used to fall back
/// to the first child / first homework item, so a stale link silently rendered
/// a *different* child's record under the requested child's route. The release
/// checklist requires denial, not substitution.
void main() {
  late _MockParentPortalRepository repository;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    repository = _MockParentPortalRepository();
    when(
      () => repository.load(activeChildId: any(named: 'activeChildId')),
    ).thenAnswer((_) async => _portal());
  });

  Future<void> pump(WidgetTester tester, Widget screen) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeParentAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          parentPortalRepositoryProvider.overrideWithValue(repository),
        ],
        child: MaterialApp(home: screen),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('an unlinked child id is denied, not swapped for a linked one', (
    tester,
  ) async {
    await pump(
      tester,
      const ParentPortalChildDetailScreen(childId: 'child-not-linked'),
    );

    expect(find.text('Child not available'), findsOneWidget);
    expect(
      find.text('Asha Rai'),
      findsNothing,
      reason: 'no other child\'s record may be shown under this route',
    );
  });

  testWidgets('a linked child id still renders that child', (tester) async {
    await pump(tester, const ParentPortalChildDetailScreen(childId: 'child-b'));

    expect(find.text('Bikash Rai'), findsWidgets);
    expect(find.text('Child not available'), findsNothing);
  });

  testWidgets(
    'child profile is a compact command centre with unambiguous statuses',
    (tester) async {
      tester.view.physicalSize = const Size(400, 900);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pump(
        tester,
        const ParentPortalChildDetailScreen(childId: 'child-a'),
      );

      expect(find.text('Attendance pending'), findsWidgets);
      expect(find.text('Attendance not marked today'), findsNothing);
      expect(
        find.text('The school has not recorded attendance yet'),
        findsWidgets,
      );
      expect(find.text('Live bus tracking unavailable'), findsOneWidget);
      expect(find.text('No fees due'), findsOneWidget);
      expect(find.text('All payments are up to date'), findsOneWidget);
      expect(find.text('Rs 0'), findsNothing);
      expect(find.textContaining('Roll 12'), findsWidgets);
      expect(find.text('Everest School'), findsOneWidget);
      expect(find.text('Academic Year 2083'), findsOneWidget);

      await tester.scrollUntilVisible(find.text('Child actions'), 260);
      await tester.pumpAndSettle();
      expect(find.text('Child actions'), findsOneWidget);
      expect(find.text('Results'), findsOneWidget);
      expect(find.text('Timetable'), findsOneWidget);
      expect(find.text('Help & Support'), findsOneWidget);

      await tester.scrollUntilVisible(find.text('School details'), 260);
      await tester.pumpAndSettle();
      expect(find.text('School details'), findsOneWidget);

      await tester.scrollUntilVisible(find.text('Recent activity'), 260);
      await tester.pumpAndSettle();
      expect(find.text('Recent activity'), findsOneWidget);
      expect(find.text('Sports Day registration'), findsOneWidget);
      expect(find.text('Today timeline'), findsNothing);
      expect(find.text('Quick actions'), findsNothing);
      expect(find.text('At school'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('an unknown homework id is denied, not swapped for another', (
    tester,
  ) async {
    await pump(
      tester,
      const ParentPortalHomeworkDetailScreen(homeworkId: 'homework-gone'),
    );

    expect(find.text('Homework not available'), findsOneWidget);
    expect(
      find.text('Fractions worksheet'),
      findsNothing,
      reason: 'a different assignment must not stand in for the requested one',
    );
  });

  testWidgets('a known homework id still renders that assignment', (
    tester,
  ) async {
    await pump(
      tester,
      const ParentPortalHomeworkDetailScreen(homeworkId: 'homework-1'),
    );

    expect(find.text('Fractions worksheet'), findsWidgets);
    expect(find.text('Homework not available'), findsNothing);
  });
}

ParentPortalData _portal() {
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: DateTime(2026, 7, 25, 9),
    activeChildId: 'child-a',
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Asha Rai',
        classSection: 'Grade 4 - A',
        teacher: 'Ramesh Gurung',
        attendance: 'Attendance not marked today',
        attendanceTime: 'Updated now',
        transport: 'GPS unavailable',
        homework: '3 assignments due',
        updates: 'No unread updates',
        rollNumber: '12',
        academicYear: '2083',
        homeworkPending: 3,
        homeworkDetail: '1 overdue · 2 due this week',
        feesTotalAmount: 4500,
        transportAssigned: true,
        transportHasActiveTrip: true,
        attendanceEnabled: true,
        homeworkEnabled: true,
        feesEnabled: true,
        transportEnabled: true,
        capabilities: {
          'ACADEMICS_VIEW',
          'ATTENDANCE_VIEW',
          'FEES_VIEW',
          'COMPLAINT_OR_CORRECTION_SUBMIT',
        },
      ),
      ParentPortalChild(
        id: 'child-b',
        name: 'Bikash Rai',
        classSection: 'Grade 2 - B',
        teacher: 'Class teacher',
        attendance: 'Present today',
        attendanceTime: 'Updated now',
        transport: 'No active trip',
        homework: 'No pending homework',
        updates: 'No unread updates',
      ),
    ],
    homework: const [
      ParentPortalHomework(
        id: 'homework-1',
        childId: 'child-a',
        childName: 'Asha Rai',
        classSection: 'Grade 4 - A',
        subject: 'Mathematics',
        title: 'Fractions worksheet',
        dueLabel: 'Due tomorrow',
        rawStatus: 'NOT_SUBMITTED',
        attachmentCount: 0,
        teacher: 'Assigned by school',
      ),
    ],
    updates: [
      ParentPortalUpdate(
        id: 'notice-1',
        childId: 'child-a',
        category: ParentUpdateCategory.notice,
        title: 'Sports Day registration',
        body: 'Registration is now open.',
        metadata: 'Asha Rai - 10:32 AM NPT',
        createdAt: DateTime(2026, 7, 25, 10, 32),
      ),
    ],
  );
}

class _MockParentPortalRepository extends Mock
    implements ParentPortalRepository {}

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getUserRole() async => null;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _FakeApiClient();
}

class _FakeParentAuthNotifier extends AuthNotifier {
  _FakeParentAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'PARENT');
  }
}
