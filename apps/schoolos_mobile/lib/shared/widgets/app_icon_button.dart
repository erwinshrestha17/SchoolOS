import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.badgeCount,
    this.badgeColor = AppColors.danger,
    this.iconColor,
    this.backgroundColor,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final int? badgeCount;
  final Color badgeColor;
  final Color? iconColor;
  final Color? backgroundColor;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final defaultIconColor =
        iconColor ?? (isDark ? AppColors.slate300 : AppColors.slate700);
    final defaultBgColor = backgroundColor ?? Colors.transparent;

    Widget button = IconButton(
      icon: Icon(icon, color: defaultIconColor, size: 24),
      onPressed: onPressed,
      style: IconButton.styleFrom(
        backgroundColor: defaultBgColor,
        hoverColor: isDark
            ? Colors.white10
            : Colors.black.withValues(alpha: 0.04),
      ),
    );

    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }

    if (badgeCount == null || badgeCount! <= 0) {
      return button;
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        button,
        Positioned(
          right: 4,
          top: 4,
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: badgeColor,
              shape: BoxShape.circle,
              border: Border.all(
                color: isDark ? AppColors.overlayDark : Colors.white,
                width: 1.5,
              ),
            ),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            child: Text(
              badgeCount! > 9 ? '9+' : '$badgeCount',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 8,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}
