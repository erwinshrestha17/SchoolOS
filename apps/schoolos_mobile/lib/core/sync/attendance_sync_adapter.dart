import 'offline_sync_envelope.dart';

/// Attendance is the first production offline adapter. Later modules reuse
/// [OfflineSyncEnvelope] instead of inventing a second queue shape.
Map<String, dynamic> withAttendanceSyncEnvelope({
  required Map<String, dynamic> body,
  required String clientSubmissionId,
  String? authorizationVersion,
  String? authorityNodeId,
  int? authorityEpoch,
}) {
  final envelope = OfflineSyncEnvelope(
    operationId: clientSubmissionId,
    authorizationVersion: authorizationVersion,
    authorityNodeId: authorityNodeId,
    authorityEpoch: authorityEpoch,
  );
  return {
    ...body,
    'clientSubmissionId': envelope.operationId,
    if (envelope.authorizationVersion != null)
      'authorizationVersion': envelope.authorizationVersion,
    if (envelope.authorityNodeId != null)
      'authorityNodeId': envelope.authorityNodeId,
    if (envelope.authorityEpoch != null)
      'authorityEpoch': envelope.authorityEpoch,
  };
}
