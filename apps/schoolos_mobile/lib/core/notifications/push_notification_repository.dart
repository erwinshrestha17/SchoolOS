import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../network/api_client.dart';

final pushNotificationRepositoryProvider = Provider<PushNotificationRepository>(
  (ref) => PushNotificationRepository(ref.watch(apiClientProvider)),
);

class PushNotificationRepository {
  const PushNotificationRepository(this._client);

  final ApiClient _client;

  Future<PushTokenRegistration> register({
    required String token,
    required String installationId,
    required String platform,
  }) async {
    final response = await _client.post(
      '/mobile/push-tokens',
      data: {
        'token': token,
        'installationId': installationId,
        'platform': platform,
      },
    );
    return PushTokenRegistration.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<void> revoke(String installationId) async {
    await _client.delete(
      '/mobile/push-tokens/${Uri.encodeComponent(installationId)}',
    );
  }
}

class PushTokenRegistration {
  const PushTokenRegistration({
    required this.registered,
    required this.providerEnabled,
    this.failureCode,
    this.failureReason,
  });

  final bool registered;
  final bool providerEnabled;
  final String? failureCode;
  final String? failureReason;

  factory PushTokenRegistration.fromJson(Map<String, dynamic> json) {
    final provider = json['provider'] is Map<String, dynamic>
        ? json['provider'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return PushTokenRegistration(
      registered: json['registered'] as bool? ?? false,
      providerEnabled: provider['enabled'] as bool? ?? false,
      failureCode: provider['failureCode'] as String?,
      failureReason: provider['failureReason'] as String?,
    );
  }
}
