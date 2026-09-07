import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/notifications/device_installation_service.dart';
import 'package:schoolos_mobile/core/notifications/push_messaging_service.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_controller.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_repository.dart';

void main() {
  late _Messaging messaging;
  late _Installation installation;
  late _Repository repository;
  late PushNotificationController controller;
  late List<Map<String, dynamic>> opened;
  var disposed = false;

  Future<void> synchronize(AuthState auth, {bool refresh = false}) =>
      controller.synchronizeSession(
        auth: auth,
        refresh: refresh,
        onOpen: (payload) async => opened.add(payload),
      );

  setUp(() {
    disposed = false;
    messaging = _Messaging();
    installation = _Installation();
    repository = _Repository();
    opened = [];
    controller = PushNotificationController(
      messaging: messaging,
      installationService: installation,
      repository: repository,
    );
  });

  tearDown(() async {
    if (!disposed) controller.dispose();
    await _flush();
    await messaging.refresh.close();
    await messaging.opened.close();
  });

  for (final role in ['PARENT', 'TEACHER', 'PRINCIPAL']) {
    test(
      '$role registers once and detaches on loading before logout',
      () async {
        final auth = _auth(role: role);
        await synchronize(auth);
        await synchronize(auth);
        expect(repository.tokens, ['device-token']);
        expect(
          controller.state.availability,
          PushNotificationAvailability.ready,
        );
        expect(messaging.refresh.hasListener, isTrue);
        messaging.opened.add({'route': '/notifications'});
        expect(opened, hasLength(1));

        final logout = synchronize(auth.copyWith(status: AuthStatus.loading));
        expect(
          controller.state.availability,
          PushNotificationAvailability.inactive,
        );
        expect(repository.cancellations.single.isCancelled, isTrue);
        messaging.refresh.add('late-token');
        messaging.opened.add({'route': '/late'});
        await logout;
        await synchronize(AuthState(status: AuthStatus.unauthenticated));
        expect(repository.tokens, ['device-token']);
        expect(opened, hasLength(1));
        expect(messaging.refresh.hasListener, isFalse);
        expect(messaging.opened.hasListener, isFalse);
        expect(messaging.deletions, 1);
      },
    );
  }

  for (final stage in [
    'initialize',
    'permission',
    'token',
    'installation',
    'register',
    'initial',
  ]) {
    test('logout during $stage ignores delayed completion', () async {
      final gate = Completer<void>();
      final entered = Completer<void>();
      Future<void> pause() {
        entered.complete();
        return gate.future;
      }

      switch (stage) {
        case 'initialize':
          messaging.beforeInitialize = pause;
        case 'permission':
          messaging.beforePermission = pause;
        case 'token':
          messaging.beforeToken = pause;
        case 'installation':
          installation.beforeRead = pause;
        case 'register':
          repository.beforeRegister = pause;
        case 'initial':
          messaging.beforeInitial = pause;
      }
      messaging.initial = {'route': '/notifications'};
      final activation = synchronize(_auth());
      await entered.future;
      final logout = controller.deactivate();
      expect(
        controller.state.availability,
        PushNotificationAvailability.inactive,
      );
      if (stage == 'register') {
        expect(repository.cancellations.single.isCancelled, isTrue);
      }
      gate.complete();
      await Future.wait([activation, logout]);
      expect(
        controller.state.availability,
        PushNotificationAvailability.inactive,
      );
      expect(opened, isEmpty);
      expect(messaging.refresh.hasListener, isFalse);
      expect(
        repository.tokens,
        hasLength(['register', 'initial'].contains(stage) ? 1 : 0),
      );
      expect(messaging.deletions, 1);
    });
  }

  test('late activation error cannot overwrite inactive state', () async {
    final gate = Completer<void>();
    final entered = Completer<void>();
    messaging.beforePermission = () {
      entered.complete();
      return gate.future;
    };
    final activation = synchronize(_auth());
    await entered.future;
    final logout = controller.deactivate();
    gate.completeError(StateError('synthetic provider error'));
    await Future.wait([activation, logout]);
    expect(
      controller.state.availability,
      PushNotificationAvailability.inactive,
    );
  });

  test(
    'new account waits for old native deletion before requesting its token',
    () async {
      await synchronize(_auth());
      final gate = Completer<void>();
      final entered = Completer<void>();
      messaging.beforeDelete = () {
        entered.complete();
        return gate.future;
      };
      final logout = controller.deactivate();
      await entered.future;
      final login = synchronize(_auth(userId: 'user-b'));
      await _flush();
      expect(
        messaging.events.where((event) => event == 'get-token'),
        hasLength(1),
      );
      expect(
        controller.state.availability,
        PushNotificationAvailability.initializing,
      );
      gate.complete();
      await Future.wait([logout, login]);
      expect(
        messaging.events,
        containsAllInOrder([
          'get-token',
          'delete-start',
          'delete-end',
          'get-token',
        ]),
      );
      expect(repository.tokens, hasLength(2));
      expect(controller.state.availability, PushNotificationAvailability.ready);
      messaging.beforeDelete = null;
    },
  );

  for (final changed in [
    _auth(tenantId: 'tenant-b'),
    _auth(role: 'PRINCIPAL'),
    _auth(token: 'new-session-token'),
    _auth(userId: 'user-b'),
  ]) {
    test(
      'session identity includes tenant, user, role and token: ${changed.user!.role}/${changed.user!.tenantId}/${changed.user!.id}/${changed.token}',
      () async {
        await synchronize(_auth());
        await synchronize(changed);
        expect(repository.tokens, hasLength(2));
        expect(repository.cancellations.first.isCancelled, isTrue);
        expect(repository.cancellations.last.isCancelled, isFalse);
        expect(messaging.deletions, 1);
      },
    );
  }

  for (final rejected in [
    _auth(role: 'STUDENT'),
    _auth(role: 'UNKNOWN'),
    _auth(tenantId: ''),
    _auth(userId: ''),
    _auth(mustChangePassword: true),
    _auth(status: AuthStatus.biometricLocked),
  ]) {
    test(
      'rejects incomplete, unsupported or locked sessions: ${rejected.user!.role}/${rejected.user!.tenantId}/${rejected.user!.id}/${rejected.user!.mustChangePassword}/${rejected.status}',
      () async {
        await synchronize(_auth());
        await synchronize(rejected);
        expect(repository.tokens, hasLength(1));
        expect(messaging.deletions, 1);
        expect(messaging.refresh.hasListener, isFalse);
        expect(
          controller.state.availability,
          isNot(PushNotificationAvailability.ready),
        );
      },
    );
  }

  test(
    'permission denial can recover in the same authenticated session',
    () async {
      messaging.permitted = false;
      await synchronize(_auth());
      expect(
        controller.state.availability,
        PushNotificationAvailability.permissionDenied,
      );
      expect(repository.tokens, isEmpty);
      messaging.permitted = true;
      await synchronize(_auth(), refresh: true);
      expect(controller.state.availability, PushNotificationAvailability.ready);
      messaging.permitted = false;
      await synchronize(_auth(), refresh: true);
      expect(
        controller.state.availability,
        PushNotificationAvailability.permissionDenied,
      );
      expect(messaging.refresh.hasListener, isFalse);
    },
  );

  test(
    'missing build configuration never attempts permission or registration',
    () async {
      messaging.configured = false;
      await synchronize(_auth());
      expect(
        controller.state.availability,
        PushNotificationAvailability.unavailable,
      );
      expect(messaging.events, ['initialize']);
      expect(repository.tokens, isEmpty);
    },
  );

  test('failed registration can retry without signing out', () async {
    repository.beforeRegister = () async =>
        throw StateError('synthetic offline');
    await synchronize(_auth());
    expect(
      controller.state.availability,
      PushNotificationAvailability.unavailable,
    );
    repository.beforeRegister = null;
    await synchronize(_auth());
    expect(controller.state.availability, PushNotificationAvailability.ready);
  });

  test(
    'backend provider-disabled status is not reported as delivery-ready',
    () async {
      repository.result = const PushTokenRegistration(
        registered: true,
        providerEnabled: false,
        failureCode: 'PROVIDER_DISABLED',
      );
      await synchronize(_auth());
      expect(
        controller.state.availability,
        PushNotificationAvailability.providerDisabled,
      );
    },
  );

  test(
    'refresh registrations stay ordered and pending refresh is cancelled on logout',
    () async {
      await synchronize(_auth());
      final gate = Completer<void>();
      final entered = Completer<void>();
      repository.beforeRegister = () {
        entered.complete();
        return gate.future;
      };
      messaging.refresh.add('rotated-token-1');
      await entered.future;
      messaging.refresh.add('rotated-token-2');
      final logout = controller.deactivate();
      expect(repository.cancellations.last.isCancelled, isTrue);
      gate.complete();
      await logout;
      expect(repository.tokens, ['device-token', 'rotated-token-1']);
      expect(
        controller.state.availability,
        PushNotificationAvailability.inactive,
      );
    },
  );

  test(
    'initial notification is consumed once and callback failures are contained',
    () async {
      messaging.initial = {'route': '/notifications'};
      await controller.synchronizeSession(
        auth: _auth(),
        onOpen: (_) async => throw StateError('route unavailable'),
      );
      await synchronize(_auth(), refresh: true);
      await _flush();
      expect(messaging.initialReads, 1);
      expect(opened, isEmpty);
      expect(controller.state.availability, PushNotificationAvailability.ready);
    },
  );

  test(
    'same-session synchronization updates navigation callback without duplicate registration',
    () async {
      await controller.synchronizeSession(
        auth: _auth(),
        onOpen: (_) async => fail('stale callback'),
      );
      await synchronize(_auth());
      messaging.opened.add({'route': '/notifications'});
      expect(opened, hasLength(1));
      expect(repository.tokens, hasLength(1));
    },
  );

  test('duplicate activation while awaiting permission shares setup', () async {
    final gate = Completer<void>();
    final entered = Completer<void>();
    messaging.beforePermission = () {
      entered.complete();
      return gate.future;
    };
    final first = synchronize(_auth());
    await entered.future;
    final second = synchronize(_auth(), refresh: true);
    gate.complete();
    await Future.wait([first, second]);
    expect(repository.tokens, hasLength(1));
  });

  test('token rotation during initial registration is not lost', () async {
    final gate = Completer<void>();
    final entered = Completer<void>();
    repository.beforeRegister = () {
      entered.complete();
      return gate.future;
    };
    final activation = synchronize(_auth());
    await entered.future;
    messaging.refresh.add('rotated-during-registration');
    repository.beforeRegister = null;
    gate.complete();
    await activation;
    await _flush();
    expect(repository.tokens, ['device-token', 'rotated-during-registration']);
  });

  test(
    'foreground recheck during initial-message lookup preserves its tap',
    () async {
      final gate = Completer<void>();
      final entered = Completer<void>();
      messaging.initial = {'route': '/notifications'};
      messaging.beforeInitial = () {
        entered.complete();
        return gate.future;
      };
      final activation = synchronize(_auth());
      await entered.future;
      final resumed = synchronize(_auth(), refresh: true);
      gate.complete();
      await Future.wait([activation, resumed]);
      expect(repository.tokens, hasLength(1));
      expect(opened, [
        {'route': '/notifications'},
      ]);
    },
  );

  test(
    'dispose during setup suppresses state writes, callbacks and registration',
    () async {
      final gate = Completer<void>();
      final entered = Completer<void>();
      messaging.beforeToken = () {
        entered.complete();
        return gate.future;
      };
      final activation = synchronize(_auth());
      await entered.future;
      controller.dispose();
      disposed = true;
      gate.complete();
      await activation;
      await _flush();
      expect(repository.tokens, isEmpty);
      expect(opened, isEmpty);
      expect(messaging.deletions, 1);
    },
  );

  test('failed device cleanup does not poison a later sign-in', () async {
    await synchronize(_auth());
    messaging.beforeDelete = () async => throw StateError('synthetic offline');
    await controller.deactivate();
    await synchronize(_auth(userId: 'user-b'));
    expect(controller.state.availability, PushNotificationAvailability.ready);
  });
}

AuthState _auth({
  String userId = 'user-a',
  String tenantId = 'tenant-a',
  String role = 'PARENT',
  String token = 'session-token',
  bool mustChangePassword = false,
  AuthStatus status = AuthStatus.authenticated,
}) => AuthState(
  status: status,
  role: role,
  token: token,
  user: AuthUser(
    id: userId,
    name: 'Synthetic User',
    email: 'synthetic@example.invalid',
    tenantId: tenantId,
    role: role,
    mustChangePassword: mustChangePassword,
  ),
);

Future<void> _flush() => Future<void>.delayed(Duration.zero);

class _Messaging implements PushMessagingService {
  final refresh = StreamController<String>.broadcast(sync: true);
  final opened = StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final events = <String>[];
  bool configured = true;
  bool permitted = true;
  int deletions = 0;
  int initialReads = 0;
  Map<String, dynamic>? initial;
  Future<void> Function()? beforeInitialize;
  Future<void> Function()? beforePermission;
  Future<void> Function()? beforeToken;
  Future<void> Function()? beforeDelete;
  Future<void> Function()? beforeInitial;

  @override
  Future<bool> initialize() async {
    events.add('initialize');
    await beforeInitialize?.call();
    return configured;
  }

  @override
  Future<bool> requestPermission() async {
    events.add('permission');
    await beforePermission?.call();
    return permitted;
  }

  @override
  Future<String?> getToken() async {
    events.add('get-token');
    await beforeToken?.call();
    return 'device-token';
  }

  @override
  Future<void> deleteToken() async {
    deletions++;
    events.add('delete-start');
    await beforeDelete?.call();
    events.add('delete-end');
  }

  @override
  Future<Map<String, dynamic>?> getInitialMessage() async {
    initialReads++;
    await beforeInitial?.call();
    return initial;
  }

  @override
  Stream<String> get tokenRefresh => refresh.stream;
  @override
  Stream<Map<String, dynamic>> get messageOpened => opened.stream;
}

class _Installation extends Fake implements DeviceInstallationService {
  Future<void> Function()? beforeRead;
  @override
  Future<String> getOrCreateInstallationId() async {
    await beforeRead?.call();
    return 'e5387c33-641f-4113-9346-c4acb32414a9';
  }
}

class _Repository extends Fake implements PushNotificationRepository {
  final tokens = <String>[];
  final cancellations = <CancelToken>[];
  Future<void> Function()? beforeRegister;
  PushTokenRegistration result = const PushTokenRegistration(
    registered: true,
    providerEnabled: true,
  );
  @override
  Future<PushTokenRegistration> register({
    required String token,
    required String installationId,
    required String platform,
    CancelToken? cancelToken,
  }) async {
    tokens.add(token);
    cancellations.add(cancelToken!);
    await beforeRegister?.call();
    return result;
  }
}
