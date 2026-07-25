import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_canteen_screen.dart';

/// The backend returns `wallet: null` for a child who has no canteen wallet,
/// and the screen prints "No wallet" for the balance. The status badge beside
/// it used to fall through to a green "OK", telling a parent their child's
/// canteen standing was fine when there was no account at all.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pump(WidgetTester tester, ApiClient client) async {
    tester.view.physicalSize = const Size(420, 1400);
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
        child: const MaterialApp(home: ParentCanteenScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a child with no wallet is not reported as OK', (tester) async {
    await pump(tester, _CanteenApiClient(wallet: null));

    expect(find.text('No wallet'), findsOneWidget);
    expect(
      find.text('OK'),
      findsNothing,
      reason: 'there is no balance to be OK about',
    );
    expect(find.text('Not set up'), findsOneWidget);
  });

  testWidgets('a funded wallet still reads OK', (tester) async {
    await pump(
      tester,
      _CanteenApiClient(
        wallet: const {
          'balance': 450,
          'lowBalanceThreshold': 200,
          'isLowBalance': false,
        },
      ),
    );

    expect(find.text('Rs 450'), findsOneWidget);
    expect(find.text('OK'), findsOneWidget);
    expect(find.text('Not set up'), findsNothing);
  });

  testWidgets('a drained wallet still warns', (tester) async {
    await pump(
      tester,
      _CanteenApiClient(
        wallet: const {
          'balance': 50,
          'lowBalanceThreshold': 200,
          'isLowBalance': true,
        },
      ),
    );

    expect(find.text('Low balance'), findsOneWidget);
    expect(find.text('OK'), findsNothing);
  });

  testWidgets('top-up is not declared unavailable before readiness answers', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final sharedPrefs = await SharedPreferences.getInstance();
    // Readiness never resolves, so the button stays in its in-flight state.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          apiClientProvider.overrideWithValue(
            _CanteenApiClient(wallet: null, stallReadiness: true),
          ),
        ],
        child: const MaterialApp(home: ParentCanteenScreen()),
      ),
    );
    // Not pumpAndSettle: a pending request plus a spinner never settles.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Checking…'), findsOneWidget);
    expect(
      find.text('Top-up not available'),
      findsNothing,
      reason: 'a verdict must wait for the answer it reports',
    );
  });
}

class _CanteenApiClient extends ApiClient {
  _CanteenApiClient({required this.wallet, this.stallReadiness = false})
    : super(tokenStorage: _TestTokenStorage());

  final Map<String, dynamic>? wallet;
  final bool stallReadiness;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    if (stallReadiness &&
        path == '/mobile/students/child-1/payment-gateway-readiness') {
      // Never completes.
      return Completer<Response<T>>().future;
    }
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
        'profile': {'studentSystemId': 'STU-001'},
      };
    }
    if (path == '/mobile/students/child-1/canteen') {
      return {
        'wallet': wallet,
        'activeMealPlans': [],
        'recentTransactions': [],
        'menuItems': [],
        'recentServings': [],
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

  static const _dashboard = {
    'selectedStudent': _child,
    'attendance': {
      'today': {'label': 'Present today'},
    },
    'homework': {'pendingCount': 0, 'nextDueAt': null},
    'fees': {'totalOutstanding': 0, 'overdueCount': 0},
    'notices': {'unreadCount': 0},
    'modules': {'canteen': true},
  };
}

class _TestTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => 'test-token';

  @override
  Future<String?> getRefreshToken() async => null;
}
