import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/learning/data/learning_repository.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  test(
    'joins a valid controlled learning session with a normalized code',
    () async {
      final apiClient = _MockApiClient();
      final repository = LearningRepository(apiClient);

      when(
        () => apiClient.post<dynamic>(
          '/learning/sessions/join',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/learning/sessions/join'),
          data: {
            'participant': {'id': 'participant-1', 'studentId': 'student-1'},
            'session': {
              'id': 'session-1',
              'activityId': 'activity-1',
              'status': 'LIVE',
              'schoolOnly': true,
              'expiresAt': '2026-06-27T10:00:00.000Z',
              'activity': {
                'id': 'activity-1',
                'title': 'Fractions',
                'difficulty': 'EASY',
                'languageMode': 'ENGLISH',
                'estimatedMinutes': 15,
                'questions': [
                  {'id': 'question-1'},
                  {'id': 'question-2'},
                ],
              },
            },
          },
        ),
      );

      final joined = await repository.joinStudentSession(
        sessionCode: ' abC123 ',
      );

      expect(joined.participantId, 'participant-1');
      expect(joined.studentId, 'student-1');
      expect(joined.session.id, 'session-1');
      expect(joined.session.schoolOnly, isTrue);
      expect(joined.session.activity.title, 'Fractions');
      expect(joined.session.activity.questionCount, 2);
      final payload =
          verify(
                () => apiClient.post<dynamic>(
                  '/learning/sessions/join',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(payload, {'sessionCode': 'ABC123'});
    },
  );
}
