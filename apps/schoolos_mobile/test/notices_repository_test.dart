import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('NoticesRepository', () {
    late MockApiClient apiClient;
    late NoticesRepository repository;
    late Directory tempDir;

    setUp(() {
      apiClient = MockApiClient();
      repository = NoticesRepository(apiClient);
      tempDir = Directory.systemTemp.createTempSync('schoolos_notice_test_');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (call) async {
              if (call.method == 'getTemporaryDirectory') {
                return tempDir.path;
              }
              return null;
            },
          );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            null,
          );
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test(
      'loads mobile notification center from parent-safe endpoint',
      () async {
        when(
          () => apiClient.get<dynamic>('/mobile/me/notifications'),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/mobile/me/notifications'),
            data: {
              'unreadCount': 2,
              'items': [
                {
                  'id': 'delivery-1',
                  'title': 'Homework due',
                  'message': 'Math worksheet is due tomorrow.',
                  'sourceType': 'homework_due_soon',
                  'createdAt': '2026-06-01T08:00:00.000Z',
                  'isRead': false,
                },
                {
                  'id': 'delivery-2',
                  'title': 'Fee receipt',
                  'body': 'Payment was confirmed.',
                  'sourceType': 'FEE_PAYMENT_CONFIRMED',
                  'createdAt': '2026-06-01T09:00:00.000Z',
                  'isRead': true,
                },
                {
                  'id': 'delivery-3',
                  'title': 'Trip delay',
                  'body': 'Bus is delayed by 10 minutes.',
                  'sourceType': 'TRANSPORT',
                  'createdAt': '2026-06-01T10:00:00.000Z',
                  'isRead': false,
                },
              ],
            },
          ),
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/me/notifications',
            queryParameters: any(named: 'queryParameters'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/mobile/me/notifications'),
            data: {
              'unreadCount': 2,
              'items': [
                {
                  'id': 'delivery-1',
                  'title': 'Homework due',
                  'message': 'Math worksheet is due tomorrow.',
                  'sourceType': 'homework_due_soon',
                  'createdAt': '2026-06-01T08:00:00.000Z',
                  'isRead': false,
                },
                {
                  'id': 'delivery-2',
                  'title': 'Fee receipt',
                  'body': 'Payment was confirmed.',
                  'sourceType': 'FEE_PAYMENT_CONFIRMED',
                  'createdAt': '2026-06-01T09:00:00.000Z',
                  'isRead': true,
                },
                {
                  'id': 'delivery-3',
                  'title': 'Trip delay',
                  'body': 'Bus is delayed by 10 minutes.',
                  'sourceType': 'TRANSPORT',
                  'createdAt': '2026-06-01T10:00:00.000Z',
                  'isRead': false,
                },
              ],
            },
          ),
        );
        when(
          () => apiClient.get<dynamic>('/mobile/me/notifications/unread-count'),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/me/notifications/unread-count',
            ),
            data: {'unreadCount': 2},
          ),
        );

        final page = await repository.getNotificationCenter();
        final items = page.items;
        final notices = await repository.getNotices();
        final unreadCount = await repository.getUnreadCount();

        expect(items, hasLength(3));
        expect(items.first.category, NoticeCategory.homework);
        expect(items[1].category, NoticeCategory.fee);
        expect(items[2].category, NoticeCategory.transport);
        expect(notices.first.id, 'delivery-1');
        expect(notices.first.isRead, isFalse);
        expect(unreadCount, 2);
        verify(
          () => apiClient.get<dynamic>('/mobile/me/notifications'),
        ).called(1);
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/me/notifications',
            queryParameters: any(named: 'queryParameters'),
          ),
        ).called(1);
      },
    );

    test(
      'marks notification delivery as read through mobile endpoint',
      () async {
        when(
          () => apiClient.post<dynamic>(
            '/mobile/me/notifications/delivery-1/read',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/me/notifications/delivery-1/read',
            ),
            data: {'success': true},
          ),
        );

        await repository.markNoticeRead('delivery-1');

        verify(
          () => apiClient.post<dynamic>(
            '/mobile/me/notifications/delivery-1/read',
          ),
        ).called(1);
      },
    );

    test('loads one exact parent-visible notification detail', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/me/notifications/delivery-2'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/me/notifications/delivery-2',
          ),
          data: {
            'id': 'delivery-2',
            'title': 'Bus update',
            'message': 'The bus has arrived.',
            'sourceType': 'TRANSPORT',
            'createdAt': '2026-06-01T10:00:00.000Z',
            'isRead': false,
            'attachment': {
              'id': 'file-1',
              'fileName': 'bus-circular.pdf',
              'mimeType': 'application/pdf',
              'sizeBytes': 1024,
              'downloadPath': '/mobile/me/notifications/delivery-2/attachment',
            },
          },
        ),
      );

      final notice = await repository.getNoticeDetail('delivery-2');

      expect(notice.id, 'delivery-2');
      expect(notice.title, 'Bus update');
      expect(notice.body, 'The bus has arrived.');
      expect(notice.hasAttachment, isTrue);
      expect(notice.attachment?.downloadPath, contains('/attachment'));
    });

    test(
      'downloads notice attachment through protected mobile endpoint',
      () async {
        const attachment = NoticeAttachment(
          id: 'file-1',
          fileName: 'bus circular.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          downloadPath: '/mobile/me/notifications/delivery-2/attachment',
        );
        when(
          () => apiClient.get<List<int>>(
            '/mobile/me/notifications/delivery-2/attachment',
            options: any(named: 'options'),
          ),
        ).thenAnswer(
          (_) async => Response<List<int>>(
            requestOptions: RequestOptions(
              path: '/mobile/me/notifications/delivery-2/attachment',
            ),
            data: [37, 80, 68, 70],
          ),
        );

        final download = await repository.downloadNoticeAttachment(attachment);

        expect(download.fileName, 'bus-circular.pdf');
        expect(File(download.filePath).existsSync(), isTrue);
        expect(File(download.filePath).readAsBytesSync(), [37, 80, 68, 70]);
        verify(
          () => apiClient.get<List<int>>(
            '/mobile/me/notifications/delivery-2/attachment',
            options: any(named: 'options'),
          ),
        ).called(1);
      },
    );

    test('maps other backend notification source families', () {
      expect(
        ParentNotification.fromJson({
          'id': 'delivery-4',
          'sourceType': 'attendance_absent',
        }).category,
        NoticeCategory.academic,
      );
      expect(
        ParentNotification.fromJson({
          'id': 'delivery-5',
          'sourceType': 'report_card_published',
        }).category,
        NoticeCategory.academic,
      );
      expect(
        ParentNotification.fromJson({
          'id': 'delivery-6',
          'sourceType': 'consent_required',
        }).category,
        NoticeCategory.approval,
      );
    });
  });
}
