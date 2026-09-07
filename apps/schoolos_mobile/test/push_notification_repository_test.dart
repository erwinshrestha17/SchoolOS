import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_repository.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

void main() {
  test('registration uses the scoped authenticated API contract', () async {
    final storage = _TokenStorage();
    final adapter = _Adapter();
    final client = ApiClient(tokenStorage: storage);
    client.dio.httpClientAdapter = adapter;
    addTearDown(() => client.dio.close(force: true));
    final cancellation = CancelToken();
    final result = await PushNotificationRepository(client).register(
      token: 'synthetic-device-token',
      installationId: 'synthetic-installation',
      platform: 'android',
      cancelToken: cancellation,
    );
    expect(result.registered, isTrue);
    expect(result.providerEnabled, isFalse);
    expect(result.failureCode, 'PROVIDER_DISABLED');
    final request = adapter.requests.single;
    expect(request.method, 'POST');
    expect(request.path, '/mobile/push-tokens');
    expect(request.headers['authorization'], 'Bearer synthetic-session-a');
    expect(request.cancelToken, same(cancellation));
    expect(request.data, {
      'token': 'synthetic-device-token',
      'installationId': 'synthetic-installation',
      'platform': 'android',
    });
  });

  test(
    'cancelled registration never dispatches with a later accounts bearer token',
    () async {
      final storage = _TokenStorage();
      final adapter = _Adapter();
      final client = ApiClient(tokenStorage: storage);
      client.dio.httpClientAdapter = adapter;
      addTearDown(() => client.dio.close(force: true));
      final entered = Completer<void>();
      final tokenRead = Completer<String?>();
      storage.readToken = () {
        entered.complete();
        return tokenRead.future;
      };
      final cancellation = CancelToken();
      final pending = PushNotificationRepository(client).register(
        token: 'synthetic-device-token',
        installationId: 'synthetic-installation',
        platform: 'ios',
        cancelToken: cancellation,
      );
      final assertion = expectLater(pending, throwsA(isA<Exception>()));
      await entered.future;
      cancellation.cancel();
      tokenRead.complete('synthetic-session-b');
      await assertion;
      await Future<void>.delayed(Duration.zero);
      expect(adapter.requests, isEmpty);
    },
  );
}

class _TokenStorage extends Fake implements TokenStorageService {
  Future<String?> Function()? readToken;
  @override
  Future<String?> getAccessToken() async =>
      readToken == null ? 'synthetic-session-a' : await readToken!();
}

class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{"success":true,"data":{"registered":true,"provider":{"enabled":false,"failureCode":"PROVIDER_DISABLED"}}}',
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
