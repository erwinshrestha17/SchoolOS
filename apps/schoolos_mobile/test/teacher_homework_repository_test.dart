import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_repository.dart';
import 'package:schoolos_mobile/features/teacher/domain/teacher_models.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient apiClient;
  late TeacherRepository repository;

  setUp(() {
    apiClient = _MockApiClient();
    repository = TeacherRepository(apiClient);
  });

  test('loads teacher-scoped homework and assigned creation scopes', () async {
    when(
      () => apiClient.get<dynamic>(
        '/mobile/teacher/homework',
        queryParameters: {'limit': '50'},
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/mobile/teacher/homework'),
        data: {
          'items': [
            {
              'id': 'homework-1',
              'title': 'Fractions',
              'instructions': 'Complete exercise 2.',
              'className': 'Grade 3',
              'sectionName': 'A',
              'subjectName': 'Mathematics',
              'dueDate': '2026-06-20T00:00:00.000Z',
              'status': 'DRAFT',
              'submissionRequired': true,
              'attachmentCount': 0,
              'submissions': {
                'total': 24,
                'submitted': 2,
                'reviewed': 1,
                'toReview': 1,
                'notSubmitted': 22,
              },
            },
          ],
          'total': 1,
          'page': 1,
          'limit': 50,
        },
      ),
    );
    when(
      () => apiClient.get<dynamic>('/mobile/teacher/homework/scopes'),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/mobile/teacher/homework/scopes'),
        data: {
          'items': [
            {
              'id': 'year-1:class-1:section-1:subject-1',
              'academicYearId': 'year-1',
              'academicYearName': '2082',
              'classId': 'class-1',
              'className': 'Grade 3',
              'sectionId': 'section-1',
              'sectionName': 'A',
              'subjectId': 'subject-1',
              'subjectName': 'Mathematics',
            },
          ],
        },
      ),
    );

    final snapshot = await repository.getHomework();

    expect(snapshot.total, 1);
    expect(snapshot.items.single.title, 'Fractions');
    expect(snapshot.items.single.submissions.toReview, 1);
    expect(snapshot.scopes.single.label, 'Grade 3 • A • Mathematics');
  });

  test('creates a safe draft and publishes through mobile endpoints', () async {
    const scope = schoolosScope;
    when(
      () => apiClient.post<dynamic>('/files/upload', data: any(named: 'data')),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/files/upload'),
        data: {'id': 'file-1', 'fileName': 'worksheet.jpg'},
      ),
    );
    when(
      () => apiClient.post<dynamic>(
        '/mobile/teacher/homework',
        data: any(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/mobile/teacher/homework'),
        data: {'id': 'homework-1'},
      ),
    );
    when(
      () => apiClient.post<dynamic>(
        '/mobile/teacher/homework/homework-1/publish',
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(
          path: '/mobile/teacher/homework/homework-1/publish',
        ),
      ),
    );

    await repository.createHomework(
      scope: scope,
      title: 'Fractions',
      instructions: 'Complete exercise 2.',
      dueDate: DateTime.utc(2026, 6, 20),
      submissionRequired: true,
      attachments: [
        TeacherHomeworkDraftAttachment(
          fileName: 'worksheet.jpg',
          contentType: 'image/jpeg',
          bytes: Uint8List.fromList([1, 2, 3]),
        ),
      ],
    );
    await repository.publishHomework('homework-1');

    final captured =
        verify(
              () => apiClient.post<dynamic>(
                '/mobile/teacher/homework',
                data: captureAny(named: 'data'),
              ),
            ).captured.single
            as Map<String, dynamic>;
    expect(captured['classId'], 'class-1');
    expect(captured['subjectId'], 'subject-1');
    expect(captured['status'], 'DRAFT');
    expect(captured['attachmentFileIds'], ['file-1']);
    final upload =
        verify(
              () => apiClient.post<dynamic>(
                '/files/upload',
                data: captureAny(named: 'data'),
              ),
            ).captured.single
            as Map<String, dynamic>;
    expect(upload['module'], 'homework');
    expect(upload['base64Content'], 'AQID');
    verify(
      () => apiClient.post<dynamic>(
        '/mobile/teacher/homework/homework-1/publish',
      ),
    ).called(1);
  });
}

const schoolosScope = TeacherHomeworkScope(
  id: 'year-1:class-1:section-1:subject-1',
  academicYearId: 'year-1',
  academicYearName: '2082',
  classId: 'class-1',
  className: 'Grade 3',
  sectionId: 'section-1',
  sectionName: 'A',
  subjectId: 'subject-1',
  subjectName: 'Mathematics',
);
