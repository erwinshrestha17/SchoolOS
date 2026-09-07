import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/app.dart';
import 'package:schoolos_mobile/app/router.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/notifications/device_installation_service.dart';
import 'package:schoolos_mobile/core/notifications/push_messaging_service.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_controller.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_repository.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

void main() {
  for (final role in ['PARENT', 'TEACHER', 'PRINCIPAL']) {
    testWidgets(
      '$role app observes restored auth, resume and intermediate logout states',
      (tester) async {
        SharedPreferences.setMockInitialValues({});
        final preferences = AppPreferencesService(
          await SharedPreferences.getInstance(),
        );
        final initial = AuthState(
          status: AuthStatus.authenticated,
          role: role,
          user: AuthUser(
            id: 'synthetic-user',
            name: 'Synthetic User',
            email: 'user@example.invalid',
            role: role,
            tenantId: 'synthetic-tenant',
          ),
        );
        final auth = _Auth(initial, preferences);
        final push = _Push();
        final router = GoRouter(
          routes: [
            GoRoute(
              path: '/',
              builder: (_, _) => const Scaffold(body: Text('Synthetic shell')),
            ),
          ],
        );
        addTearDown(router.dispose);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              appRouterProvider.overrideWithValue(router),
              appPreferencesServiceProvider.overrideWithValue(preferences),
              authProvider.overrideWith((ref) => auth),
              pushNotificationControllerProvider.overrideWith((ref) => push),
            ],
            child: const SchoolOSApp(),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(push.states, [AuthStatus.authenticated]);
        expect(push.refreshes, [false]);

        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.inactive,
        );
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        await tester.pump();
        expect(push.states, [
          AuthStatus.authenticated,
          AuthStatus.authenticated,
        ]);
        expect(push.refreshes, [false, true]);

        auth.emit(initial.copyWith(status: AuthStatus.loading));
        expect(push.states.last, AuthStatus.loading);
        auth.emit(AuthState(status: AuthStatus.unauthenticated));
        expect(push.states, [
          AuthStatus.authenticated,
          AuthStatus.authenticated,
          AuthStatus.loading,
          AuthStatus.unauthenticated,
        ]);
        await tester.pumpWidget(const SizedBox());
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.inactive,
        );
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        expect(push.states, hasLength(4));
        expect(tester.takeException(), isNull);
      },
    );
  }
}

class _Auth extends AuthNotifier {
  _Auth(this.initial, AppPreferencesService prefs)
    : super(_Storage(), _AuthRepository(), prefs);
  final AuthState initial;
  @override
  Future<void> loadSession() async => state = initial;
  void emit(AuthState value) => state = value;
}

class _Storage extends Fake implements TokenStorageService {}

class _AuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _Client();
}

class _Client extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _Installation extends Fake implements DeviceInstallationService {}

class _Messaging extends Fake implements PushMessagingService {}

class _Repository extends Fake implements PushNotificationRepository {}

class _Push extends PushNotificationController {
  _Push()
    : super(
        repository: _Repository(),
        installationService: _Installation(),
        messaging: _Messaging(),
      );
  final states = <AuthStatus>[];
  final refreshes = <bool>[];
  @override
  Future<void> synchronizeSession({
    required AuthState auth,
    required PushOpenCallback onOpen,
    bool refresh = false,
  }) async {
    states.add(auth.status);
    refreshes.add(refresh);
    await super.synchronizeSession(
      auth: auth,
      onOpen: onOpen,
      refresh: refresh,
    );
  }
}
