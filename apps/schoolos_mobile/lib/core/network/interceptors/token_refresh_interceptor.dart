import 'dart:io';
import 'package:dio/dio.dart';
import '../../auth/models/token_pair.dart';
import '../../auth/session_credential_coordinator.dart';
import '../../storage/token_storage_service.dart';
import '../session_request_context.dart';

class TokenRefreshInterceptor extends Interceptor {
  TokenRefreshInterceptor({
    required this.tokenStorage,
    required this.onSessionExpired,
    required this.dio,
    this._refreshClient,
  });

  final TokenStorageService tokenStorage;
  final void Function() onSessionExpired;
  final Dio dio;
  final Dio? _refreshClient;
  ({int epoch, Future<TokenPair> result})? _refreshInFlight;

  SessionCredentialCoordinator get _session =>
      SessionCredentialCoordinator.forStorage(tokenStorage);

  bool _isCurrent(RequestOptions request, SessionRequestContext context) =>
      _session.allowsRequests(context.epoch) &&
      request.cancelToken?.isCancelled != true;

  void _expire(RequestOptions request, SessionRequestContext context) {
    if (_isCurrent(request, context) && _session.expire(context.epoch)) {
      // Retain the refresh credential until AuthNotifier attempts server logout.
      onSessionExpired();
    }
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final context =
        request.extra[sessionRequestContextKey] as SessionRequestContext?;
    if (err.response?.statusCode != HttpStatus.unauthorized ||
        isPublicAuthRequest(request) ||
        context == null) {
      return handler.next(err);
    }
    if (!_isCurrent(request, context)) {
      return handler.next(staleSessionRequest(request));
    }
    if (context.accessToken == null || context.accessToken!.isEmpty) {
      return handler.next(err);
    }
    if (context.retried) {
      _expire(request, context);
      return handler.next(err);
    }

    try {
      final currentAccess = await _session.withStorage(
        tokenStorage.getAccessToken,
      );
      if (!_isCurrent(request, context)) {
        return handler.next(staleSessionRequest(request));
      }
      if (currentAccess == null || currentAccess.isEmpty) {
        _expire(request, context);
        return handler.next(err);
      }
      // A late 401 for a token already rotated in this same session reuses the
      // new token once; it must not rotate the refresh credential a second time.
      if (currentAccess == context.accessToken) {
        await _refresh(context.epoch, request.baseUrl);
      }
      if (!_isCurrent(request, context)) {
        return handler.next(staleSessionRequest(request));
      }
    } on DioException catch (refreshError) {
      if (!_isCurrent(request, context)) {
        return handler.next(staleSessionRequest(request));
      }
      final status = refreshError.response?.statusCode;
      if (status == HttpStatus.unauthorized || status == HttpStatus.forbidden) {
        _expire(request, context);
        return handler.next(err);
      }
      // Connectivity, timeouts, rate limiting and provider/server failures are
      // not proof of revoked credentials. Preserve the session and surface the
      // actual failure so safe offline reads/retry remain available.
      return handler.next(
        DioException(
          requestOptions: request,
          response: refreshError.response,
          type: refreshError.type,
          error: refreshError.error,
        ),
      );
    } catch (_) {
      if (!_isCurrent(request, context)) {
        return handler.next(staleSessionRequest(request));
      }
      _expire(request, context);
      return handler.next(err);
    }

    context.retried = true;
    try {
      // The auth interceptor rechecks this same epoch before attaching tokens.
      final response = await dio.fetch<dynamic>(request);
      return handler.resolve(response);
    } on DioException catch (retryError) {
      // A timeout/500 on the retried operation must never trigger logout.
      return handler.next(retryError);
    } catch (_) {
      return handler.next(DioException(requestOptions: request));
    }
  }

  Future<TokenPair> _refresh(int epoch, String baseUrl) {
    final active = _refreshInFlight;
    if (active != null && active.epoch == epoch) return active.result;
    final future = _performRefresh(epoch, baseUrl);
    _refreshInFlight = (epoch: epoch, result: future);
    return future.whenComplete(() {
      if (_refreshInFlight?.epoch == epoch) _refreshInFlight = null;
    });
  }

  Future<TokenPair> _performRefresh(int epoch, String baseUrl) async {
    final refreshToken = await _session.withStorage(
      tokenStorage.getRefreshToken,
    );
    if (!_session.allowsRequests(epoch)) {
      throw StateError('Session changed.');
    }
    if (refreshToken == null || refreshToken.isEmpty) {
      throw const FormatException('Missing refresh credential.');
    }
    final refreshDio =
        _refreshClient ??
        Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 15),
            sendTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
          ),
        );
    try {
      final response = await refreshDio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final responseMap = response.data as Map<String, dynamic>;
      final data =
          responseMap.containsKey('success') && responseMap.containsKey('data')
          ? responseMap['data'] as Map<String, dynamic>
          : responseMap;
      final tokens = TokenPair.fromJson(data);
      if (tokens.accessToken.isEmpty || tokens.refreshToken.isEmpty) {
        throw const FormatException('Invalid refresh response.');
      }
      await _session.withStorage(() async {
        final storedRefresh = await tokenStorage.getRefreshToken();
        if (!_session.allowsRequests(epoch) || storedRefresh != refreshToken) {
          throw StateError('Session changed.');
        }
        // Refresh first, access last. Serialize with login/logout storage work.
        await tokenStorage.saveRefreshToken(tokens.refreshToken);
        await tokenStorage.saveAccessToken(tokens.accessToken);
        if (!_session.allowsRequests(epoch)) {
          throw StateError('Session changed.');
        }
      });
      return tokens;
    } finally {
      if (_refreshClient == null) refreshDio.close();
    }
  }
}
