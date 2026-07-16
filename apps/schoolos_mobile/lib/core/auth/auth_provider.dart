import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/token_storage_service.dart';
import '../storage/app_preferences_service.dart';
import '../storage/private_data_cleanup_service.dart';
import '../storage/secure_storage_service.dart';
import '../errors/app_exception.dart';
import 'data/auth_repository.dart';
import 'models/auth_user.dart';
import 'models/login_request.dart';
import 'mobile_role.dart';
import '../network/api_client.dart';
import '../notifications/device_installation_service.dart';

enum AuthStatus { unauthenticated, loading, authenticated }

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
  return AuthNotifier(
    tokenStorage,
    authRepository,
    appPrefs,
    PrivateDataCleanupService(appPrefs, secureStorage),
    installationService,
  );
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(
    this._tokenStorage,
    this._authRepository,
    this._appPrefs, [
    PrivateDataCleanupService? privateDataCleanup,
    DeviceInstallationService? deviceInstallationService,
  ]) : _privateDataCleanup =
           privateDataCleanup ?? PrivateDataCleanupService(_appPrefs),
       _deviceInstallationService = deviceInstallationService,
       super(AuthState(status: AuthStatus.unauthenticated)) {
    _authRepository.client.onSessionExpired = () {
      logout();
    };
    loadSession();
  }

  final TokenStorageService _tokenStorage;
  final AuthRepository _authRepository;
  final AppPreferencesService _appPrefs;
  final PrivateDataCleanupService _privateDataCleanup;
  final DeviceInstallationService? _deviceInstallationService;

  static const _supportedMobileRoles = {
    MobileRole.parent,
    MobileRole.teacher,
    MobileRole.staff,
    MobileRole.principal,
    MobileRole.admin,
    MobileRole.student,
    MobileRole.driver,
  };

  Future<void> loadSession() async {
    state = state.copyWith(status: AuthStatus.loading);
    final token = await _tokenStorage.getAccessToken();
    final role = await _tokenStorage.getUserRole();

    if (token != null && role != null) {
      if (_tokenStorage.isAccessTokenExpired(token)) {
        await logout();
        return;
      }
      // Pre-populate role and token into state during load
      state = AuthState(status: AuthStatus.loading, role: role, token: token);

      final cachedUser = await _loadCachedUser();

      try {
        // Verify session by fetching user profile from server
        final user = await _authRepository.getMe();
        final verifiedRole = _supportedRoleFor(user);
        if (!_hasTenantScopedIdentity(user) || verifiedRole == null) {
          await logout();
          return;
        }

        await _tokenStorage.saveUserRole(verifiedRole);
        await _tokenStorage.saveCachedUser(jsonEncode(user.toJson()));
        await _appPrefs.removeCachedUser();

        state = AuthState(
          status: AuthStatus.authenticated,
          role: verifiedRole,
          token: token,
          user: user,
        );
      } on AuthException catch (_) {
        // Session expired, force logout
        await logout();
      } on NetworkException catch (_) {
        await _restoreCachedOfflineSession(
          token: token,
          storedRole: role,
          cachedUser: cachedUser,
        );
      } on TimeoutException catch (_) {
        await _restoreCachedOfflineSession(
          token: token,
          storedRole: role,
          cachedUser: cachedUser,
        );
      } catch (_) {
        await logout();
      }
    } else {
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Sign in via backend API
  Future<void> login({
    required String tenantCode,
    required String usernameOrEmail,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final response = await _authRepository.login(
        LoginRequest(
          tenantSlug: tenantCode,
          usernameOrEmail: usernameOrEmail,
          password: password,
        ),
      );

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
      await _tokenStorage.clearTokens();
      await _privateDataCleanup.clearPrivateData();
      await _tokenStorage.saveRefreshToken(response.tokenPair.refreshToken);
      await _tokenStorage.saveUserRole(verifiedRole);
      await _appPrefs.saveTenantCode(tenantCode);
      await _tokenStorage.saveCachedUser(jsonEncode(response.user.toJson()));
      await _appPrefs.removeCachedUser();
      await _tokenStorage.saveAccessToken(response.tokenPair.accessToken);

      state = AuthState(
        status: AuthStatus.authenticated,
        role: verifiedRole,
        token: response.tokenPair.accessToken,
        user: response.user,
      );
    } catch (e) {
      try {
        await _tokenStorage.clearTokens();
      } catch (_) {}
      try {
        await _privateDataCleanup.clearPrivateData();
      } catch (_) {}
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
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final message = await _authRepository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmNewPassword,
        logoutOtherDevices: logoutOtherDevices,
      );
      await logout();
      return message;
    } catch (_) {
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

  /// Gracefully sign out
  Future<void> logout() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _authRepository.logout(
        refreshToken: await _tokenStorage.getRefreshToken(),
        installationId: await _deviceInstallationService
            ?.getOrCreateInstallationId(),
      );
    } catch (_) {
      // Ignore network errors during logout
    } finally {
      await _tokenStorage.clearTokens();
      await _privateDataCleanup.clearPrivateData();
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }
}
