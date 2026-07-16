import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import 'app_preferences_service.dart';
import 'private_storage_keys.dart';
import 'secure_storage_service.dart';

final teacherAttendanceDraftStoreProvider =
    Provider<TeacherAttendanceDraftStore>((ref) {
      final auth = ref.watch(authProvider);
      final user = auth.user;
      final role = MobileRole.normalize(
        auth.role ?? user?.role,
        roles: user?.roles ?? const [],
      );
      final scope =
          auth.status == AuthStatus.authenticated &&
              user != null &&
              role == MobileRole.teacher
          ? TeacherAttendanceDraftScope(
              tenantId: user.tenantId ?? '',
              userId: user.id,
              role: role,
            )
          : null;

      return TeacherAttendanceDraftStore(
        ref.watch(secureStorageServiceProvider),
        preferences: ref.watch(appPreferencesServiceProvider),
        scope: scope,
      );
    });

class TeacherAttendanceDraftScope {
  TeacherAttendanceDraftScope({
    required this.tenantId,
    required this.userId,
    required String role,
  }) : role = MobileRole.normalize(role);

  final String tenantId;
  final String userId;
  final String role;

  bool get isValid =>
      tenantId.trim().isNotEmpty &&
      userId.trim().isNotEmpty &&
      role == MobileRole.teacher;

  String get namespace => jsonEncode([
    TeacherAttendanceDraftStore.schemaVersion,
    tenantId.trim(),
    userId.trim(),
    role,
  ]);
}

class TeacherAttendanceDraftStore {
  TeacherAttendanceDraftStore(
    this._storage, {
    required this.scope,
    this.preferences,
    DateTime Function()? now,
    this.maxRecordBytes = defaultMaxRecordBytes,
    this.maxTotalBytes = defaultMaxTotalBytes,
  }) : _now = now ?? DateTime.now {
    if (maxRecordBytes <= 0 || maxTotalBytes < maxRecordBytes) {
      throw ArgumentError(
        'Attendance draft quotas must be positive and total must cover one record.',
      );
    }
  }

  static const schemaVersion = 1;
  static const ttl = Duration(hours: 48);
  static const defaultMaxRecordBytes = 64 * 1024;
  static const defaultMaxTotalBytes = 256 * 1024;
  static const _recordPrefix =
      '$teacherAttendanceDraftStoragePrefix$schemaVersion.';
  static final _safeClassSectionId = RegExp(r'^[a-zA-Z0-9_.:-]{1,180}$');
  static final _safeDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');

  final SecureKeyValueStore _storage;
  final TeacherAttendanceDraftScope? scope;
  final AppPreferencesService? preferences;
  final DateTime Function() _now;
  final int maxRecordBytes;
  final int maxTotalBytes;

  Future<void> _pendingOperation = Future<void>.value();
  bool _legacyPurged = false;

  Future<bool> write({
    required String classSectionId,
    required String date,
    required Map<String, dynamic> payload,
  }) {
    return _synchronized(() async {
      try {
        await _purgeLegacyPreferences();
        final activeScope = scope;
        if (!_isValidRequest(activeScope, classSectionId, date)) return false;

        final savedAt = _now().toUtc();
        final serialized = jsonEncode({
          'schemaVersion': schemaVersion,
          'namespace': activeScope!.namespace,
          'classSectionId': classSectionId,
          'date': date,
          'savedAt': savedAt.toIso8601String(),
          'expiresAt': savedAt.add(ttl).toIso8601String(),
          'payload': payload,
        });
        final recordBytes = utf8.encode(serialized).length;
        final storageKey = _storageKey(activeScope, classSectionId, date);
        if (recordBytes > maxRecordBytes || recordBytes > maxTotalBytes) {
          return false;
        }
        if (!await _makeRoomFor(storageKey, recordBytes, savedAt)) {
          return false;
        }

        await _storage.write(storageKey, serialized);
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  Future<Map<String, dynamic>?> read({
    required String classSectionId,
    required String date,
  }) {
    return _synchronized(() async {
      try {
        await _purgeLegacyPreferences();
        final activeScope = scope;
        if (!_isValidRequest(activeScope, classSectionId, date)) return null;

        final storageKey = _storageKey(activeScope!, classSectionId, date);
        final raw = await _storage.read(storageKey);
        if (raw == null || raw.isEmpty) return null;
        final decoded = _decode(raw);
        if (decoded == null ||
            decoded.namespace != activeScope.namespace ||
            decoded.classSectionId != classSectionId ||
            decoded.date != date) {
          await _storage.delete(storageKey);
          return null;
        }
        if (!_now().toUtc().isBefore(decoded.expiresAt)) {
          await _storage.delete(storageKey);
          return null;
        }
        return decoded.payload;
      } catch (_) {
        return null;
      }
    });
  }

  Future<void> delete({required String classSectionId, required String date}) {
    return _synchronized(() async {
      final activeScope = scope;
      if (!_isValidRequest(activeScope, classSectionId, date)) return;
      try {
        await _storage.delete(_storageKey(activeScope!, classSectionId, date));
      } catch (_) {
        // A later logout still performs prefix cleanup.
      }
    });
  }

  bool _isValidRequest(
    TeacherAttendanceDraftScope? activeScope,
    String classSectionId,
    String date,
  ) {
    return activeScope != null &&
        activeScope.isValid &&
        _safeClassSectionId.hasMatch(classSectionId) &&
        _safeDate.hasMatch(date);
  }

  Future<bool> _makeRoomFor(
    String targetKey,
    int targetBytes,
    DateTime now,
  ) async {
    final values = await _storage.readAll();
    var totalBytes = 0;
    for (final entry in values.entries) {
      if (!entry.key.startsWith(_recordPrefix) || entry.key == targetKey) {
        continue;
      }
      final decoded = _decode(entry.value);
      if (decoded == null || !now.isBefore(decoded.expiresAt)) {
        await _storage.delete(entry.key);
        continue;
      }
      final size = utf8.encode(entry.value).length;
      totalBytes += size;
    }
    return totalBytes + targetBytes <= maxTotalBytes;
  }

  _DraftRecord? _decode(String raw) {
    try {
      final value = jsonDecode(raw);
      if (value is! Map<String, dynamic> ||
          value['schemaVersion'] != schemaVersion ||
          value['namespace'] is! String ||
          value['classSectionId'] is! String ||
          value['date'] is! String ||
          value['payload'] is! Map<String, dynamic>) {
        return null;
      }
      final savedAt = DateTime.tryParse(value['savedAt'] as String? ?? '');
      final expiresAt = DateTime.tryParse(value['expiresAt'] as String? ?? '');
      if (savedAt == null || expiresAt == null) return null;
      return _DraftRecord(
        namespace: value['namespace'] as String,
        classSectionId: value['classSectionId'] as String,
        date: value['date'] as String,
        payload: Map<String, dynamic>.from(
          value['payload'] as Map<String, dynamic>,
        ),
        savedAt: savedAt.toUtc(),
        expiresAt: expiresAt.toUtc(),
      );
    } catch (_) {
      return null;
    }
  }

  String _storageKey(
    TeacherAttendanceDraftScope activeScope,
    String classSectionId,
    String date,
  ) {
    final encoded = base64Url
        .encode(
          utf8.encode(
            '${activeScope.namespace}\u001f$classSectionId\u001f$date',
          ),
        )
        .replaceAll('=', '');
    return '$_recordPrefix$encoded';
  }

  Future<void> _purgeLegacyPreferences() async {
    if (_legacyPurged) return;
    try {
      await preferences?.purgeLegacyTeacherAttendanceDrafts();
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

class _DraftRecord {
  const _DraftRecord({
    required this.namespace,
    required this.classSectionId,
    required this.date,
    required this.payload,
    required this.savedAt,
    required this.expiresAt,
  });

  final String namespace;
  final String classSectionId;
  final String date;
  final Map<String, dynamic> payload;
  final DateTime savedAt;
  final DateTime expiresAt;
}
