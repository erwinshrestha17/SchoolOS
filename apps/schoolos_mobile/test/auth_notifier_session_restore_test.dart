import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

class _MemoryTokenStorage implements TokenStorageService {
  String? accessToken = 'access-token';
  String? refreshToken = 'refresh-token';
  String? role = MobileRole.teacher;
  String? cachedUser;

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
  Future<void> saveCachedUser(String userJson) async {
    cachedUser = userJson;
  }

  @override
  Future<String?> getCachedUser() async => cachedUser;

  @override
  Future<void> deleteCachedUser() async {
    cachedUser = null;
  }

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

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _SessionAuthRepository extends Fake implements AuthRepository {
  _SessionAuthRepository({this.user, this.failure});

  final AuthUser? user;
  final Object? failure;
  final ApiClient _client = _FakeApiClient();
  bool logoutCalled = false;

  @override
  ApiClient get client => _client;

  @override
  Future<AuthUser> getMe() async {
    final currentFailure = failure;
    if (currentFailure != null) {
      throw currentFailure;
    }
    return user ?? (throw StateError('No test user configured.'));
  }

  @override
  Future<void> logout({String? refreshToken, String? installationId}) async {
    logoutCalled = true;
  }
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

class _SessionAuthNotifier extends AuthNotifier {
  _SessionAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
    super.privateDataCleanup,
  );

  @override
  Future<void> loadSession() async {}

  Future<void> restoreSession() => super.loadSession();
}

class _Harness {
  const _Harness({
    required this.notifier,
    required this.tokenStorage,
    required this.repository,
    required this.preferences,
    required this.cleanup,
  });

  final _SessionAuthNotifier notifier;
  final _MemoryTokenStorage tokenStorage;
  final _SessionAuthRepository repository;
  final AppPreferencesService preferences;
  final _TrackingCleanup cleanup;
}

const _validTeacher = AuthUser(
  id: 'teacher-user',
  name: 'Teacher User',
  email: 'teacher@school.test',
  role: MobileRole.teacher,
  tenantId: 'tenant-1',
  tenantSlug: 'school-one',
  roles: [MobileRole.teacher],
);

Future<_Harness> _createHarness({
  AuthUser? user,
  Object? failure,
  AuthUser? cachedUser,
  String? rawCachedUser,
  Map<String, Object> legacyPreferences = const {},
  String storedRole = MobileRole.teacher,
}) async {
  SharedPreferences.setMockInitialValues(legacyPreferences);
  final preferences = AppPreferencesService(
    await SharedPreferences.getInstance(),
  );
  final tokenStorage = _MemoryTokenStorage()
    ..role = storedRole
    ..cachedUser =
        rawCachedUser ??
        (cachedUser == null ? null : jsonEncode(cachedUser.toJson()));
  final repository = _SessionAuthRepository(user: user, failure: failure);
  final cleanup = _TrackingCleanup(preferences);
  final notifier = _SessionAuthNotifier(
    tokenStorage,
    repository,
    preferences,
    cleanup,
  );
  return _Harness(
    notifier: notifier,
    tokenStorage: tokenStorage,
    repository: repository,
    preferences: preferences,
    cleanup: cleanup,
  );
}

void main() {
  test('verified profile stores cached identity in secure storage', () async {
    final harness = await _createHarness(user: _validTeacher);

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.authenticated);
    expect(harness.notifier.state.user?.id, _validTeacher.id);
    expect(harness.tokenStorage.cachedUser, isNotNull);
    expect(harness.preferences.getCachedUser(), isNull);
  });

  test('network failure restores a valid tenant-scoped cache', () async {
    final harness = await _createHarness(
      failure: const NetworkException(),
      cachedUser: _validTeacher,
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.authenticated);
    expect(harness.notifier.state.role, MobileRole.teacher);
    expect(harness.notifier.state.user?.tenantId, _validTeacher.tenantId);
    expect(harness.cleanup.called, isFalse);
  });

  test('timeout restores a valid tenant-scoped cache', () async {
    final harness = await _createHarness(
      failure: const TimeoutException(),
      cachedUser: _validTeacher,
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.authenticated);
    expect(harness.notifier.state.user?.id, _validTeacher.id);
    expect(harness.cleanup.called, isFalse);
  });

  test('network failure without cached identity fails closed', () async {
    final harness = await _createHarness(failure: const NetworkException());

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.notifier.state.user, isNull);
    expect(harness.tokenStorage.accessToken, isNull);
    expect(harness.tokenStorage.refreshToken, isNull);
    expect(harness.tokenStorage.role, isNull);
    expect(harness.cleanup.called, isTrue);
  });

  test('network failure with malformed cached identity fails closed', () async {
    final harness = await _createHarness(
      failure: const NetworkException(),
      rawCachedUser: 'not-json',
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.tokenStorage.cachedUser, isNull);
    expect(harness.cleanup.called, isTrue);
  });

  final nonNetworkFailures = <String, AppException>{
    'permission denial': const PermissionException(),
    'module lock': const ModuleLockedException(),
    'server failure': const ServerException(statusCode: 500),
    'unknown failure': const UnknownException(),
  };
  for (final entry in nonNetworkFailures.entries) {
    test('${entry.key} never restores cached authentication', () async {
      final harness = await _createHarness(
        failure: entry.value,
        cachedUser: _validTeacher,
      );

      await harness.notifier.restoreSession();

      expect(harness.notifier.state.status, AuthStatus.unauthenticated);
      expect(harness.tokenStorage.accessToken, isNull);
      expect(harness.cleanup.called, isTrue);
    });
  }

  test('cached role mismatch fails closed', () async {
    final harness = await _createHarness(
      failure: const NetworkException(),
      cachedUser: _validTeacher,
      storedRole: MobileRole.parent,
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.tokenStorage.accessToken, isNull);
  });

  test('cached identity without a tenant fails closed', () async {
    const tenantlessTeacher = AuthUser(
      id: 'teacher-user',
      name: 'Teacher User',
      email: 'teacher@school.test',
      role: MobileRole.teacher,
      roles: [MobileRole.teacher],
    );
    final harness = await _createHarness(
      failure: const NetworkException(),
      cachedUser: tenantlessTeacher,
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.tokenStorage.accessToken, isNull);
  });

  test('cached identity without a user id fails closed', () async {
    const unidentifiedTeacher = AuthUser(
      id: '   ',
      name: 'Teacher User',
      email: 'teacher@school.test',
      role: MobileRole.teacher,
      tenantId: 'tenant-1',
      roles: [MobileRole.teacher],
    );
    final harness = await _createHarness(
      failure: const NetworkException(),
      cachedUser: unidentifiedTeacher,
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.tokenStorage.accessToken, isNull);
  });

  test('unsupported cached role fails closed even when roles match', () async {
    const unsupportedUser = AuthUser(
      id: 'user-1',
      name: 'Unsupported User',
      email: 'unsupported@school.test',
      role: 'AUDITOR',
      tenantId: 'tenant-1',
      roles: ['AUDITOR'],
    );
    final harness = await _createHarness(
      failure: const NetworkException(),
      cachedUser: unsupportedUser,
      storedRole: 'AUDITOR',
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.unauthenticated);
    expect(harness.tokenStorage.accessToken, isNull);
  });

  test('legacy plaintext cached identity migrates to secure storage', () async {
    final harness = await _createHarness(
      failure: const NetworkException(),
      legacyPreferences: {
        'app_cached_user': jsonEncode(_validTeacher.toJson()),
      },
    );

    await harness.notifier.restoreSession();

    expect(harness.notifier.state.status, AuthStatus.authenticated);
    expect(harness.tokenStorage.cachedUser, isNotNull);
    expect(harness.preferences.getCachedUser(), isNull);
  });
}
