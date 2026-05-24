import 'env_config.dart';

enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig._();

  static const environmentName = String.fromEnvironment(
    'SCHOOL_OS_ENV',
    defaultValue: 'development',
  );

  static String get apiBaseUrl => EnvConfig.apiBaseUrl;

  static const appName = 'SchoolOS Mobile';

  static AppEnvironment get environment {
    switch (environmentName) {
      case 'production':
        return AppEnvironment.production;
      case 'staging':
        return AppEnvironment.staging;
      case 'development':
      default:
        return AppEnvironment.development;
    }
  }

  static bool get isProduction => environment == AppEnvironment.production;
}
