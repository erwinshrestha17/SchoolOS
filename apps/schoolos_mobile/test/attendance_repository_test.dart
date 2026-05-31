import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('AttendanceRepository', () {
    late MockApiClient apiClient;
    late AttendanceRepository repository;

    setUp(() {
      apiClient = MockApiClient();
      repository = AttendanceRepository(apiClient);
    });

    test('uses the parent-safe mobile attendance endpoint', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-summary',
          queryParameters: {'month': 5, 'year': 2026},
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/attendance-summary',
          ),
          data: {
            'today': {'status': 'ABSENT', 'label': 'Absent today'},
            'monthSummary': {'present': 18, 'absent': 1, 'late': 2, 'leave': 1},
            'monthHistory': [
              {'date': '2026-05-01T00:00:00.000Z', 'status': 'PRESENT'},
              {'date': '2026-05-02T00:00:00.000Z', 'status': 'ABSENT'},
            ],
          },
        ),
      );

      final snapshot = await repository.getParentAttendanceSnapshot(
        'child-1',
        DateTime(2026, 5),
      );

      expect(snapshot.summary.todayLabel, 'Absent today');
      expect(snapshot.summary.todayStatus, AttendanceStatus.absent);
      expect(snapshot.summary.presentCount, 18);
      expect(snapshot.summary.absentCount, 1);
      expect(snapshot.summary.lateCount, 2);
      expect(snapshot.summary.leaveCount, 1);
      expect(snapshot.days, hasLength(2));
      expect(snapshot.days.last.status, AttendanceStatus.absent);

      verify(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-summary',
          queryParameters: {'month': 5, 'year': 2026},
        ),
      ).called(1);
    });
  });
}
