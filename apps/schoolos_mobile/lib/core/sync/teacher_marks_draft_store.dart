import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/mobile_role.dart';
import '../storage/secure_storage_service.dart';

final teacherMarksDraftStoreProvider = Provider<TeacherMarksDraftStore>((ref) {
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
      ? TeacherMarksDraftScope(tenantId: user.tenantId ?? '', userId: user.id)
      : null;
  return TeacherMarksDraftStore(
    ref.watch(secureStorageServiceProvider),
    scope: scope,
  );
});

class TeacherMarksDraftScope {
  const TeacherMarksDraftScope({required this.tenantId, required this.userId});

  final String tenantId;
  final String userId;

  bool get isValid => tenantId.trim().isNotEmpty && userId.trim().isNotEmpty;
}

class TeacherMarksDraftStore {
  TeacherMarksDraftStore(this._storage, {required this.scope});

  static const _prefix = 'schoolos.teacher_marks_draft.secure.1.';

  final SecureKeyValueStore _storage;
  final TeacherMarksDraftScope? scope;

  Future<void> write({
    required String operationId,
    required Map<String, dynamic> payload,
  }) async {
    final activeScope = scope;
    if (activeScope == null || !activeScope.isValid) return;
    await _storage.write(
      '$_prefix${activeScope.tenantId}.${activeScope.userId}.$operationId',
      jsonEncode({
        'operationId': operationId,
        'payload': payload,
        'savedAt': DateTime.now().toUtc().toIso8601String(),
      }),
    );
  }

  Future<List<Map<String, dynamic>>> listQueued() async {
    final activeScope = scope;
    if (activeScope == null || !activeScope.isValid) return const [];
    final prefix = '$_prefix${activeScope.tenantId}.${activeScope.userId}.';
    final values = await _storage.readAll();
    final drafts = <Map<String, dynamic>>[];
    for (final entry in values.entries) {
      if (!entry.key.startsWith(prefix)) continue;
      try {
        final decoded = jsonDecode(entry.value);
        if (decoded is Map<String, dynamic>) {
          drafts.add(decoded);
        }
      } catch (_) {
        continue;
      }
    }
    return drafts;
  }

  Future<void> delete(String operationId) async {
    final activeScope = scope;
    if (activeScope == null || !activeScope.isValid) return;
    await _storage.delete(
      '$_prefix${activeScope.tenantId}.${activeScope.userId}.$operationId',
    );
  }
}
