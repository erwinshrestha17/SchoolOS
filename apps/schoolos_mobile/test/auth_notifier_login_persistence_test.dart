import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/auth/models/login_request.dart';
import 'package:schoolos_mobile/core/auth/models/login_response.dart';
import 'package:schoolos_mobile/core/auth/models/token_pair.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

class _OrderedTokenStorage implements TokenStorageService {
  _OrderedTokenStorage(this.operations);

  final List<String> operations;
  String? accessToken = 'old-access';
  String? refreshToken = 'old-refresh';
  String? role = MobileRole.teacher;
  String? cachedUser = '{"id":"old-user"}';
  bool failAccessWrite = false;

  @override
  Future<void> saveAccessToken(String token) async {
    operations.add('saveAccess');
    if (failAccessWrite) {
      throw StateError('Simulated interrupted access-token write.');
    }
    accessToken = token;
  }

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<void> deleteAccessToken() async => accessToken = null;

  @override
  Future<void> saveRefreshToken(String token) async {
    operations.add('saveRefresh');
    refreshToken = token;
  }

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> deleteRefreshToken() async => refreshToken = null;

  @override
  Future<void> saveUserRole(String role) async {
    operations.add('saveRole');
    this.role = role;
  }

  @override
  Future<String?> getUserRole() async => role;

  @override
  Future<void> deleteUserRole() async => role = null;

  @override
  Future<void> saveCachedUser(String userJson) async {
    operations.add('saveCachedUser');
    cachedUser = userJson;
  }

  @override
  Future<String?> getCachedUser() async => cachedUser;

  @override
  Future<void> deleteCachedUser() async => cachedUser = null;

  @override
  Future<void> clearTokens() async {
    operations.add('clearTokens');
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

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _LoginAuthRepository extends Fake implements AuthRepository {
  _LoginAuthRepository(this.response);

  final LoginResponse response;
  final ApiClient _client = _FakeApiClient();

  @override
  ApiClient get client => _client;

  @override
  Future<LoginResponse> login(LoginRequest request) async => response;
}

class _TrackingCleanup extends PrivateDataCleanupService {
  _TrackingCleanup(super.preferences, this.operations);

  final List<String> operations;

  @override
  Future<void> clearPrivateData() async {
    operations.add('clearPrivateData');
    await super.clearPrivateData();
  }
}

class _LoginAuthNotifier extends AuthNotifier {
  _LoginAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
    super.privateDataCleanup,
  );

  @override
  Future<void> loadSession() async {}
}

const _newUser = AuthUser(
  id: 'new-teacher',
  name: 'New Teacher',
  email: 'new-teacher@school.test',
  role: MobileRole.teacher,
  tenantId: 'tenant-new',
  tenantSlug: 'new-school',
  roles: [MobileRole.teacher],
);

const _loginResponse = LoginResponse(
  tokenPair: TokenPair(accessToken: 'new-access', refreshToken: 'new-refresh'),
  user: _newUser,
);

Future<
  ({
    _LoginAuthNotifier notifier,
    _OrderedTokenStorage storage,
    List<String> operations,
  })
>
_createHarness() async {
  SharedPreferences.setMockInitialValues({
    'app_cached_user': '{"id":"old-user"}',
    'app_private_read_cache_parent_children': '{"data":{}}',
  });
  final preferences = AppPreferencesService(
    await SharedPreferences.getInstance(),
  );
  final operations = <String>[];
  final storage = _OrderedTokenStorage(operations);
  final notifier = _LoginAuthNotifier(
    storage,
    _LoginAuthRepository(_loginResponse),
    preferences,
    _TrackingCleanup(preferences, operations),
  );
  return (notifier: notifier, storage: storage, operations: operations);
}

void main() {
  test(
    'account switch clears the old session and writes access token last',
    () async {
      final harness = await _createHarness();

      await harness.notifier.login(
        tenantCode: 'new-school',
        usernameOrEmail: 'new-teacher@school.test',
        password: 'CorrectHorseBatteryStaple1!',
      );

      expect(harness.operations, [
        'clearTokens',
        'clearPrivateData',
        'saveRefresh',
        'saveRole',
        'saveCachedUser',
        'saveAccess',
      ]);
      expect(harness.storage.accessToken, 'new-access');
      expect(harness.storage.refreshToken, 'new-refresh');
      expect(harness.storage.role, MobileRole.teacher);
      final cachedIdentity =
          jsonDecode(harness.storage.cachedUser!) as Map<String, dynamic>;
      expect(cachedIdentity['id'], _newUser.id);
      expect(harness.notifier.state.user?.id, _newUser.id);
    },
  );

  test(
    'interrupted final access-token write clears the partial session',
    () async {
      final harness = await _createHarness();
      harness.storage.failAccessWrite = true;

      await expectLater(
        harness.notifier.login(
          tenantCode: 'new-school',
          usernameOrEmail: 'new-teacher@school.test',
          password: 'CorrectHorseBatteryStaple1!',
        ),
        throwsStateError,
      );

      expect(harness.storage.accessToken, isNull);
      expect(harness.storage.refreshToken, isNull);
      expect(harness.storage.role, isNull);
      expect(harness.storage.cachedUser, isNull);
      expect(harness.notifier.state.status, AuthStatus.unauthenticated);
      expect(
        harness.operations.where((operation) => operation == 'clearTokens'),
        hasLength(2),
      );
    },
  );
}
