import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/secure_storage_service.dart';

final deviceInstallationServiceProvider = Provider<DeviceInstallationService>((
  ref,
) {
  return DeviceInstallationService(ref.watch(secureStorageServiceProvider));
});

class DeviceInstallationService {
  DeviceInstallationService(this._storage);

  final SecureStorageService _storage;
  Future<String>? _installationInFlight;

  static const _installationIdKey = 'school_os_push_installation_id';

  Future<String> getOrCreateInstallationId() =>
      _installationInFlight ??= _readOrCreateInstallationId().whenComplete(() {
        _installationInFlight = null;
      });

  // Registration and logout may both request the ID on a fresh install. Share
  // the secure-storage operation so logout revokes the same installation that
  // registration used, and retry storage failures without caching a false ID.
  Future<String> _readOrCreateInstallationId() async {
    final existing = await _storage.read(_installationIdKey);
    if (existing != null && _isUuid(existing)) {
      return existing;
    }

    final installationId = _newUuidV4();
    await _storage.write(_installationIdKey, installationId);
    return installationId;
  }
}

String _newUuidV4() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, '0'));
  final value = hex.join();
  return '${value.substring(0, 8)}-'
      '${value.substring(8, 12)}-'
      '${value.substring(12, 16)}-'
      '${value.substring(16, 20)}-'
      '${value.substring(20)}';
}

bool _isUuid(String value) {
  return RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  ).hasMatch(value);
}
