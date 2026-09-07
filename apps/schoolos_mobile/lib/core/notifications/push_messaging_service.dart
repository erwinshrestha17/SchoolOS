import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env_config.dart';

final pushMessagingServiceProvider = Provider<PushMessagingService>(
  (ref) => FirebasePushMessagingService(),
);

/// Device-only boundary. Account authority and registration belong to the
/// session controller and backend, not Firebase callbacks.
abstract interface class PushMessagingService {
  Future<bool> initialize();
  Future<bool> requestPermission();
  Future<String?> getToken();
  Future<void> deleteToken();
  Stream<String> get tokenRefresh;
  Stream<Map<String, dynamic>> get messageOpened;
  Future<Map<String, dynamic>?> getInitialMessage();
}

class FirebasePushMessagingService implements PushMessagingService {
  @override
  Future<bool> initialize() async {
    if (!EnvConfig.hasFirebaseConfiguration) return false;
    if (Firebase.apps.isEmpty) {
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
    }
    return true;
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> getToken() => FirebaseMessaging.instance.getToken();

  @override
  Future<void> deleteToken() => FirebaseMessaging.instance.deleteToken();

  @override
  Stream<String> get tokenRefresh => FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<Map<String, dynamic>> get messageOpened =>
      FirebaseMessaging.onMessageOpenedApp.map((message) => message.data);

  @override
  Future<Map<String, dynamic>?> getInitialMessage() async =>
      (await FirebaseMessaging.instance.getInitialMessage())?.data;
}
