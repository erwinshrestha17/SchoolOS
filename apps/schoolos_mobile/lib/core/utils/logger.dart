import 'dart:developer' as dev;
import '../config/env_config.dart';

class Logger {
  const Logger._();

  static void debug(String message, [Object? error, StackTrace? stackTrace]) {
    if (EnvConfig.isDevelopment) {
      _log('DEBUG', message, error, stackTrace);
    }
  }

  static void info(String message) {
    if (EnvConfig.isDevelopment || EnvConfig.isStaging) {
      _log('INFO', message);
    }
  }

  static void warn(String message, [Object? error, StackTrace? stackTrace]) {
    _log('WARN', message, error, stackTrace);
  }

  static void error(String message, [Object? error, StackTrace? stackTrace]) {
    _log('ERROR', message, error, stackTrace);
  }

  static void _log(
    String level,
    String message, [
    Object? error,
    StackTrace? stackTrace,
  ]) {
    final sanitizedMessage = _maskSensitiveData(message);
    final tag = 'SchoolOS[$level]';

    if (error != null || stackTrace != null) {
      dev.log(
        sanitizedMessage,
        name: tag,
        error: error,
        stackTrace: stackTrace,
      );
    } else {
      dev.log(sanitizedMessage, name: tag);
    }
  }

  static String _maskSensitiveData(String message) {
    // Basic scrubbing of auth tokens, passwords or secrets
    var result = message;

    // Replace JWT pattern
    final jwtRegExp = RegExp(
      r'eyJhbGciOi[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.?[a-zA-Z0-9-_=]*',
    );
    result = result.replaceAll(jwtRegExp, '[MASKED_TOKEN]');

    // Replace password values in json/query params
    final passwordRegExp = RegExp(
      r'''(password|token|secret|refresh_token|accessToken)\s*[:=]\s*["']?[a-zA-Z0-9\-_=+/]+["']?''',
      caseSensitive: false,
    );
    result = result.replaceAll(passwordRegExp, r'$1: "[MASKED_SENSITIVE]"');

    return result;
  }
}
