import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart' as errors;
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/network/connectivity_provider.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/auth/presentation/forgot_password_screen.dart';
import 'package:schoolos_mobile/features/auth/presentation/login_screen.dart';
import 'package:schoolos_mobile/shared/widgets/app_button.dart';
import 'package:schoolos_mobile/shared/widgets/app_text_field.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Connectivity extends Fake implements Connectivity {
  _Connectivity(this.online);
  final bool online;
  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      const Stream.empty();
  @override
  Future<List<ConnectivityResult>> checkConnectivity() async => [
    online ? ConnectivityResult.wifi : ConnectivityResult.none,
  ];
}

class _Tokens extends Fake implements TokenStorageService {}

class _Repository extends AuthRepository {
  _Repository(super.client);
  final requests = <Map<String, String>>[];
  final confirmations = <Map<String, String>>[];
  final cancellations = <CancelToken?>[];
  Future<void> Function() requestResult = () async {};
  Future<void> Function() confirmResult = () async {};

  @override
  Future<void> requestPasswordRecovery({
    required String tenantSlug,
    required String email,
    CancelToken? cancelToken,
  }) {
    requests.add({'tenantSlug': tenantSlug, 'email': email});
    cancellations.add(cancelToken);
    return requestResult();
  }

  @override
  Future<void> confirmPasswordRecovery({
    required String tenantSlug,
    required String email,
    required String code,
    required String newPassword,
    required String confirmNewPassword,
    CancelToken? cancelToken,
  }) {
    confirmations.add({
      'tenantSlug': tenantSlug,
      'email': email,
      'code': code,
      'newPassword': newPassword,
      'confirmNewPassword': confirmNewPassword,
    });
    cancellations.add(cancelToken);
    return confirmResult();
  }
}

class _Auth extends AuthNotifier {
  _Auth(this.initial, super.tokens, super.repository, super.preferences);
  final AuthState initial;
  int logoutCalls = 0;
  String? loginPassword;
  @override
  Future<void> loadSession() async => state = initial;
  @override
  Future<bool> isBiometricUnlockAvailable() async => false;
  @override
  Future<void> logout() async {
    logoutCalls++;
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  @override
  Future<void> login({
    required String tenantCode,
    required String usernameOrEmail,
    required String password,
  }) async {
    loginPassword = password;
  }

  void replaceSession() => state = AuthState(
    status: AuthStatus.authenticated,
    role: 'TEACHER',
    token: 'synthetic-session',
  );
}

Finder field(String label) => find.descendant(
  of: find.byWidgetPredicate(
    (widget) => widget is AppTextField && widget.label == label,
  ),
  matching: find.byType(TextFormField),
);
Finder button(String label) => find.byWidgetPredicate(
  (widget) => widget is AppButton && widget.label == label,
);

void main() {
  late _Repository repository;
  late _Auth auth;
  late ConnectivityNotifier connectivity;

  Future<void> pump(
    WidgetTester tester, {
    bool online = true,
    bool locked = false,
    bool login = false,
    bool empty = false,
    Size size = const Size(430, 1000),
    double scale = 1,
  }) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    SharedPreferences.setMockInitialValues({});
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    final tokens = _Tokens();
    final client = ApiClient(tokenStorage: tokens);
    repository = _Repository(client);
    auth = _Auth(
      AuthState(
        status: locked
            ? AuthStatus.biometricLocked
            : AuthStatus.unauthenticated,
      ),
      tokens,
      repository,
      preferences,
    );
    connectivity = ConnectivityNotifier(_Connectivity(online))
      ..setOnline(online);
    final router = GoRouter(
      initialLocation: login ? '/login' : '/forgot-password',
      routes: [
        GoRoute(
          path: '/forgot-password',
          builder: (_, _) => ForgotPasswordScreen(
            initialTenantSlug: empty ? '' : 'synthetic-school',
            initialEmail: empty ? '' : 'parent@example.invalid',
          ),
        ),
        GoRoute(
          path: '/login',
          builder: (_, _) => login
              ? const LoginScreen()
              : const Scaffold(body: Text('Sign-in page')),
        ),
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('Home page')),
        ),
      ],
    );
    addTearDown(() {
      router.dispose();
      client.dio.close(force: true);
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          authProvider.overrideWith((_) => auth),
          connectivityProvider.overrideWith((_) => connectivity),
          appPreferencesServiceProvider.overrideWithValue(preferences),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tap(
    WidgetTester tester,
    String label, {
    bool settle = true,
  }) async {
    final target = button(label);
    if (target.evaluate().isEmpty) {
      await tester.scrollUntilVisible(target, 200);
      await tester.pump();
    }
    await tester.ensureVisible(target);
    await tester.pump();
    await tester.tap(target);
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
    }
  }

  Future<void> fillReset(WidgetTester tester) async {
    for (final entry in {
      'Recovery code': '12345678',
      'New password': ' Qz72!mV8 ',
      'Confirm new password': ' Qz72!mV8 ',
    }.entries) {
      if (field(entry.key).evaluate().isEmpty) {
        await tester.scrollUntilVisible(field(entry.key), 200);
        await tester.pump();
      }
      await tester.ensureVisible(field(entry.key));
      await tester.pump();
      await tester.enterText(field(entry.key), entry.value);
      await tester.pumpAndSettle();
    }
  }

  testWidgets('validates school and email without claiming delivery', (
    tester,
  ) async {
    await pump(tester, empty: true);
    await tap(tester, 'Request recovery code');
    expect(repository.requests, isEmpty);
    expect(find.text('Enter your school code.'), findsOneWidget);
    expect(find.text('Enter a valid account email.'), findsOneWidget);
    expect(find.textContaining('will be sent'), findsNothing);
  });

  testWidgets(
    'waits for acknowledgement, disables edits, and prevents duplicate request',
    (tester) async {
      await pump(tester);
      final pending = Completer<void>();
      repository.requestResult = () => pending.future;
      await tap(tester, 'Request recovery code', settle: false);
      await tap(tester, 'Request recovery code', settle: false);
      expect(repository.requests, [
        {'tenantSlug': 'synthetic-school', 'email': 'parent@example.invalid'},
      ]);
      expect(
        tester.widget<TextFormField>(field('School code')).enabled,
        isFalse,
      );
      expect(find.textContaining('will be sent'), findsNothing);
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.text('Enter your recovery code'), findsOneWidget);
      expect(
        find.textContaining('If these details match an eligible account'),
        findsOneWidget,
      );
      expect(find.textContaining('We sent'), findsNothing);
    },
  );

  testWidgets(
    'offline recovery is disabled and never queued when reconnecting',
    (tester) async {
      await pump(tester, online: false);
      await tap(tester, 'Request recovery code');
      expect(repository.requests, isEmpty);
      expect(find.textContaining('Nothing will be queued'), findsOneWidget);
      connectivity.setOnline(true);
      await tester.pumpAndSettle();
      expect(repository.requests, isEmpty);
      await tap(tester, 'Request recovery code');
      await fillReset(tester);
      connectivity.setOnline(false);
      await tester.pumpAndSettle();
      await tap(tester, 'Reset password');
      await tap(tester, 'Request a new code');
      expect(repository.confirmations, isEmpty);
      expect(repository.requests, hasLength(1));
    },
  );

  testWidgets(
    'reset validates code, strength and confirmation before dispatch',
    (tester) async {
      await pump(tester);
      await tap(tester, 'Request recovery code');
      await tap(tester, 'Reset password');
      expect(repository.confirmations, isEmpty);
      expect(
        find.text('Enter the numeric code from your email.'),
        findsOneWidget,
      );
      expect(
        find.text('Password must be at least 8 characters.'),
        findsOneWidget,
      );
      expect(
        find.text('Confirm password must match new password.'),
        findsOneWidget,
      );
      await fillReset(tester);
      await tester.enterText(field('Confirm new password'), 'Qz72!mV8');
      await tap(tester, 'Reset password');
      expect(repository.confirmations, isEmpty);
    },
  );

  testWidgets(
    'reset preserves password spaces and awaits authoritative success',
    (tester) async {
      await pump(tester);
      await tap(tester, 'Request recovery code');
      await fillReset(tester);
      final pending = Completer<void>();
      repository.confirmResult = () => pending.future;
      tester.testTextInput.log.clear();
      await tap(tester, 'Reset password', settle: false);
      await tap(tester, 'Reset password', settle: false);
      expect(repository.confirmations.single, {
        'tenantSlug': 'synthetic-school',
        'email': 'parent@example.invalid',
        'code': '12345678',
        'newPassword': ' Qz72!mV8 ',
        'confirmNewPassword': ' Qz72!mV8 ',
      });
      expect(find.text('Password changed'), findsNothing);
      expect(
        tester.testTextInput.log.where(
          (call) =>
              call.method == 'TextInput.finishAutofillContext' &&
              call.arguments == true,
        ),
        isEmpty,
      );
      expect(
        tester.widget<TextFormField>(field('New password')).enabled,
        isFalse,
      );
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.text('Password changed'), findsOneWidget);
      expect(
        tester.testTextInput.log.where(
          (call) =>
              call.method == 'TextInput.finishAutofillContext' &&
              call.arguments == true,
        ),
        hasLength(1),
      );
      expect(find.byType(TextFormField), findsNothing);
      expect(auth.logoutCalls, 0);
      await tap(tester, 'Back to sign in');
      expect(find.text('Sign-in page'), findsOneWidget);
    },
  );

  for (final error in [
    const errors.AuthException(message: 'private server detail'),
    const errors.ValidationException(message: 'private server detail'),
    const errors.NetworkException('private server detail'),
    const errors.ServerException(
      statusCode: 429,
      message: 'private server detail',
    ),
  ]) {
    testWidgets(
      'reset ${error.runtimeType} keeps inputs and hides private detail',
      (tester) async {
        await pump(tester);
        await tap(tester, 'Request recovery code');
        await fillReset(tester);
        repository.confirmResult = () async => throw error;
        await tap(tester, 'Reset password');
        expect(find.text('Password changed'), findsNothing);
        expect(find.textContaining('private server detail'), findsNothing);
        expect(
          tester.widget<TextFormField>(field('New password')).controller!.text,
          ' Qz72!mV8 ',
        );
        expect(
          tester.widget<TextFormField>(field('Recovery code')).controller!.text,
          '12345678',
        );
        expect(
          find.textContaining(
            error is errors.NetworkException
                ? 'Try signing in with your new password'
                : error is errors.ServerException
                ? 'Too many recovery attempts'
                : 'Password could not be reset',
          ),
          findsOneWidget,
        );
      },
    );
  }

  testWidgets('failed requests do not advance and can be retried explicitly', (
    tester,
  ) async {
    await pump(tester);
    repository.requestResult = () async =>
        throw const errors.NetworkException('private server detail');
    await tap(tester, 'Request recovery code');
    expect(find.text('Enter your recovery code'), findsNothing);
    expect(
      find.textContaining('Check your email before retrying'),
      findsOneWidget,
    );
    expect(
      tester.widget<TextFormField>(field('Account email')).controller!.text,
      'parent@example.invalid',
    );
    repository.requestResult = () async {};
    await tap(tester, 'Request recovery code');
    expect(repository.requests, hasLength(2));
  });

  testWidgets(
    'resend clears old code only after acknowledgement; identity change clears secrets',
    (tester) async {
      await pump(tester);
      await tap(tester, 'Request recovery code');
      await fillReset(tester);
      repository.requestResult = () async =>
          throw const errors.ServerException(statusCode: 429);
      await tap(tester, 'Request a new code');
      expect(
        tester.widget<TextFormField>(field('Recovery code')).controller!.text,
        '12345678',
      );
      repository.requestResult = () async {};
      await tap(tester, 'Request a new code');
      expect(
        tester.widget<TextFormField>(field('Recovery code')).controller!.text,
        isEmpty,
      );
      await tester.ensureVisible(find.text('Use a different account'));
      await tester.tap(find.text('Use a different account'));
      await tester.pumpAndSettle();
      await tap(tester, 'Request recovery code');
      for (final label in [
        'Recovery code',
        'New password',
        'Confirm new password',
      ]) {
        expect(
          tester.widget<TextFormField>(field(label)).controller!.text,
          isEmpty,
        );
      }
    },
  );

  testWidgets(
    'leaving a pending request cancels it without late screen mutations',
    (tester) async {
      await pump(tester);
      final pending = Completer<void>();
      repository.requestResult = () => pending.future;
      await tap(tester, 'Request recovery code', settle: false);
      await tester.tap(find.byTooltip('Back to sign in'));
      await tester.pumpAndSettle();
      expect(repository.cancellations.single!.isCancelled, isTrue);
      pending.completeError(const errors.NetworkException());
      await tester.pumpAndSettle();
      expect(find.text('Sign-in page'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'leaving an unconfirmed reset cancels without saving its password',
    (tester) async {
      await pump(tester, locked: true);
      await tap(tester, 'Request recovery code');
      await fillReset(tester);
      final pending = Completer<void>();
      repository.confirmResult = () => pending.future;
      tester.testTextInput.log.clear();
      await tap(tester, 'Reset password', settle: false);
      await tester.tap(find.byTooltip('Back to sign in'));
      await tester.pumpAndSettle();
      expect(repository.cancellations.last!.isCancelled, isTrue);
      expect(
        tester.testTextInput.log.where(
          (call) =>
              call.method == 'TextInput.finishAutofillContext' &&
              call.arguments == true,
        ),
        isEmpty,
      );
      expect(
        tester.testTextInput.log.where(
          (call) =>
              call.method == 'TextInput.finishAutofillContext' &&
              call.arguments == false,
        ),
        isNotEmpty,
      );
      pending.complete();
      await tester.pumpAndSettle();
      expect(auth.logoutCalls, 0);
      expect(find.text('Sign-in page'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final changedSession in [false, true]) {
    testWidgets(
      'locked recovery ${changedSession ? 'preserves a newer session' : 'clears revoked local session'}',
      (tester) async {
        await pump(tester, locked: true);
        await tap(tester, 'Request recovery code');
        await fillReset(tester);
        final pending = Completer<void>();
        repository.confirmResult = () => pending.future;
        await tap(tester, 'Reset password', settle: false);
        if (changedSession) auth.replaceSession();
        pending.complete();
        await tester.pumpAndSettle();
        expect(auth.logoutCalls, changedSession ? 0 : 1);
        expect(find.text('Password changed'), findsOneWidget);
      },
    );
  }

  testWidgets(
    'small phone with large text keeps recovery fields and actions reachable',
    (tester) async {
      await pump(tester, size: const Size(320, 700), scale: 2);
      expect(tester.takeException(), isNull);
      await tap(tester, 'Request recovery code');
      await fillReset(tester);
      await tap(tester, 'Reset password');
      expect(repository.confirmations, hasLength(1));
      expect(find.text('Password changed'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'login passes the exact password, including leading and trailing spaces',
    (tester) async {
      await pump(tester, login: true);
      await tester.enterText(field('School code'), 'synthetic-school');
      await tester.enterText(
        field('Email or username'),
        'parent@example.invalid',
      );
      await tester.enterText(field('Password'), ' Qz72!mV8 ');
      await tap(tester, 'Sign in');
      expect(auth.loginPassword, ' Qz72!mV8 ');
    },
  );
}
