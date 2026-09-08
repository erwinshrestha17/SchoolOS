import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/principal/application/principal_providers.dart';
import 'package:schoolos_mobile/features/principal/data/principal_repository.dart';
import 'package:schoolos_mobile/features/principal/domain/attendance_correction_detail.dart';
import 'package:schoolos_mobile/features/principal/presentation/screens/attendance_correction_review_sheet.dart';

class _Client extends Mock implements ApiClient {}

class _Tokens extends Fake implements TokenStorageService {}

class _AuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _Client();
}

class _Auth extends AuthNotifier {
  _Auth(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs, {
    required this.permission,
  });
  final bool permission;
  @override
  Future<void> loadSession() async {
    state = AuthState(
      status: AuthStatus.authenticated,
      user: AuthUser(
        id: 'reviewer',
        name: 'Reviewer',
        email: 'reviewer@example.invalid',
        role: 'PRINCIPAL',
        tenantId: 'school',
        permissions: permission ? ['attendance:review_conflicts'] : [],
      ),
    );
  }
}

Map<String, dynamic> payload() => {
  'id': 'request',
  'status': 'PENDING',
  'attendanceDate': '2026-09-08T00:00:00Z',
  'student': {'firstNameEn': 'Synthetic', 'lastNameEn': 'Student'},
  'record': {'status': 'ABSENT'},
  'session': {
    'submittedBy': {'id': 'teacher'},
  },
  'requestedStatus': 'PRESENT',
  'requestedById': 'parent',
  'reason': 'Please review',
};
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'loads verified detail without cache and rejects a mismatched identity',
    () async {
      final client = _Client();
      when(
        () => client.get<dynamic>('/attendance/corrections/request'),
      ).thenAnswer(
        (_) async =>
            Response(requestOptions: RequestOptions(), data: payload()),
      );
      final repository = PrincipalRepository(client);
      expect(
        (await repository.getAttendanceCorrection('request')).currentStatus,
        'ABSENT',
      );
      expect(
        () => AttendanceCorrectionDetail.fromJson(payload(), 'other'),
        throwsA(isA<ServerException>()),
      );
    },
  );
  for (final status in ['APPROVED', 'REJECTED']) {
    test(
      'sends existing review contract for $status and validates response',
      () async {
        final client = _Client();
        when(
          () => client.patch<dynamic>(
            '/attendance/corrections/request/review',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(),
            data: {'id': 'request', 'status': status},
          ),
        );
        await PrincipalRepository(client).reviewAttendanceCorrection(
          id: 'request',
          status: status,
          reason: '  Verified register  ',
        );
        verify(
          () => client.patch<dynamic>(
            '/attendance/corrections/request/review',
            data: {'status': status, 'reviewReason': 'Verified register'},
          ),
        ).called(1);
        when(
          () => client.patch<dynamic>(
            '/attendance/corrections/request/review',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(),
            data: {'id': 'other', 'status': status},
          ),
        );
        await expectLater(
          PrincipalRepository(client).reviewAttendanceCorrection(
            id: 'request',
            status: status,
            reason: 'Verified register',
          ),
          throwsA(isA<ServerException>()),
        );
      },
    );
  }
  for (final scenario in [
    'allowed',
    'approved',
    'rejected',
    'permission',
    'self',
    'decided',
    'offline',
  ]) {
    testWidgets('review controls enforce $scenario state', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final client = _Client();
      final json = payload();
      if (scenario == 'self') json['requestedById'] = 'reviewer';
      if (scenario == 'decided') json['status'] = 'APPROVED';
      final response = Completer<Response<dynamic>>();
      when(
        () => client.patch<dynamic>(any(), data: any(named: 'data')),
      ).thenAnswer((_) => response.future);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authProvider.overrideWith(
              (ref) => _Auth(
                _Tokens(),
                _AuthRepository(),
                prefs,
                permission: scenario != 'permission',
              ),
            ),
            principalRepositoryProvider.overrideWithValue(
              PrincipalRepository(client),
            ),
            principalCorrectionDetailProvider('request').overrideWith((
              ref,
            ) async {
              if (scenario == 'offline') throw const NetworkException();
              return AttendanceCorrectionDetail.fromJson(json, 'request');
            }),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () => showModalBottomSheet<bool>(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => const AttendanceCorrectionReviewSheet(
                      requestId: 'request',
                    ),
                  ),
                  child: const Text('Open review'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open review'));
      await tester.pumpAndSettle();
      if (!['allowed', 'approved', 'rejected'].contains(scenario)) {
        expect(find.text('Approve correction'), findsNothing);
        expect(find.text('Reject correction'), findsNothing);
      } else {
        expect(find.text('Synthetic Student'), findsOneWidget);
        expect(find.text('Current attendance: absent'), findsOneWidget);
        final decisionLabel = scenario == 'rejected'
            ? 'Reject correction'
            : 'Approve correction';
        await tester.ensureVisible(find.text(decisionLabel));
        await tester.tap(find.text(decisionLabel));
        await tester.pump();
        expect(
          find.text('Enter a decision reason of up to 500 characters.'),
          findsOneWidget,
        );
        verifyNever(
          () => client.patch<dynamic>(any(), data: any(named: 'data')),
        );
        await tester.enterText(find.byType(TextField), 'Verified register');
        await tester.ensureVisible(find.text(decisionLabel));
        await tester.tap(find.text(decisionLabel));
        await tester.pump();
        expect(find.text('Submitting…'), findsOneWidget);
        if (scenario == 'allowed') {
          response.completeError(const NetworkException());
        } else {
          response.complete(
            Response(
              requestOptions: RequestOptions(),
              data: {'id': 'request', 'status': scenario.toUpperCase()},
            ),
          );
        }
        await tester.pumpAndSettle();
        expect(
          find.text('Refresh request'),
          scenario == 'allowed' ? findsOneWidget : findsNothing,
        );
        if (scenario != 'allowed') {
          expect(find.text('Review attendance correction'), findsNothing);
        }
        expect(find.text('Approve correction'), findsNothing);
        verify(
          () => client.patch<dynamic>(any(), data: any(named: 'data')),
        ).called(1);
      }
      expect(tester.takeException(), isNull);
    });
  }
}
