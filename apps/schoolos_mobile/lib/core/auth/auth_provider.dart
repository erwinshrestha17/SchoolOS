import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/token_storage_service.dart';
import '../storage/app_preferences_service.dart';
import '../storage/private_data_cleanup_service.dart';
import '../storage/secure_storage_service.dart';
import '../errors/app_exception.dart';
import 'biometric_auth_service.dart';
import 'biometric_prompt_state.dart';
import 'biometric_session_store.dart';
import 'data/auth_repository.dart';
import 'models/auth_user.dart';
import 'models/login_request.dart';
import 'mobile_role.dart';
import 'session_credential_coordinator.dart';
import '../network/api_client.dart';
import '../notifications/device_installation_service.dart';

enum AuthStatus { unauthenticated, loading, authenticated, biometricLocked }

class AuthState {
  AuthState({required this.status, this.role, this.token, this.user});

  final AuthStatus status;
  final String? role;
  final String? token;
  final AuthUser? user;

  AuthState copyWith({
    AuthStatus? status,
    String? role,
    String? token,
    AuthUser? user,
  }) {
    return AuthState(
      status: status ?? this.status,
      role: role ?? this.role,
      token: token ?? this.token,
      user: user ?? this.user,
    );
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageServiceProvider);
  return ApiClient(tokenStorage: tokenStorage);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepository(apiClient);
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final tokenStorage = ref.watch(tokenStorageServiceProvider);
  final authRepository = ref.watch(authRepositoryProvider);
  final appPrefs = ref.watch(appPreferencesServiceProvider);
  final secureStorage = ref.watch(secureStorageServiceProvider);
  final installationService = ref.watch(deviceInstallationServiceProvider);
  final biometricStore = ref.watch(biometricSessionStoreProvider);
  final biometricAuth = ref.watch(biometricAuthServiceProvider);
  return AuthNotifier(
    tokenStorage,
    authRepository,
    appPrefs,
    PrivateDataCleanupService(appPrefs, secureStorage),
    installationService,
    biometricStore,
    biometricAuth,
  );
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(
    this._tokenStorage,
    this._authRepository,
    this._appPrefs, [
    PrivateDataCleanupService? privateDataCleanup,
    DeviceInstallationService? deviceInstallationService,
    BiometricSessionStore? biometricStore,
    BiometricAuthService? biometricAuth,
  ]) : _privateDataCleanup =
           privateDataCleanup ?? PrivateDataCleanupService(_appPrefs),
       _deviceInstallationService = deviceInstallationService,
       _biometricStore = biometricStore,
       _biometricAuth = biometricAuth,
       super(AuthState(status: AuthStatus.unauthenticated)) {
    _authRepository.client.onSessionExpired = () {
      logout();
    };
    loadSession();
  }

  final TokenStorageService _tokenStorage;
  SessionCredentialCoordinator get _credentials =>
      SessionCredentialCoordinator.forStorage(_tokenStorage);
  final AuthRepository _authRepository;
  final AppPreferencesService _appPrefs;
  final PrivateDataCleanupService _privateDataCleanup;
  final DeviceInstallationService? _deviceInstallationService;
  final BiometricSessionStore? _biometricStore;
  final BiometricAuthService? _biometricAuth;

  /// Guards against overlapping sign-outs. Every in-flight request that fails
  /// with 401 asks for a logout, so a single expired session can request one
  /// many times at once; without this the app would post `/auth/logout`,
  /// re-run private-data cleanup and re-emit auth state once per failure.
  Future<void>? _logoutInFlight;
  bool _sessionCleared = false;
  bool _biometricUnlockedThisProcess = false;
  bool _resumeAfterBiometricUnlock = false;

  static const _supportedMobileRoles = {
    MobileRole.parent,
    MobileRole.teacher,
    MobileRole.staff,
    MobileRole.principal,
    MobileRole.admin,
    MobileRole.student,
    MobileRole.driver,
  };

  static bool supportsBiometricPersona(
    String? role, {
    List<String> roles = const [],
  }) {
    final normalized = MobileRole.normalize(role, roles: roles);
    return normalized == MobileRole.parent ||
        normalized == MobileRole.teacher ||
        normalized == MobileRole.principal;
  }

  Future<void> loadSession() async {
    final pendingLogout = _logoutInFlight;
    if (pendingLogout != null) await pendingLogout;
    if (!mounted) return;
    final epoch = _credentials.beginTransition();
    final afterBiometricUnlock = _resumeAfterBiometricUnlock;
    _resumeAfterBiometricUnlock = false;
    state = state.copyWith(status: AuthStatus.loading);
    final (token, role) = await _credentials.withStorage(
      () async => (
        await _tokenStorage.getAccessToken(),
        await _tokenStorage.getUserRole(),
      ),
    );
    if (!mounted || !_credentials.isCurrent(epoch)) return;

    if (token != null && role != null) {
      if (_tokenStorage.isAccessTokenExpired(token)) {
        await logout();
        return;
      }

      final cachedUser = await _credentials.withStorage(_loadCachedUser);
      if (!mounted || !_credentials.isCurrent(epoch)) return;

      if (!afterBiometricUnlock &&
          !_biometricUnlockedThisProcess &&
          cachedUser != null &&
          await _shouldRequireBiometricGate(cachedUser)) {
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        state = AuthState(
          status: AuthStatus.biometricLocked,
          role: role,
          user: cachedUser,
        );
        return;
      }

      if (!mounted || !_credentials.isCurrent(epoch)) return;
      _credentials.allowRequests(epoch);

      // Pre-populate role and token into state during load
      state = AuthState(status: AuthStatus.loading, role: role, token: token);

      try {
        // Verify session by fetching user profile from server
        final user = await _authRepository.getMe();
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        final verifiedRole = _supportedRoleFor(user);
        if (!_hasTenantScopedIdentity(user) || verifiedRole == null) {
          await logout();
          return;
        }

        final currentToken = await _credentials.withStorage(() async {
          if (!_credentials.isCurrent(epoch)) return null;
          await _tokenStorage.saveUserRole(verifiedRole);
          await _tokenStorage.saveCachedUser(jsonEncode(user.toJson()));
          await _appPrefs.removeCachedUser();
          return _tokenStorage.getAccessToken();
        });
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        if (currentToken == null || currentToken.isEmpty) {
          await logout();
          return;
        }

        _sessionCleared = false;
        state = AuthState(
          status: AuthStatus.authenticated,
          role: verifiedRole,
          token: currentToken,
          user: user,
        );
      } on AuthException catch (_) {
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        await logout();
      } on NetworkException catch (_) {
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        await _restoreCachedOfflineSession(
          token: token,
          storedRole: role,
          cachedUser: cachedUser,
        );
      } on TimeoutException catch (_) {
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        await _restoreCachedOfflineSession(
          token: token,
          storedRole: role,
          cachedUser: cachedUser,
        );
      } catch (_) {
        if (!mounted || !_credentials.isCurrent(epoch)) return;
        await logout();
      }
    } else {
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> _shouldRequireBiometricGate(AuthUser user) async {
    final store = _biometricStore;
    final bio = _biometricAuth;
    if (store == null || bio == null) return false;
    if (!store.isEnabled(user.id, tenantId: user.tenantId)) return false;
    if (!await bio.isSupported) {
      await store.clearForUser(user.id, tenantId: user.tenantId);
      return false;
    }
    return true;
  }

  /// True when tokens remain and biometric unlock is enabled for that user.
  Future<bool> isBiometricUnlockAvailable() async {
    final epoch = _credentials.epoch;
    final (token, role, cachedUser) = await _credentials.withStorage(
      () async => (
        await _tokenStorage.getAccessToken(),
        await _tokenStorage.getUserRole(),
        await _loadCachedUser(),
      ),
    );
    if (!mounted || !_credentials.isCurrent(epoch)) return false;
    if (token == null || role == null) return false;
    if (_tokenStorage.isAccessTokenExpired(token)) return false;
    if (cachedUser == null) return false;
    final available = await _shouldRequireBiometricGate(cachedUser);
    return mounted && _credentials.isCurrent(epoch) && available;
  }

  Future<bool> unlockWithBiometrics() async {
    var epoch = _credentials.epoch;
    final store = _biometricStore;
    final bio = _biometricAuth;
    if (store == null || bio == null) return false;

    if (state.status != AuthStatus.biometricLocked || state.user == null) {
      final available = await isBiometricUnlockAvailable();
      if (!mounted || !_credentials.isCurrent(epoch)) return false;
      if (!available) return false;
      final (cachedUser, role) = await _credentials.withStorage(
        () async =>
            (await _loadCachedUser(), await _tokenStorage.getUserRole()),
      );
      if (!mounted || !_credentials.isCurrent(epoch)) return false;
      if (cachedUser == null || role == null) return false;
      epoch = _credentials.beginTransition();
      state = AuthState(
        status: AuthStatus.biometricLocked,
        role: role,
        user: cachedUser,
      );
    }

    final user = state.user;
    if (user == null) return false;

    final capability = await bio.resolveCapability();
    if (!mounted || !_credentials.isCurrent(epoch)) return false;
    final ok = await bio.authenticate(
      reason: 'Unlock SchoolOS with ${bio.biometricName(capability)}',
    );
    if (!mounted || !_credentials.isCurrent(epoch)) return false;
    if (ok) {
      await store.resetFailures(user.id, tenantId: user.tenantId);
      if (!mounted || !_credentials.isCurrent(epoch)) return false;
      _biometricUnlockedThisProcess = true;
      _resumeAfterBiometricUnlock = true;
      await loadSession();
      return state.status == AuthStatus.authenticated;
    }

    final failures = await store.recordFailure(
      user.id,
      tenantId: user.tenantId,
    );
    if (!mounted || !_credentials.isCurrent(epoch)) return false;
    if (failures >= BiometricSessionStore.maxFailuresBeforeDisable) {
      await usePasswordInsteadOfBiometrics();
    }
    return false;
  }

  /// Clears biometric unlock and session so the user can sign in with password.
  Future<void> usePasswordInsteadOfBiometrics() async {
    final epoch = _credentials.epoch;
    final user = state.user;
    if (user != null) {
      await _biometricStore?.clearForUser(user.id, tenantId: user.tenantId);
    }
    if (mounted && _credentials.isCurrent(epoch)) await logout();
  }

  Future<bool> enableBiometricLogin() async {
    final epoch = _credentials.epoch;
    final store = _biometricStore;
    final bio = _biometricAuth;
    final user = state.user;
    if (store == null ||
        bio == null ||
        user == null ||
        state.status != AuthStatus.authenticated ||
        user.mustChangePassword) {
      return false;
    }
    if (!supportsBiometricPersona(user.role, roles: user.roles)) return false;
    if (!await bio.isSupported) return false;
    if (!mounted || !_credentials.isCurrent(epoch)) return false;

    final capability = await bio.resolveCapability();
    if (!mounted || !_credentials.isCurrent(epoch)) return false;
    final ok = await bio.authenticate(
      reason:
          'Confirm ${bio.biometricName(capability)} to enable biometric login',
    );
    if (!ok || !mounted || !_credentials.isCurrent(epoch)) return false;

    await _credentials.withStorage(() async {
      if (!_credentials.isCurrent(epoch)) return;
      await store.setEnabled(user.id, tenantId: user.tenantId, enabled: true);
    });
    return mounted && _credentials.isCurrent(epoch);
  }

  Future<void> disableBiometricLogin() async {
    final user = state.user;
    if (user == null) return;
    await _biometricStore?.setEnabled(
      user.id,
      tenantId: user.tenantId,
      enabled: false,
    );
    await _biometricStore?.setPromptState(
      user.id,
      tenantId: user.tenantId,
      state: BiometricPromptState.dismissed,
    );
  }

  Future<void> dismissBiometricOffer() async {
    final user = state.user;
    if (user == null) return;
    await _biometricStore?.setPromptState(
      user.id,
      tenantId: user.tenantId,
      state: BiometricPromptState.dismissed,
    );
  }

  Future<void> markBiometricSoftSuggested() async {
    final user = state.user;
    if (user == null) return;
    await _biometricStore?.setPromptState(
      user.id,
      tenantId: user.tenantId,
      state: BiometricPromptState.softSuggested,
    );
  }

  /// Sign in via backend API
  Future<void> login({
    required String tenantCode,
    required String usernameOrEmail,
    required String password,
  }) async {
    final pendingLogout = _logoutInFlight;
    if (pendingLogout != null) await pendingLogout;
    if (!mounted) return;
    final epoch = _credentials.beginTransition();
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final response = await _authRepository.login(
        LoginRequest(
          tenantSlug: tenantCode,
          usernameOrEmail: usernameOrEmail,
          password: password,
        ),
      );

      if (!mounted || !_credentials.isCurrent(epoch)) return;

      final verifiedRole = _supportedRoleFor(response.user);
      if (!_hasTenantScopedIdentity(response.user) || verifiedRole == null) {
        throw const AuthException(
          message: 'SchoolOS could not create a valid mobile session.',
          code: 'INVALID_AUTH_RESPONSE',
        );
      }

      // Remove the prior account before writing any part of the new session.
      // The access token is written last so an interrupted account switch
      // cannot combine a new token with the previous cached identity or role.
      await _credentials.withStorage(() async {
        if (!_credentials.isCurrent(epoch)) return;
        final previousUser = await _loadCachedUser();
        if (previousUser != null && previousUser.id != response.user.id) {
          await _biometricStore?.clearForUser(
            previousUser.id,
            tenantId: previousUser.tenantId,
          );
        }

        await _tokenStorage.clearTokens();
        await _privateDataCleanup.clearPrivateData();
        await _tokenStorage.saveRefreshToken(response.tokenPair.refreshToken);
        await _tokenStorage.saveUserRole(verifiedRole);
        await _appPrefs.saveTenantCode(tenantCode);
        await _tokenStorage.saveCachedUser(jsonEncode(response.user.toJson()));
        await _appPrefs.removeCachedUser();
        await _tokenStorage.saveAccessToken(response.tokenPair.accessToken);
      });

      if (!mounted || !_credentials.isCurrent(epoch)) return;
      _credentials.allowRequests(epoch);

      _sessionCleared = false;
      _biometricUnlockedThisProcess = true;
      state = AuthState(
        status: AuthStatus.authenticated,
        role: verifiedRole,
        token: response.tokenPair.accessToken,
        user: response.user,
      );
    } catch (e) {
      if (!mounted || !_credentials.isCurrent(epoch)) return;
      await _credentials.withStorage(() async {
        if (!_credentials.isCurrent(epoch)) return;
        try {
          await _tokenStorage.clearTokens();
        } catch (_) {}
        try {
          await _privateDataCleanup.clearPrivateData();
        } catch (_) {}
      });
      if (!mounted || !_credentials.isCurrent(epoch)) return;
      state = AuthState(status: AuthStatus.unauthenticated);
      rethrow;
    }
  }

  Future<AuthUser?> _loadCachedUser() async {
    try {
      var cachedUserJson = await _tokenStorage.getCachedUser();
      final legacyCachedUserJson = _appPrefs.getCachedUser();
      if (cachedUserJson == null && legacyCachedUserJson != null) {
        cachedUserJson = legacyCachedUserJson;
        await _tokenStorage.saveCachedUser(legacyCachedUserJson);
      }
      if (legacyCachedUserJson != null) {
        await _appPrefs.removeCachedUser();
      }
      if (cachedUserJson == null) {
        return null;
      }

      final decoded = jsonDecode(cachedUserJson);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Cached user must be an object.');
      }
      return AuthUser.fromJson(decoded);
    } catch (_) {
      await _discardCachedUser();
      return null;
    }
  }

  Future<void> _restoreCachedOfflineSession({
    required String token,
    required String storedRole,
    required AuthUser? cachedUser,
  }) async {
    final cachedRole = cachedUser == null
        ? null
        : _supportedRoleFor(cachedUser);
    final normalizedStoredRole = storedRole.trim().isEmpty
        ? null
        : MobileRole.normalize(storedRole);

    if (cachedUser == null ||
        !_hasTenantScopedIdentity(cachedUser) ||
        cachedRole == null ||
        normalizedStoredRole == null ||
        cachedRole != normalizedStoredRole) {
      await logout();
      return;
    }

    _sessionCleared = false;
    state = AuthState(
      status: AuthStatus.authenticated,
      role: cachedRole,
      token: token,
      user: cachedUser,
    );
  }

  bool _hasTenantScopedIdentity(AuthUser user) {
    return user.id.trim().isNotEmpty &&
        (user.tenantId?.trim().isNotEmpty ?? false);
  }

  String? _supportedRoleFor(AuthUser user) {
    final role = MobileRole.normalize(user.role, roles: user.roles);
    return _supportedMobileRoles.contains(role) ? role : null;
  }

  Future<void> _discardCachedUser() async {
    try {
      await _tokenStorage.deleteCachedUser();
    } catch (_) {}
    try {
      await _appPrefs.removeCachedUser();
    } catch (_) {}
  }

  Future<String> changePasswordAndLogout({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
    bool logoutOtherDevices = true,
  }) async {
    final epoch = _credentials.epoch;
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final message = await _authRepository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmNewPassword,
        logoutOtherDevices: logoutOtherDevices,
      );
      if (!mounted || !_credentials.isCurrent(epoch)) {
        throw const SessionExpiredException();
      }
      await logout();
      return message;
    } catch (_) {
      if (!mounted || !_credentials.isCurrent(epoch)) rethrow;
      final token = await _tokenStorage.getAccessToken();
      final role = await _tokenStorage.getUserRole();
      state = token != null && role != null
          ? AuthState(
              status: AuthStatus.authenticated,
              role: role,
              token: token,
              user: state.user,
            )
          : AuthState(status: AuthStatus.unauthenticated);
      rethrow;
    }
  }

  /// Gracefully sign out.
  ///
  /// Safe to call repeatedly and concurrently: overlapping callers share the
  /// single in-flight sign-out, and calls made after the session is already
  /// cleared are no-ops rather than another round of network, storage and
  /// state churn.
  Future<void> logout() {
    if (_sessionCleared && state.status == AuthStatus.unauthenticated) {
      return Future<void>.value();
    }
    return _logoutInFlight ??= _performLogout().whenComplete(() {
      _logoutInFlight = null;
    });
  }

  Future<void> _performLogout() async {
    final epoch = _credentials.beginTransition();
    state = state.copyWith(status: AuthStatus.loading);
    final userId = state.user?.id;
    final tenantId = state.user?.tenantId;
    try {
      await _authRepository.logout(
        refreshToken: await _credentials.withStorage(
          _tokenStorage.getRefreshToken,
        ),
        installationId: await _deviceInstallationService
            ?.getOrCreateInstallationId(),
      );
    } catch (_) {
      // Ignore network errors during logout
    }
    if (!mounted || !_credentials.isCurrent(epoch)) return;
    await _credentials.withStorage(() async {
      if (!_credentials.isCurrent(epoch)) return;
      if (userId != null) {
        await _biometricStore?.clearForUser(userId, tenantId: tenantId);
      }
      await _tokenStorage.clearTokens();
      await _privateDataCleanup.clearPrivateData();
    });
    if (!mounted || !_credentials.isCurrent(epoch)) return;
    _sessionCleared = true;
    _biometricUnlockedThisProcess = false;
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  @override
  void dispose() {
    _credentials.beginTransition();
    super.dispose();
  }
}
