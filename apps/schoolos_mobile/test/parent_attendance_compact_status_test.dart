import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/attendance/application/attendance_providers.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/presentation/screens/parent_attendance_screen.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/shared/utils/nepali_bs_calendar.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('uses a compact informational row before the monthly summary', (
    tester,
  ) async {
    final client = _ParentAttendanceApiClient(todayStatus: null);

    await _pumpAttendanceScreen(tester, client);

    expect(
      find.textContaining('Attendance not submitted yet', findRichText: true),
      findsOneWidget,
    );
    expect(find.text('Today’s attendance is not available yet'), findsNothing);
    expect(
      find.textContaining('The school has not completed attendance'),
      findsNothing,
    );
    expect(find.byTooltip('Refresh today’s attendance'), findsOneWidget);
    expect(
      tester
          .getSize(find.byKey(const ValueKey('parent-attendance-today-status')))
          .height,
      lessThan(80),
    );
    expect(client.attendanceSummaryRequests, 1);
    await tester.pump(const Duration(minutes: 1));
    await tester.pumpAndSettle();
    expect(client.attendanceSummaryRequests, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows the real marked time in a semantic present chip', (
    tester,
  ) async {
    final client = _ParentAttendanceApiClient(
      todayStatus: 'PRESENT',
      markedAt: '2026-07-29T03:27:00.000Z',
    );

    await _pumpAttendanceScreen(tester, client);

    expect(find.text('Present · Marked at 9:12 AM'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('opens the existing correction flow for an absent day', (
    tester,
  ) async {
    final client = _ParentAttendanceApiClient(
      todayStatus: 'ABSENT',
      markedAt: '2026-07-29T03:43:00.000Z',
    );

    await _pumpAttendanceScreen(tester, client);
    await tester.tap(find.text('Report an issue'));
    await tester.pumpAndSettle();

    expect(find.text('Request attendance correction'), findsOneWidget);
    expect(
      find.text(
        'The school will review this request. Attendance changes only after approval.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpAttendanceScreen(
  WidgetTester tester,
  _ParentAttendanceApiClient client,
) async {
  final preferences = await SharedPreferences.getInstance();
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appPreferencesServiceProvider.overrideWithValue(
          AppPreferencesService(preferences),
        ),
        parentRepositoryProvider.overrideWithValue(ParentRepository(client)),
        attendanceRepositoryProvider.overrideWithValue(
          AttendanceRepository(client),
        ),
      ],
      child: const MaterialApp(home: ParentAttendanceScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

class _ParentAttendanceApiClient extends ApiClient {
  _ParentAttendanceApiClient({required this.todayStatus, this.markedAt})
    : super(tokenStorage: _TestTokenStorage());

  final String? todayStatus;
  final String? markedAt;
  int attendanceSummaryRequests = 0;

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
        'items': [
          {
            'id': 'child-1',
            'name': 'Aarav Adhikari',
            'classSection': 'Class 1 - A',
            'rollNumber': '7',
            'academicYear': '2083',
            'relationship': 'Son',
          },
        ],
      };
    }
    if (path == '/mobile/me/dashboard') {
      return {
        'attendance': {
          'today': {'label': 'Attendance not marked today'},
        },
        'modules': {'attendance': true},
      };
    }
    if (path == '/mobile/students/child-1/profile') {
      return {'profile': <String, dynamic>{}};
    }
    if (path == '/mobile/students/child-1/attendance-corrections') {
      return {'items': <Map<String, dynamic>>[]};
    }
    if (path == '/mobile/students/child-1/attendance-summary') {
      attendanceSummaryRequests += 1;
      final now = NepaliBsCalendar.getNepalNow();
      final today = DateTime.utc(now.year, now.month, now.day);
      return {
        'today': {
          'status': todayStatus,
          'label': todayStatus == null
              ? 'Attendance not marked today'
              : '$todayStatus today',
          'remark': null,
          'markedAt': markedAt,
        },
        'monthSummary': {
          'present': todayStatus == 'PRESENT' ? 1 : 0,
          'absent': todayStatus == 'ABSENT' ? 1 : 0,
          'late': 0,
          'leave': 0,
          'totalMarked': todayStatus == null ? 0 : 1,
          'attendancePercentage': todayStatus == null
              ? null
              : todayStatus == 'PRESENT'
              ? 100
              : 0,
        },
        'monthHistory': todayStatus == null
            ? <Map<String, dynamic>>[]
            : [
                {
                  'date': today.toIso8601String(),
                  'status': todayStatus,
                  'label': '$todayStatus today',
                },
              ],
      };
    }
    return <String, dynamic>{};
  }
}

class _TestTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => 'test-token';

  @override
  Future<String?> getRefreshToken() async => null;
}
