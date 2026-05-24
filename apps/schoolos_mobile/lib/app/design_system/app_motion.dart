import 'package:flutter/material.dart';

class AppMotion {
  const AppMotion._();

  /// Very fast transition (e.g. checkbox state toggle, minor scale effects)
  static const Duration fast = Duration(milliseconds: 150);

  /// Medium transition (e.g. page routes, expanding card widgets)
  static const Duration normal = Duration(milliseconds: 250);

  /// Slow transition (e.g. onboarding flows, complex layout transitions)
  static const Duration slow = Duration(milliseconds: 400);

  /// Default curve for general animations (premium ease-in-out-sine style)
  static const Curve curve = Curves.easeInOutCubic;

  /// Expressive curves for popups, modal entries, or micro-animations
  static const Curve expressiveCurve = Curves.elasticOut;
}
