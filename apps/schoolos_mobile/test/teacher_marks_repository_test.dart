import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_marks_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  test(
    'sends expectedVersion on mark capture and never claims publish',
    () async {
      final apiClient = MockApiClient();
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/marks/bulk-upsert',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/marks/bulk-upsert',
          ),
          data: {'updated': 1},
        ),
      );

      final repository = TeacherMarksRepository(apiClient);
      await repository.bulkUpsert(
        examTermId: 'term-1',
        assessmentComponentId: 'comp-1',
        classId: 'class-1',
        subjectId: 'subject-1',
        entries: const [
          TeacherMarkUpsert(
            studentId: 'student-1',
            marksObtained: 18,
            expectedVersion: '2026-08-25T02:00:00.000Z',
          ),
        ],
      );

      final payload =
          verify(
                () => apiClient.post<dynamic>(
                  '/mobile/teacher/marks/bulk-upsert',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(payload['entries'], [
        {
          'studentId': 'student-1',
          'marksObtained': 18,
          'isAbsent': false,
          'isDraft': false,
          'expectedVersion': '2026-08-25T02:00:00.000Z',
        },
      ]);
    },
  );
}
