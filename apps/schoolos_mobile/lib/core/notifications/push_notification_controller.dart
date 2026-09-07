import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import 'push_messaging_service.dart';
import 'device_installation_service.dart';
import 'push_notification_repository.dart';

enum PushNotificationAvailability {
  inactive,
  initializing,
  ready,
  permissionDenied,
  providerDisabled,
  providerNotReady,
  unsupportedPersona,
  unavailable,
}

class PushNotificationState {
  const PushNotificationState({
    this.availability = PushNotificationAvailability.inactive,
    this.message = 'Push notifications start after sign in.',
  });

  final PushNotificationAvailability availability;
  final String message;
}

final pushNotificationControllerProvider =
    StateNotifierProvider<PushNotificationController, PushNotificationState>((
      ref,
    ) {
      return PushNotificationController(
        repository: ref.watch(pushNotificationRepositoryProvider),
        installationService: ref.watch(deviceInstallationServiceProvider),
        messaging: ref.watch(pushMessagingServiceProvider),
      );
    });

typedef PushOpenCallback = Future<void> Function(Map<String, dynamic> payload);

typedef _PushSession = ({
  String tenantId,
  String userId,
  String role,
  String? token,
});

class PushNotificationController extends StateNotifier<PushNotificationState> {
  PushNotificationController({
    required this._repository,
    required this._installationService,
    required this._messaging,
  }) : super(const PushNotificationState());

  final PushNotificationRepository _repository;
  final DeviceInstallationService _installationService;
  final PushMessagingService _messaging;

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<Map<String, dynamic>>? _messageOpenedSubscription;
  _PushSession? _session;
  PushOpenCallback? _onOpen;
  CancelToken? _registrationCancellation;
  int _generation = 0;
  int? _setupGeneration;
  bool _firebaseReady = false;
  bool _initialMessageHandled = false;

  // Native token creation/deletion must stay ordered. A late logout cleanup
  // must never delete the next account's token. Retirement itself is immediate;
  // an in-flight OS permission prompt may finish before device cleanup can run.
  Future<void> _lifecycle = Future<void>.value();

  Future<void> synchronizeSession({
    required AuthState auth,
    required PushOpenCallback onOpen,
    bool refresh = false,
  }) {
    final user = auth.user;
    if (auth.status != AuthStatus.authenticated ||
        user == null ||
        user.id.trim().isEmpty ||
        user.tenantId == null ||
        user.tenantId!.trim().isEmpty ||
        user.mustChangePassword) {
      return deactivate();
    }

    final role = MobileRole.normalize(user.role);
    if (!const {
      MobileRole.parent,
      MobileRole.teacher,
      MobileRole.principal,
      MobileRole.admin,
      MobileRole.driver,
      MobileRole.staff,
    }.contains(role)) {
      final cleanup = deactivate();
      if (mounted) {
        state = const PushNotificationState(
          availability: PushNotificationAvailability.unsupportedPersona,
          message: 'Push notifications are not available for this session.',
        );
      }
      return cleanup;
    }
    if (!mounted) return Future<void>.value();

    final session = (
      tenantId: user.tenantId!,
      userId: user.id,
      role: role,
      token: auth.token,
    );
    _onOpen = onOpen;
    if (_session == session &&
        (_setupGeneration == _generation ||
            (!refresh &&
                state.availability == PushNotificationAvailability.ready))) {
      return _lifecycle;
    }

    final changedSession = _session != null && _session != session;
    _retire();
    _session = session;
    _onOpen = onOpen;
    final generation = _generation;
    _setupGeneration = generation;
    final cancellation = CancelToken();
    _registrationCancellation = cancellation;
    state = const PushNotificationState(
      availability: PushNotificationAvailability.initializing,
      message: 'Checking device notification readiness.',
    );
    return _enqueue(() async {
      try {
        if (changedSession) await _deleteDeviceToken();
        if (_isCurrent(generation)) await _activate(generation, cancellation);
      } finally {
        if (_setupGeneration == generation) _setupGeneration = null;
      }
    });
  }

  Future<void> _activate(int generation, CancelToken cancellation) async {
    try {
      if (!_firebaseReady) {
        _firebaseReady = await _messaging.initialize();
        if (!_isCurrent(generation)) return;
        if (!_firebaseReady) {
          state = const PushNotificationState(
            availability: PushNotificationAvailability.unavailable,
            message: 'Push notifications are not available in this build.',
          );
          return;
        }
      }

      final permitted = await _messaging.requestPermission();
      if (!_isCurrent(generation)) return;
      if (!permitted) {
        state = const PushNotificationState(
          availability: PushNotificationAvailability.permissionDenied,
          message: 'Notifications are disabled in this device’s settings.',
        );
        return;
      }

      final token = await _messaging.getToken();
      if (!_isCurrent(generation)) return;
      if (token == null || token.isEmpty) {
        _unavailable(
          generation,
          'This device did not provide a push notification token.',
        );
        return;
      }
      // Subscribe before the registration request; FCM may rotate the token
      // while that request is in flight. Rotation is queued behind this setup.
      _tokenRefreshSubscription = _messaging.tokenRefresh.listen(
        (token) {
          if (!_isCurrent(generation)) return;
          unawaited(
            _enqueue(() async {
              if (!_isCurrent(generation)) return;
              try {
                await _registerToken(token, generation, cancellation);
              } catch (_) {
                _unavailable(
                  generation,
                  'This device could not refresh its push notification registration.',
                );
              }
            }),
          );
        },
        onError: (Object _) => _unavailable(
          generation,
          'This device could not refresh its push notification registration.',
        ),
      );
      await _registerToken(token, generation, cancellation);
      if (!_isCurrent(generation)) return;

      _messageOpenedSubscription = _messaging.messageOpened.listen(
        (payload) => unawaited(_open(payload, generation)),
        onError: (Object _) {
          // Never display provider errors or unverified preview data.
        },
      );
      if (!_initialMessageHandled) {
        _initialMessageHandled = true;
        final payload = await _messaging.getInitialMessage();
        if (payload != null) unawaited(_open(payload, generation));
      }
    } catch (_) {
      _unavailable(
        generation,
        'Push notifications are not available on this device.',
      );
    }
  }

  Future<void> deactivate() {
    if (!mounted || _session == null) return _lifecycle;
    _retire();
    state = const PushNotificationState();
    return _enqueue(_deleteDeviceToken);
  }

  void _retire() {
    _generation++;
    _setupGeneration = null;
    _session = null;
    _onOpen = null;
    _registrationCancellation?.cancel();
    _registrationCancellation = null;
    final refresh = _tokenRefreshSubscription;
    final opened = _messageOpenedSubscription;
    _tokenRefreshSubscription = null;
    _messageOpenedSubscription = null;
    // Fields are detached before awaiting so an old cancellation cannot clear
    // subscriptions belonging to a newly authenticated session.
    unawaited(_cancel(refresh));
    unawaited(_cancel(opened));
  }

  Future<void> _cancel(StreamSubscription<dynamic>? subscription) async {
    try {
      await subscription?.cancel();
    } catch (_) {
      // The generation fence also rejects callbacks from a failed cancellation.
    }
  }

  bool _isCurrent(int generation) =>
      mounted && _session != null && _generation == generation;

  Future<void> _enqueue(Future<void> Function() operation) {
    final next = _lifecycle.then((_) => operation());
    // A failed native cleanup must not poison later sign-ins.
    _lifecycle = next.catchError((Object _) {});
    return _lifecycle;
  }

  Future<void> _deleteDeviceToken() async {
    if (!_firebaseReady) return;
    try {
      await _messaging.deleteToken();
    } catch (_) {
      // Server-side logout revocation remains authoritative. This is only
      // best-effort device cleanup, never proof of provider revocation.
    }
  }

  Future<void> _open(Map<String, dynamic> payload, int generation) async {
    if (!_isCurrent(generation)) return;
    try {
      await _onOpen?.call(payload);
    } catch (_) {
      // Navigation must recheck the session after its own async scope lookup.
    }
  }

  Future<void> _registerToken(
    String token,
    int generation,
    CancelToken cancellation,
  ) async {
    if (!_isCurrent(generation) || token.isEmpty) return;
    final installationId = await _installationService
        .getOrCreateInstallationId();
    if (!_isCurrent(generation)) return;
    final registration = await _repository.register(
      token: token,
      installationId: installationId,
      platform: Platform.isIOS ? 'ios' : 'android',
      cancelToken: cancellation,
    );
    if (!_isCurrent(generation)) return;

    if (!registration.registered) {
      _unavailable(
        generation,
        'This device could not register for push notifications.',
      );
    } else if (registration.providerEnabled) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.ready,
        message: 'This device is registered for school notifications.',
      );
    } else {
      state = PushNotificationState(
        availability: registration.failureCode == 'PROVIDER_DISABLED'
            ? PushNotificationAvailability.providerDisabled
            : PushNotificationAvailability.providerNotReady,
        message:
            registration.failureReason ??
            'The school push provider is not ready for delivery.',
      );
    }
  }

  void _unavailable(int generation, String message) {
    if (!_isCurrent(generation)) return;
    state = PushNotificationState(
      availability: PushNotificationAvailability.unavailable,
      message: message,
    );
  }

  @override
  void dispose() {
    _retire();
    unawaited(_enqueue(_deleteDeviceToken));
    super.dispose();
  }
}
