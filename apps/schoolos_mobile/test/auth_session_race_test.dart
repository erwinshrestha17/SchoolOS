import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/biometric_auth_service.dart';
import 'package:schoolos_mobile/core/auth/biometric_session_store.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/auth/models/login_request.dart';
import 'package:schoolos_mobile/core/auth/models/login_response.dart';
import 'package:schoolos_mobile/core/auth/models/token_pair.dart';
import 'package:schoolos_mobile/core/auth/session_credential_coordinator.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

void main() {
  late _Tokens tokens;
  late _Repository repository;
  late _Notifier notifier;
  late _Biometrics bio;
  late BiometricSessionStore biometricStore;
  late SessionCredentialCoordinator session;
  var disposed = false;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    biometricStore = BiometricSessionStore(preferences.prefs);
    bio = _Biometrics();
    tokens = _Tokens();
    repository = _Repository();
    notifier = _Notifier(tokens, repository, preferences, biometricStore, bio);
    session = SessionCredentialCoordinator.forStorage(tokens);
    disposed = false;
  });
  tearDown(() {
    if (!disposed) notifier.dispose();
  });

  Future<void> login([String account = 'b']) => notifier.login(
    tenantCode: 'synthetic-school-$account',
    usernameOrEmail: account,
    password: 'synthetic-not-a-real-password',
  );

  for (final completion in ['success', 'failure']) {
    test(
      'older login $completion cannot replace or clear newer login',
      () async {
        final gate = Completer<LoginResponse>();
        repository.onLogin = (request) => request.usernameOrEmail == 'a'
            ? gate.future
            : Future.value(_response('b'));
        final older = login('a');
        await login('b');
        if (completion == 'failure') {
          gate.completeError(StateError('synthetic login failure'));
        } else {
          gate.complete(_response('a'));
        }
        await older;
        expect(notifier.state.user!.id, 'user-b');
        expect(tokens.access, 'access-b');
        expect(tokens.refresh, 'refresh-b');
        expect(jsonDecode(tokens.cached!)['id'], 'user-b');
      },
    );
  }

  test('login finishing after logout cannot recreate a session', () async {
    final gate = Completer<LoginResponse>();
    repository.onLogin = (_) => gate.future;
    final pending = login();
    await notifier.logout();
    gate.complete(_response('b'));
    await pending;
    expect(notifier.state.status, AuthStatus.unauthenticated);
    expect(tokens.access, isNull);
    expect(session.allowsRequests(session.epoch), isFalse);
  });

  for (final completion in ['success', 'failure']) {
    test(
      'delayed profile $completion cannot resurrect the prior identity',
      () async {
        final entered = Completer<void>();
        final gate = Completer<AuthUser>();
        repository.onMe = () {
          entered.complete();
          return gate.future;
        };
        final restore = notifier.restore();
        await entered.future;
        await login();
        if (completion == 'failure') {
          gate.completeError(StateError('synthetic profile failure'));
        } else {
          gate.complete(_user('a'));
        }
        await restore;
        expect(notifier.state.user!.id, 'user-b');
        expect(tokens.access, 'access-b');
        expect(repository.logoutCalls, 0);
      },
    );
  }

  test('new login waits for preceding logout cleanup', () async {
    final entered = Completer<void>();
    final gate = Completer<void>();
    repository.onLogout = () {
      entered.complete();
      return gate.future;
    };
    final logout = notifier.logout();
    await entered.future;
    final nextLogin = login();
    await Future<void>.delayed(Duration.zero);
    expect(repository.loginCalls, 0);
    expect(session.allowsRequests(session.epoch), isFalse);
    gate.complete();
    await Future.wait([logout, nextLogin]);
    expect(tokens.access, 'access-b');
    expect(notifier.state.user!.id, 'user-b');
    expect(repository.logoutCalls, 1);
  });

  test(
    'session restore waits for preceding logout and cannot bypass it',
    () async {
      final entered = Completer<void>();
      final gate = Completer<void>();
      repository.onLogout = () {
        entered.complete();
        return gate.future;
      };
      final logout = notifier.logout();
      await entered.future;
      final restored = notifier.restore();
      gate.complete();
      await Future.wait([logout, restored]);
      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(repository.meCalls, 0);
    },
  );

  test(
    'restored auth exposes the token actually persisted after a profile refresh',
    () async {
      repository.onMe = () async {
        await session.withStorage(() async {
          await tokens.saveRefreshToken('rotated-refresh');
          await tokens.saveAccessToken('rotated-access');
        });
        return _user('a');
      };
      await notifier.restore();
      expect(notifier.state.status, AuthStatus.authenticated);
      expect(notifier.state.token, 'rotated-access');
    },
  );

  test(
    'dispose retires pending login and prevents credential writes',
    () async {
      final gate = Completer<LoginResponse>();
      repository.onLogin = (_) => gate.future;
      final pending = login();
      notifier.dispose();
      disposed = true;
      gate.complete(_response('b'));
      await pending;
      expect(tokens.access, 'access-a');
      expect(session.allowsRequests(session.epoch), isFalse);
    },
  );

  for (final success in [true, false]) {
    test(
      'biometric result $success after account change cannot unlock or sign out the newer user',
      () async {
        await biometricStore.setEnabled(
          'user-a',
          tenantId: 'tenant-a',
          enabled: true,
        );
        await notifier.restore();
        expect(notifier.state.status, AuthStatus.biometricLocked);
        final entered = Completer<void>();
        final gate = Completer<bool>();
        bio.onAuthenticate = () {
          entered.complete();
          return gate.future;
        };
        final unlock = notifier.unlockWithBiometrics();
        await entered.future;
        await login();
        gate.complete(success);
        expect(await unlock, isFalse);
        expect(notifier.state.user!.id, 'user-b');
        expect(tokens.access, 'access-b');
        expect(repository.meCalls, 0);
        expect(repository.logoutCalls, 0);
      },
    );
  }

  test(
    'late biometric enrollment cannot re-enable an account after logout',
    () async {
      await login('a');
      final entered = Completer<void>();
      final gate = Completer<bool>();
      bio.onAuthenticate = () {
        entered.complete();
        return gate.future;
      };
      final enrollment = notifier.enableBiometricLogin();
      await entered.future;
      await notifier.logout();
      gate.complete(true);
      expect(await enrollment, isFalse);
      expect(biometricStore.isEnabled('user-a', tenantId: 'tenant-a'), isFalse);
      expect(notifier.state.status, AuthStatus.unauthenticated);
    },
  );
}

AuthUser _user(String account) => AuthUser(
  id: 'user-$account',
  name: 'Synthetic User',
  email: 'user-$account@example.invalid',
  role: 'PARENT',
  tenantId: 'tenant-$account',
);
LoginResponse _response(String account) => LoginResponse(
  user: _user(account),
  tokenPair: TokenPair(
    accessToken: 'access-$account',
    refreshToken: 'refresh-$account',
  ),
);

class _Notifier extends AuthNotifier {
  _Notifier(
    TokenStorageService tokens,
    AuthRepository repository,
    AppPreferencesService preferences,
    BiometricSessionStore store,
    BiometricAuthService bio,
  ) : super(
        tokens,
        repository,
        preferences,
        PrivateDataCleanupService(preferences),
        null,
        store,
        bio,
      );
  @override
  Future<void> loadSession() async {}
  Future<void> restore() => super.loadSession();
}

class _Tokens extends Fake implements TokenStorageService {
  String? access = 'access-a';
  String? refresh = 'refresh-a';
  String? role = 'PARENT';
  String? cached = jsonEncode(_user('a').toJson());
  @override
  Future<String?> getAccessToken() async => access;
  @override
  Future<String?> getRefreshToken() async => refresh;
  @override
  Future<String?> getUserRole() async => role;
  @override
  Future<String?> getCachedUser() async => cached;
  @override
  Future<void> saveAccessToken(String value) async => access = value;
  @override
  Future<void> saveRefreshToken(String value) async => refresh = value;
  @override
  Future<void> saveUserRole(String value) async => role = value;
  @override
  Future<void> saveCachedUser(String value) async => cached = value;
  @override
  Future<void> deleteCachedUser() async => cached = null;
  @override
  Future<void> clearTokens() async {
    access = null;
    refresh = null;
    role = null;
    cached = null;
  }

  @override
  bool isAccessTokenExpired(String token, {DateTime? now}) => false;
}

class _Client extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _Repository extends Fake implements AuthRepository {
  Future<LoginResponse> Function(LoginRequest request)? onLogin;
  Future<AuthUser> Function()? onMe;
  Future<void> Function()? onLogout;
  int loginCalls = 0;
  int logoutCalls = 0;
  int meCalls = 0;
  @override
  ApiClient get client => _Client();
  @override
  Future<LoginResponse> login(LoginRequest request) {
    loginCalls++;
    return onLogin?.call(request) ??
        Future.value(_response(request.usernameOrEmail));
  }

  @override
  Future<AuthUser> getMe() {
    meCalls++;
    return onMe?.call() ?? Future.value(_user('a'));
  }

  @override
  Future<void> logout({String? refreshToken, String? installationId}) async {
    logoutCalls++;
    await onLogout?.call();
  }
}

class _Biometrics extends Fake implements BiometricAuthService {
  Future<bool> Function()? onAuthenticate;
  @override
  Future<bool> get isSupported async => true;
  @override
  Future<BiometricCapability> resolveCapability() async =>
      BiometricCapability.fingerprint;
  @override
  String biometricName(BiometricCapability capability) => 'Fingerprint';
  @override
  Future<bool> authenticate({required String reason}) =>
      onAuthenticate?.call() ?? Future.value(true);
}
