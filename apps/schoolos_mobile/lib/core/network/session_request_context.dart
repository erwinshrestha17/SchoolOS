import 'package:dio/dio.dart';

const sessionRequestContextKey = 'schoolos.sessionRequest';

class SessionRequestContext {
  SessionRequestContext(this.epoch);

  final int epoch;
  String? accessToken;
  bool retried = false;
}

bool isPublicAuthRequest(RequestOptions options) =>
    options.method == 'POST' &&
    const {
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/auth/password-recovery/request',
      '/auth/password-recovery/confirm',
    }.contains(options.path);

DioException staleSessionRequest(RequestOptions request) => DioException(
  requestOptions: request,
  type: DioExceptionType.cancel,
  message: 'The signed-in session changed. Please try again.',
);
