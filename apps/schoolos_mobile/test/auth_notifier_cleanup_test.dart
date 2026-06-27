import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

class _MemoryTokenStorage implements TokenStorageService {
  String? accessToken = 'access-token';
  String? refreshToken = 'refresh-token';
  String? role = 'STUDENT';

  @override
  Future<void> saveAccessToken(String token) async {
    accessToken = token;
  }

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<void> deleteAccessToken() async {
    accessToken = null;
  }

  @override
  Future<void> saveRefreshToken(String token) async {
    refreshToken = token;
  }

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> deleteRefreshToken() async {
    refreshToken = null;
  }

  @override
  Future<void> saveUserRole(String role) async {
    this.role = role;
  }

  @override
  Future<String?> getUserRole() async => role;

  @override
  Future<void> deleteUserRole() async {
    role = null;
  }

  @override
  Future<void> clearTokens() async {
    accessToken = null;
    refreshToken = null;
    role = null;
  }

  @override
  Future<bool> hasValidSession() async => accessToken != null;

  @override
  bool isAccessTokenExpired(String token, {DateTime? now}) => false;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  _FakeAuthRepository(this._client);

  final ApiClient _client;

  @override
  ApiClient get client => _client;

  @override
  Future<void> logout({String? refreshToken}) async {}
}

class _TrackingCleanup extends PrivateDataCleanupService {
  _TrackingCleanup(this.preferences) : super(preferences);

  final AppPreferencesService preferences;
  bool called = false;

  @override
  Future<void> clearPrivateData() async {
    called = true;
    await preferences.clearPrivateData();
  }
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
    state = AuthState(status: AuthStatus.authenticated, role: 'STUDENT');
  }
}

void main() {
  test(
    'logout clears private cache and token-backed student session state',
    () async {
      SharedPreferences.setMockInitialValues({
        'app_selected_child_id': 'child-1',
        'app_cached_user': '{"id":"student-user"}',
        'app_private_read_cache_learning_session': '{"data":{}}',
        'schoolos.teacher_attendance_draft.class-1.2026-06-18': '{}',
      });
      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final tokenStorage = _MemoryTokenStorage();
      final cleanup = _TrackingCleanup(preferences);
      final notifier = _TestAuthNotifier(
        tokenStorage,
        _FakeAuthRepository(_FakeApiClient()),
        preferences,
        cleanup,
      );

      await notifier.logout();

      expect(cleanup.called, isTrue);
      expect(await tokenStorage.getAccessToken(), isNull);
      expect(await tokenStorage.getRefreshToken(), isNull);
      expect(await tokenStorage.getUserRole(), isNull);
      expect(preferences.getSelectedChildId(), isNull);
      expect(preferences.getCachedUser(), isNull);
      expect(preferences.getPrivateCache('learning_session'), isNull);
    },
  );
}
