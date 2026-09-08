import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_repository.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  const path = '/mobile/me/notifications/unread-count';
  for (final count in [0, 7, 999]) {
    test('preserves authoritative unread count $count', () async {
      final client = _MockApiClient();
      when(() => client.get<dynamic>(path)).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: path),
          data: {'unreadCount': count},
        ),
      );
      expect(
        (await TeacherRepository(client).getNoticeSummary()).unreadCount,
        count,
      );
    });
  }

  for (final payload in [
    null,
    [],
    {},
    {'unreadCount': null},
    {'unreadCount': -1},
    {'unreadCount': '0'},
    {'unreadCount': 1.5},
    {'unreadCount': true},
  ]) {
    test('rejects malformed notification summary $payload', () async {
      final client = _MockApiClient();
      when(() => client.get<dynamic>(path)).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: path),
          data: payload,
        ),
      );
      await expectLater(
        TeacherRepository(client).getNoticeSummary(),
        throwsA(
          isA<ServerException>().having(
            (e) => e.code,
            'code',
            'INVALID_NOTIFICATION_SUMMARY',
          ),
        ),
      );
    });
  }
}
