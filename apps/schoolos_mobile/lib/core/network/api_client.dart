import 'dart:io';
import 'package:dio/dio.dart';

import '../config/env_config.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage_service.dart';
import '../utils/logger.dart';

import 'interceptors/token_refresh_interceptor.dart';

class ApiClient {
  ApiClient({required this.tokenStorage, this.onSessionExpired}) {
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
      _authInterceptor(),
      TokenRefreshInterceptor(
        tokenStorage: tokenStorage,
        onSessionExpired: () => onSessionExpired?.call(),
        dio: _dio,
      ),
      _loggingInterceptor(),
      _errorInterceptor(),
    ]);
  }

  late final Dio _dio;
  final TokenStorageService tokenStorage;
  void Function()? onSessionExpired;

  Dio get dio => _dio;

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
        options: options,
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
        options: options,
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
        options: options,
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
        options: options,
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  /// Interceptor to inject bearer auth token
  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStorage.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers[HttpHeaders.authorizationHeader] = 'Bearer $token';
        }
        return handler.next(options);
      },
    );
  }

  /// Logging Interceptor that hides sensitive token logs
  Interceptor _loggingInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        Logger.debug('API Request [${options.method}] -> ${options.uri}');
        if (options.data != null) {
          Logger.debug('Request Data: ${options.data}');
        }
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

          String message = 'A server error occurred. Please try again.';
          String? errorCode;

          if (data is Map<String, dynamic>) {
            message = data['message'] ?? data['error'] ?? message;
            errorCode = data['code'];
          }

          if (statusCode == HttpStatus.unauthorized) {
            return AuthException(message: message, code: errorCode);
          } else if (statusCode == HttpStatus.forbidden) {
            return PermissionException(message);
          } else if (statusCode == HttpStatus.unprocessableEntity ||
              statusCode == HttpStatus.badRequest) {
            final Map<String, dynamic> errors =
                data is Map<String, dynamic> &&
                    data['errors'] is Map<String, dynamic>
                ? data['errors'] as Map<String, dynamic>
                : {};
            return ValidationException(
              message: message,
              code: errorCode,
              errors: errors,
            );
          } else {
            return ServerException(
              message: message,
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
