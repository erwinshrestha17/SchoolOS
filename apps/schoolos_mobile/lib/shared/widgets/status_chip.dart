import 'package:flutter/material.dart';
import '../../app/design_system/app_radius.dart';
import '../design/status_tone.dart';

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
  const StatusChip({super.key, required this.status, this.label, this.tone});

  /// A chip for a raw backend status (e.g. `OVERDUE`), toned exactly as the
  /// Web renders it.
  StatusChip.fromStatus(String backendStatus, {super.key, String? label})
    : status = AppStatusType.unavailable,
      tone = resolveStatusTone(backendStatus),
      label = label ?? backendStatus.trim().toUpperCase().replaceAll('_', ' ');

  final AppStatusType status;
  final String? label;

  /// Explicit semantic tone; overrides the one derived from [status].
  final StatusTone? tone;

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

  /// Every chip colour comes from the shared semantic tone table, the same
  /// one the Web `StatusBadge` uses (Phase 4G).
  (Color, Color) _getColors(bool isDark) =>
      statusToneColors(tone ?? _toneFor(status), isDark: isDark);

  static StatusTone _toneFor(AppStatusType status) {
    switch (status) {
      case AppStatusType.present:
        return resolveStatusTone('PRESENT');
      case AppStatusType.absent:
        return resolveStatusTone('ABSENT');
      case AppStatusType.late:
        return resolveStatusTone('LATE');
      case AppStatusType.paid:
        return resolveStatusTone('PAID');
      case AppStatusType.due:
        return resolveStatusTone('DUE');
      case AppStatusType.onRoute:
        return StatusTone.info;
      case AppStatusType.pending:
        return resolveStatusTone('PENDING');
      case AppStatusType.approved:
        return resolveStatusTone('APPROVED');
      case AppStatusType.rejected:
        return resolveStatusTone('REJECTED');
      case AppStatusType.draft:
        return resolveStatusTone('DRAFT');
      case AppStatusType.published:
        return resolveStatusTone('PUBLISHED');
      case AppStatusType.completed:
        return resolveStatusTone('SUCCEEDED');
      case AppStatusType.notRecorded:
        return resolveStatusTone('NOT_RECORDED');
      case AppStatusType.queued:
        return resolveStatusTone('QUEUED');
      case AppStatusType.syncing:
        return resolveStatusTone('SYNCING');
      case AppStatusType.synced:
        return resolveStatusTone('SYNCED');
      case AppStatusType.failed:
        return resolveStatusTone('FAILED');
      case AppStatusType.unavailable:
        return resolveStatusTone('UNAVAILABLE');
    }
  }
}
