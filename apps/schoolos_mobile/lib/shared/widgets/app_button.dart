import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/design_system/app_spacing.dart';

enum AppButtonVariant { filled, outlined, text }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.filled,
    this.icon,
    this.isLoading = false,
    this.fullWidth = true,
    this.backgroundColor,
    this.foregroundColor,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final Widget labelWidget = Flexible(
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
    );

    final Widget content = isLoading
        ? Semantics(
            label: label,
            value: 'In progress',
            liveRegion: true,
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(
                  variant == AppButtonVariant.filled
                      ? (foregroundColor ?? theme.colorScheme.onPrimary)
                      : (foregroundColor ?? theme.colorScheme.primary),
                ),
              ),
            ),
          )
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: AppSpacing.sm),
              ],
              labelWidget,
            ],
          );

    final buttonStyle = ElevatedButton.styleFrom(
      minimumSize: const Size(0, 52),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
    );

    Widget button;

    switch (variant) {
      case AppButtonVariant.filled:
        button = ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: buttonStyle,
          child: content,
        );
      case AppButtonVariant.outlined:
        button = OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 52),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            foregroundColor: foregroundColor ?? theme.colorScheme.primary,
            side: BorderSide(
              color: foregroundColor ?? theme.colorScheme.primary,
              width: 1.5,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
          ),
          child: content,
        );
      case AppButtonVariant.text:
        button = TextButton(
          onPressed: isLoading ? null : onPressed,
          style: TextButton.styleFrom(
            minimumSize: const Size(0, 52),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            foregroundColor: foregroundColor ?? theme.colorScheme.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
          ),
          child: content,
        );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: SizedBox(width: fullWidth ? double.infinity : null, child: button),
    );
  }
}
