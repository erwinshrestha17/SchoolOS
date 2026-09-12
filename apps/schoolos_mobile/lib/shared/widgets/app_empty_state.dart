import 'package:flutter/material.dart';
import '../../app/design_system/app_spacing.dart';
import '../../app/theme/app_semantic_colors.dart';
import 'app_button.dart';

/// Shared recoverable state that keeps its message and action reachable on
/// compact phones, with the keyboard open, and at accessibility text sizes.
class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_rounded,
    this.actionLabel,
    this.onActionPressed,
    this.iconColor,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onActionPressed;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final semantic = AppSemanticColors.of(context);
    final tone = iconColor ?? semantic.textSecondary;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: constraints.hasBoundedHeight ? constraints.maxHeight : 0,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 36, color: tone),
                    const SizedBox(height: AppSpacing.lg),
                    Semantics(
                      header: true,
                      child: Text(
                        title,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: semantic.textPrimary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      message,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: semantic.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (actionLabel != null && onActionPressed != null) ...[
                      const SizedBox(height: AppSpacing.xl),
                      AppButton(
                        label: actionLabel!,
                        onPressed: onActionPressed,
                        fullWidth: false,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
