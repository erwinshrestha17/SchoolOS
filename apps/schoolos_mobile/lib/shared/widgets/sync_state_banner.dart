import 'package:flutter/material.dart';

import '../../app/design_system/app_spacing.dart';
import '../design/status_tone.dart';

/// Where a screen's data stands relative to the server (Phase 4G). One
/// widget for every screen so "offline", "saved on this phone" and "could not
/// be saved" always look and read the same.
enum SyncState {
  /// Fresh from the server: nothing is shown.
  live,

  /// Showing data saved on this phone earlier (read side).
  cached,

  /// No connection; nothing can be refreshed or sent.
  offline,

  /// Changes are being sent now.
  syncing,

  /// Changes are saved on this phone and waiting to be sent.
  pendingUpload,

  /// The server refused changes; they will not be retried automatically.
  failed,
}

class SyncStateBanner extends StatelessWidget {
  const SyncStateBanner({
    super.key,
    required this.state,
    this.lastUpdated,
    this.count = 0,
    this.detail,
    this.actionLabel,
    this.onAction,
    this.now,
  });

  final SyncState state;

  /// When the shown data was last confirmed by the server ([SyncState.cached]).
  final DateTime? lastUpdated;

  /// Number of changes waiting or failed.
  final int count;

  /// Extra explanation, e.g. the server's reason for a failure.
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Injectable clock for tests.
  final DateTime? now;

  static String relativeAge(DateTime when, DateTime now) {
    final minutes = now.difference(when).inMinutes;
    if (minutes < 1) return 'just now';
    if (minutes < 60) return '$minutes min ago';
    final hours = minutes ~/ 60;
    if (hours < 24) return hours == 1 ? '1 hour ago' : '$hours hours ago';
    final days = hours ~/ 24;
    return days == 1 ? '1 day ago' : '$days days ago';
  }

  String get message {
    final plural = count == 1 ? '' : 's';
    switch (state) {
      case SyncState.live:
        return '';
      case SyncState.cached:
        final when = lastUpdated;
        return when == null
            ? 'Showing information saved on this phone.'
            : 'Showing information saved ${relativeAge(when, now ?? DateTime.now())}.';
      case SyncState.offline:
        return 'You are offline. Connect to refresh information.';
      case SyncState.syncing:
        return count > 0 ? 'Sending $count change$plural…' : 'Syncing…';
      case SyncState.pendingUpload:
        return '$count change$plural saved on this phone, not yet sent. '
            'They are sent when you reconnect.';
      case SyncState.failed:
        return '$count change$plural could not be saved.';
    }
  }

  StatusTone get _tone => switch (state) {
    SyncState.live => StatusTone.info,
    SyncState.cached => StatusTone.info,
    SyncState.offline => StatusTone.pending,
    SyncState.syncing => StatusTone.pending,
    SyncState.pendingUpload => StatusTone.pending,
    SyncState.failed => StatusTone.rejected,
  };

  IconData get _icon => switch (state) {
    SyncState.live => Icons.cloud_done_rounded,
    SyncState.cached => Icons.history_rounded,
    SyncState.offline => Icons.cloud_off_rounded,
    SyncState.syncing => Icons.sync_rounded,
    SyncState.pendingUpload => Icons.cloud_upload_outlined,
    SyncState.failed => Icons.error_outline_rounded,
  };

  @override
  Widget build(BuildContext context) {
    if (state == SyncState.live) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (background, foreground) = statusToneColors(_tone, isDark: isDark);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        key: ValueKey('sync_state_${state.name}'),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_icon, size: 18, color: foreground),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: TextStyle(
                      color: foreground,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (detail != null && detail!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        detail!,
                        style: TextStyle(color: foreground, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(foregroundColor: foreground),
                child: Text(actionLabel!),
              ),
          ],
        ),
      ),
    );
  }
}
