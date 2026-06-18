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

class SessionExpiredException extends AuthException {
  const SessionExpiredException()
    : super(message: 'Your session has expired. Please sign in again.');
}

class MfaRequiredException extends AuthException {
  const MfaRequiredException()
    : super(
        message:
            'This account needs an additional verification step. Please use the SchoolOS web sign-in or contact your school administrator.',
        code: 'MFA_REQUIRED',
      );
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
  const PermissionException([
    String message = 'You do not have permission to view this information.',
  ]) : super(message, 'PERMISSION_DENIED');
}

class ModuleLockedException extends AppException {
  const ModuleLockedException()
    : super('This module is not enabled for your school.', 'MODULE_LOCKED');
}

class NotFoundAppException extends AppException {
  const NotFoundAppException([
    String message = 'This information is no longer available.',
  ]) : super(message, 'NOT_FOUND');
}

class ConflictAppException extends AppException {
  const ConflictAppException()
    : super(
        'This information changed since it was opened. Refresh and try again.',
        'CONFLICT',
      );
}

class CacheException extends AppException {
  const CacheException([String message = 'Failed to read/write local storage.'])
    : super(message, 'CACHE_ERROR');
}

class UnknownException extends AppException {
  const UnknownException([String message = 'An unexpected error occurred.'])
    : super(message, 'UNKNOWN_ERROR');
}
