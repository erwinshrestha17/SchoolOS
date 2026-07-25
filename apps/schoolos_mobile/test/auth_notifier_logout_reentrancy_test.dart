import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

/// Every in-flight request that fails with 401 asks the notifier to sign out,
/// so one expired session can request a logout many times at once. These tests
/// pin that the notifier collapses those into a single sign-out instead of
/// re-posting `/auth/logout`, re-running private-data cleanup and re-emitting
/// auth state once per failed request.
void main() {
  late AppPreferencesService preferences;

  Future<void> setUpPreferences() async {
    SharedPreferences.setMockInitialValues({});
    preferences = AppPreferencesService(await SharedPreferences.getInstance());
  }

  test('concurrent logout requests perform a single sign-out', () async {
    await setUpPreferences();
    final repository = _FakeAuthRepository(_FakeApiClient());
    final cleanup = _CountingCleanup(preferences);
    final notifier = _TestAuthNotifier(
      _MemoryTokenStorage(),
      repository,
      preferences,
      cleanup,
    );
    final states = <AuthStatus>[];
    notifier.addListener((state) => states.add(state.status));

    // Five requests fail with 401 at the same moment.
    await Future.wait(List.generate(5, (_) => notifier.logout()));

    expect(repository.logoutCallCount, 1);
    expect(cleanup.callCount, 1);
    expect(notifier.state.status, AuthStatus.unauthenticated);
    // Initial authenticated state, then loading, then unauthenticated - not
    // one loading/unauthenticated pair per caller.
    expect(states, [
      AuthStatus.authenticated,
      AuthStatus.loading,
      AuthStatus.unauthenticated,
    ]);
  });

  test('logout after the session is already cleared is a no-op', () async {
    await setUpPreferences();
    final repository = _FakeAuthRepository(_FakeApiClient());
    final cleanup = _CountingCleanup(preferences);
    final notifier = _TestAuthNotifier(
      _MemoryTokenStorage(),
      repository,
      preferences,
      cleanup,
    );

    await notifier.logout();
    expect(repository.logoutCallCount, 1);

    // A late 401 arriving after sign-out must not restart the whole flow.
    await notifier.logout();
    await notifier.logout();

    expect(repository.logoutCallCount, 1);
    expect(cleanup.callCount, 1);
    expect(notifier.state.status, AuthStatus.unauthenticated);
  });

  test(
    'a later sign-out still runs after a new session is established',
    () async {
      await setUpPreferences();
      final repository = _FakeAuthRepository(_FakeApiClient());
      final cleanup = _CountingCleanup(preferences);
      final tokenStorage = _MemoryTokenStorage();
      final notifier = _TestAuthNotifier(
        tokenStorage,
        repository,
        preferences,
        cleanup,
      );

      await notifier.logout();
      expect(repository.logoutCallCount, 1);

      // Simulate signing back in, which is what re-arms the guard.
      await notifier.loadSession();
      expect(notifier.state.status, AuthStatus.authenticated);

      await notifier.logout();

      expect(repository.logoutCallCount, 2);
      expect(cleanup.callCount, 2);
      expect(notifier.state.status, AuthStatus.unauthenticated);
    },
  );
}

class _TestAuthNotifier extends AuthNotifier {
  _TestAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
    super.privateDataCleanup,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'TEACHER');
  }
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  _FakeAuthRepository(this._client);

  final ApiClient _client;
  int logoutCallCount = 0;

  @override
  ApiClient get client => _client;

  @override
  Future<void> logout({String? refreshToken, String? installationId}) async {
    logoutCallCount++;
    // Yield so overlapping callers really do overlap.
    await Future<void>.delayed(Duration.zero);
  }
}

class _CountingCleanup extends PrivateDataCleanupService {
  _CountingCleanup(this.preferences) : super(preferences);

  final AppPreferencesService preferences;
  int callCount = 0;

  @override
  Future<void> clearPrivateData() async {
    callCount++;
    await preferences.clearPrivateData();
  }
}

class _MemoryTokenStorage implements TokenStorageService {
  String? accessToken = 'access-token';
  String? refreshToken = 'refresh-token';
  String? role = 'TEACHER';
  String? cachedUser;

  @override
  Future<void> saveAccessToken(String token) async => accessToken = token;

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<void> deleteAccessToken() async => accessToken = null;

  @override
  Future<void> saveRefreshToken(String token) async => refreshToken = token;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> deleteRefreshToken() async => refreshToken = null;

  @override
  Future<void> saveUserRole(String role) async => this.role = role;

  @override
  Future<String?> getUserRole() async => role;

  @override
  Future<void> deleteUserRole() async => role = null;

  @override
  Future<void> saveCachedUser(String userJson) async => cachedUser = userJson;

  @override
  Future<String?> getCachedUser() async => cachedUser;

  @override
  Future<void> deleteCachedUser() async => cachedUser = null;

  @override
  Future<void> clearTokens() async {
    accessToken = null;
    refreshToken = null;
    role = null;
    cachedUser = null;
  }

  @override
  Future<bool> hasValidSession() async => accessToken != null;

  @override
  bool isAccessTokenExpired(String token, {DateTime? now}) => false;
}
