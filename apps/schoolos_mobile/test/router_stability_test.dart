import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/app/router.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

/// `appRouterProvider` used to `ref.watch(authProvider)`, so every auth state
/// change - including the transient `loading` hop in the middle of sign-in and
/// sign-out - produced a brand new `GoRouter`. `MaterialApp.router` then
/// received a different `routerConfig`, tore down the Navigator and reset the
/// stack to `initialLocation`. The router must instead be built once and
/// re-evaluate `redirect` through its `refreshListenable`.
void main() {
  late ProviderContainer container;
  late _ControllableAuthNotifier auth;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    container = ProviderContainer(
      overrides: [
        appPreferencesServiceProvider.overrideWithValue(preferences),
        tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        authProvider.overrideWith((ref) {
          return auth = _ControllableAuthNotifier(
            ref.watch(tokenStorageServiceProvider),
            ref.watch(authRepositoryProvider),
            ref.watch(appPreferencesServiceProvider),
          );
        }),
      ],
    );
    addTearDown(container.dispose);
    // Force the notifier to be created so `auth` is assigned.
    container.read(authProvider);
  });

  test('the same router instance survives a full sign-in transition', () {
    final router = container.read(appRouterProvider);

    auth.emit(AuthStatus.loading);
    expect(container.read(appRouterProvider), same(router));

    auth.emit(AuthStatus.authenticated, role: 'TEACHER');
    expect(
      container.read(appRouterProvider),
      same(router),
      reason:
          'a new GoRouter here would reset the navigation stack to '
          '${AppRoutes.splash} on every sign-in',
    );
  });

  test('the same router instance survives a full sign-out transition', () {
    auth.emit(AuthStatus.authenticated, role: 'PARENT');
    final router = container.read(appRouterProvider);

    // logout() emits loading and then unauthenticated.
    auth.emit(AuthStatus.loading);
    auth.emit(AuthStatus.unauthenticated);

    expect(container.read(appRouterProvider), same(router));
  });

  group('resolveAuthRedirect', () {
    AuthState signedInAs(String role, {bool mustChangePassword = false}) {
      return AuthState(
        status: AuthStatus.authenticated,
        role: role,
        user: AuthUser(
          id: '$role-1',
          name: 'Test $role',
          email: '$role@example-school.edu.np',
          role: role,
          mustChangePassword: mustChangePassword,
        ),
      );
    }

    final signedOut = AuthState(status: AuthStatus.unauthenticated);

    test('sends a signed-out user on a protected route to login', () {
      expect(
        resolveAuthRedirect(signedOut, AppRoutes.parentHome),
        AppRoutes.login,
      );
    });

    test('leaves public routes alone while signed out', () {
      expect(resolveAuthRedirect(signedOut, AppRoutes.login), isNull);
      expect(resolveAuthRedirect(signedOut, AppRoutes.splash), isNull);
      expect(resolveAuthRedirect(signedOut, AppRoutes.forgotPassword), isNull);
    });

    test('does not redirect while auth is still loading', () {
      // Mid sign-in the app should sit still rather than bounce to login.
      expect(
        resolveAuthRedirect(
          AuthState(status: AuthStatus.loading),
          AppRoutes.parentHome,
        ),
        isNull,
      );
    });

    test('lets each persona reach its own routes', () {
      expect(
        resolveAuthRedirect(signedInAs('PARENT'), AppRoutes.parentHome),
        isNull,
      );
      expect(
        resolveAuthRedirect(signedInAs('TEACHER'), AppRoutes.teacherHome),
        isNull,
      );
      expect(
        resolveAuthRedirect(signedInAs('PRINCIPAL'), AppRoutes.principalToday),
        isNull,
      );
    });

    test('bounces each persona off another persona routes', () {
      const crossPersona = {
        'PARENT': [AppRoutes.teacherHome, AppRoutes.principalAdmissions],
        'TEACHER': [AppRoutes.parentFees, AppRoutes.principalApprovals],
        'PRINCIPAL': [AppRoutes.parentFees, AppRoutes.teacherHomework],
      };
      for (final entry in crossPersona.entries) {
        for (final route in entry.value) {
          expect(
            resolveAuthRedirect(signedInAs(entry.key), route),
            AppRoutes.home,
            reason: '${entry.key} must not reach $route',
          );
        }
      }
    });

    test('forces a pending password change ahead of any persona route', () {
      expect(
        resolveAuthRedirect(
          signedInAs('TEACHER', mustChangePassword: true),
          AppRoutes.teacherHome,
        ),
        AppRoutes.changePassword,
      );
      expect(
        resolveAuthRedirect(
          signedInAs('TEACHER', mustChangePassword: true),
          AppRoutes.changePassword,
        ),
        isNull,
      );
    });

    test('sends a signed-in user off a public route to home', () {
      expect(
        resolveAuthRedirect(signedInAs('PARENT'), AppRoutes.login),
        AppRoutes.home,
      );
    });
  });
}

class _ControllableAuthNotifier extends AuthNotifier {
  _ControllableAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  void emit(AuthStatus status, {String? role}) {
    state = AuthState(status: status, role: role);
  }
}

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
