import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import '../config/env_config.dart';
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
      );
    });

class PushNotificationController extends StateNotifier<PushNotificationState> {
  PushNotificationController({
    required this._repository,
    required this._installationService,
  }) : super(const PushNotificationState());

  final PushNotificationRepository _repository;
  final DeviceInstallationService _installationService;

  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _messageOpenedSubscription;
  String? _activeUserId;
  bool _firebaseReady = false;
  bool _initialMessageHandled = false;

  Future<void> activate({
    required AuthState auth,
    required Future<void> Function(Map<String, dynamic> payload) onOpen,
  }) async {
    final user = auth.user;
    if (auth.status != AuthStatus.authenticated || user == null) {
      return;
    }
    if (MobileRole.isStudent(user.role)) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.unsupportedPersona,
        message:
            'Push notifications are not available for controlled student sessions.',
      );
      return;
    }
    if (_activeUserId == user.id) {
      return;
    }

    _activeUserId = user.id;
    state = const PushNotificationState(
      availability: PushNotificationAvailability.initializing,
      message: 'Checking device notification readiness.',
    );

    try {
      if (!_firebaseReady) {
        if (!EnvConfig.hasFirebaseConfiguration) {
          state = const PushNotificationState(
            availability: PushNotificationAvailability.unavailable,
            message:
                'Push notifications are unavailable until Firebase is configured for this build.',
          );
          return;
        }
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: EnvConfig.firebaseApiKey,
            appId: EnvConfig.firebaseAppId,
            messagingSenderId: EnvConfig.firebaseMessagingSenderId,
            projectId: EnvConfig.firebaseProjectId,
            storageBucket: EnvConfig.firebaseStorageBucket.isEmpty
                ? null
                : EnvConfig.firebaseStorageBucket,
          ),
        );
        _firebaseReady = true;
      }

      final messaging = FirebaseMessaging.instance;
      final permission = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (permission.authorizationStatus == AuthorizationStatus.denied) {
        state = const PushNotificationState(
          availability: PushNotificationAvailability.permissionDenied,
          message: 'Notifications are disabled in this device’s settings.',
        );
        return;
      }

      final token = await messaging.getToken();
      if (token == null || token.isEmpty) {
        state = const PushNotificationState(
          availability: PushNotificationAvailability.unavailable,
          message: 'This device did not provide a push notification token.',
        );
        return;
      }

      await _registerToken(token);
      await _tokenRefreshSubscription?.cancel();
      _tokenRefreshSubscription = messaging.onTokenRefresh.listen((token) {
        unawaited(_registerRefreshedToken(token));
      });

      await _messageOpenedSubscription?.cancel();
      _messageOpenedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => unawaited(onOpen(message.data)),
      );

      if (!_initialMessageHandled) {
        _initialMessageHandled = true;
        final initialMessage = await messaging.getInitialMessage();
        if (initialMessage != null) {
          await onOpen(initialMessage.data);
        }
      }
    } catch (_) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.unavailable,
        message:
            'Push notifications are unavailable until Firebase is configured for this build.',
      );
    }
  }

  Future<void> deactivate() async {
    _activeUserId = null;
    await _tokenRefreshSubscription?.cancel();
    await _messageOpenedSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _messageOpenedSubscription = null;

    if (_firebaseReady) {
      try {
        await FirebaseMessaging.instance.deleteToken();
      } catch (_) {
        // Server-side logout revocation remains authoritative.
      }
    }

    state = const PushNotificationState();
  }

  Future<void> _registerToken(String token) async {
    final installationId = await _installationService
        .getOrCreateInstallationId();
    final registration = await _repository.register(
      token: token,
      installationId: installationId,
      platform: Platform.isIOS ? 'ios' : 'android',
    );

    if (!registration.registered) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.unavailable,
        message: 'This device could not register for push notifications.',
      );
      return;
    }

    if (registration.providerEnabled) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.ready,
        message: 'This device is registered for school notifications.',
      );
      return;
    }

    state = PushNotificationState(
      availability: registration.failureCode == 'PROVIDER_DISABLED'
          ? PushNotificationAvailability.providerDisabled
          : PushNotificationAvailability.providerNotReady,
      message:
          registration.failureReason ??
          'The school push provider is not ready for delivery.',
    );
  }

  Future<void> _registerRefreshedToken(String token) async {
    try {
      await _registerToken(token);
    } catch (_) {
      state = const PushNotificationState(
        availability: PushNotificationAvailability.unavailable,
        message:
            'This device could not refresh its push notification registration.',
      );
    }
  }

  @override
  void dispose() {
    unawaited(_tokenRefreshSubscription?.cancel());
    unawaited(_messageOpenedSubscription?.cancel());
    super.dispose();
  }
}
