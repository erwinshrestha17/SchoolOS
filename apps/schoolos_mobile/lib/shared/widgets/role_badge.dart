import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/theme/app_colors.dart';

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role, this.label});

  final String role;
  final String? label;

  static String displayLabel(String role) {
    switch (role.trim().toUpperCase()) {
      case 'PARENT':
      case 'GUARDIAN':
        return 'Parent / Guardian';
      case 'TEACHER':
        return 'Teacher';
      case 'STUDENT':
        return 'Student';
      case 'DRIVER':
        return 'Driver';
      case 'STAFF':
        return 'Staff';
      case 'PRINCIPAL':
        return 'Principal';
      case 'ADMIN':
        return 'Admin';
      default:
        final cleaned = role.trim();
        if (cleaned.isEmpty) return 'User';
        return cleaned[0].toUpperCase() + cleaned.substring(1).toLowerCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final normalized = role.toUpperCase();
    final (bgColor, fgColor) = _getColors(normalized, isDark);
    final text = label ?? displayLabel(role);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: fgColor.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_getIcon(normalized), color: fgColor, size: 13),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: fgColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.0,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getIcon(String role) {
    switch (role) {
      case 'PARENT':
        return Icons.family_restroom_rounded;
      case 'STUDENT':
        return Icons.person_rounded;
      case 'TEACHER':
        return Icons.co_present_rounded;
      case 'DRIVER':
        return Icons.directions_bus_rounded;
      case 'STAFF':
        return Icons.badge_rounded;
      case 'ADMIN':
        return Icons.admin_panel_settings_rounded;
      default:
        return Icons.account_circle_rounded;
    }
  }

  (Color, Color) _getColors(String role, bool isDark) {
    switch (role) {
      case 'PARENT':
        return (
          AppColors.parentAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.parentAccent,
        );
      case 'STUDENT':
        return (
          AppColors.studentAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.studentAccent,
        );
      case 'TEACHER':
        return (
          AppColors.teacherAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.teacherAccent,
        );
      case 'DRIVER':
        return (
          AppColors.driverAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.driverAccent,
        );
      case 'STAFF':
        return (
          AppColors.staffAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.staffAccent,
        );
      case 'ADMIN':
      case 'PRINCIPAL':
        return (
          AppColors.adminAccent.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.adminAccent,
        );
      default:
        return (
          AppColors.primary.withValues(alpha: isDark ? 0.15 : 0.08),
          AppColors.primary,
        );
    }
  }
}
