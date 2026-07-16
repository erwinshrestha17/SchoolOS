import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appPreferencesServiceProvider = Provider<AppPreferencesService>((ref) {
  throw UnimplementedError(
    'SharedPreferences must be initialized in main() and overridden in ProviderScope',
  );
});

class AppPreferencesService {
  const AppPreferencesService(this._prefs);

  final SharedPreferences _prefs;

  static const String _themeModeKey = 'app_theme_mode';
  static const String _languageKey = 'app_language_code';
  static const String _tenantKey = 'app_tenant_code';
  static const String _selectedChildIdKey = 'app_selected_child_id';
  static const String _biometricEnabledKey = 'app_biometric_enabled';
  static const String _cachedUserKey = 'app_cached_user';
  static const String _privateCachePrefix = 'app_private_read_cache_';

  Future<void> saveThemeMode(String mode) async {
    await _prefs.setString(_themeModeKey, mode);
  }

  String? getThemeMode() {
    return _prefs.getString(_themeModeKey);
  }

  Future<void> saveLanguage(String lang) async {
    await _prefs.setString(_languageKey, lang);
  }

  String? getLanguage() {
    return _prefs.getString(_languageKey);
  }

  Future<void> saveTenantCode(String tenantCode) async {
    await _prefs.setString(_tenantKey, tenantCode);
  }

  String? getTenantCode() {
    return _prefs.getString(_tenantKey);
  }

  Future<void> saveSelectedChildId(String childId) async {
    await _prefs.setString(_selectedChildIdKey, childId);
  }

  String? getSelectedChildId() {
    return _prefs.getString(_selectedChildIdKey);
  }

  Future<void> removeSelectedChildId() async {
    await _prefs.remove(_selectedChildIdKey);
  }

  Future<void> saveBiometricEnabled(bool enabled) async {
    await _prefs.setBool(_biometricEnabledKey, enabled);
  }

  bool getBiometricEnabled({bool defaultValue = false}) {
    return _prefs.getBool(_biometricEnabledKey) ?? defaultValue;
  }

  Future<void> saveCachedUser(String userJson) async {
    await _prefs.setString(_cachedUserKey, userJson);
  }

  String? getCachedUser() {
    return _prefs.getString(_cachedUserKey);
  }

  Future<void> removeCachedUser() async {
    await _prefs.remove(_cachedUserKey);
  }

  Future<void> savePrivateCache(String key, String value) async {
    await _prefs.setString('$_privateCachePrefix$key', value);
  }

  String? getPrivateCache(String key) {
    return _prefs.getString('$_privateCachePrefix$key');
  }

  Future<void> purgeLegacyPrivateReadCache() async {
    for (final key in _prefs.getKeys()) {
      if (key.startsWith(_privateCachePrefix)) {
        await _prefs.remove(key);
      }
    }
  }

  Future<void> purgeLegacyTeacherAttendanceDrafts() async {
    const legacyDraftPrefix = 'schoolos.teacher_attendance_draft.';
    for (final key in _prefs.getKeys()) {
      if (key.startsWith(legacyDraftPrefix)) {
        await _prefs.remove(key);
      }
    }
  }

  Future<void> clearPrivateData() async {
    const privateKeys = {_selectedChildIdKey, _cachedUserKey};
    const privatePrefixes = {
      'schoolos.',
      'app_private_',
      'app_parent_cache_',
      'app_notice_cache_',
      'app_attendance_cache_',
      'app_protected_file_',
    };

    for (final key in _prefs.getKeys()) {
      if (privateKeys.contains(key) || privatePrefixes.any(key.startsWith)) {
        await _prefs.remove(key);
      }
    }
  }

  Future<void> clearAll() async {
    await _prefs.clear();
  }
}
