import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/notices/application/notices_providers.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/presentation/screens/notice_list_screen.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getUserRole() async => null;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _FakeApiClient();
}

class _ParentAuthNotifier extends AuthNotifier {
  _ParentAuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);

  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.authenticated,
      role: 'PARENT',
      user: const AuthUser(
        id: 'parent-1',
        name: 'Gita Adhikari',
        email: 'gita@example.test',
        role: 'PARENT',
        roles: ['parent'],
      ),
    );
  }
}

class _StaticNoticesController extends NoticesController {
  _StaticNoticesController()
    : super(repository: NoticesRepository(_FakeApiClient()), isOnline: true) {
    state = const NoticesState(isLoading: false);
  }

  @override
  Future<void> load() async {}
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('parent notices keeps parent navigation and can return home', (
    tester,
  ) async {
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    final router = GoRouter(
      initialLocation: AppRoutes.notices,
      routes: [
        GoRoute(
          path: AppRoutes.notices,
          builder: (_, _) => const NoticeListScreen(),
        ),
        GoRoute(
          path: AppRoutes.parentHome,
          builder: (_, _) => const Scaffold(body: Text('Parent home')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authProvider.overrideWith(
            (ref) => _ParentAuthNotifier(
              _FakeTokenStorage(),
              _FakeAuthRepository(),
              preferences,
            ),
          ),
          noticesControllerProvider.overrideWith(
            (ref) => _StaticNoticesController(),
          ),
          parentPortalDataProvider.overrideWith(
            (ref) async => ParentPortalData(
              parentName: 'Gita Adhikari',
              schoolName: 'Everest Academy',
              lastUpdated: DateTime(2026, 7, 11, 13, 37),
              children: const [],
              homework: const [],
              updates: const [],
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Notices'), findsWidgets);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Children'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('Homework'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();

    expect(find.text('Parent home'), findsOneWidget);
    expect(
      router.routeInformationProvider.value.uri.path,
      AppRoutes.parentHome,
    );

    router.go(AppRoutes.notices);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();

    expect(find.text('Parent home'), findsOneWidget);
    expect(
      router.routeInformationProvider.value.uri.path,
      AppRoutes.parentHome,
    );
    expect(tester.takeException(), isNull);
  });
}
