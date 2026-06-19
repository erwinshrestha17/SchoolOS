import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('ParentRepository', () {
    late MockApiClient apiClient;
    late ParentRepository repository;

    const child = GuardianChild(
      id: 'child-1',
      name: 'Asha Rai',
      classSection: 'Grade 4 - A',
      rollNumber: '7',
      academicYear: '2026',
      relationship: 'Daughter',
    );

    setUp(() {
      apiClient = MockApiClient();
      repository = ParentRepository(apiClient);
    });

    test('maps parent-safe child profile fields from mobile API', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/students/child-1/profile'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/profile',
          ),
          data: {
            'profile': {
              'studentSystemId': 'SCH-2026-001',
              'classTeacher': {'id': 'staff-1', 'name': 'Mina Shrestha'},
              'admissionNumber': 'ADM-001',
              'admissionDate': '2026-04-01T00:00:00.000Z',
              'dateOfBirth': '2017-02-03T00:00:00.000Z',
              'gender': 'FEMALE',
              'bloodGroup': 'O+',
              'nationality': 'Nepali',
              'lifecycleStatus': 'ENROLLED',
              'medicalSummary': {
                'hasMedicalConsent': true,
                'medicalConditions': 'Asthma',
                'severeAllergies': 'Peanuts',
                'specialNeeds': null,
              },
              'privacy': {
                'photoUsageConsent': true,
                'dataProcessingConsent': true,
              },
            },
          },
        ),
      );

      final profile = await repository.getChildProfileForChild(child);

      expect(profile.studentSystemId, 'SCH-2026-001');
      expect(profile.admissionNumber, 'ADM-001');
      expect(profile.lifecycleStatus, 'ENROLLED');
      expect(profile.classTeacher, 'Mina Shrestha');
      expect(profile.classTeacherId, 'staff-1');
      expect(profile.photoUsageConsent, isTrue);
      expect(profile.dataProcessingConsent, isTrue);
      expect(profile.healthWarning, 'Asthma / Peanuts');
      expect(profile.canViewHealthWarning, isTrue);
      expect(profile.guardianSummary, contains('Daughter access verified'));
      expect(profile.qrLabel, contains('SCH-2026-001'));
    });

    test(
      'blocks unlinked child detail before calling child endpoint',
      () async {
        when(() => apiClient.get<dynamic>('/mobile/me/students')).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/mobile/me/students'),
            data: {
              'items': [
                {
                  'id': 'child-1',
                  'name': 'Asha Rai',
                  'classSection': 'Grade 4 - A',
                  'rollNumber': '7',
                  'academicYear': '2026',
                  'relationship': 'Daughter',
                },
              ],
            },
          ),
        );

        await expectLater(
          repository.getChildProfile('child-other'),
          throwsA(
            isA<Exception>().having(
              (error) => error.toString(),
              'message',
              contains('not linked'),
            ),
          ),
        );
        verifyNever(
          () => apiClient.get<dynamic>('/mobile/students/child-other/profile'),
        );
      },
    );

    test('maps report-card subject summaries from mobile API', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/students/child-1/report-cards'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/report-cards',
          ),
          data: {
            'items': [
              {
                'id': 'report-card-1',
                'academicYear': {'name': '2083'},
                'examTerm': {'name': 'First Terminal Examination'},
                'percentage': 85,
                'grade': 'A',
                'gpa': 3.7,
                'remarks': 'Strong progress',
                'classTeacherRemark': 'Keep it up',
                'attendancePercentage': 94,
                'publishedAt': '2026-06-01T00:00:00.000Z',
                'hasFile': true,
                'subjects': [
                  {
                    'subjectId': 'subject-1',
                    'subjectName': 'Mathematics',
                    'grade': 'A',
                    'percentage': 85,
                    'marksObtained': 85,
                    'maxMarks': 100,
                  },
                ],
              },
            ],
          },
        ),
      );

      final cards = await repository.getReportCardsForChild('child-1');

      expect(cards, hasLength(1));
      expect(cards.first.classTeacherRemark, 'Keep it up');
      expect(cards.first.attendancePercentage, 94);
      expect(cards.first.subjects.single.subjectName, 'Mathematics');
      expect(cards.first.subjects.single.grade, 'A');
    });

    test('maps linked-child payment gateway readiness', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/payment-gateway-readiness',
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'readiness'),
          data: {
            'enabled': true,
            'status': 'ready',
            'provider': {'name': 'NEPAL_GATEWAY'},
            'message': 'Online payment initiation is enabled.',
          },
        ),
      );

      final readiness = await repository.getPaymentGatewayReadiness('child-1');

      expect(readiness.enabled, isTrue);
      expect(readiness.providerName, 'NEPAL_GATEWAY');
      expect(readiness.status, 'ready');
    });

    test('sends an idempotent linked-child payment intent request', () async {
      when(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/payment-intents',
          data: any<dynamic>(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'payment-intents'),
          data: {
            'id': 'intent-1',
            'invoiceId': 'invoice-1',
            'provider': 'NEPAL_GATEWAY',
            'amount': 500,
            'currency': 'NPR',
            'status': 'READY',
            'checkoutUrl': 'https://gateway.test/checkout/intent-1',
          },
        ),
      );

      final intent = await repository.initiatePayment(
        childId: 'child-1',
        invoiceId: 'invoice-1',
        amount: 500,
        provider: 'NEPAL_GATEWAY',
        idempotencyKey: 'parent-payment-test-0004',
      );

      expect(intent.status, 'READY');
      expect(intent.checkoutUrl, 'https://gateway.test/checkout/intent-1');
      verify(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/payment-intents',
          data: {
            'invoiceId': 'invoice-1',
            'amount': 500,
            'provider': 'NEPAL_GATEWAY',
            'idempotencyKey': 'parent-payment-test-0004',
          },
        ),
      ).called(1);
    });
  });
}
