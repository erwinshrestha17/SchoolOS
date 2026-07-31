import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/network/api_path_resolver.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_action_centre_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_service_request_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_weekly_progress_models.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    registerFallbackValue(Options());
  });

  group('ParentRepository', () {
    late MockApiClient apiClient;
    late MockDio dio;
    late ParentRepository repository;
    late Directory tempDir;

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
      dio = MockDio();
      when(() => apiClient.dio).thenReturn(dio);
      // Delegate to the real resolver so these tests exercise the production
      // rule that backend-supplied file URLs are reduced to an API-relative
      // path before the authenticated client requests them.
      when(
        () => apiClient.toApiPath(
          any(),
          unavailableMessage: any(named: 'unavailableMessage'),
        ),
      ).thenAnswer(
        (invocation) => resolveApiPath(
          invocation.positionalArguments.first as String,
          baseUrl: 'https://api.schoolos.test/api/v1',
          unavailableMessage:
              invocation.namedArguments[#unavailableMessage] as String,
        ),
      );
      repository = ParentRepository(apiClient);
      tempDir = Directory.systemTemp.createTempSync('schoolos_parent_test_');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (call) async {
              if (call.method == 'getTemporaryDirectory') {
                return tempDir.path;
              }
              return null;
            },
          );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            null,
          );
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test(
      'loads the live action centre with an optional linked-child scope',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/me/action-centre',
            queryParameters: {'studentId': 'child-1'},
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/mobile/me/action-centre'),
            data: {
              'generatedAt': '2026-07-26T10:00:00.000Z',
              'dataState': 'LIVE',
              'scope': {
                'selectedStudentId': 'child-1',
                'children': [
                  {
                    'id': 'child-1',
                    'name': 'Asha Rai',
                    'classSection': 'Grade 4 - A',
                  },
                ],
              },
              'summary': {
                'visibleActionCount': 1,
                'urgentCount': 0,
                'returnedCount': 1,
                'isPartial': false,
              },
              'items': [
                {
                  'id': 'fee:child-1:invoice-1',
                  'source': 'fees',
                  'type': 'FEE_DUE',
                  'priority': 'HIGH',
                  'title': 'Fee balance for INV-001',
                  'description': 'NPR 500.00 remains due.',
                  'child': {
                    'id': 'child-1',
                    'name': 'Asha Rai',
                    'classSection': 'Grade 4 - A',
                  },
                  'dueAt': '2026-07-30T00:00:00.000Z',
                  'isOverdue': false,
                  'action': {
                    'label': 'Review fees',
                    'route': '/parent/fees?child=child-1',
                  },
                },
              ],
              'truncated': false,
              'sources': {
                'fees': {'status': 'available', 'reason': null},
              },
            },
          ),
        );

        final centre = await repository.getActionCentre(studentId: 'child-1');

        expect(centre, isA<ParentActionCentre>());
        expect(centre.items.single.child?.id, 'child-1');
        expect(centre.items.single.route, '/parent/fees?child=child-1');
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/me/action-centre',
            queryParameters: {'studentId': 'child-1'},
          ),
        ).called(1);
      },
    );

    test(
      'loads a live linked-child weekly digest without a device cache',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/weekly-progress',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/students/child-1/weekly-progress',
            ),
            data: {
              'generatedAt': '2026-07-26T10:00:00.000Z',
              'dataState': 'LIVE',
              'student': {
                'id': 'child-1',
                'name': 'Asha Rai',
                'classSection': 'Grade 4 - A',
              },
              'period': {
                'startAt': '2026-07-19T10:00:00.000Z',
                'endAt': '2026-07-26T10:00:00.000Z',
                'upcomingEndAt': '2026-08-02T10:00:00.000Z',
                'days': 7,
              },
              'attendance': {
                'availability': 'EMPTY',
                'recordedDays': 0,
                'presentDays': 0,
                'absentDays': 0,
                'lateDays': 0,
                'excusedDays': 0,
                'attendanceRate': null,
              },
              'homework': {
                'availability': 'EMPTY',
                'requiredCount': 0,
                'completedCount': 0,
                'needsFollowUpCount': 0,
                'completionRate': null,
              },
              'academicTrend': {
                'availability': 'UNAVAILABLE',
                'direction': null,
                'changePoints': null,
                'current': null,
                'previous': null,
                'reason': 'Comparable published results are not available.',
              },
              'teacherComments': [],
              'upcomingDeadlines': [],
              'requiredActions': [],
              'sources': {
                'attendance': {
                  'status': 'empty',
                  'reason': 'No attendance was recorded.',
                },
              },
              'isPartial': false,
            },
          ),
        );

        final progress = await repository.getWeeklyProgress('child-1');

        expect(progress, isA<ParentWeeklyProgress>());
        expect(progress.student.id, 'child-1');
        expect(progress.attendance.attendanceRate, isNull);
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/weekly-progress',
          ),
        ).called(1);
      },
    );

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
              'documents': [
                {
                  'id': 'doc-1',
                  'title': 'Birth certificate',
                  'fileName': 'birth.pdf',
                  'kind': 'BIRTH_CERTIFICATE',
                  'status': 'VERIFIED',
                  'mimeType': 'application/pdf',
                  'sizeBytes': 1200,
                  'downloadPath':
                      '/mobile/students/child-1/documents/doc-1/download-url',
                  'verifiedAt': '2026-04-02T00:00:00.000Z',
                  'objectKey': 'must-not-map',
                },
              ],
              'qrStatus': {
                'status': 'ACTIVE',
                'credentialId': 'qr-1',
                'createdAt': '2026-04-03T00:00:00.000Z',
                'tokenHash': 'must-not-map',
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
      expect(profile.qrLabel, contains('Student QR is active'));
      expect(profile.qrStatus?.isActive, isTrue);
      expect(profile.qrStatus?.credentialId, 'qr-1');
      expect(profile.documents.single.title, 'Birth certificate');
      expect(profile.documents.single.downloadPath, contains('/download-url'));
      expect(profile.documents.single.hasProtectedDownload, isTrue);
      expect(
        profile.documents.single.downloadPath,
        isNot(contains('must-not-map')),
      );
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

    test(
      'downloads activity media only through the protected API path',
      () async {
        when(
          () => apiClient.get<List<int>>(
            '/activity-feed/attachments/attachment-1/preview',
            options: any(named: 'options'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'activity-preview'),
            data: [0xff, 0xd8, 0xff, 0xd9],
          ),
        );

        final bytes = await repository.getActivityPreview(
          '/activity-feed/attachments/attachment-1/preview',
        );

        expect(bytes, [0xff, 0xd8, 0xff, 0xd9]);
        verify(
          () => apiClient.get<List<int>>(
            '/activity-feed/attachments/attachment-1/preview',
            options: any(named: 'options'),
          ),
        ).called(1);
      },
    );

    test(
      'downloads activity thumbnails only through the protected path',
      () async {
        when(
          () => apiClient.get<List<int>>(
            '/activity-feed/attachments/attachment-1/thumbnail',
            options: any(named: 'options'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: 'activity-thumbnail'),
            data: [0x52, 0x49, 0x46, 0x46],
          ),
        );

        final bytes = await repository.getActivityThumbnail(
          '/activity-feed/attachments/attachment-1/thumbnail',
        );

        expect(bytes, [0x52, 0x49, 0x46, 0x46]);
        verify(
          () => apiClient.get<List<int>>(
            '/activity-feed/attachments/attachment-1/thumbnail',
            options: any(named: 'options'),
          ),
        ).called(1);
      },
    );

    test('maps the linked-child published exam schedule', () async {
      when(
        () => apiClient.get<dynamic>('/mobile/students/child-1/exam-schedule'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'exam-schedule'),
          data: {
            'academicYear': {'id': 'year-1', 'name': '2083/84'},
            'items': [
              {
                'id': 'exam-slot-1',
                'examTerm': {'id': 'term-1', 'name': 'First Terminal'},
                'subject': {
                  'id': 'subject-1',
                  'name': 'Mathematics',
                  'code': 'MATH',
                },
                'startsAt': '2026-07-10T03:30:00.000Z',
                'endsAt': '2026-07-10T04:30:00.000Z',
                'room': 'Room 4',
                'publishedAt': '2026-07-01T00:00:00.000Z',
              },
            ],
          },
        ),
      );

      final schedule = await repository.getExamScheduleForChild('child-1');

      expect(schedule.academicYearName, '2083/84');
      expect(schedule.items, hasLength(1));
      expect(schedule.items.single.subjectName, 'Mathematics');
      expect(schedule.items.single.room, 'Room 4');
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
            'confirmStudentId': 'child-1',
            'invoiceId': 'invoice-1',
            'amount': 500,
            'provider': 'NEPAL_GATEWAY',
            'idempotencyKey': 'parent-payment-test-0004',
          },
        ),
      ).called(1);
    });

    test('sends confirmStudentId on sandbox fee payment payloads', () async {
      when(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/sandbox-payments/fees',
          data: any<dynamic>(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'sandbox-payments/fees'),
          data: {
            'status': 'CONFIRMED',
            'provider': 'SANDBOX',
            'amount': 500,
            'receiptNumber': 'RCPT-001',
          },
        ),
      );

      final result = await repository.payInvoiceInSandbox(
        childId: 'child-1',
        invoiceId: 'invoice-1',
        amount: 500,
        provider: 'SANDBOX',
        idempotencyKey: 'parent-sandbox-fee-0001',
      );

      expect(result.status, 'CONFIRMED');
      expect(result.receiptNumber, 'RCPT-001');
      verify(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/sandbox-payments/fees',
          data: {
            'confirmStudentId': 'child-1',
            'invoiceId': 'invoice-1',
            'amount': 500,
            'provider': 'SANDBOX',
            'idempotencyKey': 'parent-sandbox-fee-0001',
          },
        ),
      ).called(1);
    });

    test('sends confirmStudentId on sandbox canteen top-up payloads', () async {
      when(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/sandbox-payments/canteen-top-up',
          data: any<dynamic>(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: 'sandbox-payments/canteen-top-up',
          ),
          data: {
            'status': 'CONFIRMED',
            'provider': 'SANDBOX',
            'amount': 200,
            'wallet': {'balance': 1200},
          },
        ),
      );

      final result = await repository.topUpCanteenInSandbox(
        childId: 'child-1',
        amount: 200,
        provider: 'SANDBOX',
        idempotencyKey: 'parent-sandbox-topup-0001',
      );

      expect(result.status, 'CONFIRMED');
      expect(result.walletBalance, 1200);
      verify(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/sandbox-payments/canteen-top-up',
          data: {
            'confirmStudentId': 'child-1',
            'amount': 200,
            'provider': 'SANDBOX',
            'idempotencyKey': 'parent-sandbox-topup-0001',
          },
        ),
      ).called(1);
    });

    test('sends confirmStudentId on consent decision payloads', () async {
      when(
        () => apiClient.post<dynamic>(
          '/mobile/me/consents/decision',
          data: any<dynamic>(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'consents/decision'),
          data: const {},
        ),
      );

      await repository.decideMyConsent(
        childId: 'child-1',
        consentType: 'PHOTO_USAGE',
        version: '2026-01',
        granted: true,
      );

      verify(
        () => apiClient.post<dynamic>(
          '/mobile/me/consents/decision',
          data: {
            'confirmStudentId': 'child-1',
            'consentType': 'PHOTO_USAGE',
            'version': '2026-01',
            'granted': true,
          },
        ),
      ).called(1);
    });

    test(
      'passes category and month filters to the activity feed endpoint',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/activity-feed',
            queryParameters: any(named: 'queryParameters'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/students/child-1/activity-feed',
            ),
            data: {'items': <dynamic>[]},
          ),
        );

        await repository.getActivityFeedForChild(
          'child-1',
          category: 'LEARNING',
          month: '2026-07',
        );

        verify(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/activity-feed',
            queryParameters: {
              'take': '20',
              'category': 'LEARNING',
              'month': '2026-07',
            },
          ),
        ).called(1);
      },
    );

    test('marks an activity seen as the authenticated guardian', () async {
      when(
        () => apiClient.post<dynamic>(
          '/activity-feed/posts/post-1/reactions',
          data: {'reaction': 'SEEN', 'guardianId': 'guardian-1'},
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/activity-feed/posts/post-1/reactions',
          ),
          data: {'id': 'reaction-1'},
        ),
      );

      await repository.markActivitySeen(
        postId: 'post-1',
        guardianId: 'guardian-1',
      );

      verify(
        () => apiClient.post<dynamic>(
          '/activity-feed/posts/post-1/reactions',
          data: {'reaction': 'SEEN', 'guardianId': 'guardian-1'},
        ),
      ).called(1);
    });

    test('maps developmental milestones for the linked child', () async {
      when(
        () => apiClient.get<dynamic>(
          '/activity-feed/milestones',
          queryParameters: any(named: 'queryParameters'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/activity-feed/milestones'),
          data: [
            {
              'id': 'milestone-1',
              'domain': 'Motor skills',
              'milestone': 'Uses classroom materials independently',
              'status': 'PROGRESSING',
              'observedAt': '2026-06-01T00:00:00.000Z',
              'observationNote': 'Needs occasional prompting.',
            },
          ],
        ),
      );

      final milestones = await repository.getMilestonesForChild('child-1');

      expect(milestones, hasLength(1));
      expect(milestones.single.domain, 'Motor skills');
      expect(milestones.single.status, 'PROGRESSING');
    });

    test(
      'downloads a student document through the signed download-url flow',
      () async {
        const document = ParentStudentDocument(
          id: 'doc-1',
          title: 'Birth certificate',
          fileName: 'birth.pdf',
          kind: 'BIRTH_CERTIFICATE',
          status: 'VERIFIED',
          mimeType: 'application/pdf',
          sizeBytes: 1200,
          downloadPath: '/mobile/students/child-1/documents/doc-1/download-url',
        );

        when(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/documents/doc-1/download-url',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: ''),
            data: {
              'documentId': 'doc-1',
              'fileName': 'birth.pdf',
              'kind': 'BIRTH_CERTIFICATE',
              'url': 'https://files.example.test/signed/doc-1',
              'expiresInSeconds': 60,
            },
          ),
        );
        // The backend advertises an absolute URL. Only its path may be used:
        // requesting the advertised host with the authenticated client would
        // hand the session bearer token to that host.
        when(
          () => apiClient.get<List<int>>(
            '/signed/doc-1',
            options: any(named: 'options'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: ''),
            data: List<int>.filled(8, 1),
          ),
        );

        final file = await repository.downloadStudentDocument(
          childId: 'child-1',
          document: document,
        );

        expect(file.fileName, 'birth.pdf');
        expect(file.filePath, contains('birth.pdf'));

        verify(
          () => apiClient.get<dynamic>(
            '/mobile/students/child-1/documents/doc-1/download-url',
          ),
        ).called(1);
        verify(
          () => apiClient.get<List<int>>(
            '/signed/doc-1',
            options: any(named: 'options'),
          ),
        ).called(1);
        verifyNever(
          () => dio.get<List<int>>(
            any(that: contains('files.example.test')),
            options: any(named: 'options'),
          ),
        );
      },
    );

    test('maps the linked-child service-request lifecycle', () async {
      when(
        () =>
            apiClient.get<dynamic>('/mobile/students/child-1/service-requests'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'service-requests'),
          data: {
            'items': [
              {
                'id': 'request-1',
                'student': {
                  'id': 'child-1',
                  'name': 'Asha Rai',
                  'classSection': 'Grade 4 - A',
                },
                'type': 'PAYMENT_DISPUTE',
                'category': 'FEES_AND_PAYMENTS',
                'priority': 'HIGH',
                'subject': 'Payment not reflected',
                'description': 'The bank payment is not shown on the invoice.',
                'status': 'IN_PROGRESS',
                'invoice': {
                  'id': 'invoice-1',
                  'invoiceNumber': 'INV-001',
                  'status': 'PARTIAL',
                  'totalAmount': 1200,
                  'dueDate': '2026-07-30T00:00:00.000Z',
                },
                'responder': {'name': 'School Accounts'},
                'responseDeadline': '2026-07-28T00:00:00.000Z',
                'isOverdue': false,
                'resolutionSummary': null,
                'notes': [
                  {
                    'id': 'note-1',
                    'body': 'The accounts team is checking the statement.',
                    'author': 'School Accounts',
                    'createdAt': '2026-07-26T00:00:00.000Z',
                  },
                ],
                'attachments': [
                  {
                    'id': 'attachment-1',
                    'fileName': 'bank-slip.jpg',
                    'mimeType': 'image/jpeg',
                    'sizeBytes': 1200,
                    'label': 'Parent evidence',
                    'downloadPath':
                        '/mobile/service-requests/request-1/attachments/attachment-1',
                    'createdAt': '2026-07-26T00:00:00.000Z',
                  },
                ],
                'actions': {
                  'cancel': false,
                  'confirmResolution': false,
                  'reopen': false,
                  'addEvidence': true,
                },
                'createdAt': '2026-07-26T00:00:00.000Z',
                'updatedAt': '2026-07-26T00:00:00.000Z',
              },
            ],
            'total': 1,
          },
        ),
      );

      final result = await repository.getServiceRequestsForChild('child-1');

      expect(result.total, 1);
      expect(result.items.single.isPaymentDispute, isTrue);
      expect(result.items.single.invoice?.invoiceNumber, 'INV-001');
      expect(result.items.single.notes.single.author, 'School Accounts');
      expect(result.items.single.canAddEvidence, isTrue);
    });

    test('sends a payment dispute with a stable idempotency key', () async {
      when(
        () => apiClient.post<Map<String, dynamic>>(
          '/mobile/students/child-1/service-requests',
          data: any<dynamic>(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: 'service-requests'),
          data: _serviceRequestJson(),
        ),
      );

      final request = await repository.createServiceRequest(
        childId: 'child-1',
        type: 'PAYMENT_DISPUTE',
        category: 'FEES_AND_PAYMENTS',
        priority: 'NORMAL',
        subject: 'Payment not reflected',
        description: 'The bank payment is not shown on the invoice.',
        invoiceId: 'invoice-1',
        idempotencyKey: '41d743bb-9d72-4d0e-b2c4-a9ead27e1501',
      );

      expect(request.id, 'request-1');
      verify(
        () => apiClient.post<Map<String, dynamic>>(
          '/mobile/students/child-1/service-requests',
          data: {
            'confirmStudentId': 'child-1',
            'type': 'PAYMENT_DISPUTE',
            'category': 'FEES_AND_PAYMENTS',
            'priority': 'NORMAL',
            'subject': 'Payment not reflected',
            'description': 'The bank payment is not shown on the invoice.',
            'idempotencyKey': '41d743bb-9d72-4d0e-b2c4-a9ead27e1501',
            'invoiceId': 'invoice-1',
          },
        ),
      ).called(1);
    });

    test(
      'refuses a backend-supplied service-request attachment path that does not match its records',
      () async {
        final request = ParentServiceRequest.fromJson(_serviceRequestJson());
        final attachment = ParentServiceRequestAttachment(
          id: 'attachment-1',
          fileName: 'evidence.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1200,
          downloadPath: 'https://untrusted.test/evidence.jpg',
          createdAt: DateTime(2026),
        );

        await expectLater(
          repository.downloadServiceRequestEvidence(
            request: request,
            attachment: attachment,
          ),
          throwsA(isA<Exception>()),
        );
        verifyNever(
          () => apiClient.get<List<int>>(any(), options: any(named: 'options')),
        );
      },
    );
  });
}

Map<String, dynamic> _serviceRequestJson() {
  return {
    'id': 'request-1',
    'student': {
      'id': 'child-1',
      'name': 'Asha Rai',
      'classSection': 'Grade 4 - A',
    },
    'type': 'PAYMENT_DISPUTE',
    'category': 'FEES_AND_PAYMENTS',
    'priority': 'NORMAL',
    'subject': 'Payment not reflected',
    'description': 'The bank payment is not shown on the invoice.',
    'status': 'OPEN',
    'invoice': {
      'id': 'invoice-1',
      'invoiceNumber': 'INV-001',
      'status': 'PARTIAL',
      'totalAmount': 1200,
      'dueDate': '2026-07-30T00:00:00.000Z',
    },
    'responseDeadline': '2026-07-31T00:00:00.000Z',
    'isOverdue': false,
    'notes': <dynamic>[],
    'attachments': <dynamic>[],
    'actions': {
      'cancel': true,
      'confirmResolution': false,
      'reopen': false,
      'addEvidence': true,
    },
    'createdAt': '2026-07-26T00:00:00.000Z',
    'updatedAt': '2026-07-26T00:00:00.000Z',
  };
}
