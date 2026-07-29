import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_fees_screen.dart';

/// A parent could see that a bill was Rs 4,700 but not what the Rs 4,700 was
/// for, and not which month it belonged to. The printed receipt has always
/// itemised the charge; the app showed a total and an invoice number.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pump(WidgetTester tester, ApiClient client) async {
    tester.view.physicalSize = const Size(420, 2400);
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

  group('month grouping', () {
    test(
      'groups by the Bikram Sambat month a bill falls due, newest first',
      () {
        final groups = groupInvoicesByDueMonth([
          _invoice(id: 'a', due: '2026-07-14T00:00:00.000Z'),
          _invoice(id: 'b', due: '2026-09-12T00:00:00.000Z'),
          _invoice(id: 'c', due: '2026-08-13T00:00:00.000Z'),
        ]);

        expect(groups.map((g) => g.label), [
          'Bhadra 2083',
          'Shrawan 2083',
          'Asar 2083',
        ]);
        expect(groups.map((g) => g.invoices.single.id), ['b', 'c', 'a']);
      },
    );

    test('bills due in the same month share one group', () {
      final groups = groupInvoicesByDueMonth([
        _invoice(id: 'a', due: '2026-08-05T00:00:00.000Z'),
        _invoice(id: 'b', due: '2026-08-13T00:00:00.000Z'),
      ]);

      expect(groups, hasLength(1));
      expect(groups.single.invoices.map((i) => i.id), ['a', 'b']);
    });

    test('a bill with no due date is kept, not dropped', () {
      // Losing a bill because the school left a field blank would be worse
      // than showing it under a plain heading.
      final groups = groupInvoicesByDueMonth([
        _invoice(id: 'a', due: null),
        _invoice(id: 'b', due: '2026-08-13T00:00:00.000Z'),
      ]);

      expect(groups.map((g) => g.label), contains('No due date given'));
      expect(
        groups.expand((g) => g.invoices).map((i) => i.id),
        containsAll(<String>['a', 'b']),
      );
    });

    test('the month total counts only what is still owed', () {
      final groups = groupInvoicesByDueMonth([
        _invoice(id: 'a', due: '2026-08-05T00:00:00.000Z', outstanding: 2700),
        _invoice(id: 'b', due: '2026-08-13T00:00:00.000Z', outstanding: 0),
      ]);

      expect(groups.single.outstanding, 2700);
    });
  });

  testWidgets('outstanding and paid bills stay in separate records tabs', (
    tester,
  ) async {
    await pump(tester, _FeesApiClient(invoices: _threeMonths));

    expect(find.text('Due in Bhadra 2083'), findsOneWidget);
    expect(find.text('Due in Shrawan 2083'), findsOneWidget);
    expect(find.text('Asar 2083'), findsNothing);
    expect(find.text('View fee breakdown'), findsNWidgets(2));

    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();

    expect(find.text('Asar 2083'), findsOneWidget);
    expect(find.text('Due in Asar 2083'), findsNothing);
    expect(find.text('View receipt'), findsOneWidget);
    expect(find.text('View fee breakdown'), findsOneWidget);
    expect(
      find.text('Tuition Fee'),
      findsNothing,
      reason: 'the breakdown is opt-in, so records stay compact',
    );
  });

  testWidgets('expanding a bill shows each charge and the total', (
    tester,
  ) async {
    await pump(tester, _FeesApiClient(invoices: _threeMonths));

    await tester.tap(find.text('View fee breakdown').first);
    await tester.pumpAndSettle();

    expect(find.text('Tuition Fee'), findsOneWidget);
    expect(find.text('Transport Fee'), findsOneWidget);
    expect(find.text('Late Fee'), findsOneWidget);
    expect(find.text('Rs 3,000'), findsWidgets);
    expect(find.text('Hide breakdown'), findsOneWidget);
  });

  testWidgets('a bill the school did not itemise says so', (tester) async {
    await pump(
      tester,
      _FeesApiClient(
        invoices: [
          {
            'id': 'invoice-plain',
            'invoiceNumber': 'INV-PLAIN',
            'status': 'ISSUED',
            'dueDate': '2026-08-13T00:00:00.000Z',
            'totalAmount': 500,
            'paidAmount': 0,
            'outstandingAmount': 500,
            'isOverdue': false,
            'lines': [],
            'receipts': [],
          },
        ],
      ),
    );

    expect(
      find.text('Breakdown unavailable'),
      findsOneWidget,
      reason: 'an unavailable action is explicit and cannot open an empty area',
    );
  });

  testWidgets('the bill status reads in words, not database enums', (
    tester,
  ) async {
    await pump(tester, _FeesApiClient(invoices: _threeMonths));

    expect(find.text('Part paid'), findsOneWidget);
    expect(find.text('Due'), findsOneWidget);

    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('Paid'), findsOneWidget);
    for (final raw in ['ISSUED', 'PARTIAL', 'PAID']) {
      expect(
        find.text(raw),
        findsNothing,
        reason: '$raw is a database value, not something a parent reads',
      );
    }
  });

  testWidgets('survives a long bill at the largest text scale', (tester) async {
    tester.view.physicalSize = const Size(320, 2400);
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
          apiClientProvider.overrideWithValue(
            _FeesApiClient(invoices: _threeMonths),
          ),
        ],
        child: const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(1.6)),
            child: ParentFeesScreen(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('View fee breakdown').first);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('paid records avoid repeated status and expose receipt details', (
    tester,
  ) async {
    await pump(tester, _FeesApiClient(invoices: _threeMonths));

    expect(find.text('Fee status'), findsNothing);
    expect(find.text('Nothing left to pay.'), findsNothing);
    expect(find.text('All paid'), findsNothing);
    expect(find.text('Left to pay'), findsNothing);

    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();

    expect(find.text('Paid'), findsOneWidget);
    expect(find.text('View receipt'), findsOneWidget);

    await tester.tap(find.text('View receipt'));
    await tester.pumpAndSettle();

    expect(find.text('Official receipt'), findsOneWidget);
    expect(find.text('Payment date'), findsOneWidget);
    expect(find.text('Payment method'), findsOneWidget);
    expect(find.text('Payment reference'), findsOneWidget);
    expect(find.text('Download receipt'), findsOneWidget);
    expect(find.text('Share receipt'), findsOneWidget);
  });

  test('no retired jargon survives on the money screens', () {
    // These read as engineering notes, not as something a guardian understands.
    const retired = [
      'backend-gated',
      'Sandbox ready',
      'Sandbox top-up',
      'Sandbox wallet top-up',
      'never queues fee payments offline',
      'from the backend',
      'backend confirms payment',
      'confirmed backend receipt generation',
      'payment provider readiness',
      'Choose payment provider',
      'Continue to secure payment',
      'NPR ',
    ];
    for (final path in const [
      'lib/features/parent/presentation/screens/parent_fees_screen.dart',
      'lib/features/parent/presentation/screens/parent_canteen_screen.dart',
    ]) {
      final source = File(path).readAsStringSync();
      for (final phrase in retired) {
        expect(
          source.contains(phrase),
          isFalse,
          reason: '"$phrase" reads as jargon in $path',
        );
      }
    }
  });
}

ParentFeeInvoice _invoice({
  required String id,
  required String? due,
  num outstanding = 100,
}) {
  return ParentFeeInvoice(
    id: id,
    invoiceNumber: 'INV-$id',
    status: 'ISSUED',
    dueDate: due,
    totalAmount: 100,
    paidAmount: 100 - outstanding,
    outstandingAmount: outstanding,
    isOverdue: false,
  );
}

Map<String, dynamic> _bill({
  required String id,
  required String number,
  required String status,
  required String due,
  required num total,
  required num paid,
  required List<List<Object>> lines,
}) {
  final receipt = {
    'id': 'receipt-$id',
    'receiptNumber': 'REC-$number',
    'invoiceId': id,
    'invoiceNumber': number,
    'paymentId': 'payment-$id',
    'amount': paid,
    'method': 'ESEWA',
    'paidAt': '2026-07-15T00:00:00.000Z',
    'issuedAt': '2026-07-15T00:01:00.000Z',
  };
  return {
    'id': id,
    'invoiceNumber': number,
    'status': status,
    'dueDate': due,
    'totalAmount': total,
    'paidAmount': paid,
    'outstandingAmount': total - paid,
    'isOverdue': false,
    'subtotal': total,
    'vatAmount': 0,
    'lines': [
      for (final line in lines)
        {
          'id': '$id-${line[0]}',
          'description': line[0],
          'feeHead': {'code': 'CODE', 'name': line[0]},
          'quantity': 1,
          'unitAmount': line[1],
          'vatAmount': 0,
          'totalAmount': line[1],
        },
    ],
    'receipts': status == 'PAID' ? [receipt] : const [],
  };
}

final _threeMonths = [
  _bill(
    id: 'invoice-asar',
    number: 'FEE-ASAR',
    status: 'PAID',
    due: '2026-07-14T00:00:00.000Z',
    total: 4200,
    paid: 4200,
    lines: [
      ['Tuition Fee', 3000],
      ['Transport Fee', 1200],
    ],
  ),
  _bill(
    id: 'invoice-shrawan',
    number: 'FEE-SHRAWAN',
    status: 'PARTIAL',
    due: '2026-08-13T00:00:00.000Z',
    total: 4700,
    paid: 2000,
    lines: [
      ['Tuition Fee', 3000],
      ['Transport Fee', 1200],
      ['Exam Fee', 500],
    ],
  ),
  _bill(
    id: 'invoice-bhadra',
    number: 'FEE-BHADRA',
    status: 'ISSUED',
    due: '2026-09-12T00:00:00.000Z',
    total: 4400,
    paid: 0,
    lines: [
      ['Tuition Fee', 3000],
      ['Transport Fee', 1200],
      ['Late Fee', 200],
    ],
  ),
];

class _FeesApiClient extends ApiClient {
  _FeesApiClient({required this.invoices})
    : super(tokenStorage: _TestTokenStorage());

  final List<Map<String, dynamic>> invoices;

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
      final total = invoices.fold<num>(
        0,
        (sum, item) => sum + (item['totalAmount'] as num),
      );
      final paid = invoices.fold<num>(
        0,
        (sum, item) => sum + (item['paidAmount'] as num),
      );
      return {
        'selectedStudent': _child,
        'attendance': {
          'today': {'label': 'Present today'},
        },
        'homework': {'pendingCount': 0, 'nextDueAt': null},
        'fees': {
          'status': paid >= total ? 'PAID' : 'PARTIAL',
          'totalAmount': total,
          'paidAmount': paid,
          'totalOutstanding': total - paid,
          'overdueCount': 0,
          'nextDueDate': null,
          'recentInvoices': invoices,
          'recentReceipts': const [],
        },
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
