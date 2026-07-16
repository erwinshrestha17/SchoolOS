import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return const SecureStorageService(FlutterSecureStorage());
});

abstract interface class SecureKeyValueStore {
  Future<void> write(String key, String value);

  Future<String?> read(String key);

  Future<Map<String, String>> readAll();

  Future<void> delete(String key);

  Future<void> clearAll();

  Future<bool> containsKey(String key);

  Future<void> deleteByPrefix(String prefix);
}

class SecureStorageService implements SecureKeyValueStore {
  const SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  @override
  Future<String?> read(String key) async {
    return _storage.read(key: key);
  }

  @override
  Future<Map<String, String>> readAll() async {
    return _storage.readAll();
  }

  @override
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  @override
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  @override
  Future<bool> containsKey(String key) async {
    return _storage.containsKey(key: key);
  }

  @override
  Future<void> deleteByPrefix(String prefix) async {
    final values = await readAll();
    await Future.wait(
      values.keys.where((key) => key.startsWith(prefix)).map(delete),
    );
  }
}
