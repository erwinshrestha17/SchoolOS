import 'package:flutter/material.dart';

/// SchoolOS colour direction — one unified identity across web and mobile:
/// Himalayan blue brand, calm neutral surfaces, semantic status colours that
/// never change meaning, and restrained persona accents anchored to the
/// module each persona lives in. Mirrors apps/web/docs/DESIGN_SYSTEM.md §5.
class AppColors {
  const AppColors._();

  // Core brand colors (Himalayan blue identity)
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFFEAF2FF);
  static const Color primaryDark = Color(0xFF1D4ED8);

  static const Color brandNavy = Color(0xFF17324D);
  static const Color brandMarigold = Color(0xFFE2A126);

  // Secondary accent (brand teal)
  static const Color secondary = Color(0xFF168C8C);
  static const Color secondaryLight = Color(0xFFE7F4F4);
  static const Color secondaryDark = Color(0xFF0F6666);

  // Status colors (semantic; identical meaning on web and mobile)
  static const Color success = Color(0xFF27875A);
  static const Color successLight = Color(0xFFEAF7F0);
  static const Color successDark = Color(0xFF17633E);

  static const Color warning = Color(0xFFD99016);
  static const Color warningLight = Color(0xFFFFF6DF);
  static const Color warningDark = Color(0xFF82580B);

  static const Color danger = Color(0xFFD14343);
  static const Color dangerLight = Color(0xFFFDECEC);
  static const Color dangerDark = Color(0xFF9D2929);

  static const Color info = Color(0xFF2878C8);
  static const Color infoLight = Color(0xFFEAF3FC);
  static const Color infoDark = Color(0xFF1F5E9B);

  // Neutral scale (SchoolOS grey: 200 = border, 400 = muted/timestamps,
  // 500 = secondary text, 900 = primary text)
  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF2F4F7);
  static const Color slate200 = Color(0xFFDDE4EC);
  static const Color slate300 = Color(0xFFC7D0DC);
  static const Color slate400 = Color(0xFF98A2B3);
  static const Color slate500 = Color(0xFF667085);
  static const Color slate600 = Color(0xFF475467);
  static const Color slate700 = Color(0xFF344054);
  static const Color slate800 = Color(0xFF1D2939);
  static const Color slate900 = Color(0xFF172033);
  static const Color slate950 = Color(0xFF0C111D);

  // Persona accents, anchored to the module each persona lives in.
  // Accents identify the persona's home; they never replace semantic
  // status colours (green is not "meal served", orange is not "delayed").
  // Parent (Activity coral — warm, child-first)
  static const Color parentAccent = Color(0xFFD56B5D);
  static const List<Color> parentGradient = [
    Color(0xFFB1584C),
    Color(0xFFD56B5D),
  ];

  // Student (Learning cyan — engaging, school-controlled)
  static const Color studentAccent = Color(0xFF2C91B7);
  static const List<Color> studentGradient = [
    Color(0xFF1F6986),
    Color(0xFF2C91B7),
  ];

  // Teacher (Academics indigo — structured, precise)
  static const Color teacherAccent = Color(0xFF5B5BD6);
  static const List<Color> teacherGradient = [
    Color(0xFF3F3FA5),
    Color(0xFF5B5BD6),
  ];

  // Driver (Transport orange — visible, safety-oriented)
  static const Color driverAccent = Color(0xFFD46A1F);
  static const List<Color> driverGradient = [
    Color(0xFF994915),
    Color(0xFFD46A1F),
  ];

  // Staff (HR steel blue — professional, confidential)
  static const Color staffAccent = Color(0xFF4B6B88);
  static const List<Color> staffGradient = [
    Color(0xFF365067),
    Color(0xFF4B6B88),
  ];

  // Admin/Principal (brand navy into primary blue — authority)
  static const Color adminAccent = Color(0xFF17324D);
  static const List<Color> adminGradient = [
    Color(0xFF17324D),
    Color(0xFF2563EB),
  ];

  // Common UI colors
  static const Color overlayLight = Colors.white;
  static const Color overlayDark = Color(0xFF1D2939);

  static const Color backgroundLight = Color(0xFFF4F7FB);
  static const Color backgroundDark = Color(0xFF0B0F19);
}
