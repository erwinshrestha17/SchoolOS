import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/design_system/app_shadows.dart';
import '../../app/design_system/app_spacing.dart';

class AppGradientCard extends StatelessWidget {
  const AppGradientCard({
    super.key,
    required this.child,
    required this.gradient,
    this.padding = const EdgeInsets.all(AppSpacing.xl),
    this.onTap,
    this.borderRadius,
    this.hasShadow = true,
  });

  final Widget child;
  final Gradient gradient;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;
  final bool hasShadow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final cardBorderRadius =
        borderRadius ?? BorderRadius.circular(AppRadius.xxl);

    final Widget cardContent = Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: cardBorderRadius,
        boxShadow: hasShadow && !isDark ? AppShadows.medium : null,
      ),
      child: ClipRRect(
        borderRadius: cardBorderRadius,
        child: Padding(padding: padding, child: child),
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
