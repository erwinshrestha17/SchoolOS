import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
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

    test('keeps principal dashboard network-only when offline without cache',
        () async {
      when(
        () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
      ).thenThrow(const NetworkException());

      final repository = PrincipalRepository(apiClient);

      await expectLater(
        repository.getDashboard(),
        throwsA(isA<NetworkException>()),
      );
    });

    test('returns cached principal dashboard after a successful fetch',
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
          },
        ),
      );

      final cache = PrivateReadCache(
        _MemorySecureStore(),
        scope: PrivateReadCacheScope(
          tenantId: 'tenant-1',
          userId: 'principal-1',
          role: 'PRINCIPAL',
        ),
      );
      final repository = PrincipalRepository(apiClient, cache: cache);
      final online = await repository.getDashboard();
      expect(online['_mobileFromCache'], isFalse);

      when(
        () => apiClient.get<dynamic>('/mobile/principal/dashboard'),
      ).thenThrow(const NetworkException());

      final offline = await repository.getDashboard();
      expect(offline['attentionCount'], 2);
      expect(offline['_mobileFromCache'], isTrue);
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
      'loads and triages parent requests through principal mobile contracts',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/principal/service-requests',
            queryParameters: any(named: 'queryParameters'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'service-requests'),
            data: {
              'items': [
                {'id': 'request-1', 'status': 'OPEN'},
              ],
              'total': 1,
              'page': 1,
            },
          ),
        );
        when(
          () => apiClient.post<dynamic>(
            '/mobile/principal/service-requests/request-1/triage-self',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'triage-self'),
            data: {'id': 'request-1', 'status': 'IN_PROGRESS'},
          ),
        );

        final repository = PrincipalRepository(apiClient);
        final queue = await repository.getServiceRequests(status: 'OPEN');
        final result = await repository.triageServiceRequest(
          requestId: 'request-1',
          priority: 'HIGH',
          responseDeadline: '2026-07-28T00:00:00.000Z',
          status: 'IN_PROGRESS',
          reason: 'Principal accepted the parent follow-up.',
        );

        expect(queue['total'], 1);
        expect(result['status'], 'IN_PROGRESS');
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/principal/service-requests',
            queryParameters: {'status': 'OPEN', 'page': 1, 'limit': 50},
          ),
        ).called(1);
        verify(
          () => apiClient.post<dynamic>(
            '/mobile/principal/service-requests/request-1/triage-self',
            data: {
              'priority': 'HIGH',
              'responseDeadline': '2026-07-28T00:00:00.000Z',
              'status': 'IN_PROGRESS',
              'reason': 'Principal accepted the parent follow-up.',
            },
          ),
        ).called(1);
      },
    );

    test('escalates parent requests with required assignee id', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/principal/service-requests/request-1/escalation-candidates',
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'escalation-candidates'),
          data: {
            'items': [
              {'id': 'manager-2', 'name': 'Coordinator One'},
            ],
            'total': 1,
          },
        ),
      );
      when(
        () => apiClient.post<dynamic>(
          '/mobile/principal/service-requests/request-1/escalate',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'escalate'),
          data: {'id': 'request-1', 'status': 'ASSIGNED', 'priority': 'HIGH'},
        ),
      );

      final repository = PrincipalRepository(apiClient);
      final result = await repository.escalateServiceRequest(
        requestId: 'request-1',
        reason: 'Needs coordinator review after fee office reply.',
        assignedToUserId: 'manager-2',
      );

      expect(result['priority'], 'HIGH');
      final captured =
          verify(
                () => apiClient.post<dynamic>(
                  '/mobile/principal/service-requests/request-1/escalate',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(captured, {
        'reason': 'Needs coordinator review after fee office reply.',
        'assignedToUserId': 'manager-2',
      });
    });

    test('rejects an untrusted request-evidence download path', () async {
      final repository = PrincipalRepository(apiClient);

      await expectLater(
        repository.downloadServiceRequestEvidence(
          requestId: 'request-1',
          attachmentId: 'attachment-1',
          downloadPath: 'https://untrusted.test/evidence.jpg',
          fileName: 'evidence.jpg',
          mimeType: 'image/jpeg',
        ),
        throwsA(isA<ValidationException>()),
      );
    });

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

    test(
      'records and updates walkthroughs through the purpose-limited contract',
      () async {
        when(
          () => apiClient.post<dynamic>(
            '/mobile/principal/classroom-walkthroughs',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'classroom-walkthroughs'),
            data: {'id': 'observation-1', 'status': 'DRAFT'},
          ),
        );
        when(
          () => apiClient.patch<dynamic>(
            '/mobile/principal/classroom-walkthroughs/observation-1',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'observation-1'),
            data: {'id': 'observation-1', 'status': 'COMPLETED'},
          ),
        );

        final repository = PrincipalRepository(apiClient);
        await repository.createClassroomWalkthrough(
          teacherStaffId: 'staff-1',
          academicYearId: 'year-1',
          observedOn: '2026-07-28',
          strengths: 'Learners explained their reasoning clearly.',
          developmentFocus: 'Check every group before independent work.',
          agreedAction: 'Use two planned understanding checks.',
          followUpOn: '2026-08-12',
          clientRequestId: '11111111-1111-4111-8111-111111111112',
        );
        final result = await repository.updateClassroomWalkthrough(
          observationId: 'observation-1',
          expectedVersion: 1,
          status: 'COMPLETED',
          reason: 'Feedback discussion completed with the teacher.',
        );

        expect(result['status'], 'COMPLETED');
        final createBody =
            verify(
                  () => apiClient.post<dynamic>(
                    '/mobile/principal/classroom-walkthroughs',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(createBody['clientRequestId'], isNotEmpty);
        expect(createBody['teacherStaffId'], 'staff-1');
        verify(
          () => apiClient.patch<dynamic>(
            '/mobile/principal/classroom-walkthroughs/observation-1',
            data: {
              'expectedVersion': 1,
              'status': 'COMPLETED',
              'reason': 'Feedback discussion completed with the teacher.',
            },
          ),
        ).called(1);
      },
    );

    test('loads school plans and updates owned actions online', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/principal/school-improvement-plans',
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'school-improvement-plans'),
          data: {
            'items': [
              {'id': 'plan-1', 'status': 'ACTIVE'},
            ],
            'total': 1,
          },
        ),
      );
      when(
        () => apiClient.patch<dynamic>(
          '/mobile/principal/school-improvement-actions/action-1',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'action-1'),
          data: {'id': 'action-1', 'status': 'IN_PROGRESS'},
        ),
      );

      final repository = PrincipalRepository(apiClient);
      final plans = await repository.getSchoolImprovementPlans();
      final action = await repository.updateSchoolImprovementAction(
        actionId: 'action-1',
        expectedVersion: 2,
        status: 'IN_PROGRESS',
        reason: 'The assigned team has started the agreed work.',
        progressNote: 'First review is scheduled.',
      );

      expect(plans['total'], 1);
      expect(action['status'], 'IN_PROGRESS');
      verify(
        () => apiClient.patch<dynamic>(
          '/mobile/principal/school-improvement-actions/action-1',
          data: {
            'expectedVersion': 2,
            'status': 'IN_PROGRESS',
            'reason': 'The assigned team has started the agreed work.',
            'progressNote': 'First review is scheduled.',
          },
        ),
      ).called(1);
    });

    test(
      'loads each board readiness track without a predictive payload',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/principal/board-exam-readiness/SEE',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'board-readiness'),
            data: {
              'track': 'SEE',
              'nonPredictive': true,
              'indicators': [
                {'code': 'MARKS_COMPLETION', 'state': 'NEEDS_ATTENTION'},
              ],
            },
          ),
        );

        final result = await PrincipalRepository(
          apiClient,
        ).getBoardExamReadiness('SEE');

        expect(result['track'], 'SEE');
        expect(result['nonPredictive'], isTrue);
        expect(result.containsKey('predictedScore'), isFalse);
      },
    );
  });
}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }

  @override
  Future<void> clearAll() async {
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}
