import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/features/notices/application/notices_providers.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';

/// Acknowledgement is the school's record that a guardian read a notice. The
/// backend stores only `firstAcknowledgedAt`, so a replay is harmless - but the
/// app must still not fire it twice from one intent, must not queue it offline
/// (the timestamp would be wrong and the parent could not be told whether it
/// landed), and must surface a real failure rather than claiming success.
void main() {
  late _MockNoticesRepository repository;

  setUp(() {
    repository = _MockNoticesRepository();
  });

  NoticeAcknowledgementController controller({bool isOnline = true}) {
    return NoticeAcknowledgementController(
      repository: repository,
      isOnline: isOnline,
    );
  }

  test('records the acknowledgement once and reports success', () async {
    when(() => repository.acknowledgeNotice(any())).thenAnswer((_) async {});

    final subject = controller();
    expect(await subject.acknowledge('notice-1'), isTrue);

    expect(subject.state.isAcknowledged, isTrue);
    expect(subject.state.error, isNull);
    verify(() => repository.acknowledgeNotice('notice-1')).called(1);
  });

  test('a second tap after success does not send again', () async {
    when(() => repository.acknowledgeNotice(any())).thenAnswer((_) async {});

    final subject = controller();
    await subject.acknowledge('notice-1');
    await subject.acknowledge('notice-1');

    verify(() => repository.acknowledgeNotice('notice-1')).called(1);
  });

  test('overlapping taps send a single request', () async {
    final gate = Completer<void>();
    var calls = 0;
    when(() => repository.acknowledgeNotice(any())).thenAnswer((_) async {
      calls++;
      await gate.future;
    });

    final subject = controller();
    final first = subject.acknowledge('notice-1');
    final second = subject.acknowledge('notice-1');
    gate.complete();
    await Future.wait([first, second]);

    expect(calls, 1, reason: 'a double tap is one intent, not two records');
  });

  test('is refused offline rather than queued', () async {
    final subject = controller(isOnline: false);

    expect(await subject.acknowledge('notice-1'), isFalse);
    expect(subject.state.status, NoticeAcknowledgementStatus.failed);
    expect(subject.state.error, isA<NetworkException>());
    verifyNever(() => repository.acknowledgeNotice(any()));
  });

  test('surfaces a backend failure and stays retryable', () async {
    when(
      () => repository.acknowledgeNotice(any()),
    ).thenAnswer((_) async => throw const ServerException());

    final subject = controller();
    expect(await subject.acknowledge('notice-1'), isFalse);
    expect(subject.state.status, NoticeAcknowledgementStatus.failed);
    expect(
      subject.state.isAcknowledged,
      isFalse,
      reason: 'a failed write must never render as confirmed',
    );

    // The parent can try again, and the retry is allowed through.
    when(() => repository.acknowledgeNotice(any())).thenAnswer((_) async {});
    expect(await subject.acknowledge('notice-1'), isTrue);
    expect(subject.state.isAcknowledged, isTrue);
  });

  group('notice identity', () {
    // Device QA 2026-07-25: the mocked controller tests all passed while the
    // real call 404'd, because the screen passed the *notification* id to an
    // endpoint keyed on the *notice* id. These pin the two apart.
    test('a notice-backed entry exposes the notice id, not its own', () {
      final notice = Notice(
        id: 'notification-1',
        noticeId: 'notice-1',
        title: 'Closure',
        preview: '',
        body: '',
        publishedBy: 'SchoolOS',
        publishedAt: _publishedAt,
        audience: 'Whole school',
        category: NoticeCategory.general,
        isRead: false,
        hasAttachment: false,
      );

      expect(notice.canAcknowledge, isTrue);
      expect(
        notice.noticeId,
        isNot(notice.id),
        reason: 'acknowledgement must not be keyed on the notification id',
      );
    });

    test('a non-notice entry cannot be acknowledged', () {
      final event = Notice(
        id: 'notification-2',
        title: 'Sports day',
        preview: '',
        body: '',
        publishedBy: 'SchoolOS',
        publishedAt: _publishedAt,
        audience: 'Whole school',
        category: NoticeCategory.general,
        isRead: false,
        hasAttachment: false,
      );

      expect(
        event.canAcknowledge,
        isFalse,
        reason: 'events and activity posts have no notice record to confirm',
      );
    });

    test('copyWith preserves the notice id', () {
      final notice = Notice(
        id: 'notification-1',
        noticeId: 'notice-1',
        title: 'Closure',
        preview: '',
        body: '',
        publishedBy: 'SchoolOS',
        publishedAt: _publishedAt,
        audience: 'Whole school',
        category: NoticeCategory.general,
        isRead: false,
        hasAttachment: false,
      );

      expect(notice.copyWith(isRead: true).noticeId, 'notice-1');
    });
  });

  test('maps an unexpected error to a school-friendly message', () async {
    when(
      () => repository.acknowledgeNotice(any()),
    ).thenAnswer((_) async => throw StateError('boom'));

    final subject = controller();
    expect(await subject.acknowledge('notice-1'), isFalse);
    expect(subject.state.error, isA<UnknownException>());
    expect(subject.state.error!.message, isNot(contains('boom')));
  });
}

final _publishedAt = DateTime(2026, 7, 25, 9);

class _MockNoticesRepository extends Mock implements NoticesRepository {}
