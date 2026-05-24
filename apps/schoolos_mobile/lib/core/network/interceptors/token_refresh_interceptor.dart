import 'dart:io';
import 'package:dio/dio.dart';
import '../../auth/models/token_pair.dart';
import '../../storage/token_storage_service.dart';

class TokenRefreshInterceptor extends Interceptor {
  TokenRefreshInterceptor({
    required this.tokenStorage,
    required this.onSessionExpired,
    required this.dio,
  });

  final TokenStorageService tokenStorage;
  final void Function() onSessionExpired;
  final Dio dio;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Only attempt refresh on 401 Unauthorized
    if (err.response?.statusCode != HttpStatus.unauthorized) {
      return handler.next(err);
    }

    // Avoid infinite retry loops
    if (err.requestOptions.extra['isRetry'] == true) {
      return handler.next(err);
    }

    final refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      onSessionExpired();
      return handler.next(err);
    }

    try {
      // 1. Request new token pair using a separate Dio to bypass interceptors
      final refreshDio = Dio(BaseOptions(baseUrl: err.requestOptions.baseUrl));
      final response = await refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final responseMap = response.data as Map<String, dynamic>;
      final unwrappedData = responseMap.containsKey('success') &&
              responseMap.containsKey('data')
          ? responseMap['data'] as Map<String, dynamic>
          : responseMap;

      final tokenPair = TokenPair.fromJson(unwrappedData);

      // 2. Persist new tokens
      await tokenStorage.saveAccessToken(tokenPair.accessToken);
      await tokenStorage.saveRefreshToken(tokenPair.refreshToken);

      // 3. Clone and retry the original request
      final requestOptions = err.requestOptions;
      requestOptions.extra['isRetry'] = true;
      requestOptions.headers[HttpHeaders.authorizationHeader] =
          'Bearer ${tokenPair.accessToken}';

      final retryResponse = await dio.fetch(requestOptions);
      return handler.resolve(retryResponse);
    } catch (e) {
      // Token refresh failed (e.g. refresh token also expired)
      await tokenStorage.clearTokens();
      onSessionExpired();
      return handler.next(err);
    }
  }
}
