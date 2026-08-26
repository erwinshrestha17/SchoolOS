import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/sync/school_authority_discovery.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  test('caches the school authority fence from /sync/authority', () async {
    final apiClient = MockApiClient();
    when(() => apiClient.get<dynamic>('/sync/authority')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/sync/authority'),
        data: {'authorityNodeId': 'cloud', 'authorityEpoch': 1},
      ),
    );

    final discovery = SchoolAuthorityDiscovery(apiClient);
    final fence = await discovery.refresh();

    expect(fence?.authorityNodeId, 'cloud');
    expect(fence?.authorityEpoch, 1);
    expect(discovery.fields()['authorityNodeId'], 'cloud');
    expect(discovery.fields()['authorityEpoch'], 1);
  });

  test('keeps the last trusted fence when discovery is unreachable', () async {
    final apiClient = MockApiClient();
    when(() => apiClient.get<dynamic>('/sync/authority')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/sync/authority'),
        data: {'authorityNodeId': 'cloud', 'authorityEpoch': 2},
      ),
    );
    final discovery = SchoolAuthorityDiscovery(apiClient);
    await discovery.refresh();

    when(
      () => apiClient.get<dynamic>('/sync/authority'),
    ).thenThrow(Exception('offline'));
    final cached = await discovery.refresh();
    expect(cached?.authorityEpoch, 2);
  });
}
