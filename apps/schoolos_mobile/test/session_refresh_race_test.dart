import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/session_credential_coordinator.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';

void main() {
  late _Tokens tokens;
  late _Adapter api;
  late _Adapter refresh;
  late ApiClient client;
  late Dio refreshClient;
  late SessionCredentialCoordinator session;
  var expired = 0;

  setUp(() {
    tokens = _Tokens();
    api = _Adapter();
    refresh = _Adapter();
    refreshClient = Dio(BaseOptions(baseUrl: 'https://school.example.invalid'))
      ..httpClientAdapter = refresh;
    expired = 0;
    client = ApiClient(
      tokenStorage: tokens,
      refreshClient: refreshClient,
      onSessionExpired: () => expired++,
    );
    client.dio.httpClientAdapter = api;
    session = SessionCredentialCoordinator.forStorage(tokens);
    api.respond = (request) async => _json(
      request.headers['authorization'] == 'Bearer access-a' ? 401 : 200,
    );
    refresh.respond = (_) async => _rotated();
  });

  tearDown(() {
    client.dio.close(force: true);
    refreshClient.close(force: true);
  });

  Future<void> switchAccount() async {
    final epoch = session.beginTransition();
    await session.withStorage(() async {
      await tokens.clearTokens();
      await tokens.saveRefreshToken('refresh-b');
      await tokens.saveAccessToken('access-b');
    });
    session.allowRequests(epoch);
  }

  test(
    'rejected refresh invokes real auth logout without recursive refresh',
    () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final notifier = _AuthNotifier(
        tokens,
        AuthRepository(client),
        preferences,
      );
      addTearDown(notifier.dispose);
      api.respond = (request) async =>
          _json(request.path == '/auth/logout' ? 200 : 401);
      refresh.respond = (_) async => _json(401);
      await expectLater(
        client.get<dynamic>('/private'),
        throwsA(isA<AppException>()),
      );
      await notifier.logout();
      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(tokens.access, isNull);
      expect(tokens.refresh, isNull);
      final logouts = api.requests
          .where((request) => request.path == '/auth/logout')
          .toList();
      expect(logouts, hasLength(1));
      expect(logouts.single.data, {'refreshToken': 'refresh-a'});
      expect(logouts.single.bearer, isNull);
      expect(refresh.requests, hasLength(1));
    },
  );

  test(
    'caller-supplied bearer header casing cannot override the bound session',
    () async {
      api.respond = (request) async {
        final headers = request.headers.entries.where(
          (entry) => entry.key.toLowerCase() == 'authorization',
        );
        if (request.path == '/auth/login') {
          expect(headers, isEmpty);
        } else {
          expect(headers.map((entry) => entry.value).toList(), [
            'Bearer access-a',
          ]);
        }
        return _json(200);
      };
      await client.get<dynamic>(
        '/private',
        options: Options(
          headers: {'Authorization': 'Bearer stale-custom-token'},
        ),
      );
      await client.post<dynamic>(
        '/auth/login',
        options: Options(
          headers: {'Authorization': 'Bearer stale-custom-token'},
        ),
      );
      expect(refresh.requests, isEmpty);
    },
  );

  test(
    'old network errors are cancelled instead of enabling a later accounts offline fallback',
    () async {
      final entered = Completer<void>();
      final gate = Completer<ResponseBody>();
      late RequestOptions originalRequest;
      api.respond = (request) {
        originalRequest = request;
        entered.complete();
        return gate.future;
      };
      final pending = client.get<dynamic>('/private');
      final rejected = expectLater(
        pending,
        throwsA(isNot(isA<NetworkException>())),
      );
      await entered.future;
      await switchAccount();
      gate.completeError(
        DioException(
          requestOptions: originalRequest,
          type: DioExceptionType.connectionError,
        ),
      );
      await rejected;
      expect(expired, 0);
    },
  );

  test(
    'concurrent expired requests share one refresh and retry once with its tokens',
    () async {
      final entered = Completer<void>();
      final gate = Completer<ResponseBody>();
      refresh.respond = (_) {
        entered.complete();
        return gate.future;
      };
      final requests = List.generate(
        5,
        (index) => client.get<dynamic>('/private/$index'),
      );
      await entered.future;
      await _flush();
      expect(refresh.requests, hasLength(1));
      gate.complete(_rotated());
      final results = await Future.wait(requests);
      expect(results.every((result) => result.statusCode == 200), isTrue);
      expect(refresh.requests, hasLength(1));
      expect(refresh.requests.single.data, {'refreshToken': 'refresh-a'});
      expect(
        api.requests.where((request) => request.bearer == 'Bearer access-a'),
        hasLength(5),
      );
      expect(
        api.requests.where((request) => request.bearer == 'Bearer access-a2'),
        hasLength(5),
      );
      expect(tokens.writes, ['refresh:refresh-a2', 'access:access-a2']);
      expect(expired, 0);
    },
  );

  test(
    'late 401 from an already rotated token does not rotate again',
    () async {
      final entered = Completer<void>();
      final lateResponse = Completer<ResponseBody>();
      api.respond = (request) async {
        if (request.path == '/late' &&
            request.headers['authorization'] == 'Bearer access-a') {
          entered.complete();
          return lateResponse.future;
        }
        return _json(
          request.headers['authorization'] == 'Bearer access-a' ? 401 : 200,
        );
      };
      final late = client.get<dynamic>('/late');
      await entered.future;
      await client.get<dynamic>('/first');
      lateResponse.complete(_json(401));
      await late;
      expect(refresh.requests, hasLength(1));
      expect(api.requests.last.bearer, 'Bearer access-a2');
      expect(expired, 0);
    },
  );

  for (final result in ['success', 'unauthorized', 'offline']) {
    test(
      'late refresh $result cannot overwrite or expire a newer account',
      () async {
        final entered = Completer<void>();
        final gate = Completer<ResponseBody>();
        refresh.respond = (_) {
          entered.complete();
          return gate.future;
        };
        final old = client.get<dynamic>('/private');
        final rejected = expectLater(old, throwsA(isA<AppException>()));
        await entered.future;
        await switchAccount();
        if (result == 'offline') {
          gate.completeError(
            DioException(
              requestOptions: RequestOptions(path: '/auth/refresh'),
              type: DioExceptionType.connectionError,
            ),
          );
        } else {
          gate.complete(result == 'success' ? _rotated() : _json(401));
        }
        await rejected;
        expect(tokens.access, 'access-b');
        expect(tokens.refresh, 'refresh-b');
        expect(tokens.writes, isNot(contains('access:access-a2')));
        expect(api.requests, hasLength(1));
        expect(expired, 0);
      },
    );
  }

  test('new account never joins old accounts in-flight refresh', () async {
    final entered = Completer<void>();
    final gate = Completer<ResponseBody>();
    refresh.respond = (request) async {
      if ((request.data as Map)['refreshToken'] == 'refresh-a') {
        entered.complete();
        return gate.future;
      }
      return _rotated('b');
    };
    api.respond = (request) async => _json(
      [
            'Bearer access-a',
            'Bearer access-b',
          ].contains(request.headers['authorization'])
          ? 401
          : 200,
    );
    final old = client.get<dynamic>('/old');
    final rejected = expectLater(old, throwsA(isA<AppException>()));
    await entered.future;
    await switchAccount();
    await client.get<dynamic>('/new');
    expect(tokens.access, 'access-b2');
    gate.complete(_rotated());
    await rejected;
    expect(refresh.requests, hasLength(2));
    expect(tokens.access, 'access-b2');
    expect(expired, 0);
  });

  test(
    'logout without a replacement session never resurrects rotated credentials',
    () async {
      final entered = Completer<void>();
      final gate = Completer<ResponseBody>();
      refresh.respond = (_) {
        entered.complete();
        return gate.future;
      };
      final pending = client.get<dynamic>('/private');
      final rejected = expectLater(pending, throwsA(isA<AppException>()));
      await entered.future;
      session.beginTransition();
      await session.withStorage(tokens.clearTokens);
      gate.complete(_rotated());
      await rejected;
      expect(tokens.access, isNull);
      expect(tokens.refresh, isNull);
      expect(expired, 0);
    },
  );

  for (final status in [429, 500, 503]) {
    test('refresh $status preserves credentials for a later retry', () async {
      refresh.respond = (_) async => _json(status);
      await expectLater(
        client.get<dynamic>('/private'),
        throwsA(isA<AppException>()),
      );
      expect(tokens.access, 'access-a');
      expect(tokens.refresh, 'refresh-a');
      expect(expired, 0);
      refresh.respond = (_) async => _rotated();
      await client.get<dynamic>('/private');
      expect(tokens.access, 'access-a2');
    });
  }

  for (final type in [
    DioExceptionType.connectionError,
    DioExceptionType.receiveTimeout,
  ]) {
    test('refresh $type does not destroy an offline-usable session', () async {
      refresh.respond = (request) async =>
          throw DioException(requestOptions: request, type: type);
      await expectLater(
        client.get<dynamic>('/private'),
        throwsA(
          type == DioExceptionType.connectionError
              ? isA<NetworkException>()
              : isA<TimeoutException>(),
        ),
      );
      expect(tokens.access, 'access-a');
      expect(tokens.refresh, 'refresh-a');
      expect(expired, 0);
    });
  }

  test(
    'failed retried business request is not misclassified as failed authentication',
    () async {
      api.respond = (request) async => _json(
        request.headers['authorization'] == 'Bearer access-a' ? 401 : 503,
      );
      await expectLater(
        client.post<dynamic>(
          '/private/operation',
          data: {'operationId': 'synthetic-operation'},
        ),
        throwsA(isA<ServerException>()),
      );
      expect(tokens.access, 'access-a2');
      expect(tokens.refresh, 'refresh-a2');
      expect(expired, 0);
      expect(api.requests, hasLength(2));
      expect(api.requests.last.data, {'operationId': 'synthetic-operation'});
    },
  );

  test(
    'a second 401 expires only the current session and cannot loop',
    () async {
      api.respond = (_) async => _json(401);
      await expectLater(
        client.get<dynamic>('/private'),
        throwsA(isA<AppException>()),
      );
      expect(api.requests, hasLength(2));
      expect(refresh.requests, hasLength(1));
      expect(expired, 1);
    },
  );

  test('concurrent rejected refresh expires the session only once', () async {
    refresh.respond = (_) async {
      await _flush();
      return _json(401);
    };
    await Future.wait(
      List.generate(
        4,
        (index) => expectLater(
          client.get<dynamic>('/private/$index'),
          throwsA(isA<AppException>()),
        ),
      ),
    );
    expect(expired, 1);
    expect(refresh.requests, hasLength(1));
    expect(tokens.refresh, 'refresh-a');
  });

  test(
    'missing refresh credentials fail closed without sending an empty refresh',
    () async {
      tokens.refresh = null;
      await expectLater(
        client.get<dynamic>('/private'),
        throwsA(isA<AppException>()),
      );
      expect(refresh.requests, isEmpty);
      expect(expired, 1);
    },
  );

  test('malformed rotated credentials are not persisted', () async {
    refresh.respond = (_) async => _json(200, {'accessToken': 'partial-token'});
    await expectLater(
      client.get<dynamic>('/private'),
      throwsA(isA<AppException>()),
    );
    expect(tokens.writes, isEmpty);
    expect(expired, 1);
  });

  for (final path in ['/auth/login', '/auth/refresh', '/auth/logout']) {
    test(
      '$path never borrows a bearer token or triggers recursive refresh',
      () async {
        api.respond = (_) async => _json(401);
        await expectLater(
          client.post<dynamic>(path),
          throwsA(isA<AppException>()),
        );
        expect(api.requests.single.bearer, isNull);
        expect(refresh.requests, isEmpty);
        expect(expired, 0);
      },
    );
  }

  test(
    'a successful private response arriving after account switch is discarded',
    () async {
      final entered = Completer<void>();
      final gate = Completer<ResponseBody>();
      api.respond = (_) {
        entered.complete();
        return gate.future;
      };
      final old = client.get<dynamic>('/private');
      final rejected = expectLater(old, throwsA(isA<AppException>()));
      await entered.future;
      await switchAccount();
      gate.complete(
        _json(200, {'privateRecord': 'synthetic-old-account-record'}),
      );
      await rejected;
      expect(expired, 0);
    },
  );

  test(
    'request created before an account transition is rejected before dispatch',
    () async {
      final old = client.get<dynamic>('/private');
      final rejected = expectLater(old, throwsA(isA<AppException>()));
      await switchAccount();
      await rejected;
      expect(api.requests, isEmpty);
      expect(expired, 0);
    },
  );

  test(
    'cancelled request after 401 neither retries nor expires the session',
    () async {
      final entered = Completer<void>();
      final gate = Completer<ResponseBody>();
      refresh.respond = (_) {
        entered.complete();
        return gate.future;
      };
      final cancellation = CancelToken();
      final pending = client.get<dynamic>(
        '/private',
        cancelToken: cancellation,
      );
      final rejected = expectLater(pending, throwsA(isA<AppException>()));
      await entered.future;
      cancellation.cancel();
      gate.complete(_json(401));
      await rejected;
      await _flush();
      expect(expired, 0);
      expect(api.requests, hasLength(1));
    },
  );

  test(
    'account replacement waits for a partial refresh write before replacing the pair',
    () async {
      final entered = Completer<void>();
      final gate = Completer<void>();
      tokens.beforeAccessWrite = (value) {
        if (value == 'access-a2') {
          entered.complete();
          return gate.future;
        }
        return Future<void>.value();
      };
      final old = client.get<dynamic>('/private');
      final rejected = expectLater(old, throwsA(isA<AppException>()));
      await entered.future;
      final replacement = switchAccount();
      gate.complete();
      await replacement;
      await rejected;
      expect(tokens.access, 'access-b');
      expect(tokens.refresh, 'refresh-b');
      expect(tokens.writes, [
        'refresh:refresh-a2',
        'access:access-a2',
        'clear',
        'refresh:refresh-b',
        'access:access-b',
      ]);
      expect(expired, 0);
    },
  );
}

Future<void> _flush() => Future<void>.delayed(Duration.zero);

ResponseBody _json(int status, [Map<String, dynamic> data = const {}]) =>
    ResponseBody.fromString(
      jsonEncode(data),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

ResponseBody _rotated([String account = 'a']) => _json(200, {
  'success': true,
  'data': {
    'accessToken': 'access-${account}2',
    'refreshToken': 'refresh-${account}2',
  },
});

class _AuthNotifier extends AuthNotifier {
  _AuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);
  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.authenticated,
      role: 'PARENT',
      token: 'access-a',
    );
  }
}

class _Tokens extends Fake implements TokenStorageService {
  String? access = 'access-a';
  String? refresh = 'refresh-a';
  final writes = <String>[];
  Future<void> Function(String value)? beforeAccessWrite;
  @override
  Future<String?> getAccessToken() async => access;
  @override
  Future<String?> getRefreshToken() async => refresh;
  @override
  Future<void> saveAccessToken(String value) async {
    await beforeAccessWrite?.call(value);
    access = value;
    writes.add('access:$value');
  }

  @override
  Future<void> saveRefreshToken(String value) async {
    refresh = value;
    writes.add('refresh:$value');
  }

  @override
  Future<void> clearTokens() async {
    access = null;
    refresh = null;
    writes.add('clear');
  }
}

class _Adapter implements HttpClientAdapter {
  final requests = <({String path, Object? bearer, Object? data})>[];
  late Future<ResponseBody> Function(RequestOptions options) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    requests.add((
      path: options.path,
      bearer: options.headers['authorization'],
      data: options.data,
    ));
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}
