import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
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

  test('loads purpose-limited activity scopes and recent uploads', () async {
    when(
      () => apiClient.get<dynamic>('/mobile/teacher/activity/scopes'),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: 'activity/scopes'),
        data: {
          'items': [
            {
              'id': 'year-1:class-1:section-1',
              'academicYearId': 'year-1',
              'academicYearName': '2083',
              'classId': 'class-1',
              'className': 'Grade 3',
              'sectionId': 'section-1',
              'sectionName': 'A',
            },
          ],
        },
      ),
    );
    when(
      () => apiClient.get<dynamic>(
        '/mobile/teacher/activity/posts',
        queryParameters: {'page': 1, 'limit': 20},
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: 'activity/posts'),
        data: {
          'items': [
            {
              'id': 'post-1',
              'title': 'Science day',
              'caption': 'Students built models.',
              'category': 'LEARNING',
              'status': 'PENDING_APPROVAL',
              'class': {'name': 'Grade 3'},
              'section': {'name': 'A'},
              'attachments': [
                {
                  'id': 'attachment-1',
                  'fileName': 'science.jpg',
                  'contentType': 'image/jpeg',
                  'sizeBytes': 1024,
                  'processingStatus': 'PENDING',
                  'previewUrl':
                      'http://localhost:4000/api/v1/activity-feed/attachments/attachment-1/preview',
                },
              ],
            },
          ],
        },
      ),
    );

    final snapshot = await repository.getActivity();

    expect(snapshot.scopes.single.label, 'Grade 3 • A');
    expect(snapshot.posts.single.title, 'Science day');
    expect(
      snapshot.posts.single.attachments.single.processingStatus,
      'PENDING',
    );
  });

  test('maps paginated consent state for the student picker', () async {
    when(
      () => apiClient.get<dynamic>(
        '/mobile/teacher/activity/students',
        queryParameters: {
          'classId': 'class-1',
          'sectionId': 'section-1',
          'page': 1,
          'limit': 50,
        },
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: 'activity/students'),
        data: {
          'items': [
            {
              'id': 'student-1',
              'studentSystemId': 'STU-001',
              'fullName': 'Aarav Sharma',
              'rollNumber': 1,
              'mediaConsentGranted': true,
            },
          ],
          'meta': {'total': 1, 'page': 1, 'limit': 50, 'totalPages': 1},
        },
      ),
    );

    final page = await repository.getActivityStudents(scope: activityScope);

    expect(page.total, 1);
    expect(page.items.single.fullName, 'Aarav Sharma');
    expect(page.items.single.mediaConsentGranted, isTrue);
  });

  test('retries a transient upload with the same idempotency key', () async {
    var attempts = 0;
    when(
      () => apiClient.post<dynamic>(
        '/mobile/teacher/activity/posts',
        data: any(named: 'data'),
      ),
    ).thenAnswer((_) async {
      attempts += 1;
      if (attempts == 1) {
        throw const NetworkException();
      }
      return Response(
        requestOptions: RequestOptions(path: 'activity/posts'),
        data: {
          'id': 'post-1',
          'title': 'Science day',
          'caption': 'Students built models.',
          'category': 'LEARNING',
          'status': 'PENDING_APPROVAL',
          'attachments': [],
        },
      );
    });

    await repository.createActivityPost(
      clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
      scope: activityScope,
      title: 'Science day',
      caption: 'Students built models.',
      category: 'LEARNING',
      studentIds: ['student-1'],
      attachments: [
        TeacherActivityMedia(
          fileName: 'science.jpg',
          contentType: 'image/jpeg',
          bytes: Uint8List.fromList([0xff, 0xd8, 0xff, 0xd9]),
        ),
      ],
    );

    final captured = verify(
      () => apiClient.post<dynamic>(
        '/mobile/teacher/activity/posts',
        data: captureAny(named: 'data'),
      ),
    ).captured.cast<Map<String, dynamic>>();
    expect(captured, hasLength(2));
    expect(captured.map((payload) => payload['clientSubmissionId']).toSet(), {
      '6731ea4f-5c37-4b16-bb72-955abbadc31b',
    });
    expect(
      (captured.first['attachments'] as List).single['base64Content'],
      '/9j/2Q==',
    );
  });

  test(
    'retries a transient milestone submission with the same idempotency key',
    () async {
      var attempts = 0;
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/activity/milestones',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async {
        attempts += 1;
        if (attempts == 1) {
          throw const NetworkException();
        }
        return Response(
          requestOptions: RequestOptions(path: 'activity/milestones'),
          data: {'id': 'milestone-1'},
        );
      });

      await repository.createMilestone(
        clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
        scope: activityScope,
        studentId: 'student-1',
        domain: 'Motor skills',
        milestone: 'Uses classroom materials independently',
        status: 'PROGRESSING',
      );

      final captured = verify(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/activity/milestones',
          data: captureAny(named: 'data'),
        ),
      ).captured.cast<Map<String, dynamic>>();
      expect(captured, hasLength(2));
      expect(
        captured.map((payload) => payload['clientSubmissionId']).toSet(),
        {'6731ea4f-5c37-4b16-bb72-955abbadc31b'},
      );
    },
  );
}

const activityScope = TeacherActivityScope(
  id: 'year-1:class-1:section-1',
  academicYearId: 'year-1',
  academicYearName: '2083',
  classId: 'class-1',
  className: 'Grade 3',
  sectionId: 'section-1',
  sectionName: 'A',
);
