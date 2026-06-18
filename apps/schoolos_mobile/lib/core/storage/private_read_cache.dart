import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_preferences_service.dart';

final privateReadCacheProvider = Provider<PrivateReadCache>((ref) {
  return PrivateReadCache(ref.watch(appPreferencesServiceProvider));
});

class PrivateReadCache {
  const PrivateReadCache(this._preferences);

  final AppPreferencesService _preferences;

  Future<void> write(String key, Map<String, dynamic> data) async {
    await _preferences.savePrivateCache(
      key,
      jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': data}),
    );
  }

  CachedPrivateRead? read(String key) {
    final raw = _preferences.getPrivateCache(key);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic> ||
          decoded['data'] is! Map<String, dynamic>) {
        return null;
      }
      return CachedPrivateRead(
        data: decoded['data'] as Map<String, dynamic>,
        savedAt:
            DateTime.tryParse(decoded['savedAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
    } catch (_) {
      return null;
    }
  }
}

class CachedPrivateRead {
  const CachedPrivateRead({required this.data, required this.savedAt});

  final Map<String, dynamic> data;
  final DateTime savedAt;

  Map<String, dynamic> withMetadata() => {
    ...data,
    '_mobileLastUpdated': savedAt.toIso8601String(),
    '_mobileFromCache': true,
  };
}
