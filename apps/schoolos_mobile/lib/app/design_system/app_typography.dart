import 'package:flutter/material.dart';

/// SchoolOS mobile type scale (Typography and Wording Standard §5).
/// Inter carries English, numbers, and general interface text; Noto Sans
/// Devanagari carries Nepali. Neither family is bundled as an asset yet, so
/// the system font renders until the fonts are added — declaring the stack
/// now keeps web and mobile on one type identity.
class AppTypography {
  const AppTypography._();

  static const String fontFamily = 'Inter';
  static const List<String> fontFamilyFallback = ['Noto Sans Devanagari'];

  // Hero numbers and oversized values (rare on mobile).
  static const TextStyle displayLarge = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.0,
    height: 40 / 32,
  );

  static const TextStyle displayMedium = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.0,
    height: 36 / 28,
  );

  // Screen title: 24/32, bold.
  static const TextStyle headlineLarge = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.0,
    height: 32 / 24,
  );

  // Important value (large): 20/28.
  static const TextStyle headlineMedium = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 20,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.0,
    height: 28 / 20,
  );

  // Section heading: 18/24, semibold.
  static const TextStyle titleLarge = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 24 / 18,
  );

  // Card heading: 16/22, semibold.
  static const TextStyle titleMedium = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 22 / 16,
  );

  static const TextStyle titleSmall = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 20 / 14,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 24 / 16,
  );

  // Main body: 14/21.
  static const TextStyle bodyMedium = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 21 / 14,
  );

  // Helper text: 12/17.
  static const TextStyle bodySmall = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.0,
    height: 17 / 12,
  );

  // Button text: 14/20, semibold.
  static const TextStyle labelLarge = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 20 / 14,
  );

  // Form labels and status badges: 12/16, semibold.
  static const TextStyle labelMedium = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.0,
    height: 16 / 12,
  );

  // Bottom navigation: 11/16.
  static const TextStyle labelSmall = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.0,
    height: 16 / 11,
  );
}
