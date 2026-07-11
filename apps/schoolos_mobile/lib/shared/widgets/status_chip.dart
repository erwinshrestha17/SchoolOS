import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/theme/app_colors.dart';

enum AppStatusType {
  present,
  absent,
  late,
  paid,
  due,
  onRoute,
  pending,
  approved,
  rejected,
  draft,
  published,
  completed,
  notRecorded,
  queued,
  syncing,
  synced,
  failed,
  unavailable,
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.label});

  final AppStatusType status;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final String text = label ?? _getDefaultLabel();
    final (bgColor, fgColor) = _getColors(isDark);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.max),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: fgColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.0,
        ),
      ),
    );
  }

  String _getDefaultLabel() {
    switch (status) {
      case AppStatusType.present:
        return 'Present';
      case AppStatusType.absent:
        return 'Absent';
      case AppStatusType.late:
        return 'Late';
      case AppStatusType.paid:
        return 'Paid';
      case AppStatusType.due:
        return 'Due';
      case AppStatusType.onRoute:
        return 'On Route';
      case AppStatusType.pending:
        return 'Pending';
      case AppStatusType.approved:
        return 'Approved';
      case AppStatusType.rejected:
        return 'Rejected';
      case AppStatusType.draft:
        return 'Draft';
      case AppStatusType.published:
        return 'Published';
      case AppStatusType.completed:
        return 'Completed';
      case AppStatusType.notRecorded:
        return 'Not recorded';
      case AppStatusType.queued:
        return 'Queued';
      case AppStatusType.syncing:
        return 'Syncing';
      case AppStatusType.synced:
        return 'Synced';
      case AppStatusType.failed:
        return 'Failed';
      case AppStatusType.unavailable:
        return 'Unavailable';
    }
  }

  (Color, Color) _getColors(bool isDark) {
    switch (status) {
      case AppStatusType.present:
      case AppStatusType.paid:
      case AppStatusType.approved:
      case AppStatusType.completed:
      case AppStatusType.synced:
        return (
          AppColors.successLight.withValues(alpha: isDark ? 0.15 : 0.8),
          isDark ? AppColors.success : AppColors.successDark,
        );
      case AppStatusType.absent:
      case AppStatusType.rejected:
      case AppStatusType.failed:
        return (
          AppColors.dangerLight.withValues(alpha: isDark ? 0.15 : 0.8),
          isDark ? AppColors.danger : AppColors.dangerDark,
        );
      case AppStatusType.late:
      case AppStatusType.due:
      case AppStatusType.pending:
      case AppStatusType.queued:
      case AppStatusType.syncing:
        return (
          AppColors.warningLight.withValues(alpha: isDark ? 0.15 : 0.8),
          isDark ? AppColors.warning : AppColors.warningDark,
        );
      case AppStatusType.onRoute:
      case AppStatusType.published:
        return (
          AppColors.infoLight.withValues(alpha: isDark ? 0.15 : 0.8),
          isDark ? AppColors.info : AppColors.infoDark,
        );
      case AppStatusType.draft:
      case AppStatusType.notRecorded:
      case AppStatusType.unavailable:
        return (
          isDark ? AppColors.slate800 : AppColors.slate100,
          isDark ? AppColors.slate300 : AppColors.slate600,
        );
    }
  }
}
