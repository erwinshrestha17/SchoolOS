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
import 'package:schoolos_mobile/features/principal/application/principal_providers.dart';
import 'package:schoolos_mobile/features/principal/data/principal_repository.dart';
import 'package:schoolos_mobile/features/principal/presentation/screens/principal_screens.dart';

/// The backend deduplicates principal writes on `idempotencyKey`: a replayed
/// key returns the existing record instead of writing a second one. Minting a
/// fresh key for each attempt defeats that entirely, so a retry after a
/// timeout that the server actually processed records a second approval
/// decision, or broadcasts a school-wide emergency notice twice.
void main() {
  late _MockPrincipalRepository repository;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    repository = _MockPrincipalRepository();
  });

  Future<Widget> harness(Widget home) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appPreferencesServiceProvider.overrideWithValue(
          AppPreferencesService(sharedPrefs),
        ),
        tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        authProvider.overrideWith((ref) {
          return _FakePrincipalAuthNotifier(
            ref.watch(tokenStorageServiceProvider),
            ref.watch(authRepositoryProvider),
            ref.watch(appPreferencesServiceProvider),
          );
        }),
        principalRepositoryProvider.overrideWithValue(repository),
        principalApprovalsProvider.overrideWith((ref, status) async {
          return {
            'summary': {'pending': 1, 'urgent': 1, 'today': 1},
            'items': [
              {
                'id': 'approval-1',
                'type': 'leave',
                'title': 'Leave Request',
                'subtitle': 'Maya Gurung',
                'detail': '2 days leave',
                'status': 'PENDING',
                'severity': 'high',
                'route': '/principal/approvals/approval-1',
              },
            ],
          };
        }),
        principalSnapshotProvider.overrideWith((ref, key) async {
          // The empty branch is the one that offers the compose entry point.
          return {'status': 'empty', 'items': <dynamic>[]};
        }),
      ],
      child: MaterialApp(home: home),
    );
  }

  testWidgets('retrying an approval decision replays the same idempotency key', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final keys = <String>[];
    var attempt = 0;
    when(
      () => repository.decideApproval(
        approvalRequestId: any(named: 'approvalRequestId'),
        decision: any(named: 'decision'),
        idempotencyKey: any(named: 'idempotencyKey'),
        reason: any(named: 'reason'),
      ),
    ).thenAnswer((invocation) async {
      keys.add(invocation.namedArguments[#idempotencyKey] as String);
      attempt++;
      // First attempt reaches the server but the reply is lost.
      if (attempt == 1) throw const TimeoutException();
      return <String, dynamic>{'status': 'APPROVED'};
    });

    await tester.pumpWidget(await harness(const PrincipalApprovalsScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Review'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField).first,
      'Cover arranged for both days.',
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Approve'));
    await tester.pumpAndSettle();

    // The principal sees the failure and taps Approve again. This second
    // attempt succeeds and closes the sheet, so settling here also covers the
    // sheet's closing transition: if the reason controller were disposed the
    // instant the route popped, this pump would throw "A TextEditingController
    // was used after being disposed".
    await tester.tap(find.text('Approve'));
    await tester.pumpAndSettle();

    expect(keys, hasLength(2));
    expect(
      keys.first,
      keys.last,
      reason:
          'A retry must replay the first key so the backend recognises it as '
          'the same decision instead of recording a second one.',
    );
    expect(keys.first, isNotEmpty);
  });

  testWidgets('retrying an emergency notice replays the same idempotency key', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    when(
      () => repository.previewEmergencyNoticeRecipients(
        title: any(named: 'title'),
        body: any(named: 'body'),
        priority: any(named: 'priority'),
        audienceType: any(named: 'audienceType'),
        classId: any(named: 'classId'),
        sectionId: any(named: 'sectionId'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{'canSubmit': true, 'recipientCount': 120},
    );

    final keys = <String>[];
    var attempt = 0;
    when(
      () => repository.submitEmergencyNotice(
        title: any(named: 'title'),
        body: any(named: 'body'),
        priority: any(named: 'priority'),
        audienceType: any(named: 'audienceType'),
        sendMode: any(named: 'sendMode'),
        idempotencyKey: any(named: 'idempotencyKey'),
        scheduledFor: any(named: 'scheduledFor'),
        attachmentFileId: any(named: 'attachmentFileId'),
        reason: any(named: 'reason'),
      ),
    ).thenAnswer((invocation) async {
      keys.add(invocation.namedArguments[#idempotencyKey] as String);
      attempt++;
      if (attempt == 1) throw const TimeoutException();
      return <String, dynamic>{'state': 'queued'};
    });

    await tester.pumpWidget(
      await harness(
        const PrincipalSnapshotScreen(
          snapshotKey: 'notice',
          title: 'Emergency Notice',
          subtitle: 'Review and send urgent school communication',
        ),
      ),
    );
    await tester.pumpAndSettle();

    final composeAction = find.text('Compose emergency notice');
    expect(
      composeAction,
      findsWidgets,
      reason: 'the compose entry point should be reachable',
    );
    await tester.tap(composeAction.first);
    await tester.pumpAndSettle();

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Early closure today');
    await tester.enterText(
      fields.at(1),
      'School closes at 12pm due to strike.',
    );
    await tester.enterText(fields.at(2), 'Bandh announced.');
    await tester.pumpAndSettle();

    final submit = find.text('Submit');
    await tester.ensureVisible(submit.first);
    await tester.tap(submit.first);
    await tester.pumpAndSettle();

    await tester.ensureVisible(submit.first);
    await tester.tap(submit.first);
    await tester.pumpAndSettle();

    expect(keys, hasLength(2));
    expect(
      keys.first,
      keys.last,
      reason:
          'A retry must replay the first key so the school is never sent the '
          'same emergency notice twice.',
    );
    expect(keys.first, isNotEmpty);
  });
}

class _MockPrincipalRepository extends Mock implements PrincipalRepository {}

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

class _FakePrincipalAuthNotifier extends AuthNotifier {
  _FakePrincipalAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'principal');
  }
}
