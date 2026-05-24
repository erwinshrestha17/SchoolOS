import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final tenantStorageProvider = Provider<TenantStorage>((ref) {
  return const TenantStorage();
});

class TenantStorage {
  const TenantStorage();

  static const _tenantIdKey = 'schoolos.tenantId';
  static const _tenantCodeKey = 'schoolos.tenantCode';

  Future<String?> readTenantId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tenantIdKey);
  }

  Future<String?> readTenantCode() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tenantCodeKey);
  }

  Future<void> saveTenant({String? tenantId, String? tenantCode}) async {
    final prefs = await SharedPreferences.getInstance();
    if (tenantId != null) {
      await prefs.setString(_tenantIdKey, tenantId);
    }
    if (tenantCode != null) {
      await prefs.setString(_tenantCodeKey, tenantCode);
    }
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove(_tenantIdKey),
      prefs.remove(_tenantCodeKey),
    ]);
  }
}
