import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  // Core brand colors (Modern indigo/blue focus)
  static const Color primary = Color(0xFF4F46E5);
  static const Color primaryLight = Color(0xFFEEF2FF);
  static const Color primaryDark = Color(0xFF3730A3);

  static const Color secondary = Color(0xFF0EA5E9);
  static const Color secondaryLight = Color(0xFFF0F9FF);
  static const Color secondaryDark = Color(0xFF0369A1);

  // Status colors (Semantic)
  static const Color success = Color(0xFF10B981); // Emerald
  static const Color successLight = Color(0xFFECFDF5);
  static const Color successDark = Color(0xFF047857);

  static const Color warning = Color(0xFFF59E0B); // Amber
  static const Color warningLight = Color(0xFFFFFBEB);
  static const Color warningDark = Color(0xFFB45309);

  static const Color danger = Color(0xFFEF4444); // Red
  static const Color dangerLight = Color(0xFFFEF2F2);
  static const Color dangerDark = Color(0xFFB91C1C);

  static const Color info = Color(0xFF3B82F6); // Blue
  static const Color infoLight = Color(0xFFEFF6FF);
  static const Color infoDark = Color(0xFF1D4ED8);

  // Neutral scale (Slate)
  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate950 = Color(0xFF020617);

  // Role-specific accents & gradients
  // Parent (Emerald/Mint - warm, child-friendly, safe)
  static const Color parentAccent = Color(0xFF10B981);
  static const List<Color> parentGradient = [
    Color(0xFF059669),
    Color(0xFF10B981),
  ];

  // Student (Indigo/Cyan - active, learning)
  static const Color studentAccent = Color(0xFF6366F1);
  static const List<Color> studentGradient = [
    Color(0xFF4F46E5),
    Color(0xFF06B6D4),
  ];

  // Teacher (Purple/Violet - academic, authority)
  static const Color teacherAccent = Color(0xFF8B5CF6);
  static const List<Color> teacherGradient = [
    Color(0xFF7C3AED),
    Color(0xFF8B5CF6),
  ];

  // Driver (Amber/Orange - safety, routes)
  static const Color driverAccent = Color(0xFFF59E0B);
  static const List<Color> driverGradient = [
    Color(0xFFD97706),
    Color(0xFFF59E0B),
  ];

  // Staff (Teal - HR, workspace)
  static const Color staffAccent = Color(0xFF0D9488);
  static const List<Color> staffGradient = [
    Color(0xFF0F766E),
    Color(0xFF0D9488),
  ];

  // Admin/Principal (Crimson/Red - authority, metrics)
  static const Color adminAccent = Color(0xFFE11D48);
  static const List<Color> adminGradient = [
    Color(0xFFBE123C),
    Color(0xFFE11D48),
  ];

  // Common UI colors
  static const Color overlayLight = Colors.white;
  static const Color overlayDark = Color(0xFF1E293B);

  static const Color backgroundLight = Color(0xFFF8FAFC);
  static const Color backgroundDark = Color(0xFF0B0F19);
}
