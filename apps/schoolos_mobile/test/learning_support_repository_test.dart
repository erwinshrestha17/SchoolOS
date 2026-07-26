import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/principal/data/principal_repository.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_repository.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  group('purpose-limited learning support repositories', () {
    late _MockApiClient apiClient;

    setUp(() {
      apiClient = _MockApiClient();
    });

    test(
      'parent loads a linked-child summary without a broad admin API',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/students/student-1/learning-summary',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'learning-summary'),
            data: _parentSummaryJson(),
          ),
        );

        final summary = await ParentRepository(
          apiClient,
        ).getLearningSupport('student-1');

        expect(summary.student.id, 'student-1');
        expect(
          summary.outcomeProgress.single.latestMasteryStatus,
          'DEVELOPING',
        );
        expect(
          summary.guidance.single.homeActivity,
          'Read together for ten minutes.',
        );
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/students/student-1/learning-summary',
          ),
        ).called(1);
      },
    );

    test(
      'teacher reads and writes only within explicit assignment scope',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/students/student-1/learning-support',
            queryParameters: {
              'academicYearId': 'year-1',
              'classId': 'class-1',
              'sectionId': 'section-1',
            },
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'teacher-learning-support'),
            data: {
              ..._parentSummaryJson(),
              'availableOutcomes': [_outcomeJson()],
              'interventions': const [],
              'remedialGroups': const [],
              'parentGuidance': const [],
            },
          ),
        );
        when(
          () => apiClient.post<dynamic>(
            '/mobile/teacher/students/student-1/formative-assessments',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'formative-assessments'),
            data: const {'id': 'assessment-1'},
          ),
        );

        final repository = TeacherRepository(apiClient);
        final hub = await repository.getStudentLearningSupport(
          studentId: 'student-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
        );
        await repository.recordFormativeCheck(
          studentId: 'student-1',
          outcomeId: 'outcome-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
          kind: 'OBSERVATION',
          masteryStatus: 'DEVELOPING',
          assessedOn: DateTime.utc(2026, 7, 26, 10),
          note: 'Used letter sounds with a prompt.',
          parentSummary: 'Practising letter sounds in class.',
          clientSubmissionId: '11111111-1111-4111-8111-111111111111',
        );

        expect(hub.availableOutcomes.single.id, 'outcome-1');
        final payload =
            verify(
                  () => apiClient.post<dynamic>(
                    '/mobile/teacher/students/student-1/formative-assessments',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(payload['academicYearId'], 'year-1');
        expect(payload['classId'], 'class-1');
        expect(payload['sectionId'], 'section-1');
        expect(payload['subjectId'], 'subject-1');
        expect(payload['clientSubmissionId'], hasLength(36));
        expect(payload.containsKey('studentId'), isFalse);
      },
    );

    test(
      'principal consumes explainable signals and versioned case writes',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/principal/learning-attention',
            queryParameters: {'page': 1, 'limit': 20},
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'learning-attention'),
            data: {
              'items': [
                {
                  'signalKey': 'student-1:stage3-v1',
                  'student': _studentJson(),
                  'attentionLevel': 'WATCH',
                  'reasons': [
                    {
                      'code': 'FORMATIVE_SUPPORT',
                      'label': 'Classroom checks need follow-up',
                      'explanation':
                          'Two recent checks are at the starting stage.',
                    },
                  ],
                  'sourceStates': {
                    'attendance': 'available',
                    'formativeAssessment': 'available',
                    'homework': 'empty',
                  },
                  'activeInterventionCaseId': 'case-1',
                },
              ],
              'total': 1,
              'page': 1,
              'limit': 20,
              'generatedAt': '2026-07-26T10:00:00.000Z',
              'rulesVersion': 'stage3-v1',
              'nonPredictive': true,
            },
          ),
        );
        when(
          () => apiClient.patch<dynamic>(
            '/mobile/principal/intervention-cases/case-1',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'case-1'),
            data: const {'id': 'case-1', 'status': 'IN_PROGRESS'},
          ),
        );

        final repository = PrincipalRepository(apiClient);
        final page = await repository.getLearningAttention();
        await repository.updateLearningIntervention(
          caseId: 'case-1',
          status: 'IN_PROGRESS',
          reason: 'Reviewed with the class teacher.',
          expectedVersion: 3,
        );

        expect(page.nonPredictive, isTrue);
        expect(page.items.single.reasons.single.code, 'FORMATIVE_SUPPORT');
        final payload =
            verify(
                  () => apiClient.patch<dynamic>(
                    '/mobile/principal/intervention-cases/case-1',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(payload, {
          'status': 'IN_PROGRESS',
          'reason': 'Reviewed with the class teacher.',
          'expectedVersion': 3,
        });
      },
    );
  });
}

Map<String, dynamic> _parentSummaryJson() => {
  'generatedAt': '2026-07-26T10:00:00.000Z',
  'student': _studentJson(),
  'sourceStates': {
    'outcomeProgress': 'available',
    'guidance': 'available',
    'remedialSupport': 'empty',
    'interventionUpdates': 'empty',
  },
  'outcomeProgress': [
    {
      'outcome': _outcomeJson(),
      'latestMasteryStatus': 'DEVELOPING',
      'latestAssessedOn': '2026-07-26T00:00:00.000Z',
      'previousMasteryStatus': 'BEGINNING',
      'assessmentCount': 2,
      'parentSummary': 'Practising letter sounds in class.',
    },
  ],
  'guidance': [
    {
      'id': 'guidance-1',
      'title': 'Read familiar words',
      'skillExplanation': 'A short fluency practice.',
      'homeActivity': 'Read together for ten minutes.',
      'status': 'PUBLISHED',
      'subject': _subjectJson(),
      'teacher': {'id': 'staff-1', 'fullName': 'Mina Shrestha'},
      'outcome': _outcomeJson(),
    },
  ],
  'remedialSupport': const [],
  'interventionUpdates': const [],
};

Map<String, dynamic> _studentJson() => {
  'id': 'student-1',
  'studentSystemId': 'SCH-001',
  'fullName': 'Asha Rai',
  'classId': 'class-1',
  'className': 'Grade 3',
  'classLevel': 3,
  'sectionId': 'section-1',
  'sectionName': 'A',
};

Map<String, dynamic> _subjectJson() => {
  'id': 'subject-1',
  'code': 'ENG',
  'name': 'English',
};

Map<String, dynamic> _outcomeJson() => {
  'id': 'outcome-1',
  'code': 'FR-01',
  'title': 'Recognises common letter sounds',
  'domain': 'FOUNDATIONAL_READING',
  'subject': _subjectJson(),
};
