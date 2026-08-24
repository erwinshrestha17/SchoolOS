import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import '../errors/app_exception.dart';
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

  Future<bool> write(
    String resourceKey,
    Map<String, dynamic> data, {
    String? authorizationScopeVersion,
    Future<bool> Function()? beforeCommit,
  }) {
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
          'authorizationScopeVersion': ?authorizationScopeVersion,
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
        if (beforeCommit != null && !await beforeCommit()) {
          return false;
        }
        await _storage.write(storageKey, serialized);
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  Future<CachedPrivateRead?> read(
    String resourceKey, {
    String? expectedAuthorizationScopeVersion,
    bool enforceAuthorizationScopeVersion = false,
    Future<bool> Function()? beforeReturn,
  }) {
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
        if (enforceAuthorizationScopeVersion &&
            decoded.authorizationScopeVersion !=
                expectedAuthorizationScopeVersion) {
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
        if (beforeReturn != null && !await beforeReturn()) {
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

  /// Drops every record of the current scope whose resource key matches.
  ///
  /// For when the *subject* of a cached read stops being visible to this user
  /// - a guardian link removed, say - which the record's own expiry would
  /// otherwise take hours to catch up with. Scoped to the caller's own
  /// namespace, so one user can never evict another's records.
  Future<void> deleteWhere(bool Function(String resourceKey) test) {
    return _synchronized(() async {
      try {
        final activeScope = scope;
        if (activeScope == null || !activeScope.isValid) return;

        final values = await _storage.readAll();
        for (final entry in values.entries) {
          if (!entry.key.startsWith(_recordPrefix)) continue;
          final decoded = _decodeRecord(entry.value);
          if (decoded == null || decoded.namespace != activeScope.namespace) {
            continue;
          }
          if (test(decoded.resourceKey)) {
            await _storage.delete(entry.key);
          }
        }
      } catch (_) {
        // Best effort: a failed prune must not break the caller's load.
      }
    });
  }

  /// Strictly removes only teacher-attendance reads in the current secure
  /// tenant/user namespace. Authorization invalidation must observe failures;
  /// unlike [deleteWhere], this operation never degrades to best effort.
  Future<void> clearTeacherAttendanceScopeStrict() {
    return _synchronized(() async {
      final activeScope = scope;
      if (activeScope == null ||
          !activeScope.isValid ||
          activeScope.role != MobileRole.teacher) {
        throw const CacheException(
          'Teacher attendance cache scope is unavailable for this session.',
        );
      }

      late final Map<String, String> values;
      try {
        values = await _storage.readAll();
      } catch (_) {
        throw const CacheException(
          'Teacher attendance cache could not be inspected securely.',
        );
      }

      var deletionFailed = false;
      for (final entry in values.entries) {
        if (!entry.key.startsWith(_recordPrefix)) continue;
        final decoded = _decodeRecord(entry.value);
        final identity = decoded == null
            ? _decodeStorageKeyIdentity(entry.key)
            : _PrivateReadCacheIdentity(
                namespace: decoded.namespace,
                resourceKey: decoded.resourceKey,
              );
        if (identity == null ||
            identity.namespace != activeScope.namespace ||
            !_isTeacherAttendanceResourceKey(identity.resourceKey)) {
          continue;
        }
        try {
          await _storage.delete(entry.key);
        } catch (_) {
          deletionFailed = true;
        }
      }

      if (deletionFailed) {
        throw const CacheException(
          'Teacher attendance cache could not be cleared securely.',
        );
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
        // The whole Today dashboard for one child. Twelve hours is the
        // freshness ceiling: a school day is six to eight hours, so a
        // snapshot can carry this morning into this evening but can never
        // present yesterday's attendance or fee balance as if it were today's
        // - past the window the record is deleted and the parent gets the
        // error state and a real fetch instead.
        if (resourceKey.startsWith('parent_dashboard_v')) {
          return const Duration(hours: 12);
        }
        // The fee and attendance figures behind that snapshot, on the same
        // twelve-hour ceiling and for the same reason: they must never carry
        // yesterday into today. The child *profile* stays off this list on
        // purpose - see the note in `getChildProfileForChild`.
        if (resourceKey.startsWith('parent_dashboard_summary_')) {
          return const Duration(hours: 12);
        }
        // One record per notice, so a cached detail can only ever stand in
        // for the notice it was fetched for.
        if (resourceKey.startsWith('notice_detail_')) {
          return const Duration(hours: 12);
        }
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
      final rawAuthorizationScopeVersion = value['authorizationScopeVersion'];
      if (savedAt == null ||
          expiresAt == null ||
          (rawAuthorizationScopeVersion != null &&
              rawAuthorizationScopeVersion is! String)) {
        return null;
      }

      return _StoredRecord(
        namespace: value['namespace'] as String,
        resourceKey: value['resourceKey'] as String,
        authorizationScopeVersion: rawAuthorizationScopeVersion as String?,
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

  _PrivateReadCacheIdentity? _decodeStorageKeyIdentity(String storageKey) {
    if (!storageKey.startsWith(_recordPrefix)) return null;
    try {
      final encoded = storageKey.substring(_recordPrefix.length);
      final decoded = utf8.decode(
        base64Url.decode(base64Url.normalize(encoded)),
      );
      final separator = decoded.indexOf('\u001f');
      if (separator <= 0 || separator == decoded.length - 1) return null;
      return _PrivateReadCacheIdentity(
        namespace: decoded.substring(0, separator),
        resourceKey: decoded.substring(separator + 1),
      );
    } catch (_) {
      return null;
    }
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

bool _isTeacherAttendanceResourceKey(String resourceKey) =>
    resourceKey == 'teacher_assigned_classes' ||
    resourceKey.startsWith('teacher_today_') ||
    resourceKey.startsWith('teacher_roster_');

class _PrivateReadCacheIdentity {
  const _PrivateReadCacheIdentity({
    required this.namespace,
    required this.resourceKey,
  });

  final String namespace;
  final String resourceKey;
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
    required this.authorizationScopeVersion,
    required this.data,
    required this.savedAt,
    required this.expiresAt,
  });

  final String namespace;
  final String resourceKey;
  final String? authorizationScopeVersion;
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
