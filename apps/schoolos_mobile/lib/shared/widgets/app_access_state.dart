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
    this.compact = false,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Renders the same state inside a small slot - a media thumbnail, a tile,
  /// an inline panel - where the full-page treatment would overflow. The
  /// title is dropped and the message carries the meaning, so the copy stays
  /// in one place instead of being re-invented per slot.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: compact ? 28 : 48, color: AppColors.slate400),
            SizedBox(height: compact ? AppSpacing.sm : AppSpacing.lg),
            if (!compact) ...[
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            Flexible(
              child: Text(
                message,
                textAlign: TextAlign.center,
                maxLines: compact ? 3 : null,
                overflow: compact ? TextOverflow.ellipsis : null,
                style: compact ? Theme.of(context).textTheme.bodySmall : null,
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              SizedBox(height: compact ? AppSpacing.sm : AppSpacing.xl),
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
  const ProtectedFileUnavailableState({
    super.key,
    this.onRetry,
    this.message,
    this.compact = false,
  });

  final VoidCallback? onRetry;

  /// Overrides the default copy where the surface knows what kind of file it
  /// is showing (for example protected activity media).
  final String? message;

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return AppAccessState(
      title: 'File unavailable',
      message:
          message ??
          'This protected file is unavailable or your access has expired.',
      icon: Icons.file_download_off_outlined,
      actionLabel: onRetry == null ? null : 'Try again',
      onAction: onRetry,
      compact: compact,
    );
  }
}

// The pending-sync state DESIGN_SYSTEM.md section 10 requires is a *banner*
// (`PendingSyncBanner`), not a centered full-area state, and it already exists:
// `_SyncBanner` in teacher attendance carries the queued / syncing /
// server-checking / failed statuses with a retry, next-step copy and a
// last-updated timestamp. Promote that to this file when a second surface
// needs it; extracting a shared abstraction from its single consumer now would
// be guesswork. A centered `PendingSyncState` stub used to sit here and was
// removed rather than wired in, because it would have been a downgrade
// wherever it landed.
