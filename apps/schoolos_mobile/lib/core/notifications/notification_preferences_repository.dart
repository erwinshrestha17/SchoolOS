import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../network/api_client.dart';

enum NotificationPreferenceCategory {
  general,
  attendance,
  fees,
  notice,
  security,
  emergency;

  String get apiValue => switch (this) {
    NotificationPreferenceCategory.general => 'GENERAL',
    NotificationPreferenceCategory.attendance => 'ATTENDANCE',
    NotificationPreferenceCategory.fees => 'FEES',
    NotificationPreferenceCategory.notice => 'NOTICE',
    NotificationPreferenceCategory.security => 'SECURITY',
    NotificationPreferenceCategory.emergency => 'EMERGENCY',
  };

  String get label => switch (this) {
    NotificationPreferenceCategory.general => 'General updates',
    NotificationPreferenceCategory.attendance => 'Attendance',
    NotificationPreferenceCategory.fees => 'Fees',
    NotificationPreferenceCategory.notice => 'Notices',
    NotificationPreferenceCategory.security => 'Security alerts',
    NotificationPreferenceCategory.emergency => 'Safety alerts',
  };

  String get description => switch (this) {
    NotificationPreferenceCategory.general => 'Everyday school updates',
    NotificationPreferenceCategory.attendance =>
      'Absence, late arrival, and attendance notices',
    NotificationPreferenceCategory.fees => 'Fee reminders and payment updates',
    NotificationPreferenceCategory.notice => 'School notices and announcements',
    NotificationPreferenceCategory.security =>
      'Account and security notifications (always on)',
    NotificationPreferenceCategory.emergency =>
      'Critical school safety alerts (always on)',
  };

  bool get isMandatory =>
      this == NotificationPreferenceCategory.security ||
      this == NotificationPreferenceCategory.emergency;

  static NotificationPreferenceCategory? fromApi(String? value) {
    return switch (value) {
      'GENERAL' => NotificationPreferenceCategory.general,
      'ATTENDANCE' => NotificationPreferenceCategory.attendance,
      'FEES' => NotificationPreferenceCategory.fees,
      'NOTICE' => NotificationPreferenceCategory.notice,
      'SECURITY' => NotificationPreferenceCategory.security,
      'EMERGENCY' => NotificationPreferenceCategory.emergency,
      _ => null,
    };
  }
}

class NotificationPreferenceOverride {
  const NotificationPreferenceOverride({
    required this.category,
    required this.channel,
    required this.enabled,
  });

  final NotificationPreferenceCategory category;
  final String channel;
  final bool enabled;

  factory NotificationPreferenceOverride.fromJson(Map<String, dynamic> json) {
    return NotificationPreferenceOverride(
      category:
          NotificationPreferenceCategory.fromApi(json['category'] as String?) ??
          NotificationPreferenceCategory.general,
      channel: json['channel'] as String? ?? 'PUSH',
      enabled: json['enabled'] as bool? ?? true,
    );
  }
}

class NotificationPreferenceSummary {
  const NotificationPreferenceSummary({required this.overrides});

  final List<NotificationPreferenceOverride> overrides;

  factory NotificationPreferenceSummary.fromJson(Map<String, dynamic> json) {
    final overrides = (json['overrides'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(NotificationPreferenceOverride.fromJson)
        .toList();
    return NotificationPreferenceSummary(overrides: overrides);
  }

  bool isPushEnabled(NotificationPreferenceCategory category) {
    if (category.isMandatory) return true;
    for (final override in overrides) {
      if (override.category == category && override.channel == 'PUSH') {
        return override.enabled;
      }
    }
    return true;
  }
}

final notificationPreferencesRepositoryProvider =
    Provider<NotificationPreferencesRepository>((ref) {
      return NotificationPreferencesRepository(ref.watch(apiClientProvider));
    });

class NotificationPreferencesRepository {
  const NotificationPreferencesRepository(this._client);

  final ApiClient _client;

  Future<NotificationPreferenceSummary> getOwn() async {
    final response = await _client.get('/notifications/preferences/me');
    return NotificationPreferenceSummary.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<void> updatePushPreference({
    required NotificationPreferenceCategory category,
    required bool enabled,
  }) async {
    await _client.patch(
      '/notifications/preferences/me',
      data: {
        'category': category.apiValue,
        'channel': 'PUSH',
        'enabled': category.isMandatory ? true : enabled,
      },
    );
  }
}
