import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/profile/presentation/profile_screen.dart';

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

class _ParentAuthNotifier extends AuthNotifier {
  _ParentAuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);

  int signOutCalls = 0;

  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.authenticated,
      role: 'PARENT',
      user: const AuthUser(
        id: 'parent-1',
        name: 'Sita Adhikari',
        email: 'guardian@example.test',
        role: 'PARENT',
        tenantSlug: 'default-school',
        roles: ['PARENT'],
      ),
    );
  }

  @override
  Future<void> logout() async {
    signOutCalls++;
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('Profile confirms before signing a parent out', (tester) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final sharedPrefs = await SharedPreferences.getInstance();
    late _ParentAuthNotifier authNotifier;
    final router = GoRouter(
      initialLocation: AppRoutes.profile,
      routes: [
        GoRoute(
          path: AppRoutes.profile,
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: AppRoutes.login,
          builder: (context, state) =>
              const Scaffold(body: Text('Sign in destination')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            authNotifier = _ParentAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
            return authNotifier;
          }),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await tester.ensureVisible(find.text('Sign Out'));
    await tester.tap(find.text('Sign Out'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    expect(authNotifier.signOutCalls, 0);
    expect(find.text('Sign out of SchoolOS?'), findsOneWidget);
    expect(
      find.text(
        'You will need to sign in again to access your children’s information.',
      ),
      findsOneWidget,
    );
    expect(find.text('Cancel'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(authNotifier.signOutCalls, 0);
    expect(find.text('Sign out of SchoolOS?'), findsNothing);

    await tester.tap(find.text('Sign Out'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Sign Out').last);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    expect(authNotifier.signOutCalls, 1);
    expect(find.text('Sign in destination'), findsOneWidget);
  });
}
