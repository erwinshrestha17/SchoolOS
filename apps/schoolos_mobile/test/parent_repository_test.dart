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
      expect(profile.photoUsageConsent, isTrue);
      expect(profile.dataProcessingConsent, isTrue);
      expect(profile.healthWarning, 'Asthma / Peanuts');
      expect(profile.canViewHealthWarning, isTrue);
      expect(profile.guardianSummary, contains('Daughter access verified'));
      expect(profile.qrLabel, contains('SCH-2026-001'));
    });
  });
}
