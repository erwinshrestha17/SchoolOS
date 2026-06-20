import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/features/principal/data/principal_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('PrincipalRepository', () {
    late MockApiClient apiClient;

    setUp(() {
      apiClient = MockApiClient();
    });

    test(
      'loads principal dashboard from purpose-limited mobile endpoint',
      () async {
        when(
          () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/mobile/principal/dashboard'),
            data: {
              'attentionCount': 2,
              'cards': [
                {'key': 'approvals', 'label': 'Approvals', 'value': 2},
              ],
              'modules': {'fees': true},
            },
          ),
        );

        final repository = PrincipalRepository(apiClient);
        final dashboard = await repository.getDashboard();

        expect(dashboard['attentionCount'], 2);
        expect(dashboard['_mobileFromCache'], isFalse);
        verify(
          () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
        ).called(1);
      },
    );

    test('uses cached read-only principal dashboard when offline', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = PrivateReadCache(
        AppPreferencesService(await SharedPreferences.getInstance()),
      );
      await cache.write('principal_dashboard', {
        'attentionCount': 1,
        'modules': {'attendance': true},
      });
      when(
        () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
      ).thenThrow(const NetworkException());

      final repository = PrincipalRepository(apiClient, cache: cache);
      final dashboard = await repository.getDashboard();

      expect(dashboard['attentionCount'], 1);
      expect(dashboard['_mobileFromCache'], isTrue);
    });

    test('loads the purpose-limited admissions snapshot', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/principal/admissions-summary'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/principal/admissions-summary',
          ),
          data: {
            'metrics': {
              'waitingForReview': 2,
              'approvedReadyToAdmit': 1,
              'documentsPending': 3,
              'duplicateWarnings': 1,
              'iemisFollowUp': 4,
            },
            'items': [
              {
                'id': 'waiting-review',
                'title': 'Admissions needing review',
                'detail': '2 cases awaiting a school decision',
              },
            ],
          },
        ),
      );

      final repository = PrincipalRepository(apiClient);
      final summary = await repository.getAdmissionsSummary();

      expect(summary['metrics']['waitingForReview'], 2);
      expect(summary['_mobileFromCache'], isFalse);
      verify(
        () => apiClient.get<dynamic>('/mobile/principal/admissions-summary'),
      ).called(1);
    });
  });
}
