import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/design_system/app_shadows.dart';
import '../../app/design_system/app_spacing.dart';
import '../../app/theme/app_colors.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.onTap,
    this.color,
    this.borderRadius,
    this.border,
    this.hasShadow = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final BorderRadius? borderRadius;
  final BoxBorder? border;
  final bool hasShadow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final cardBorderRadius =
        borderRadius ?? BorderRadius.circular(AppRadius.xl);
    final cardColor = color ?? (isDark ? AppColors.overlayDark : Colors.white);

    final decorationBorder =
        border ??
        (isDark
            ? Border.all(color: AppColors.slate800, width: 1)
            : Border.all(color: AppColors.slate100, width: 1));

    final Widget cardContent = ConstrainedBox(
      constraints: BoxConstraints(minHeight: onTap == null ? 0 : 44),
      child: Container(
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: cardBorderRadius,
          border: decorationBorder,
          boxShadow: hasShadow && !isDark ? AppShadows.soft : null,
        ),
        child: ClipRRect(
          borderRadius: cardBorderRadius,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );

    if (onTap == null) {
      return cardContent;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: cardBorderRadius,
        child: cardContent,
      ),
    );
  }
}
