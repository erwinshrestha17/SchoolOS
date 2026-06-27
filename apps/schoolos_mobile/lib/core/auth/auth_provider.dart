import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/token_storage_service.dart';
import '../storage/app_preferences_service.dart';
import '../storage/private_data_cleanup_service.dart';
import '../errors/app_exception.dart';
import 'data/auth_repository.dart';
import 'models/auth_user.dart';
import 'models/login_request.dart';
import '../network/api_client.dart';

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
  return AuthNotifier(tokenStorage, authRepository, appPrefs);
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(
    this._tokenStorage,
    this._authRepository,
    this._appPrefs, [
    PrivateDataCleanupService? privateDataCleanup,
  ]) : _privateDataCleanup =
           privateDataCleanup ?? PrivateDataCleanupService(_appPrefs),
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

      AuthUser? cachedUser;
      try {
        final cachedUserJson = _appPrefs.getCachedUser();
        if (cachedUserJson != null) {
          cachedUser = AuthUser.fromJson(
            jsonDecode(cachedUserJson) as Map<String, dynamic>,
          );
        }
      } catch (_) {}

      try {
        // Verify session by fetching user profile from server
        final user = await _authRepository.getMe();

        await _tokenStorage.saveUserRole(user.role);
        await _appPrefs.saveCachedUser(jsonEncode(user.toJson()));

        state = AuthState(
          status: AuthStatus.authenticated,
          role: user.role,
          token: token,
          user: user,
        );
      } on AuthException catch (_) {
        // Session expired, force logout
        await logout();
      } catch (e) {
        // Network/connection issues: offline resilience
        // Retain authenticated status using cached tokens and role
        state = AuthState(
          status: AuthStatus.authenticated,
          role: role,
          token: token,
          user: cachedUser,
        );
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

      await _privateDataCleanup.clearPrivateData();
      await _tokenStorage.saveAccessToken(response.tokenPair.accessToken);
      await _tokenStorage.saveRefreshToken(response.tokenPair.refreshToken);
      await _tokenStorage.saveUserRole(response.user.role);
      await _appPrefs.saveTenantCode(tenantCode);
      await _appPrefs.saveCachedUser(jsonEncode(response.user.toJson()));

      state = AuthState(
        status: AuthStatus.authenticated,
        role: response.user.role,
        token: response.tokenPair.accessToken,
        user: response.user,
      );
    } catch (e) {
      state = AuthState(status: AuthStatus.unauthenticated);
      rethrow;
    }
  }

  /// Gracefully sign out
  Future<void> logout() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _authRepository.logout(
        refreshToken: await _tokenStorage.getRefreshToken(),
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
