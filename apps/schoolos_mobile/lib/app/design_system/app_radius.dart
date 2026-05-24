import 'package:flutter/material.dart';

class AppRadius {
  const AppRadius._();

  /// 4.0 pixels radius
  static const double xs = 4.0;
  static final BorderRadius borderRadiusXS = BorderRadius.circular(xs);

  /// 8.0 pixels radius
  static const double sm = 8.0;
  static final BorderRadius borderRadiusSM = BorderRadius.circular(sm);

  /// 12.0 pixels radius
  static const double md = 12.0;
  static final BorderRadius borderRadiusMD = BorderRadius.circular(md);

  /// 16.0 pixels radius
  static const double lg = 16.0;
  static final BorderRadius borderRadiusLG = BorderRadius.circular(lg);

  /// 20.0 pixels radius (For standard cards, text fields, buttons)
  static const double xl = 20.0;
  static final BorderRadius borderRadiusXL = BorderRadius.circular(xl);

  /// 28.0 pixels radius (For premium large dashboard cards and bottom sheets)
  static const double xxl = 28.0;
  static final BorderRadius borderRadiusXXL = BorderRadius.circular(xxl);

  /// Infinite radius for pill buttons and circular badges
  static const double max = 999.0;
  static final BorderRadius borderRadiusMax = BorderRadius.circular(max);
}
