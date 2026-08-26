class OfflineSyncEnvelope {
  const OfflineSyncEnvelope({
    required this.operationId,
    this.authorizationVersion,
    this.expectedVersion,
    this.authorityNodeId,
    this.authorityEpoch,
  });

  final String operationId;
  final String? authorizationVersion;
  final String? expectedVersion;
  final String? authorityNodeId;
  final int? authorityEpoch;

  Map<String, dynamic> toJson() => {
    'operationId': operationId,
    if (authorizationVersion != null)
      'authorizationVersion': authorizationVersion,
    if (expectedVersion != null) 'expectedVersion': expectedVersion,
    if (authorityNodeId != null) 'authorityNodeId': authorityNodeId,
    if (authorityEpoch != null) 'authorityEpoch': authorityEpoch,
  };
}
