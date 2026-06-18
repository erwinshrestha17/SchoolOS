import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:schoolos_mobile/app/app.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/shared/widgets/app_button.dart';
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
      const ProviderScope(
        child: MaterialApp(
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
    expect(find.text('Child'), findsOneWidget);
    expect(find.text('Fees'), findsOneWidget);
    expect(find.text('Notices'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });

  testWidgets('RoleShellScaffold renders routed student navigation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: RoleShellScaffold(
            role: 'STUDENT',
            selectedIndex: 0,
            body: Center(child: Text('Student Home Body')),
          ),
        ),
      ),
    );

    expect(find.text('Student Home Body'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Homework'), findsOneWidget);
    expect(find.text('Timetable'), findsOneWidget);
    expect(find.text('Notices'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
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
          parentPortalDataProvider.overrideWith(
            (ref) async => const ParentPortalData(
              parentName: 'Erwin Shrestha',
              schoolName: 'greenfield',
              lastUpdated: '6:19 PM',
              totalFeesDue: 4500,
              overdueFeesCount: 1,
              unreadUpdates: 1,
              children: [
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
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Homework').last);
    await tester.pumpAndSettle();
    expect(find.text('Homework summary'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Updates').last);
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
}
