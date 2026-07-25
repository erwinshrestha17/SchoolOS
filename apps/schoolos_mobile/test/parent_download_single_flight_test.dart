import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

/// Every protected download writes to a path derived from the record id, so two
/// overlapping downloads of the same record would interleave their bytes into
/// one corrupt file - and that file is what the parent then opens or shares.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late ParentRepository repository;
  late Directory tempDir;

  setUpAll(() {
    registerFallbackValue(Options());
  });

  setUp(() {
    apiClient = MockApiClient();
    repository = ParentRepository(apiClient);
    tempDir = Directory.systemTemp.createTempSync('schoolos_download_test_');
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

  const reportCard = ParentReportCard(
    id: 'report-1',
    examTerm: 'First Terminal',
    publishedAt: '2026-07-20',
    academicYear: '2083',
    percentage: 82.5,
    grade: 'A',
    hasFile: true,
  );

  test('overlapping downloads of one record perform a single write', () async {
    var fetches = 0;
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      fetches++;
      // Hold both callers inside the download so they genuinely overlap.
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, 7),
      );
    });

    final results = await Future.wait([
      repository.downloadReportCardPdf(
        childId: 'child-1',
        reportCard: reportCard,
      ),
      repository.downloadReportCardPdf(
        childId: 'child-1',
        reportCard: reportCard,
      ),
    ]);

    expect(
      fetches,
      1,
      reason:
          'a second tap while the first download is still writing must join it, '
          'not start a concurrent write to the same path',
    );
    expect(results.first.filePath, results.last.filePath);
    expect(File(results.first.filePath).readAsBytesSync(), hasLength(64));
  });

  test('a later download of the same record starts fresh', () async {
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

    await repository.downloadReportCardPdf(
      childId: 'child-1',
      reportCard: reportCard,
    );
    await repository.downloadReportCardPdf(
      childId: 'child-1',
      reportCard: reportCard,
    );

    expect(
      fetches,
      2,
      reason:
          'the guard is only for overlapping calls; re-downloading later must '
          'fetch the current file rather than replay a stale one',
    );
  });

  test('different records download concurrently', () async {
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

    await Future.wait([
      repository.downloadReportCardPdf(
        childId: 'child-1',
        reportCard: reportCard,
      ),
      repository.downloadReportCardPdf(
        childId: 'child-1',
        reportCard: const ParentReportCard(
          id: 'report-2',
          examTerm: 'Second Terminal',
          publishedAt: '2026-07-21',
          academicYear: '2083',
          percentage: 79.0,
          grade: 'A',
          hasFile: true,
        ),
      ),
    ]);

    expect(fetches, 2, reason: 'separate files must not block each other');
  });

  test('a failed download does not poison the next attempt', () async {
    var fetches = 0;
    when(
      () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
    ).thenAnswer((_) async {
      fetches++;
      if (fetches == 1) throw const NetworkException();
      return Response(
        requestOptions: RequestOptions(path: ''),
        data: List<int>.filled(64, 7),
      );
    });

    await expectLater(
      repository.downloadReportCardPdf(
        childId: 'child-1',
        reportCard: reportCard,
      ),
      throwsA(isA<NetworkException>()),
    );

    final retry = await repository.downloadReportCardPdf(
      childId: 'child-1',
      reportCard: reportCard,
    );

    expect(fetches, 2);
    expect(File(retry.filePath).existsSync(), isTrue);
  });
}

class MockApiClient extends Mock implements ApiClient {}
