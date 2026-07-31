import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/app/router.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';

void main() {
  AuthState lockedParent() {
    return AuthState(
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

  AuthState authenticatedParent() {
    return AuthState(
      status: AuthStatus.authenticated,
      role: 'PARENT',
      token: 'token',
      user: const AuthUser(
        id: 'user-1',
        name: 'Parent One',
        email: 'parent@schoolos.test',
        role: 'PARENT',
        tenantId: 'tenant-1',
      ),
    );
  }

  test('biometricLocked sends protected routes to unlock screen', () {
    expect(
      resolveAuthRedirect(lockedParent(), AppRoutes.parentHome),
      AppRoutes.biometricUnlock,
    );
    expect(
      resolveAuthRedirect(lockedParent(), AppRoutes.home),
      AppRoutes.biometricUnlock,
    );
  });

  test('biometricLocked allows unlock and password login routes', () {
    expect(
      resolveAuthRedirect(lockedParent(), AppRoutes.biometricUnlock),
      isNull,
    );
    expect(resolveAuthRedirect(lockedParent(), AppRoutes.login), isNull);
  });

  test('authenticated users leaving unlock are sent home', () {
    expect(
      resolveAuthRedirect(authenticatedParent(), AppRoutes.biometricUnlock),
      AppRoutes.home,
    );
  });
}
