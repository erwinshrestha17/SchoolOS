import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../network/api_client.dart';

class SchoolAuthorityFence {
  const SchoolAuthorityFence({
    required this.authorityNodeId,
    required this.authorityEpoch,
  });

  final String authorityNodeId;
  final int authorityEpoch;
}

final schoolAuthorityDiscoveryProvider = Provider<SchoolAuthorityDiscovery>((
  ref,
) {
  return SchoolAuthorityDiscovery(ref.watch(apiClientProvider));
});

/// Discovers the active school authority fence for this tenant.
/// This is Mode B fencing metadata, not a local NestJS Edge runtime.
class SchoolAuthorityDiscovery {
  SchoolAuthorityDiscovery(this._client);

  final ApiClient _client;
  SchoolAuthorityFence? _cached;

  SchoolAuthorityFence? get current => _cached;

  Map<String, dynamic> fields() {
    final fence = _cached;
    if (fence == null) return const {};
    return {
      'authorityNodeId': fence.authorityNodeId,
      'authorityEpoch': fence.authorityEpoch,
    };
  }

  Future<SchoolAuthorityFence?> refresh() async {
    try {
      final response = await _client.get<dynamic>('/sync/authority');
      final data = response.data;
      if (data is! Map) return _cached;
      final nodeId = data['authorityNodeId'];
      final epoch = data['authorityEpoch'];
      if (nodeId is! String || nodeId.trim().isEmpty) return _cached;
      final parsedEpoch = epoch is int
          ? epoch
          : epoch is num
          ? epoch.toInt()
          : int.tryParse('$epoch');
      if (parsedEpoch == null || parsedEpoch < 1) return _cached;
      _cached = SchoolAuthorityFence(
        authorityNodeId: nodeId.trim(),
        authorityEpoch: parsedEpoch,
      );
      return _cached;
    } catch (_) {
      return _cached;
    }
  }
}
