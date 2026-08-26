import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/sync/attendance_sync_adapter.dart';
import 'package:schoolos_mobile/core/sync/offline_sync_envelope.dart';

void main() {
  test('attendance adapter uses the shared offline envelope', () {
    final envelope = OfflineSyncEnvelope(
      operationId: 'op-1',
      authorizationVersion: '7',
      authorityNodeId: 'cloud',
      authorityEpoch: 1,
    );
    final body = withAttendanceSyncEnvelope(
      body: {
        'academicYearId': 'year-1',
        'classId': 'class-1',
        'attendanceDate': '2026-06-02',
        'exceptions': const [],
        'deviceTimestamp': '2026-06-02T03:00:00.000Z',
      },
      clientSubmissionId: envelope.operationId,
      authorizationVersion: envelope.authorizationVersion,
      authorityNodeId: envelope.authorityNodeId,
      authorityEpoch: envelope.authorityEpoch,
    );

    expect(body['clientSubmissionId'], 'op-1');
    expect(body['authorizationVersion'], '7');
    expect(body['authorityNodeId'], 'cloud');
    expect(body['authorityEpoch'], 1);
    expect(body.containsKey('operationId'), isFalse);
  });
}
