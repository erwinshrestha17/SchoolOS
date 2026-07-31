import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../storage/app_preferences_service.dart';
import 'biometric_prompt_state.dart';

final biometricSessionStoreProvider = Provider<BiometricSessionStore>((ref) {
  final prefs = ref.watch(appPreferencesServiceProvider);
  return BiometricSessionStore(prefs.prefs);
});

/// User-scoped biometric unlock configuration for this device.
///
/// SchoolOS never stores biometric templates. This store only tracks whether
/// the local session for a given account may be unlocked with device biometrics.
class BiometricSessionStore {
  BiometricSessionStore(this._prefs);

  final SharedPreferences _prefs;

  static const _legacyGlobalKey = 'app_biometric_enabled';
  static const _enabledPrefix = 'biometric_enabled:';
  static const _promptPrefix = 'biometric_prompt_state:';
  static const _failurePrefix = 'biometric_failures:';
  static const _lastUserKey = 'biometric_last_user_id';
  static const _lastTenantKey = 'biometric_last_tenant_id';
  static const maxFailuresBeforeDisable = 5;

  String _scopeKey(String userId, {String? tenantId}) {
    final tenant = tenantId?.trim();
    if (tenant != null && tenant.isNotEmpty) {
      return '$tenant:$userId';
    }
    return userId;
  }

  bool isEnabled(String userId, {String? tenantId}) {
    return _prefs.getBool(
          '$_enabledPrefix${_scopeKey(userId, tenantId: tenantId)}',
        ) ??
        false;
  }

  BiometricPromptState promptState(String userId, {String? tenantId}) {
    return BiometricPromptStateCodec.fromStorage(
      _prefs.getString(
        '$_promptPrefix${_scopeKey(userId, tenantId: tenantId)}',
      ),
    );
  }

  int failureCount(String userId, {String? tenantId}) {
    return _prefs.getInt(
          '$_failurePrefix${_scopeKey(userId, tenantId: tenantId)}',
        ) ??
        0;
  }

  String? get lastUserId => _prefs.getString(_lastUserKey);

  String? get lastTenantId => _prefs.getString(_lastTenantKey);

  Future<void> setEnabled(
    String userId, {
    String? tenantId,
    required bool enabled,
  }) async {
    await _purgeLegacyGlobalFlag();
    final scope = _scopeKey(userId, tenantId: tenantId);
    await _prefs.setBool('$_enabledPrefix$scope', enabled);
    if (enabled) {
      await _prefs.setString(
        '$_promptPrefix$scope',
        BiometricPromptState.enabled.storageValue,
      );
      await _prefs.setInt('$_failurePrefix$scope', 0);
      await _prefs.setString(_lastUserKey, userId);
      if (tenantId != null && tenantId.trim().isNotEmpty) {
        await _prefs.setString(_lastTenantKey, tenantId);
      }
    } else {
      final current = promptState(userId, tenantId: tenantId);
      if (current == BiometricPromptState.enabled) {
        await _prefs.setString(
          '$_promptPrefix$scope',
          BiometricPromptState.never.storageValue,
        );
      }
    }
  }

  Future<void> setPromptState(
    String userId, {
    String? tenantId,
    required BiometricPromptState state,
  }) async {
    await _prefs.setString(
      '$_promptPrefix${_scopeKey(userId, tenantId: tenantId)}',
      state.storageValue,
    );
  }

  Future<int> recordFailure(String userId, {String? tenantId}) async {
    final scope = _scopeKey(userId, tenantId: tenantId);
    final next = failureCount(userId, tenantId: tenantId) + 1;
    await _prefs.setInt('$_failurePrefix$scope', next);
    if (next >= maxFailuresBeforeDisable) {
      await clearForUser(userId, tenantId: tenantId);
    }
    return next;
  }

  Future<void> resetFailures(String userId, {String? tenantId}) async {
    await _prefs.setInt(
      '$_failurePrefix${_scopeKey(userId, tenantId: tenantId)}',
      0,
    );
  }

  Future<void> clearForUser(String userId, {String? tenantId}) async {
    final scope = _scopeKey(userId, tenantId: tenantId);
    await _prefs.remove('$_enabledPrefix$scope');
    final current = BiometricPromptStateCodec.fromStorage(
      _prefs.getString('$_promptPrefix$scope'),
    );
    if (current == BiometricPromptState.enabled) {
      await _prefs.setString(
        '$_promptPrefix$scope',
        BiometricPromptState.never.storageValue,
      );
    }
    await _prefs.remove('$_failurePrefix$scope');
    if (lastUserId == userId) {
      await _prefs.remove(_lastUserKey);
      await _prefs.remove(_lastTenantKey);
    }
    await _purgeLegacyGlobalFlag();
  }

  /// Whether the first-login biometric offer modal should be shown.
  bool shouldOfferFirstPrompt(String userId, {String? tenantId}) {
    if (isEnabled(userId, tenantId: tenantId)) return false;
    final state = promptState(userId, tenantId: tenantId);
    return state == BiometricPromptState.never;
  }

  /// Whether a single soft security suggestion may be shown.
  bool shouldShowSoftSuggestion(String userId, {String? tenantId}) {
    if (isEnabled(userId, tenantId: tenantId)) return false;
    return promptState(userId, tenantId: tenantId) ==
        BiometricPromptState.dismissed;
  }

  Future<void> _purgeLegacyGlobalFlag() async {
    if (_prefs.containsKey(_legacyGlobalKey)) {
      await _prefs.remove(_legacyGlobalKey);
    }
  }
}
