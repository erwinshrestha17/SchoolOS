import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/storage/teacher_attendance_scope_version_store.dart';

void main() {
  late _MemorySecureStore storage;

  setUp(() {
    storage = _MemorySecureStore();
  });

  TeacherAttendanceScopeVersionStore store({
    String tenantId = 'tenant-1',
    String userId = 'teacher-1',
    String role = 'subject_teacher',
  }) {
    return TeacherAttendanceScopeVersionStore(
      storage,
      scope: TeacherAttendanceScopeVersionScope(
        tenantId: tenantId,
        userId: userId,
        role: role,
      ),
    );
  }

  test(
    'stores a decimal version in tenant and normalized teacher scope',
    () async {
      final first = store();
      await first.write('1722438000000');

      expect(await first.read(), '1722438000000');
      expect(await store(userId: 'teacher-2').read(), isNull);
      expect(await store(tenantId: 'tenant-2').read(), isNull);
    },
  );

  test('rejects invalid versions and quarantines corrupt records', () async {
    final versions = store();

    await expectLater(versions.write('-1'), throwsA(isA<CacheException>()));
    await expectLater(versions.write('01'), throwsA(isA<CacheException>()));
    await versions.write('7');
    storage.values.updateAll((_, _) => '{"scopeVersion":"7.1"}');

    final state = await versions.readState();
    expect(state?.scopeVersion, isNull);
    expect(state?.quarantined, isTrue);
    expect(storage.values, isNotEmpty);

    await versions.write('8');
    expect(await versions.read(), '8');
    expect(await versions.isQuarantined(), isFalse);
  });

  test('quarantines a namespace-mismatched record', () async {
    final versions = store();
    await versions.write('7');
    storage.values.updateAll(
      (_, _) =>
          '{"schemaVersion":1,"namespace":"other",'
          '"scopeVersion":"7","quarantined":false}',
    );

    final state = await versions.readState();
    expect(state?.scopeVersion, isNull);
    expect(state?.quarantined, isTrue);
    expect(storage.values, isNotEmpty);
  });

  test('fails closed without a valid teacher session scope', () async {
    final versions = TeacherAttendanceScopeVersionStore(storage, scope: null);

    await expectLater(versions.read(), throwsA(isA<CacheException>()));
    await expectLater(versions.write('1'), throwsA(isA<CacheException>()));
    await expectLater(versions.clear(), throwsA(isA<CacheException>()));
  });

  test('propagates secure deletion failure', () async {
    final versions = store();
    await versions.write('1');
    storage.failDelete = true;

    await expectLater(versions.clear(), throwsA(isA<CacheException>()));
  });

  test('propagates secure write failure', () async {
    final versions = store();
    storage.failWrite = true;

    await expectLater(versions.write('1'), throwsA(isA<CacheException>()));
    await expectLater(
      versions.quarantine(clearVersion: true),
      throwsA(isA<CacheException>()),
    );
  });

  test('persists quarantine and can clear the prior version', () async {
    final versions = store();
    await versions.write('7');

    await versions.quarantine(clearVersion: false);
    expect((await versions.readState())?.scopeVersion, '7');
    expect(await versions.isQuarantined(), isTrue);

    await versions.quarantine(clearVersion: true);
    expect((await versions.readState())?.scopeVersion, isNull);
    expect(await versions.isQuarantined(), isTrue);

    await versions.write('8');
    expect(await versions.read(), '8');
    expect(await versions.isQuarantined(), isFalse);
  });
}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  bool failDelete = false;
  bool failWrite = false;

  @override
  Future<void> write(String key, String value) async {
    if (failWrite) throw StateError('write failed');
    values[key] = value;
  }

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async {
    if (failDelete) throw StateError('delete failed');
    values.remove(key);
  }

  @override
  Future<void> clearAll() async {
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}
