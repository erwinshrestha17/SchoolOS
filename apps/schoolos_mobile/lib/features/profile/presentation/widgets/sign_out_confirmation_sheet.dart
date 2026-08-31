import 'package:flutter/material.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';

Future<bool?> showSignOutConfirmationSheet(
  BuildContext context, {
  required bool isParent,
}) {
  final theme = Theme.of(context);
  final isDark = theme.brightness == Brightness.dark;

  return showModalBottomSheet<bool>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        MediaQuery.viewPaddingOf(sheetContext).bottom + AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sign out of SchoolOS?',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            isParent
                ? 'You will need to sign in again to access your children’s information.'
                : 'You will need to sign in again to access your school information.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(sheetContext, false),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(sheetContext, true),
                  style: FilledButton.styleFrom(
                    backgroundColor: isDark
                        ? AppColors.danger
                        : AppColors.dangerDark,
                  ),
                  child: const Text('Sign Out'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
