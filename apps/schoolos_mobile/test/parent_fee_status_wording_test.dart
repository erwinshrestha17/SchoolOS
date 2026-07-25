import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_fees_screen.dart';

/// The backend fee summary reports status PAID whenever nothing is
/// outstanding, and a child the school has never invoiced has nothing
/// outstanding. The app used to repeat that as a bold "Paid" with a green
/// badge, claiming a settlement that never happened - and hiding the far more
/// likely reading, that this term's invoices have not been issued yet.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pump(WidgetTester tester, ApiClient client) async {
    tester.view.physicalSize = const Size(420, 1600);
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
          apiClientProvider.overrideWithValue(client),
        ],
        child: const MaterialApp(home: ParentFeesScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a never-invoiced child is not reported as paid', (tester) async {
    await pump(
      tester,
      _FeesApiClient(
        fees: const {
          'status': 'PAID',
          'totalAmount': 0,
          'paidAmount': 0,
          'totalOutstanding': 0,
          'overdueCount': 0,
          'nextDueDate': null,
          'recentInvoices': [],
          'recentReceipts': [],
        },
      ),
    );

    expect(find.text('Not billed'), findsOneWidget);
    expect(
      find.text('Paid'),
      findsNothing,
      reason: 'nothing was ever billed, so nothing was ever paid',
    );
    expect(find.text('No invoices'), findsOneWidget);
    expect(
      find.text('The school has not issued any fee invoice for this child.'),
      findsOneWidget,
    );
  });

  testWidgets('a genuinely settled account still reads paid', (tester) async {
    await pump(
      tester,
      _FeesApiClient(
        fees: const {
          'status': 'PAID',
          'totalAmount': 1200,
          'paidAmount': 1200,
          'totalOutstanding': 0,
          'overdueCount': 0,
          'nextDueDate': null,
          'recentInvoices': [
            {
              'id': 'invoice-1',
              'invoiceNumber': 'INV-001',
              'status': 'PAID',
              'totalAmount': 1200,
              'paidAmount': 1200,
              'outstandingAmount': 0,
              'isOverdue': false,
              'receipts': [],
            },
          ],
          'recentReceipts': [],
        },
      ),
    );

    expect(find.text('Paid'), findsWidgets);
    expect(find.text('Not billed'), findsNothing);
    expect(find.text('No invoices'), findsNothing);
  });

  testWidgets('an outstanding balance is untouched', (tester) async {
    await pump(
      tester,
      _FeesApiClient(
        fees: const {
          'status': 'DUE',
          'totalAmount': 1200,
          'paidAmount': 0,
          'totalOutstanding': 1200,
          'overdueCount': 1,
          'nextDueDate': '2026-06-25T00:00:00.000Z',
          'recentInvoices': [],
          'recentReceipts': [],
        },
      ),
    );

    expect(find.text('NPR 1200'), findsWidgets);
    expect(find.text('1 overdue'), findsOneWidget);
    expect(find.text('Not billed'), findsNothing);
  });

  test('the portal child model separates never-billed from settled', () {
    const neverBilled = ParentPortalChild(
      id: 'child-1',
      name: 'Asha Rai',
      classSection: 'Grade 4 - A',
      teacher: 'Class teacher',
      attendance: 'Present today',
      attendanceTime: 'Updated now',
      transport: 'No active trip',
      homework: 'No pending homework',
      updates: 'No unread updates',
    );
    const settled = ParentPortalChild(
      id: 'child-2',
      name: 'Bikash Rai',
      classSection: 'Grade 2 - B',
      teacher: 'Class teacher',
      attendance: 'Present today',
      attendanceTime: 'Updated now',
      transport: 'No active trip',
      homework: 'No pending homework',
      updates: 'No unread updates',
      feesTotalAmount: 1200,
      feesPaidAmount: 1200,
      feesStatus: 'PAID',
    );

    expect(neverBilled.hasNoFeeInvoices, isTrue);
    expect(settled.hasNoFeeInvoices, isFalse);
    expect(settled.hasFeesDue, isFalse);
  });
}

class _FeesApiClient extends ApiClient {
  _FeesApiClient({required this.fees})
    : super(tokenStorage: _TestTokenStorage());

  final Map<String, dynamic> fees;

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
      return {
        'selectedStudent': _child,
        'attendance': {
          'today': {'label': 'Present today'},
        },
        'homework': {'pendingCount': 0, 'nextDueAt': null},
        'fees': fees,
        'notices': {'unreadCount': 0},
        'modules': {'fees': true},
      };
    }
    if (path == '/mobile/students/child-1/profile') {
      return {
        'profile': {'studentSystemId': 'STU-001'},
      };
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
}

class _TestTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => 'test-token';

  @override
  Future<String?> getRefreshToken() async => null;
}
