import 'package:flutter/material.dart';

import '../../app/design_system/app_spacing.dart';
import '../../app/theme/app_colors.dart';
import 'app_button.dart';

class AppAccessState extends StatelessWidget {
  const AppAccessState({
    super.key,
    required this.title,
    required this.message,
    required this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.slate400),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(message, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: actionLabel!,
                onPressed: onAction,
                fullWidth: false,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class PermissionDeniedState extends StatelessWidget {
  const PermissionDeniedState({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppAccessState(
      title: 'Access not available',
      message: 'You do not have permission to view this information.',
      icon: Icons.lock_outline_rounded,
    );
  }
}

class ModuleLockedState extends StatelessWidget {
  const ModuleLockedState({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppAccessState(
      title: 'Module not enabled',
      message: 'This module is not enabled for your school.',
      icon: Icons.extension_off_outlined,
    );
  }
}

class SessionExpiredState extends StatelessWidget {
  const SessionExpiredState({super.key, this.onSignIn});

  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    return AppAccessState(
      title: 'Session expired',
      message: 'Your session has expired. Please sign in again.',
      icon: Icons.timer_off_outlined,
      actionLabel: onSignIn == null ? null : 'Sign in',
      onAction: onSignIn,
    );
  }
}

class ProtectedFileUnavailableState extends StatelessWidget {
  const ProtectedFileUnavailableState({super.key, this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return AppAccessState(
      title: 'File unavailable',
      message: 'This protected file is unavailable or your access has expired.',
      icon: Icons.file_download_off_outlined,
      actionLabel: onRetry == null ? null : 'Try again',
      onAction: onRetry,
    );
  }
}

class PendingSyncState extends StatelessWidget {
  const PendingSyncState({super.key, this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return AppAccessState(
      title: 'Waiting to sync',
      message: 'This approved draft is still on this device.',
      icon: Icons.sync_problem_outlined,
      actionLabel: onRetry == null ? null : 'Retry sync',
      onAction: onRetry,
    );
  }
}
