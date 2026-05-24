sealed class AppException implements Exception {
  const AppException(this.message, [this.code]);

  final String message;
  final String? code;

  @override
  String toString() =>
      '$runtimeType: $message${code != null ? " ($code)" : ""}';
}

class NetworkException extends AppException {
  const NetworkException([
    String message = 'No internet connection. Please check your network.',
  ]) : super(message, 'NETWORK_ERROR');
}

class TimeoutException extends AppException {
  const TimeoutException([
    String message = 'Connection timed out. Please try again later.',
  ]) : super(message, 'TIMEOUT_ERROR');
}

class ServerException extends AppException {
  const ServerException({
    String message = 'A server error occurred. Please contact support.',
    String? code,
    this.statusCode,
  }) : super(message, code ?? 'SERVER_ERROR');

  final int? statusCode;
}

class AuthException extends AppException {
  const AuthException({
    String message = 'Session expired. Please log in again.',
    String? code,
  }) : super(message, code ?? 'AUTH_ERROR');
}

class ValidationException extends AppException {
  const ValidationException({
    required String message,
    String? code,
    this.errors = const {},
  }) : super(message, code ?? 'VALIDATION_ERROR');

  final Map<String, dynamic> errors;
}

class PermissionException extends AppException {
  const PermissionException([String message = 'Permission denied.'])
    : super(message, 'PERMISSION_DENIED');
}

class CacheException extends AppException {
  const CacheException([String message = 'Failed to read/write local storage.'])
    : super(message, 'CACHE_ERROR');
}

class UnknownException extends AppException {
  const UnknownException([String message = 'An unexpected error occurred.'])
    : super(message, 'UNKNOWN_ERROR');
}
