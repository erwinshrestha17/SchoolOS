import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/session_credential_coordinator.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

void main() {
  late _Adapter adapter;
  late ApiClient client;
  late AuthRepository repository;
  late _Tokens storage;
  var expired = false;
  setUp(() {
    adapter = _Adapter();
    storage = _Tokens();
    expired = false;
    client = ApiClient(
      tokenStorage: storage,
      onSessionExpired: () => expired = true,
    );
    client.dio.httpClientAdapter = adapter;
    repository = AuthRepository(client);
    SessionCredentialCoordinator.forStorage(storage).beginTransition();
  });
  tearDown(() => client.dio.close(force: true));

  test('request works while signed out and sends school/email only', () async {
    final cancellation = CancelToken();
    await repository.requestPasswordRecovery(
      tenantSlug: 'synthetic-school',
      email: 'parent@example.invalid',
      cancelToken: cancellation,
    );
    final request = adapter.requests.single;
    expect(request.path, '/auth/password-recovery/request');
    expect(request.method, 'POST');
    expect(request.data, {
      'tenantSlug': 'synthetic-school',
      'email': 'parent@example.invalid',
    });
    expect(request.headers.containsKey('authorization'), isFalse);
    expect(request.cancelToken, same(cancellation));
    expect(expired, isFalse);
  });

  test(
    'confirmation sends the existing contract and preserves password whitespace',
    () async {
      await repository.confirmPasswordRecovery(
        tenantSlug: 'synthetic-school',
        email: 'teacher@example.invalid',
        code: '123456',
        newPassword: ' Qz72!mV8 ',
        confirmNewPassword: ' Qz72!mV8 ',
      );
      expect(adapter.requests.single.path, '/auth/password-recovery/confirm');
      expect(adapter.requests.single.data, {
        'tenantSlug': 'synthetic-school',
        'email': 'teacher@example.invalid',
        'code': '123456',
        'newPassword': ' Qz72!mV8 ',
        'confirmNewPassword': ' Qz72!mV8 ',
      });
      expect(expired, isFalse);
    },
  );

  for (final payload in [
    null,
    {},
    {'success': false},
    {'success': 'true'},
  ]) {
    test('missing acknowledgement is not success: $payload', () async {
      adapter.payload = payload;
      await expectLater(
        repository.requestPasswordRecovery(
          tenantSlug: 'synthetic-school',
          email: 'parent@example.invalid',
        ),
        throwsA(isA<AuthException>()),
      );
      await expectLater(
        repository.confirmPasswordRecovery(
          tenantSlug: 'synthetic-school',
          email: 'parent@example.invalid',
          code: '123456',
          newPassword: 'Qz72!mV8',
          confirmNewPassword: 'Qz72!mV8',
        ),
        throwsA(isA<AuthException>()),
      );
    });
  }

  for (final status in [400, 401, 403, 429, 503]) {
    test(
      'recovery $status is not treated as session expiry or auto-retried',
      () async {
        adapter.status = status;
        await expectLater(
          repository.confirmPasswordRecovery(
            tenantSlug: 'synthetic-school',
            email: 'principal@example.invalid',
            code: '123456',
            newPassword: 'Qz72!mV8',
            confirmNewPassword: 'Qz72!mV8',
          ),
          throwsA(isA<AppException>()),
        );
        expect(adapter.requests, hasLength(1));
        expect(expired, isFalse);
      },
    );
  }

  test('pre-cancelled request cannot dispatch', () async {
    final cancellation = CancelToken()..cancel();
    await expectLater(
      repository.requestPasswordRecovery(
        tenantSlug: 'synthetic-school',
        email: 'parent@example.invalid',
        cancelToken: cancellation,
      ),
      throwsA(isA<AppException>()),
    );
    expect(adapter.requests, isEmpty);
  });
}

class _Tokens extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async =>
      throw StateError('Public recovery must not read stored credentials.');
}

class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  int status = 200;
  Object? payload = {'success': true};
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode({'success': true, 'data': payload}),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
