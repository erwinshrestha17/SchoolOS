import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Semantic color roles for production mobile UI.
///
/// Screens should prefer these roles over raw palette values so light/dark
/// mode and future brand changes remain centralized. Persona accent colors may
/// still be used sparingly for identity, but semantic status colors never
/// change meaning by role.
@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.primary,
    required this.secondary,
    required this.background,
    required this.surface,
    required this.elevatedSurface,
    required this.border,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
  });

  final Color primary;
  final Color secondary;
  final Color background;
  final Color surface;
  final Color elevatedSurface;
  final Color border;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color success;
  final Color warning;
  final Color error;
  final Color info;

  static const light = AppSemanticColors(
    primary: AppColors.primary,
    secondary: AppColors.secondary,
    background: AppColors.backgroundLight,
    surface: Colors.white,
    elevatedSurface: AppColors.slate50,
    border: AppColors.slate200,
    textPrimary: AppColors.slate900,
    textSecondary: AppColors.slate600,
    textMuted: AppColors.slate500,
    success: AppColors.success,
    warning: AppColors.warning,
    error: AppColors.danger,
    info: AppColors.info,
  );

  static const dark = AppSemanticColors(
    primary: Color(0xFF6EA0FF),
    secondary: Color(0xFF5CC3C3),
    background: AppColors.backgroundDark,
    surface: AppColors.overlayDark,
    elevatedSurface: AppColors.slate800,
    border: AppColors.slate700,
    textPrimary: Color(0xFFF8FAFC),
    textSecondary: AppColors.slate300,
    textMuted: AppColors.slate400,
    success: Color(0xFF69C997),
    warning: Color(0xFFF2B84B),
    error: Color(0xFFF07A7A),
    info: Color(0xFF79B9F4),
  );

  static AppSemanticColors of(BuildContext context) =>
      Theme.of(context).extension<AppSemanticColors>() ??
      (Theme.of(context).brightness == Brightness.dark ? dark : light);

  @override
  AppSemanticColors copyWith({
    Color? primary,
    Color? secondary,
    Color? background,
    Color? surface,
    Color? elevatedSurface,
    Color? border,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? success,
    Color? warning,
    Color? error,
    Color? info,
  }) => AppSemanticColors(
    primary: primary ?? this.primary,
    secondary: secondary ?? this.secondary,
    background: background ?? this.background,
    surface: surface ?? this.surface,
    elevatedSurface: elevatedSurface ?? this.elevatedSurface,
    border: border ?? this.border,
    textPrimary: textPrimary ?? this.textPrimary,
    textSecondary: textSecondary ?? this.textSecondary,
    textMuted: textMuted ?? this.textMuted,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    error: error ?? this.error,
    info: info ?? this.info,
  );

  @override
  AppSemanticColors lerp(covariant AppSemanticColors? other, double t) {
    if (other == null) return this;
    return AppSemanticColors(
      primary: Color.lerp(primary, other.primary, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      elevatedSurface: Color.lerp(elevatedSurface, other.elevatedSurface, t)!,
      border: Color.lerp(border, other.border, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}
