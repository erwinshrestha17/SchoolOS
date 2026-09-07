import 'dart:io';
import 'package:dio/dio.dart';

import '../config/env_config.dart';
import '../auth/session_credential_coordinator.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage_service.dart';
import '../utils/logger.dart';

import 'api_path_resolver.dart';
import 'session_request_context.dart';
import 'interceptors/token_refresh_interceptor.dart';

class ApiClient {
  ApiClient({
    required this.tokenStorage,
    this.onSessionExpired,
    Dio? refreshClient,
  }) {
    _dio = Dio(
      BaseOptions(
        baseUrl: EnvConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 15),
        headers: {
          HttpHeaders.acceptHeader: 'application/json',
          HttpHeaders.contentTypeHeader: 'application/json',
        },
      ),
    );

    _dio.interceptors.addAll([
      _envelopeInterceptor(),
      _authInterceptor(),
      TokenRefreshInterceptor(
        tokenStorage: tokenStorage,
        onSessionExpired: () => onSessionExpired?.call(),
        dio: _dio,
        refreshClient: refreshClient,
      ),
      _loggingInterceptor(),
      _errorInterceptor(),
    ]);
  }

  late final Dio _dio;
  final TokenStorageService tokenStorage;
  SessionCredentialCoordinator get _session =>
      SessionCredentialCoordinator.forStorage(tokenStorage);
  void Function()? onSessionExpired;

  Dio get dio => _dio;

  /// Converts a backend-supplied file URL into a path safe to request through
  /// this authenticated client. See [resolveApiPath].
  String toApiPath(
    String rawUrl, {
    String unavailableMessage = 'This file is unavailable.',
  }) {
    return resolveApiPath(
      rawUrl,
      baseUrl: _dio.options.baseUrl,
      unavailableMessage: unavailableMessage,
    );
  }

  /// Interceptor to unwrap standard NestJS response envelope
  Interceptor _envelopeInterceptor() {
    return InterceptorsWrapper(
      onResponse: (response, handler) {
        final data = response.data;
        if (data is Map<String, dynamic> &&
            data.containsKey('success') &&
            data.containsKey('data')) {
          response.data = data['data'];
        }
        return handler.next(response);
      },
    );
  }

  /// GET Request
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: _sessionOptions(options),
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// POST Request
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: _sessionOptions(options),
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// PUT Request
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: _sessionOptions(options),
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// PATCH Request
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: _sessionOptions(options),
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// DELETE Request
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: _sessionOptions(options),
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Options _sessionOptions(Options? options) => (options ?? Options()).copyWith(
    extra: {
      ...?options?.extra,
      sessionRequestContextKey: SessionRequestContext(_session.epoch),
    },
  );

  /// Bind each request to the session that created it, including while secure
  /// storage reads, refresh and Dio's asynchronous interceptors are pending.
  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (isPublicAuthRequest(options)) {
          options.headers.removeWhere(
            (key, _) => key.toLowerCase() == HttpHeaders.authorizationHeader,
          );
          return handler.next(options);
        }
        final context =
            options.extra[sessionRequestContextKey] as SessionRequestContext? ??
            SessionRequestContext(_session.epoch);
        options.extra[sessionRequestContextKey] = context;
        try {
          final token = await _session.withStorage(() async {
            if (!_session.allowsRequests(context.epoch) ||
                options.cancelToken?.isCancelled == true) {
              throw staleSessionRequest(options);
            }
            final token = await tokenStorage.getAccessToken();
            if (!_session.allowsRequests(context.epoch) ||
                options.cancelToken?.isCancelled == true) {
              throw staleSessionRequest(options);
            }
            return token;
          });
          context.accessToken = token;
          options.headers.removeWhere(
            (key, _) => key.toLowerCase() == HttpHeaders.authorizationHeader,
          );
          if (token != null && token.isNotEmpty) {
            options.headers[HttpHeaders.authorizationHeader] = 'Bearer $token';
          }
          return handler.next(options);
        } catch (error) {
          return handler.reject(
            error is DioException
                ? error
                : DioException(
                    requestOptions: options,
                    error: const SessionExpiredException(),
                  ),
          );
        }
      },
      onResponse: (response, handler) {
        final request = response.requestOptions;
        final context =
            request.extra[sessionRequestContextKey] as SessionRequestContext?;
        if (!isPublicAuthRequest(request) &&
            context != null &&
            !_session.allowsRequests(context.epoch)) {
          return handler.reject(staleSessionRequest(request));
        }
        return handler.next(response);
      },
      onError: (error, handler) {
        final request = error.requestOptions;
        final context =
            request.extra[sessionRequestContextKey] as SessionRequestContext?;
        if (!isPublicAuthRequest(request) &&
            context != null &&
            !_session.allowsRequests(context.epoch)) {
          return handler.next(staleSessionRequest(request));
        }
        return handler.next(error);
      },
    );
  }

  /// Logging Interceptor that hides sensitive token logs
  Interceptor _loggingInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        Logger.debug('API Request [${options.method}] -> ${options.uri}');
        return handler.next(options);
      },
      onResponse: (response, handler) {
        Logger.debug(
          'API Response [${response.statusCode}] <- ${response.requestOptions.uri}',
        );
        return handler.next(response);
      },
    );
  }

  /// Interceptor for centralized mapping of errors
  Interceptor _errorInterceptor() {
    return InterceptorsWrapper(
      onError: (DioException error, handler) {
        final mappedException = _handleDioError(error);
        return handler.next(
          DioException(
            requestOptions: error.requestOptions,
            response: error.response,
            type: error.type,
            error: mappedException,
            message: mappedException.message,
          ),
        );
      },
    );
  }

  /// Maps DioException to custom AppException
  AppException _handleDioError(DioException error) {
    if (error.error is AppException) {
      return error.error as AppException;
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutException();

      case DioExceptionType.connectionError:
        return const NetworkException();

      case DioExceptionType.badResponse:
        final response = error.response;
        if (response != null) {
          final statusCode = response.statusCode;
          final dynamic data = response.data;

          String? errorCode;
          String backendMessage = '';

          if (data is Map<String, dynamic>) {
            final rawMessage = data['message'] ?? data['error'];
            backendMessage = rawMessage is String ? rawMessage : '';
            errorCode = data['code'] as String?;
          }

          if (statusCode == HttpStatus.unauthorized) {
            return const SessionExpiredException();
          } else if (statusCode == HttpStatus.forbidden) {
            final normalized = backendMessage.toLowerCase();
            if (normalized.contains('module') ||
                normalized.contains('subscription plan') ||
                normalized.contains('feature')) {
              return const ModuleLockedException();
            }
            final isAccessChanged =
                errorCode == 'GUARDIAN_CAPABILITY_DENIED' ||
                errorCode == 'TEACHER_SCOPE_DENIED';
            return PermissionException(
              isAccessChanged
                  ? 'Your access to this school data changed. Cached information was cleared.'
                  : 'You do not have permission to view this information.',
              errorCode ??
                  (isAccessChanged ? 'ACCESS_CHANGED' : 'PERMISSION_DENIED'),
            );
          } else if (statusCode == HttpStatus.notFound) {
            return const NotFoundAppException();
          } else if (statusCode == HttpStatus.conflict) {
            return const ConflictAppException();
          } else if (statusCode == HttpStatus.unprocessableEntity ||
              statusCode == HttpStatus.badRequest) {
            final Map<String, dynamic> errors =
                data is Map<String, dynamic> &&
                    data['errors'] is Map<String, dynamic>
                ? data['errors'] as Map<String, dynamic>
                : {};
            return ValidationException(
              message: _safeClientErrorMessage(backendMessage),
              code: errorCode,
              errors: errors,
            );
          } else {
            return ServerException(
              message:
                  'SchoolOS could not complete this request. Please try again.',
              code: errorCode,
              statusCode: statusCode,
            );
          }
        }
        return const ServerException();

      case DioExceptionType.cancel:
        return const UnknownException('Request was cancelled.');

      case DioExceptionType.badCertificate:
        return const UnknownException('Secure connection check failed.');

      case DioExceptionType.unknown:
        // Check if it's a SocketException (indicating offline)
        final innerError = error.error;
        if (innerError is SocketException) {
          return const NetworkException();
        }
        return UnknownException(
          error.message ?? 'An unexpected network error occurred.',
        );
    }
  }
}

String _safeClientErrorMessage(String message) {
  final trimmed = message.trim();
  if (trimmed.isEmpty) {
    return 'Please check the information entered and try again.';
  }

  final unsafePatterns = [
    'bcrypt',
    'prisma',
    'stack',
    'token hash',
    'database',
    'sql',
    'exception',
    'undefined',
    'null',
  ];
  final normalized = trimmed.toLowerCase();
  if (unsafePatterns.any(normalized.contains)) {
    return 'Please check the information entered and try again.';
  }

  return trimmed;
}
