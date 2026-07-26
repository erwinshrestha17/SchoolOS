import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/principal/data/principal_repository.dart';

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

    test('keeps principal dashboard network-only when offline', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
      ).thenThrow(const NetworkException());

      final repository = PrincipalRepository(apiClient);

      await expectLater(
        repository.getDashboard(),
        throwsA(isA<NetworkException>()),
      );
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

    test('submits principal approval decisions with idempotency', () async {
      when(
        () => apiClient.post<dynamic>(
          '/mobile/principal/approvals/approval-1/decisions',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/principal/approvals/approval-1/decisions',
          ),
          data: {'id': 'approval-1', 'status': 'APPLIED'},
        ),
      );

      final repository = PrincipalRepository(apiClient);
      final result = await repository.decideApproval(
        approvalRequestId: 'approval-1',
        decision: 'APPROVE',
        reason: 'Reviewed on mobile.',
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      );

      expect(result['status'], 'APPLIED');
      final captured =
          verify(
                () => apiClient.post<dynamic>(
                  '/mobile/principal/approvals/approval-1/decisions',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(captured, {
        'decision': 'APPROVE',
        'reason': 'Reviewed on mobile.',
        'idempotencyKey': '33333333-3333-4333-8333-333333333333',
      });
    });

    test(
      'loads candidates and delegates through purpose-limited contracts',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/principal/approvals/approval-1/delegation-candidates',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path:
                  '/mobile/principal/approvals/approval-1/delegation-candidates',
            ),
            data: {
              'items': [
                {'id': 'user-2', 'name': 'Sita Shrestha'},
              ],
            },
          ),
        );
        when(
          () => apiClient.post<dynamic>(
            '/mobile/principal/approvals/approval-1/delegation',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/principal/approvals/approval-1/delegation',
            ),
            data: {'id': 'approval-1', 'status': 'PENDING'},
          ),
        );

        final repository = PrincipalRepository(apiClient);
        final candidates = await repository.getApprovalDelegationCandidates(
          'approval-1',
        );
        final result = await repository.delegateApproval(
          approvalRequestId: 'approval-1',
          delegatedToUserId: 'user-2',
          reason: 'Covering the school visit.',
        );

        expect((candidates['items'] as List).single['id'], 'user-2');
        expect(result['status'], 'PENDING');
        final captured =
            verify(
                  () => apiClient.post<dynamic>(
                    '/mobile/principal/approvals/approval-1/delegation',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(captured, {
          'delegatedToUserId': 'user-2',
          'reason': 'Covering the school visit.',
        });
      },
    );

    test(
      'previews and submits emergency notices through mobile contracts',
      () async {
        when(
          () => apiClient.post<dynamic>(
            '/mobile/principal/emergency-notices/recipient-preview',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/principal/emergency-notices/recipient-preview',
            ),
            data: {
              'recipients': {'eligible': 10, 'total': 12},
              'canSubmit': true,
            },
          ),
        );
        when(
          () => apiClient.post<dynamic>(
            '/mobile/principal/emergency-notices',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/principal/emergency-notices',
            ),
            data: {'id': 'notice-1', 'state': 'AWAITING_APPROVAL'},
          ),
        );

        final repository = PrincipalRepository(apiClient);
        final preview = await repository.previewEmergencyNoticeRecipients(
          title: 'School closure',
          body: 'School is closed today due to an emergency.',
          priority: 'EMERGENCY',
          audienceType: 'ALL',
        );
        final submitted = await repository.submitEmergencyNotice(
          title: 'School closure',
          body: 'School is closed today due to an emergency.',
          priority: 'EMERGENCY',
          audienceType: 'ALL',
          sendMode: 'SEND_NOW',
          reason: 'Immediate safety notice.',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        );

        expect(preview['canSubmit'], isTrue);
        expect(submitted['state'], 'AWAITING_APPROVAL');
        final submitBody =
            verify(
                  () => apiClient.post<dynamic>(
                    '/mobile/principal/emergency-notices',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(submitBody['priority'], 'EMERGENCY');
        expect(submitBody['audienceType'], 'ALL');
        expect(submitBody['idempotencyKey'], isNotEmpty);
      },
    );
  });
}
