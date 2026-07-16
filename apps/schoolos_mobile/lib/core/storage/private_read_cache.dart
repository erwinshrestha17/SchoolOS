import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import 'app_preferences_service.dart';
import 'private_storage_keys.dart';
import 'secure_storage_service.dart';

final privateReadCacheProvider = Provider<PrivateReadCache>((ref) {
  final auth = ref.watch(authProvider);
  final user = auth.user;
  final scope = auth.status == AuthStatus.authenticated && user != null
      ? PrivateReadCacheScope(
          tenantId: user.tenantId ?? '',
          userId: user.id,
          role: MobileRole.normalize(auth.role ?? user.role, roles: user.roles),
        )
      : null;

  return PrivateReadCache(
    ref.watch(secureStorageServiceProvider),
    preferences: ref.watch(appPreferencesServiceProvider),
    scope: scope,
  );
});

class PrivateReadCacheScope {
  PrivateReadCacheScope({
    required this.tenantId,
    required this.userId,
    required String role,
  }) : role = MobileRole.normalize(role);

  final String tenantId;
  final String userId;
  final String role;

  bool get isValid {
    return tenantId.trim().isNotEmpty &&
        userId.trim().isNotEmpty &&
        _supportedRoles.contains(role);
  }

  String get namespace => jsonEncode([
    PrivateReadCache.schemaVersion,
    tenantId.trim(),
    userId.trim(),
    role,
  ]);

  static const _supportedRoles = {
    MobileRole.parent,
    MobileRole.teacher,
    MobileRole.staff,
    MobileRole.principal,
    MobileRole.admin,
    MobileRole.student,
    MobileRole.driver,
  };
}

class PrivateReadCache {
  PrivateReadCache(
    this._storage, {
    required this.scope,
    this.preferences,
    DateTime Function()? now,
    this.maxRecordBytes = defaultMaxRecordBytes,
    this.maxTotalBytes = defaultMaxTotalBytes,
  }) : _now = now ?? DateTime.now {
    if (maxRecordBytes <= 0 || maxTotalBytes < maxRecordBytes) {
      throw ArgumentError(
        'Private read cache quotas must be positive and total must cover one record.',
      );
    }
  }

  static const schemaVersion = 1;
  static const defaultMaxRecordBytes = 64 * 1024;
  static const defaultMaxTotalBytes = 512 * 1024;

  static const _recordPrefix = '$privateReadCacheStoragePrefix$schemaVersion.';
  static final _safeResourceKey = RegExp(r'^[a-zA-Z0-9_.:-]{1,180}$');

  final SecureKeyValueStore _storage;
  final AppPreferencesService? preferences;
  final PrivateReadCacheScope? scope;
  final DateTime Function() _now;
  final int maxRecordBytes;
  final int maxTotalBytes;

  Future<void> _pendingOperation = Future<void>.value();
  bool _legacyPurged = false;

  Future<bool> write(String resourceKey, Map<String, dynamic> data) {
    return _synchronized(() async {
      try {
        await _purgeLegacyPreferences();
        final policy = _policyFor(resourceKey);
        final activeScope = scope;
        if (activeScope == null || !activeScope.isValid || policy == null) {
          return false;
        }

        final payload = Map<String, dynamic>.from(data)
          ..remove('_mobileFromCache')
          ..remove('_mobileLastUpdated');
        if (_containsProtectedOrImageMaterial(payload)) {
          return false;
        }

        final savedAt = _now().toUtc();
        final serialized = jsonEncode({
          'schemaVersion': schemaVersion,
          'namespace': activeScope.namespace,
          'resourceKey': resourceKey,
          'savedAt': savedAt.toIso8601String(),
          'expiresAt': savedAt.add(policy).toIso8601String(),
          'data': payload,
        });
        final recordBytes = utf8.encode(serialized).length;
        final storageKey = _storageKey(activeScope, resourceKey);
        if (recordBytes > maxRecordBytes || recordBytes > maxTotalBytes) {
          await _storage.delete(storageKey);
          return false;
        }

        if (!await _makeRoomFor(storageKey, recordBytes, savedAt)) {
          await _storage.delete(storageKey);
          return false;
        }
        await _storage.write(storageKey, serialized);
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  Future<CachedPrivateRead?> read(String resourceKey) {
    return _synchronized(() async {
      try {
        await _purgeLegacyPreferences();
        final policy = _policyFor(resourceKey);
        final activeScope = scope;
        if (activeScope == null || !activeScope.isValid || policy == null) {
          return null;
        }

        final storageKey = _storageKey(activeScope, resourceKey);
        final raw = await _storage.read(storageKey);
        if (raw == null || raw.isEmpty) return null;

        final decoded = _decodeRecord(raw);
        if (decoded == null ||
            decoded.namespace != activeScope.namespace ||
            decoded.resourceKey != resourceKey) {
          await _storage.delete(storageKey);
          return null;
        }

        final policyExpiry = decoded.savedAt.add(policy);
        final effectiveExpiry = decoded.expiresAt.isBefore(policyExpiry)
            ? decoded.expiresAt
            : policyExpiry;
        if (!_now().toUtc().isBefore(effectiveExpiry)) {
          await _storage.delete(storageKey);
          return null;
        }

        return CachedPrivateRead(
          data: decoded.data,
          savedAt: decoded.savedAt,
          expiresAt: effectiveExpiry,
        );
      } catch (_) {
        return null;
      }
    });
  }

  Future<void> clear() async {
    await _storage.deleteByPrefix(privateReadCacheStoragePrefix);
    await preferences?.purgeLegacyPrivateReadCache();
  }

  Duration? _policyFor(String resourceKey) {
    final activeScope = scope;
    if (activeScope == null || !_safeResourceKey.hasMatch(resourceKey)) {
      return null;
    }

    switch (activeScope.role) {
      case MobileRole.parent:
        if (resourceKey == 'parent_children') return const Duration(hours: 6);
        if (resourceKey.startsWith('parent_homework_') ||
            resourceKey.startsWith('parent_timetable_') ||
            resourceKey.startsWith('parent_exam_schedule_') ||
            resourceKey.startsWith('attendance_')) {
          return const Duration(hours: 24);
        }
        if (resourceKey == 'notice_feed') return const Duration(hours: 12);
        return null;
      case MobileRole.teacher:
        if (resourceKey == 'teacher_assigned_classes') {
          return const Duration(hours: 8);
        }
        if (resourceKey.startsWith('teacher_today_') ||
            resourceKey.startsWith('teacher_roster_')) {
          return const Duration(hours: 12);
        }
        if (resourceKey.startsWith('teacher_homework_') ||
            resourceKey == 'teacher_timetable_week') {
          return const Duration(hours: 24);
        }
        if (resourceKey == 'notice_feed') return const Duration(hours: 12);
        return null;
      case MobileRole.staff:
      case MobileRole.driver:
        return resourceKey == 'notice_feed' ? const Duration(hours: 12) : null;
      case MobileRole.principal:
      case MobileRole.admin:
      case MobileRole.student:
        return null;
      default:
        return null;
    }
  }

  Future<bool> _makeRoomFor(
    String targetKey,
    int targetBytes,
    DateTime now,
  ) async {
    final values = await _storage.readAll();
    final candidates = <_StoredCandidate>[];
    var totalBytes = 0;

    for (final entry in values.entries) {
      if (!entry.key.startsWith(_recordPrefix) || entry.key == targetKey) {
        continue;
      }
      final decoded = _decodeRecord(entry.value);
      if (decoded == null || !now.isBefore(decoded.expiresAt)) {
        await _storage.delete(entry.key);
        continue;
      }
      final size = utf8.encode(entry.value).length;
      totalBytes += size;
      candidates.add(
        _StoredCandidate(
          storageKey: entry.key,
          savedAt: decoded.savedAt,
          size: size,
        ),
      );
    }

    candidates.sort((a, b) => a.savedAt.compareTo(b.savedAt));
    for (final candidate in candidates) {
      if (totalBytes + targetBytes <= maxTotalBytes) break;
      await _storage.delete(candidate.storageKey);
      totalBytes -= candidate.size;
    }
    return totalBytes + targetBytes <= maxTotalBytes;
  }

  _StoredRecord? _decodeRecord(String raw) {
    try {
      final value = jsonDecode(raw);
      if (value is! Map<String, dynamic> ||
          value['schemaVersion'] != schemaVersion ||
          value['namespace'] is! String ||
          value['resourceKey'] is! String ||
          value['data'] is! Map<String, dynamic>) {
        return null;
      }
      final savedAt = DateTime.tryParse(value['savedAt'] as String? ?? '');
      final expiresAt = DateTime.tryParse(value['expiresAt'] as String? ?? '');
      if (savedAt == null || expiresAt == null) return null;

      return _StoredRecord(
        namespace: value['namespace'] as String,
        resourceKey: value['resourceKey'] as String,
        data: Map<String, dynamic>.from(value['data'] as Map<String, dynamic>),
        savedAt: savedAt.toUtc(),
        expiresAt: expiresAt.toUtc(),
      );
    } catch (_) {
      return null;
    }
  }

  String _storageKey(PrivateReadCacheScope activeScope, String resourceKey) {
    final encoded = base64Url
        .encode(utf8.encode('${activeScope.namespace}\u001f$resourceKey'))
        .replaceAll('=', '');
    return '$_recordPrefix$encoded';
  }

  Future<void> _purgeLegacyPreferences() async {
    if (_legacyPurged) return;
    try {
      await preferences?.purgeLegacyPrivateReadCache();
    } finally {
      _legacyPurged = true;
    }
  }

  Future<T> _synchronized<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _pendingOperation = _pendingOperation.then((_) async {
      try {
        completer.complete(await action());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }
}

class CachedPrivateRead {
  const CachedPrivateRead({
    required this.data,
    required this.savedAt,
    required this.expiresAt,
  });

  final Map<String, dynamic> data;
  final DateTime savedAt;
  final DateTime expiresAt;

  Map<String, dynamic> withMetadata() => {
    ...data,
    '_mobileLastUpdated': savedAt.toIso8601String(),
    '_mobileFromCache': true,
  };
}

class _StoredRecord {
  const _StoredRecord({
    required this.namespace,
    required this.resourceKey,
    required this.data,
    required this.savedAt,
    required this.expiresAt,
  });

  final String namespace;
  final String resourceKey;
  final Map<String, dynamic> data;
  final DateTime savedAt;
  final DateTime expiresAt;
}

class _StoredCandidate {
  const _StoredCandidate({
    required this.storageKey,
    required this.savedAt,
    required this.size,
  });

  final String storageKey;
  final DateTime savedAt;
  final int size;
}

bool _containsProtectedOrImageMaterial(Object? value) {
  if (value is Map) {
    for (final entry in value.entries) {
      final key = entry.key.toString().toLowerCase();
      if (_disallowedCacheFields.contains(key) ||
          _containsProtectedOrImageMaterial(entry.value)) {
        return true;
      }
    }
  } else if (value is Iterable) {
    return value.any(_containsProtectedOrImageMaterial);
  } else if (value is String) {
    final normalized = value.trim().toLowerCase();
    return normalized.startsWith('data:') ||
        normalized.startsWith('file:') ||
        normalized.startsWith('blob:');
  }
  return false;
}

const _disallowedCacheFields = {
  'avatarurl',
  'avatar_url',
  'base64',
  'bytes',
  'downloadpath',
  'download_path',
  'downloadurl',
  'download_url',
  'fileurl',
  'file_url',
  'objectkey',
  'object_key',
  'photourl',
  'photo_url',
  'previewpath',
  'preview_path',
  'signedurl',
  'signed_url',
  'storagekey',
  'storage_key',
  'thumbnailpath',
  'thumbnail_path',
  'thumbnailurl',
  'thumbnail_url',
};
