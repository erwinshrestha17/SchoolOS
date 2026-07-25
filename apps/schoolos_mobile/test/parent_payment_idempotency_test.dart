import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_canteen_screen.dart';

/// The canteen wallet key must behave in both directions:
///
/// * held across a retry, so an ambiguous failure replays instead of topping
///   up twice, and
/// * released once a top-up is confirmed, because `topUpWallet` returns the
///   *original* transaction for a replayed key whatever amount is sent - so a
///   held key makes the second top-up report success while adding nothing.
void main() {
  late _MockParentRepository repository;

  setUpAll(() {
    registerFallbackValue(_child);
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    repository = _MockParentRepository();
    when(
      () => repository.getCanteenForChild(any()),
    ).thenAnswer((_) async => _canteenInfo(500));
    when(() => repository.getPaymentGatewayReadiness(any())).thenAnswer(
      (_) async => const ParentPaymentGatewayReadiness(
        enabled: true,
        status: 'READY',
        providerName: 'esewa',
        message: 'Sandbox payments are enabled.',
        providers: ['esewa'],
        sandbox: true,
      ),
    );
    // ParentCanteenScreen resolves its child through ParentController.
    when(
      () => repository.getGuardianChildren(),
    ).thenAnswer((_) async => const [_child]);
    when(
      () => repository.getParentDashboardSummaryForChild(any()),
    ).thenAnswer((_) async => _dashboard());
    when(
      () => repository.getChildProfileForChild(any()),
    ).thenAnswer((_) async => _profile());
  });

  Future<void> pumpCanteen(WidgetTester tester) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeParentAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          parentRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(home: ParentCanteenScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> topUp(WidgetTester tester) async {
    await tester.tap(find.text('Add test balance'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add balance'));
    await tester.pumpAndSettle();
  }

  testWidgets('a confirmed top-up releases the key for the next one', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final keys = <String>[];
    when(
      () => repository.topUpCanteenInSandbox(
        childId: any(named: 'childId'),
        amount: any(named: 'amount'),
        provider: any(named: 'provider'),
        idempotencyKey: any(named: 'idempotencyKey'),
      ),
    ).thenAnswer((invocation) async {
      keys.add(invocation.namedArguments[#idempotencyKey] as String);
      return const ParentSandboxPaymentResult(
        status: 'SUCCEEDED',
        provider: 'esewa',
        amount: 1000,
        walletBalance: 1500,
      );
    });

    await pumpCanteen(tester);
    await topUp(tester);
    await topUp(tester);

    expect(keys, hasLength(2));
    expect(
      keys.first,
      isNot(keys.last),
      reason:
          'the second top-up is a new payment; replaying the first key returns '
          'the original transaction and silently adds no balance',
    );
  });

  testWidgets('a failed top-up keeps the key so a retry cannot double charge', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final keys = <String>[];
    var attempt = 0;
    when(
      () => repository.topUpCanteenInSandbox(
        childId: any(named: 'childId'),
        amount: any(named: 'amount'),
        provider: any(named: 'provider'),
        idempotencyKey: any(named: 'idempotencyKey'),
      ),
    ).thenAnswer((invocation) async {
      keys.add(invocation.namedArguments[#idempotencyKey] as String);
      attempt++;
      // Reached the wallet, but the reply was lost.
      if (attempt == 1) throw const TimeoutException();
      return const ParentSandboxPaymentResult(
        status: 'SUCCEEDED',
        provider: 'esewa',
        amount: 1000,
        walletBalance: 1500,
      );
    });

    await pumpCanteen(tester);
    await topUp(tester);
    await topUp(tester);

    expect(keys, hasLength(2));
    expect(
      keys.first,
      keys.last,
      reason:
          'a retry after an ambiguous failure must replay the same key so the '
          'wallet is credited once',
    );
  });
}

const _child = GuardianChild(
  id: 'child-1',
  name: 'Asha Rai',
  classSection: 'Grade 4 - A',
  rollNumber: '7',
  academicYear: '2083',
  relationship: 'Daughter',
);

ParentCanteenInfo _canteenInfo(num balance) {
  return ParentCanteenInfo(walletBalance: balance, isLowBalance: false);
}

ParentDashboardSummary _dashboard() {
  return ParentDashboardSummary(
    child: _child,
    attendanceToday: 'Present',
    homeworkPending: 0,
    feesDue: 0,
    overdueFeesCount: 0,
    unreadNotices: 0,
    transportStatus: 'No active trip',
    canteenBalance: 500,
    canteenIsLowBalance: false,
    latestActivity: 'No recent activity',
    lastUpdated: DateTime(2026, 7, 25, 9),
  );
}

ChildProfile _profile() {
  return const ChildProfile(
    child: _child,
    classTeacher: 'Class teacher',
    guardianSummary: 'verified',
    canViewGuardianSummary: true,
    attendanceSummary: '',
    homeworkSummary: '',
    feesSummary: '',
    qrLabel: '',
  );
}

class _MockParentRepository extends Mock implements ParentRepository {}

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getUserRole() async => null;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _FakeApiClient();
}

class _FakeParentAuthNotifier extends AuthNotifier {
  _FakeParentAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'PARENT');
  }
}
