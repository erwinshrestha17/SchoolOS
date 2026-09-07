import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/notifications/device_installation_service.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';

void main() {
  test(
    'concurrent registration and logout share one persisted installation',
    () async {
      final storage = _Storage();
      final gate = Completer<void>();
      storage.beforeRead = () => gate.future;
      final service = DeviceInstallationService(storage);
      final registration = service.getOrCreateInstallationId();
      final logout = service.getOrCreateInstallationId();
      expect(registration, same(logout));
      gate.complete();
      final ids = await Future.wait([registration, logout]);
      expect(ids[0], ids[1]);
      expect(storage.reads, 1);
      expect(storage.writes, 1);
      expect(storage.value, ids[0]);
      expect(
        ids[0],
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
      expect(await service.getOrCreateInstallationId(), ids[0]);
      expect(storage.writes, 1);
    },
  );

  test(
    'secure-storage write failure retries and never returns an unpersisted ID',
    () async {
      final storage = _Storage()..failWrite = true;
      final service = DeviceInstallationService(storage);
      await expectLater(service.getOrCreateInstallationId(), throwsStateError);
      expect(storage.value, isNull);
      storage.failWrite = false;
      final id = await service.getOrCreateInstallationId();
      expect(storage.value, id);
      expect(storage.writes, 2);
    },
  );

  test(
    'invalid stored identity is replaced once, and a new instance reuses it',
    () async {
      final storage = _Storage()..value = 'invalid';
      final service = DeviceInstallationService(storage);
      final id = await service.getOrCreateInstallationId();
      expect(id, isNot('invalid'));
      expect(
        await DeviceInstallationService(storage).getOrCreateInstallationId(),
        id,
      );
      expect(storage.writes, 1);
    },
  );
}

class _Storage extends Fake implements SecureStorageService {
  String? value;
  int reads = 0;
  int writes = 0;
  bool failWrite = false;
  Future<void> Function()? beforeRead;
  @override
  Future<String?> read(String key) async {
    expect(key, 'school_os_push_installation_id');
    reads++;
    await beforeRead?.call();
    return value;
  }

  @override
  Future<void> write(String key, String newValue) async {
    expect(key, 'school_os_push_installation_id');
    writes++;
    if (failWrite) throw StateError('synthetic storage failure');
    value = newValue;
  }
}
