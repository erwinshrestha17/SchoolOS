import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:schoolos_mobile/app/app.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/operational_summary/application/operational_summary_providers.dart';
import 'package:schoolos_mobile/features/operational_summary/domain/operational_summary_models.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/shared/widgets/app_button.dart';
import 'package:schoolos_mobile/shared/widgets/app_exception_view.dart';
import 'package:schoolos_mobile/shared/widgets/status_chip.dart';
import 'package:schoolos_mobile/shared/widgets/role_badge.dart';
import 'package:schoolos_mobile/shared/widgets/role_shell_scaffold.dart';
import 'package:schoolos_mobile/shared/widgets/school_os_app_shell.dart';

class FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;
  @override
  Future<String?> getUserRole() async => null;
}

class FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => FakeApiClient();
}

class FakeAuthNotifier extends AuthNotifier {
  FakeAuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

class StudentAuthNotifier extends AuthNotifier {
  StudentAuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);

  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.authenticated,
      role: 'STUDENT',
      user: AuthUser(
        id: 'student-user',
        name: 'Student User',
        email: 'student@school.test',
        role: 'STUDENT',
        roles: ['student'],
      ),
    );
  }
}

final testOperationalSummaryOverride = operationalSummaryProvider.overrideWith(
  (ref, persona) async => OperationalMobileSummary(
    persona: persona,
    generatedAt: 'test',
    schoolDay: 'test',
    status: OperationalSummaryStatus.empty,
    metrics: const {},
    attentionItems: const [],
  ),
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('SchoolOS app loads and renders splash screen', (
    WidgetTester tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            final tokenStorage = ref.watch(tokenStorageServiceProvider);
            final authRepository = ref.watch(authRepositoryProvider);
            final appPrefs = ref.watch(appPreferencesServiceProvider);
            return FakeAuthNotifier(tokenStorage, authRepository, appPrefs);
          }),
        ],
        child: const SchoolOSApp(),
      ),
    );

    expect(find.text('SchoolOS Mobile'), findsOneWidget);
    expect(
      find.text('Daily operations, parent engagement, staff self-service'),
      findsOneWidget,
    );

    // Settle splash screen transition timers and animations to prevent pending timers
    await tester.pump(const Duration(milliseconds: 3000));
    await tester.pumpAndSettle();
  });

  testWidgets('AppButton renders label and responds to taps', (
    WidgetTester tester,
  ) async {
    bool tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppButton(
            label: 'Test Button',
            onPressed: () {
              tapped = true;
            },
          ),
        ),
      ),
    );

    expect(find.text('Test Button'), findsOneWidget);
    await tester.tap(find.text('Test Button'));
    expect(tapped, isTrue);
  });

  testWidgets('StatusChip renders correct text', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: StatusChip(status: AppStatusType.present)),
      ),
    );

    expect(find.text('Present'), findsOneWidget);
  });

  testWidgets('AppExceptionView shows safe offline and conflict states', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppExceptionView(error: NetworkException())),
      ),
    );

    expect(find.text('Connection lost'), findsOneWidget);
    expect(find.textContaining('No internet connection'), findsOneWidget);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppExceptionView(error: ConflictAppException())),
      ),
    );

    expect(find.text('Refresh needed'), findsOneWidget);
    expect(find.textContaining('Refresh and try again'), findsOneWidget);
  });

  testWidgets('RoleBadge renders correct role label', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: RoleBadge(role: 'PARENT')),
      ),
    );

    expect(find.text('PARENT'), findsOneWidget);
  });

  testWidgets('RoleShellScaffold renders parent mobile navigation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [testOperationalSummaryOverride],
        child: const MaterialApp(
          home: RoleShellScaffold(
            role: 'PARENT',
            selectedIndex: 0,
            body: Center(child: Text('Parent Home Body')),
          ),
        ),
      ),
    );

    expect(find.text('Parent Home Body'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Children'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('Homework'), findsOneWidget);
    expect(find.text('Notices'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });

  testWidgets('RoleShellScaffold limits student navigation to session entry', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [testOperationalSummaryOverride],
        child: const MaterialApp(
          home: RoleShellScaffold(
            role: 'STUDENT',
            selectedIndex: 0,
            body: Center(child: Text('Student Home Body')),
          ),
        ),
      ),
    );

    expect(find.text('Student Home Body'), findsOneWidget);
    expect(find.text('Session'), findsNothing);
    expect(find.text('Homework'), findsNothing);
    expect(find.text('Timetable'), findsNothing);
    expect(find.text('Notices'), findsNothing);
    expect(find.text('More'), findsNothing);
    expect(find.byTooltip('Notifications'), findsNothing);
    expect(find.byTooltip('Profile'), findsNothing);
  });

  testWidgets('student deep links fail closed to controlled session entry', (
    WidgetTester tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return StudentAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
        ],
        child: const SchoolOSApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Student learning session'), findsOneWidget);

    final context = tester.element(find.text('Student learning session'));
    GoRouter.of(context).go(AppRoutes.studentHomework);
    await tester.pumpAndSettle();

    expect(find.text('Student learning session'), findsOneWidget);
    expect(find.text('Join a live session'), findsOneWidget);
    expect(find.text('Homework'), findsNothing);

    final sessionContext = tester.element(
      find.text('Student learning session'),
    );
    GoRouter.of(sessionContext).go(AppRoutes.notices);
    await tester.pumpAndSettle();

    expect(find.text('Student learning session'), findsOneWidget);
    expect(find.text('Join a live session'), findsOneWidget);
  });

  testWidgets('RoleShellScaffold renders exact teacher bottom navigation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [testOperationalSummaryOverride],
        child: const MaterialApp(
          home: RoleShellScaffold(
            role: 'TEACHER',
            selectedIndex: 0,
            body: Center(child: Text('Teacher Today Body')),
          ),
        ),
      ),
    );

    expect(find.text('Teacher Today Body'), findsOneWidget);
    expect(find.text('Operational snapshot'), findsNothing);
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('Homework'), findsOneWidget);
    expect(find.text('Messages'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Classes'), findsNothing);
    expect(find.text('More'), findsNothing);
  });

  testWidgets('parent portal tabs render on a compact phone viewport', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          testOperationalSummaryOverride,
          parentPortalDataProvider.overrideWith(
            (ref) async => ParentPortalData(
              parentName: 'Erwin Shrestha',
              schoolName: 'greenfield',
              lastUpdated: DateTime(2024, 1, 1, 18, 19),
              totalFeesDue: 4500,
              overdueFeesCount: 1,
              unreadUpdates: 1,
              children: const [
                ParentPortalChild(
                  id: 'aarav',
                  name: 'Aarav Shrestha',
                  classSection: 'Nursery-A',
                  teacher: 'Class teacher details in timetable',
                  attendance: 'Present today',
                  attendanceTime: 'Updated 6:19 PM',
                  transport: 'Pickup at 3:15 PM',
                  homework: 'No pending homework',
                  updates: 'No unread updates',
                ),
                ParentPortalChild(
                  id: 'aarohi',
                  name: 'Aarohi Shrestha',
                  classSection: 'LKG-A',
                  teacher: 'Class teacher details in timetable',
                  attendance: 'Present today',
                  attendanceTime: 'Updated 6:19 PM',
                  transport: 'Guardian pickup',
                  homework: '1 homework pending',
                  updates: '1 unread update',
                  homeworkPending: 1,
                  unreadUpdates: 1,
                  feesDue: 4500,
                ),
              ],
              homework: [
                ParentPortalHomework(
                  id: 'phonics',
                  childId: 'aarohi',
                  childName: 'Aarohi Shrestha',
                  classSection: 'LKG-A',
                  subject: 'English',
                  title: 'Read the phonics worksheet',
                  dueLabel: 'Due tomorrow',
                  status: 'Pending',
                  attachmentCount: 1,
                  teacher: 'Assigned by school',
                ),
              ],
              updates: [
                ParentPortalUpdate(
                  id: 'holiday',
                  category: ParentUpdateCategory.notice,
                  title: 'Holiday notice for Friday',
                  body: 'School will remain closed.',
                  metadata: 'School - 6:19 PM',
                  isImportant: true,
                  unreadCount: 1,
                  route: '/notices/holiday',
                ),
                ParentPortalUpdate(
                  id: 'ptm',
                  category: ParentUpdateCategory.event,
                  title: 'Parent-Teacher Meeting',
                  body: 'Friday, 10:00 AM-2:00 PM',
                  metadata: 'Aarohi Shrestha - 6:19 PM',
                  route: '/parent/updates?eventId=ptm',
                ),
              ],
            ),
          ),
        ],
        child: const MaterialApp(home: SchoolOsAppShell()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Namaste, Erwin'), findsOneWidget);
    expect(find.text("Aarav's school day"), findsOneWidget);
    expect(find.text('Operational snapshot'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Homework').last);
    await tester.pumpAndSettle();
    expect(find.text('Homework summary'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Notices').last);
    await tester.pumpAndSettle();
    expect(find.text('Holiday notice for Friday'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final updateFilters = find.ancestor(
      of: find.text('Events'),
      matching: find.byType(SingleChildScrollView),
    );
    await tester.drag(updateFilters, const Offset(-220, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Events'));
    await tester.pumpAndSettle();
    expect(find.text('Parent-Teacher Meeting'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'parent portal keeps module locked and permission denied distinct',
    (WidgetTester tester) async {
      final cases = <(Object, String)>[
        (const ModuleLockedException(), 'Module not enabled'),
        (const PermissionException(), 'Access not available'),
      ];

      for (final (error, expectedTitle) in cases) {
        await tester.pumpWidget(
          ProviderScope(
            key: ValueKey(expectedTitle),
            overrides: [
              testOperationalSummaryOverride,
              parentPortalDataProvider.overrideWith(
                (ref) => Future<ParentPortalData>.error(error),
              ),
            ],
            child: const MaterialApp(home: SchoolOsAppShell()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text(expectedTitle), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    },
  );
}
