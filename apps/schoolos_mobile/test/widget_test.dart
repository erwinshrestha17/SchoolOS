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
import 'package:schoolos_mobile/shared/widgets/app_button.dart';
import 'package:schoolos_mobile/shared/widgets/status_chip.dart';
import 'package:schoolos_mobile/shared/widgets/role_badge.dart';
import 'package:schoolos_mobile/shared/widgets/role_shell_scaffold.dart';

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
    expect(find.text('Smarter school operations'), findsOneWidget);

    // Settle splash screen transition timers and animations to prevent pending timers
    await tester.pump(const Duration(milliseconds: 2000));
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
}
