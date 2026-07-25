import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';

/// `/mobile/me/notifications` is backed by `NotificationDelivery`, one row per
/// channel, so a notice sent IN_APP and PUSH reaches the parent twice. Verified
/// against a seeded tenant on 2026-07-25: every notice appeared exactly twice.
///
/// The feed must show one entry per notification while keeping genuinely
/// distinct entries - notably the same notice reaching a guardian once per
/// linked child - apart.
void main() {
  late MockApiClient apiClient;
  late NoticesRepository repository;

  setUp(() {
    apiClient = MockApiClient();
    repository = NoticesRepository(apiClient);
  });

  void stub(List<Map<String, dynamic>> items, {int unreadCount = 0}) {
    when(
      () => apiClient.get<dynamic>(
        '/mobile/me/notifications',
        queryParameters: any(named: 'queryParameters'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: ''),
        data: {'items': items, 'unreadCount': unreadCount},
      ),
    );
  }

  Map<String, dynamic> delivery({
    required String id,
    required String noticeId,
    String? childId,
    String? readAt,
    String title = 'Early closure',
  }) {
    return {
      'id': id,
      'noticeId': noticeId,
      'childId': childId,
      'sourceType': 'NOTICE',
      'title': title,
      'body': 'School closes at noon.',
      'createdAt': '2026-07-25T05:32:00.000Z',
      'readAt': readAt,
    };
  }

  test('one notice delivered on two channels appears once', () async {
    stub([
      delivery(id: 'in-app-row', noticeId: 'notice-1', childId: 'child-a'),
      delivery(id: 'push-row', noticeId: 'notice-1', childId: 'child-a'),
    ], unreadCount: 2);

    final page = await repository.getNotificationCenter();

    expect(page.items, hasLength(1));
    expect(
      page.unreadCount,
      1,
      reason: 'the badge must match the visible list, not the delivery count',
    );
  });

  test('the same notice for two children stays two entries', () async {
    stub([
      delivery(id: 'row-a', noticeId: 'notice-1', childId: 'child-a'),
      delivery(id: 'row-b', noticeId: 'notice-1', childId: 'child-b'),
    ]);

    final page = await repository.getNotificationCenter();

    expect(
      page.items,
      hasLength(2),
      reason:
          'a notice reaching a guardian once per linked child is two distinct '
          'things to that parent',
    );
  });

  test('a notification read on any channel counts as read', () async {
    stub([
      delivery(id: 'push-row', noticeId: 'notice-1', childId: 'child-a'),
      delivery(
        id: 'in-app-row',
        noticeId: 'notice-1',
        childId: 'child-a',
        readAt: '2026-07-25T06:00:00.000Z',
      ),
    ], unreadCount: 1);

    final page = await repository.getNotificationCenter();

    expect(page.items, hasLength(1));
    expect(
      page.items.single.isRead,
      isTrue,
      reason:
          'markNoticeRead clears every delivery for a notice, so one read row '
          'means the parent has read it',
    );
    expect(page.unreadCount, 0);
  });

  test('entries without a source id are never merged', () async {
    stub([
      {
        'id': 'row-1',
        'sourceType': 'OTHER',
        'title': 'One',
        'createdAt': '2026-07-25T05:32:00.000Z',
      },
      {
        'id': 'row-2',
        'sourceType': 'OTHER',
        'title': 'Two',
        'createdAt': '2026-07-25T05:33:00.000Z',
      },
    ]);

    final page = await repository.getNotificationCenter();

    expect(
      page.items,
      hasLength(2),
      reason: 'with nothing to group on, collapsing would lose information',
    );
  });

  test('newest-first order is preserved', () async {
    stub([
      delivery(id: 'row-new', noticeId: 'notice-2', title: 'Newest'),
      delivery(id: 'row-new-push', noticeId: 'notice-2', title: 'Newest'),
      delivery(id: 'row-old', noticeId: 'notice-1', title: 'Older'),
    ]);

    final page = await repository.getNotificationCenter();

    expect(page.items.map((item) => item.title), ['Newest', 'Older']);
  });
}

class MockApiClient extends Mock implements ApiClient {}
