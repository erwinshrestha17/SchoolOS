import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/notices/data/notices_repository.dart';
import 'package:schoolos_mobile/features/notices/domain/notice_models.dart';

/// Notice attachments are written to disk and then opened or shared. Two
/// writes landing on one path interleave into a corrupt file, so downloads
/// must neither overlap for one attachment nor share a path between different
/// attachments that happen to carry the same display name.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late NoticesRepository repository;
  late Directory tempDir;

  setUpAll(() => registerFallbackValue(Options()));

  setUp(() {
    apiClient = MockApiClient();
    repository = NoticesRepository(apiClient);
    tempDir = Directory.systemTemp.createTempSync('schoolos_notice_test_');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (call) async =>
              call.method == 'getTemporaryDirectory' ? tempDir.path : null,
        );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          null,
        );
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  const attachment = NoticeAttachment(
    id: 'attachment-1',
    fileName: 'circular.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    downloadPath: '/mobile/me/notifications/notice-1/attachment',
  );

  void stubBytes({Duration delay = Duration.zero, int fill = 7}) {
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      if (delay > Duration.zero) await Future<void>.delayed(delay);
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, fill),
      );
    });
  }

  test('overlapping downloads of one attachment write once', () async {
    var fetches = 0;
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      fetches++;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, 7),
      );
    });

    final results = await Future.wait([
      repository.downloadNoticeAttachment(attachment),
      repository.downloadNoticeAttachment(attachment),
    ]);

    expect(
      fetches,
      1,
      reason: 'Download and Share tapped together must not race on one path',
    );
    expect(results.first.filePath, results.last.filePath);
  });

  test('attachments sharing a display name get separate paths', () async {
    stubBytes();

    final first = await repository.downloadNoticeAttachment(attachment);
    final second = await repository.downloadNoticeAttachment(
      const NoticeAttachment(
        id: 'attachment-2',
        fileName: 'circular.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        downloadPath: '/mobile/me/notifications/notice-2/attachment',
      ),
    );

    expect(
      first.filePath,
      isNot(second.filePath),
      reason:
          'two notices can both attach a file called circular.pdf; sharing one '
          'path lets a concurrent write corrupt it',
    );
    expect(first.fileName, 'circular.pdf');
    expect(second.fileName, 'circular.pdf');
    expect(File(first.filePath).existsSync(), isTrue);
    expect(File(second.filePath).existsSync(), isTrue);
  });

  test('a later download of the same attachment refetches', () async {
    var fetches = 0;
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      fetches++;
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, 7),
      );
    });

    await repository.downloadNoticeAttachment(attachment);
    await repository.downloadNoticeAttachment(attachment);

    expect(fetches, 2, reason: 'the guard covers overlap only, not caching');
  });

  test('a failed download does not poison the next attempt', () async {
    var fetches = 0;
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      fetches++;
      if (fetches == 1) throw StateError('network down');
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, 7),
      );
    });

    await expectLater(
      repository.downloadNoticeAttachment(attachment),
      throwsA(isA<StateError>()),
    );
    final retry = await repository.downloadNoticeAttachment(attachment);

    expect(fetches, 2);
    expect(File(retry.filePath).existsSync(), isTrue);
  });
}

class MockApiClient extends Mock implements ApiClient {}
