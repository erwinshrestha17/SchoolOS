import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

final biometricAuthServiceProvider = Provider<BiometricAuthService>((ref) {
  return BiometricAuthService(LocalAuthentication());
});

enum BiometricCapability {
  unavailable,
  faceId,
  touchId,
  fingerprint,
  face,
  generic,
}

class BiometricAuthService {
  BiometricAuthService(this._auth);

  final LocalAuthentication _auth;

  Future<bool> get isSupported async {
    if (kIsWeb) return false;
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final deviceSupported = await _auth.isDeviceSupported();
      if (!canCheck && !deviceSupported) return false;
      final enrolled = await _auth.getAvailableBiometrics();
      return enrolled.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<BiometricCapability> resolveCapability() async {
    if (!await isSupported) return BiometricCapability.unavailable;

    final enrolled = await _auth.getAvailableBiometrics();
    final hasFace = enrolled.contains(BiometricType.face);
    final hasFingerprint = enrolled.contains(BiometricType.fingerprint);
    final hasStrong = enrolled.contains(BiometricType.strong);
    final hasWeak = enrolled.contains(BiometricType.weak);

    if (!kIsWeb && Platform.isIOS) {
      if (hasFace) return BiometricCapability.faceId;
      if (hasFingerprint) return BiometricCapability.touchId;
      if (hasStrong || hasWeak) {
        // iOS without a specific type usually means Face ID on modern devices.
        return BiometricCapability.faceId;
      }
    }

    if (!kIsWeb && Platform.isAndroid) {
      if (hasFingerprint) return BiometricCapability.fingerprint;
      if (hasFace) return BiometricCapability.face;
      if (hasStrong || hasWeak) return BiometricCapability.fingerprint;
    }

    if (hasFace) return BiometricCapability.face;
    if (hasFingerprint) return BiometricCapability.fingerprint;
    return BiometricCapability.generic;
  }

  String enableButtonLabel(BiometricCapability capability) {
    return switch (capability) {
      BiometricCapability.faceId => 'Enable Face ID',
      BiometricCapability.touchId => 'Enable Touch ID',
      BiometricCapability.fingerprint => 'Enable Fingerprint Login',
      BiometricCapability.face => 'Enable Face Login',
      BiometricCapability.generic => 'Enable Biometric Login',
      BiometricCapability.unavailable => 'Biometric Login Unavailable',
    };
  }

  String unlockButtonLabel(BiometricCapability capability) {
    return switch (capability) {
      BiometricCapability.faceId => 'Use Face ID',
      BiometricCapability.touchId => 'Use Touch ID',
      BiometricCapability.fingerprint => 'Use Fingerprint',
      BiometricCapability.face => 'Use Face Unlock',
      BiometricCapability.generic => 'Use Biometric Login',
      BiometricCapability.unavailable => 'Biometric Login Unavailable',
    };
  }

  String statusLabel(BiometricCapability capability, {required bool enabled}) {
    if (!enabled) return 'Off';
    return switch (capability) {
      BiometricCapability.faceId => 'Face ID on',
      BiometricCapability.touchId => 'Touch ID on',
      BiometricCapability.fingerprint => 'Fingerprint on',
      BiometricCapability.face => 'Face login on',
      BiometricCapability.generic => 'On',
      BiometricCapability.unavailable => 'Unavailable',
    };
  }

  String biometricName(BiometricCapability capability) {
    return switch (capability) {
      BiometricCapability.faceId => 'Face ID',
      BiometricCapability.touchId => 'Touch ID',
      BiometricCapability.fingerprint => 'Fingerprint',
      BiometricCapability.face => 'Face authentication',
      BiometricCapability.generic => 'Biometric login',
      BiometricCapability.unavailable => 'Biometric login',
    };
  }

  Future<bool> authenticate({required String reason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
    } catch (_) {
      return false;
    }
  }
}
