import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_feature_state.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_calendar_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_canteen_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_consents_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_fees_receipts_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_fees_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_home_tab.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_library_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_report_cards_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_transport_screen.dart';

class _TestTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => 'test-token';

  @override
  Future<String?> getRefreshToken() async => null;
}

class _ParentScreenApiClient extends ApiClient {
  _ParentScreenApiClient() : super(tokenStorage: _TestTokenStorage());

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return Response<T>(
      data: _payload(path) as T,
      requestOptions: RequestOptions(path: path),
    );
  }

  Map<String, dynamic> _payload(String path) {
    if (path == '/mobile/me/students') {
      return {
        'items': [_child],
      };
    }
    if (path == '/mobile/me/dashboard') {
      return _dashboard;
    }
    if (path == '/mobile/students/child-1/profile') {
      return {
        'profile': {
          'studentSystemId': 'STU-001',
          'privacy': {
            'photoUsageConsent': false,
            'dataProcessingConsent': true,
          },
        },
      };
    }
    if (path == '/mobile/students/child-1/report-cards') {
      return {
        'items': [
          {
            'id': 'report-1',
            'examName': 'Term 1',
            'status': 'PUBLISHED',
            'publishedAt': '2026-06-01T00:00:00.000Z',
            'fileId': null,
            'summary': {'grade': 'A'},
          },
        ],
      };
    }
    if (path == '/mobile/students/child-1/canteen') {
      return {
        'wallet': {
          'balance': 450,
          'lowBalanceThreshold': 200,
          'isLowBalance': false,
        },
        'activeMealPlans': [],
        'recentTransactions': [],
        'menuItems': [],
      };
    }
    if (path == '/mobile/students/child-1/transport') {
      return {
        'assignment': {
          'status': 'ACTIVE',
          'route': {'name': 'Route A', 'code': 'A'},
          'stop': {'name': 'Gate 1', 'sequence': 1},
        },
        'activeTrip': {
          'status': 'ACTIVE',
          'studentStatus': 'BOARDED',
          'direction': 'PICKUP',
          'route': {'name': 'Route A', 'code': 'A'},
          'vehicle': {'registrationNumber': 'BA-1-PA-1234'},
          'latestLocation': {
            'latitude': 27.7,
            'longitude': 85.3,
            'recordedAt': '2026-06-30T00:00:00.000Z',
            'ageSeconds': 1080,
            'confidence': 'stale',
            'isStale': true,
          },
        },
      };
    }
    if (path == '/mobile/students/child-1/library') {
      return {'activeIssues': [], 'recentHistory': [], 'fines': []};
    }
    if (path == '/mobile/students/child-1/payment-gateway-readiness') {
      return {
        'enabled': false,
        'status': 'not_configured',
        'provider': null,
        'providers': [],
        'sandbox': false,
        'message': 'Online payments are not enabled for this school.',
      };
    }
    return {};
  }

  static const _child = {
    'id': 'child-1',
    'name': 'Asha Rai',
    'classSection': 'Grade 4 - A',
    'rollNumber': '7',
    'academicYear': '2026',
    'relationship': 'Daughter',
  };

  static const _dashboard = {
    'selectedStudent': _child,
    'attendance': {
      'today': {'label': 'Present today'},
    },
    'homework': {'pendingCount': 0, 'nextDueAt': null},
    'fees': {
      'totalOutstanding': 1200,
      'overdueCount': 0,
      'nextDueDate': '2026-06-25T00:00:00.000Z',
      'recentInvoices': [
        {
          'id': 'invoice-1',
          'invoiceNumber': 'INV-001',
          'status': 'ISSUED',
          'totalAmount': 1200,
          'paidAmount': 0,
          'outstandingAmount': 1200,
          'isOverdue': false,
          'receipts': [],
        },
      ],
      'recentReceipts': [],
    },
    'notices': {'unreadCount': 0},
    'transport': {
      'activeTrip': {
        'studentStatus': 'WAITING',
        'route': {'name': 'Route A'},
      },
    },
    'canteen': {
      'wallet': {'balance': 450, 'isLowBalance': false},
    },
    'latestActivity': {'title': 'Class update', 'caption': 'Learning update'},
    'modules': {
      'attendance': true,
      'fees': true,
      'homework': true,
      'activity': true,
      'transport': true,
      'canteen': true,
    },
  };
}

class _ParentBigFeesApiClient extends ApiClient {
  _ParentBigFeesApiClient() : super(tokenStorage: _TestTokenStorage());

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return Response<T>(
      data: _payload(path) as T,
      requestOptions: RequestOptions(path: path),
    );
  }

  Map<String, dynamic> _payload(String path) {
    if (path == '/mobile/me/students') {
      return {
        'items': [_child],
      };
    }
    if (path == '/mobile/me/dashboard') {
      return _dashboard;
    }
    if (path == '/mobile/students/child-1/profile') {
      return {
        'profile': {
          'studentSystemId': 'STU-001',
          'privacy': {
            'photoUsageConsent': false,
            'dataProcessingConsent': true,
          },
        },
      };
    }
    if (path == '/mobile/students/child-1/payment-gateway-readiness') {
      return {
        'enabled': true,
        'status': 'ready',
        'provider': 'ESEWA',
        'providers': ['ESEWA'],
        'sandbox': true,
        'message': 'Sandbox payments are enabled for this school.',
      };
    }
    return {};
  }

  static const _child = {
    'id': 'child-1',
    'name': 'Aaradhya Chaudhary Shrestha',
    'classSection': 'Grade 10 - Science and Technology Section - Diamond',
    'rollNumber': '7',
    'academicYear': '2026',
    'relationship': 'Daughter',
  };

  static const _dashboard = {
    'selectedStudent': _child,
    'attendance': {
      'today': {'label': 'Present today'},
    },
    'homework': {'pendingCount': 0, 'nextDueAt': null},
    'fees': {
      'totalOutstanding': 12345678,
      'paidAmount': 1234567,
      'totalAmount': 13580245,
      'overdueCount': 1,
      'nextDueDate': '2026-06-25T00:00:00.000Z',
      'recentInvoices': [
        {
          'id': 'invoice-1',
          'invoiceNumber': 'INV-2026-TRIMESTER-3-ANNUAL-TUITION-AND-TRANSPORT',
          'status': 'ISSUED',
          'totalAmount': 12345678,
          'paidAmount': 0,
          'outstandingAmount': 12345678,
          'isOverdue': true,
          'receipts': [],
        },
      ],
      'recentReceipts': [],
    },
    'notices': {'unreadCount': 0},
    'transport': {
      'activeTrip': {
        'studentStatus': 'WAITING',
        'route': {'name': 'Route A'},
      },
    },
    'canteen': {
      'wallet': {'balance': 450, 'isLowBalance': false},
    },
    'latestActivity': {'title': 'Class update', 'caption': 'Learning update'},
    'modules': {
      'attendance': true,
      'fees': true,
      'homework': true,
      'activity': true,
      'transport': true,
      'canteen': true,
    },
  };
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'parent fees screen handles large currency values and long invoice numbers without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sharedPrefs = await SharedPreferences.getInstance();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            apiClientProvider.overrideWithValue(_ParentBigFeesApiClient()),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: const ParentFeesScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('NPR 12345678'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  test('parent notice state tracks local read acknowledgement only', () {
    final controller = ParentFeatureController();

    controller.markNoticeRead();

    expect(controller.state.noticeRead, isTrue);
  });

  testWidgets('new parent More screens render on a compact phone', (
    tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final screens = <Widget>[
      const ParentCalendarScreen(),
      const ParentFeesReceiptsScreen(),
      const ParentReportCardsScreen(),
      const ParentCanteenScreen(),
      const ParentTransportScreen(),
      const ParentConsentsScreen(),
      const ParentLibraryScreen(),
    ];

    for (final screen in screens) {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            apiClientProvider.overrideWithValue(_ParentScreenApiClient()),
            parentPortalDataProvider.overrideWith(
              (ref) async => ParentPortalData(
                parentName: 'Parent',
                schoolName: 'School',
                lastUpdated: DateTime(2024, 1, 1, 9, 30),
                children: const [
                  ParentPortalChild(
                    id: 'child-1',
                    name: 'Asha Rai',
                    classSection: 'Grade 4 - A',
                    teacher: 'Class teacher',
                    attendance: 'Present today',
                    attendanceTime: 'Updated now',
                    transport: 'Route A',
                    homework: 'No pending homework',
                    updates: 'No unread updates',
                  ),
                ],
                homework: [],
                updates: [
                  ParentPortalUpdate(
                    id: 'event-1',
                    category: ParentUpdateCategory.event,
                    title: 'School event',
                    body: 'Event details',
                    metadata: 'School - now',
                  ),
                ],
              ),
            ),
          ],
          child: MaterialApp(home: screen),
        ),
      );
      await tester.pumpAndSettle();
      if (screen is ParentTransportScreen) {
        expect(find.text('GPS is stale'), findsOneWidget);
        expect(find.text('Last updated 18 minutes ago'), findsOneWidget);
      }
      if (screen is ParentFeesReceiptsScreen) {
        expect(
          find.text('SchoolOS never queues fee payments offline.'),
          findsOneWidget,
        );
        expect(
          find.textContaining('Receipts appear after the backend confirms'),
          findsOneWidget,
        );
      }
      expect(
        tester.takeException(),
        isNull,
        reason: screen.runtimeType.toString(),
      );
    }
  });

  testWidgets('parent consents keeps trip and pickup requests unavailable', (
    tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          apiClientProvider.overrideWithValue(_ParentScreenApiClient()),
          parentPortalDataProvider.overrideWith(
            (ref) async => ParentPortalData(
              parentName: 'Parent',
              schoolName: 'School',
              lastUpdated: DateTime(2024, 1, 1, 9, 30),
              children: const [
                ParentPortalChild(
                  id: 'child-1',
                  name: 'Asha Rai',
                  classSection: 'Grade 4 - A',
                  teacher: 'Class teacher',
                  attendance: 'Present today',
                  attendanceTime: 'Updated now',
                  transport: 'Route A',
                  homework: 'No pending homework',
                  updates: 'No unread updates',
                ),
              ],
              homework: [],
              updates: [],
            ),
          ),
        ],
        child: const MaterialApp(home: ParentConsentsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Trip permission'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Trip permission'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Authorized pickup'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Authorized pickup'), findsOneWidget);
    expect(find.text('Unavailable'), findsNWidgets(2));
    expect(
      find.textContaining('No pickup contact is activated from mobile.'),
      findsOneWidget,
    );
    expect(find.textContaining('Pending API'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'parent calendar day grid stays overflow-free at max text scale with many markers',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sharedPrefs = await SharedPreferences.getInstance();
      final now = DateTime.now();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            parentPortalDataProvider.overrideWith(
              (ref) async => ParentPortalData(
                parentName: 'Parent',
                schoolName: 'School',
                lastUpdated: now,
                children: [
                  ParentPortalChild(
                    id: 'child-1',
                    name: 'Aaradhya Chaudhary Shrestha',
                    classSection: 'Grade 10 - Diamond',
                    teacher: 'Class teacher',
                    attendance: 'Present today',
                    attendanceTime: 'Updated now',
                    transport: 'Route A',
                    homework: 'Pending',
                    updates: 'Unread',
                    feesDue: 987654,
                    nextFeeDueDate: now.toIso8601String(),
                  ),
                  const ParentPortalChild(
                    id: 'child-2',
                    name: 'Bishwanath Shrestha',
                    classSection: 'Grade 5 - B',
                    teacher: 'Class teacher',
                    attendance: 'Present today',
                    attendanceTime: 'Updated now',
                    transport: 'Route B',
                    homework: 'Pending',
                    updates: 'Unread',
                  ),
                ],
                homework: [
                  ParentPortalHomework(
                    id: 'hw-1',
                    childId: 'child-1',
                    childName: 'Aaradhya',
                    classSection: 'Grade 10 - Diamond',
                    subject: 'Science',
                    title: 'Lab report',
                    dueLabel: 'Today',
                    dueAt: now,
                    status: 'PENDING',
                    attachmentCount: 0,
                    teacher: 'Teacher',
                  ),
                  ParentPortalHomework(
                    id: 'hw-2',
                    childId: 'child-2',
                    childName: 'Bishwanath',
                    classSection: 'Grade 5 - B',
                    subject: 'Math',
                    title: 'Worksheet',
                    dueLabel: 'Today',
                    dueAt: now,
                    status: 'PENDING',
                    attachmentCount: 0,
                    teacher: 'Teacher',
                  ),
                ],
                updates: [
                  ParentPortalUpdate(
                    id: 'update-1',
                    category: ParentUpdateCategory.event,
                    title: 'School event today',
                    body: 'Details',
                    metadata: 'School - now',
                    createdAt: now,
                  ),
                ],
              ),
            ),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
              child: const ParentCalendarScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('BS Calendar'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'parent home quick actions grid stays overflow-free at max text scale',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final data = ParentPortalData(
        parentName: 'Parent',
        schoolName: 'School',
        lastUpdated: DateTime(2026, 1, 1),
        activeChildId: 'child-1',
        children: const [
          ParentPortalChild(
            id: 'child-1',
            name: 'Aaradhya Chaudhary Shrestha',
            classSection: 'Grade 10 - Diamond',
            teacher: 'Class teacher',
            attendance: 'Present today',
            attendanceTime: 'Updated now',
            transport: 'Route A',
            homework: 'No pending homework',
            updates: 'No unread updates',
          ),
        ],
        homework: const [],
        updates: const [],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
              child: Scaffold(body: ParentPortalHomeTab(data: data)),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Pay fees'),
        220,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Quick actions'), findsOneWidget);
      expect(find.text('Pay fees'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
