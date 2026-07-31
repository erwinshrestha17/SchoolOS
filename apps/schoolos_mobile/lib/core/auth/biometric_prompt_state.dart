/// Local-only prompt lifecycle for biometric login setup.
enum BiometricPromptState {
  /// User has not been offered biometric setup on this device.
  never,

  /// User dismissed the first-login offer with Not Now.
  dismissed,

  /// Soft security suggestion was shown once after dismissal.
  softSuggested,

  /// Biometric unlock is currently enabled for this account on this device.
  enabled,
}

extension BiometricPromptStateCodec on BiometricPromptState {
  String get storageValue => name;

  static BiometricPromptState fromStorage(String? value) {
    return BiometricPromptState.values.firstWhere(
      (state) => state.name == value,
      orElse: () => BiometricPromptState.never,
    );
  }
}
