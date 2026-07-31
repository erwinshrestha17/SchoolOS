import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/biometric_auth_service.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/auth/presentation/login_screen.dart';

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getRefreshToken() async => null;

  @override
  Future<String?> getUserRole() async => null;

  @override
  Future<String?> getCachedUser() async => null;

  @override
  bool isAccessTokenExpired(String token, {DateTime? now}) => false;
}

class _FakeBioAuth extends BiometricAuthService {
  _FakeBioAuth() : super(LocalAuthentication());

  @override
  Future<bool> get isSupported async => true;

  @override
  Future<BiometricCapability> resolveCapability() async =>
      BiometricCapability.faceId;

  @override
  Future<bool> authenticate({required String reason}) async => true;
}

class _LockedAuthNotifier extends AuthNotifier {
  _LockedAuthNotifier(
    TokenStorageService tokenStorage,
    AuthRepository authRepository,
    AppPreferencesService appPrefs, {
    required BiometricAuthService biometricAuth,
  }) : super(
         tokenStorage,
         authRepository,
         appPrefs,
         null,
         null,
         null,
         biometricAuth,
       );

  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.biometricLocked,
      role: 'PARENT',
      user: const AuthUser(
        id: 'user-1',
        name: 'Parent One',
        email: 'parent@schoolos.test',
        role: 'PARENT',
        tenantId: 'tenant-1',
      ),
    );
  }

  @override
  Future<bool> isBiometricUnlockAvailable() async => true;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login shows Face ID unlock when biometric session exists', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final appPrefs = AppPreferencesService(prefs);
    final tokenStorage = _FakeTokenStorage();
    final authRepository = AuthRepository(
      ApiClient(tokenStorage: tokenStorage),
    );
    final bio = _FakeBioAuth();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(appPrefs),
          tokenStorageServiceProvider.overrideWithValue(tokenStorage),
          biometricAuthServiceProvider.overrideWithValue(bio),
          authProvider.overrideWith(
            (ref) => _LockedAuthNotifier(
              tokenStorage,
              authRepository,
              appPrefs,
              biometricAuth: bio,
            ),
          ),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Use Face ID'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
