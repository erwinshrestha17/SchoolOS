import 'package:flutter/foundation.dart';

class EnvConfig {
  const EnvConfig._();

  /// API base URL injected via `--dart-define=SCHOOL_OS_API_BASE_URL=...`
  /// Defaults to the local SchoolOS backend for the active emulator.
  static const String _apiBaseUrlOverride = String.fromEnvironment(
    'SCHOOL_OS_API_BASE_URL',
    defaultValue: '',
  );

  static String get apiBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) {
      return _apiBaseUrlOverride;
    }

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000/api/v1';
    }

    return 'http://localhost:4000/api/v1';
  }

  /// Environment name, e.g. development, staging, production
  static const String environment = String.fromEnvironment(
    'SCHOOL_OS_ENV',
    defaultValue: 'development',
  );

  static bool get isDevelopment => environment == 'development';
  static bool get isStaging => environment == 'staging';
  static bool get isProduction => environment == 'production';

  static const String firebaseApiKey = String.fromEnvironment(
    'SCHOOL_OS_FIREBASE_API_KEY',
    defaultValue: '',
  );
  static const String firebaseAppId = String.fromEnvironment(
    'SCHOOL_OS_FIREBASE_APP_ID',
    defaultValue: '',
  );
  static const String firebaseMessagingSenderId = String.fromEnvironment(
    'SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '',
  );
  static const String firebaseProjectId = String.fromEnvironment(
    'SCHOOL_OS_FIREBASE_PROJECT_ID',
    defaultValue: '',
  );
  static const String firebaseStorageBucket = String.fromEnvironment(
    'SCHOOL_OS_FIREBASE_STORAGE_BUCKET',
    defaultValue: '',
  );

  static bool get hasFirebaseConfiguration =>
      firebaseApiKey.isNotEmpty &&
      firebaseAppId.isNotEmpty &&
      firebaseMessagingSenderId.isNotEmpty &&
      firebaseProjectId.isNotEmpty;

  static void validate() {
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      throw StateError('SCHOOL_OS_API_BASE_URL must be an absolute URL.');
    }
    if (isProduction && uri.scheme != 'https') {
      throw StateError('SchoolOS production mobile API must use HTTPS.');
    }
  }
}
