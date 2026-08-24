import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import '../errors/app_exception.dart';
import 'private_storage_keys.dart';
import 'secure_storage_service.dart';

final teacherAttendanceScopeVersionStoreProvider =
    Provider<TeacherAttendanceScopeVersionStore>((ref) {
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
          ? TeacherAttendanceScopeVersionScope(
              tenantId: user.tenantId ?? '',
              userId: user.id,
              role: role,
            )
          : null;

      return TeacherAttendanceScopeVersionStore(
        ref.watch(secureStorageServiceProvider),
        scope: scope,
      );
    });

bool isValidTeacherAttendanceScopeVersion(String value) {
  return RegExp(r'^(0|[1-9][0-9]*)$').hasMatch(value);
}

class TeacherAttendanceScopeVersionScope {
  TeacherAttendanceScopeVersionScope({
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
    TeacherAttendanceScopeVersionStore.schemaVersion,
    tenantId.trim(),
    userId.trim(),
    role,
  ]);
}

class TeacherAttendanceScopeVersionStore {
  const TeacherAttendanceScopeVersionStore(
    this._storage, {
    required this.scope,
  });

  static const schemaVersion = 1;
  static const _recordPrefix =
      '$teacherAttendanceScopeVersionStoragePrefix$schemaVersion.';

  final SecureKeyValueStore _storage;
  final TeacherAttendanceScopeVersionScope? scope;

  Future<TeacherAttendanceScopeVersionState?> readState() async {
    final activeScope = _requireScope();
    final storageKey = _storageKey(activeScope);
    try {
      final raw = await _storage.read(storageKey);
      if (raw == null || raw.isEmpty) return null;

      final decoded = _decode(raw);
      if (decoded == null || decoded.namespace != activeScope.namespace) {
        await _writeState(
          storageKey: storageKey,
          namespace: activeScope.namespace,
          scopeVersion: null,
          quarantined: true,
        );
        return const TeacherAttendanceScopeVersionState(
          scopeVersion: null,
          quarantined: true,
        );
      }
      return TeacherAttendanceScopeVersionState(
        scopeVersion: decoded.scopeVersion,
        quarantined: decoded.quarantined,
      );
    } catch (error) {
      if (error is CacheException) rethrow;
      throw const CacheException(
        'Teacher attendance access state could not be read securely.',
      );
    }
  }

  Future<String?> read() async => (await readState())?.scopeVersion;

  Future<bool> isQuarantined() async =>
      (await readState())?.quarantined ?? false;

  Future<void> write(String scopeVersion) async {
    final activeScope = _requireScope();
    if (!isValidTeacherAttendanceScopeVersion(scopeVersion)) {
      throw const CacheException(
        'Teacher attendance access state was invalid.',
      );
    }

    try {
      await _writeState(
        storageKey: _storageKey(activeScope),
        namespace: activeScope.namespace,
        scopeVersion: scopeVersion,
        quarantined: false,
      );
    } catch (_) {
      throw const CacheException(
        'Teacher attendance access state could not be stored securely.',
      );
    }
  }

  Future<void> quarantine({required bool clearVersion}) async {
    final activeScope = _requireScope();
    try {
      final storageKey = _storageKey(activeScope);
      final raw = await _storage.read(storageKey);
      final decoded = raw == null ? null : _decode(raw);
      final priorVersion = decoded?.namespace == activeScope.namespace
          ? decoded?.scopeVersion
          : null;
      await _writeState(
        storageKey: storageKey,
        namespace: activeScope.namespace,
        scopeVersion: clearVersion ? null : priorVersion,
        quarantined: true,
      );
    } catch (_) {
      throw const CacheException(
        'Teacher attendance access state could not be quarantined securely.',
      );
    }
  }

  Future<void> clear() async {
    final activeScope = _requireScope();
    try {
      await _storage.delete(_storageKey(activeScope));
    } catch (_) {
      throw const CacheException(
        'Teacher attendance access state could not be cleared securely.',
      );
    }
  }

  TeacherAttendanceScopeVersionScope _requireScope() {
    final activeScope = scope;
    if (activeScope == null || !activeScope.isValid) {
      throw const CacheException(
        'Teacher attendance access state is unavailable for this session.',
      );
    }
    return activeScope;
  }

  _ScopeVersionRecord? _decode(String raw) {
    try {
      final value = jsonDecode(raw);
      if (value is! Map<String, dynamic> ||
          value['schemaVersion'] != schemaVersion ||
          value['namespace'] is! String ||
          value['quarantined'] is! bool) {
        return null;
      }
      final rawScopeVersion = value['scopeVersion'];
      if (rawScopeVersion != null && rawScopeVersion is! String) return null;
      final scopeVersion = rawScopeVersion as String?;
      if (scopeVersion != null &&
          !isValidTeacherAttendanceScopeVersion(scopeVersion)) {
        return null;
      }
      return _ScopeVersionRecord(
        namespace: value['namespace'] as String,
        scopeVersion: scopeVersion,
        quarantined: value['quarantined'] as bool,
      );
    } catch (_) {
      return null;
    }
  }

  String _storageKey(TeacherAttendanceScopeVersionScope activeScope) {
    final encoded = base64Url
        .encode(utf8.encode(activeScope.namespace))
        .replaceAll('=', '');
    return '$_recordPrefix$encoded';
  }

  Future<void> _writeState({
    required String storageKey,
    required String namespace,
    required String? scopeVersion,
    required bool quarantined,
  }) {
    return _storage.write(
      storageKey,
      jsonEncode({
        'schemaVersion': schemaVersion,
        'namespace': namespace,
        'scopeVersion': scopeVersion,
        'quarantined': quarantined,
      }),
    );
  }
}

class TeacherAttendanceScopeVersionState {
  const TeacherAttendanceScopeVersionState({
    required this.scopeVersion,
    required this.quarantined,
  });

  final String? scopeVersion;
  final bool quarantined;
}

class _ScopeVersionRecord {
  const _ScopeVersionRecord({
    required this.namespace,
    required this.scopeVersion,
    required this.quarantined,
  });

  final String namespace;
  final String? scopeVersion;
  final bool quarantined;
}
