import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/staff_providers.dart';
import '../../domain/staff_models.dart';

class StaffAttendanceScreen extends ConsumerWidget {
  const StaffAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendance = ref.watch(staffAttendanceProvider);

    return RoleShellScaffold(
      role: 'STAFF',
      selectedIndex: 1,
      title: 'My Attendance',
      body: attendance.when(
        loading: () => const AppLoading(message: 'Loading attendance...'),
        error: (_, _) => AppErrorView(
          title: 'Could not load attendance',
          message: 'Your staff attendance could not be loaded right now.',
          onRetry: () => ref.invalidate(staffAttendanceProvider),
        ),
        data: (records) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(staffAttendanceProvider);
            await ref.read(staffAttendanceProvider.future);
          },
          child: records.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: AppSpacing.xxxl),
                    AppEmptyState(
                      title: 'No attendance records',
                      message:
                          'Your check-in and leave attendance records will appear here after HR sync.',
                      icon: Icons.fact_check_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: records.length + 1,
                  separatorBuilder: (_, index) => index == 0
                      ? const SizedBox(height: AppSpacing.sm)
                      : const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return const SectionHeader(title: 'Recent Attendance');
                    }
                    return _AttendanceRecordCard(record: records[index - 1]);
                  },
                ),
        ),
      ),
    );
  }
}

class _AttendanceRecordCard extends StatelessWidget {
  const _AttendanceRecordCard({required this.record});

  final StaffAttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _statusColor(record.status).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _statusIcon(record.status),
              color: _statusColor(record.status),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _formatDate(record.date),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    StatusChip(
                      status: _chipStatus(record.status),
                      label: _label(record.status),
                    ),
                  ],
                ),
                if (record.checkInAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Check-in ${_formatTime(record.checkInAt!)}',
                    style: const TextStyle(
                      color: AppColors.slate500,
                      fontSize: 12,
                    ),
                  ),
                ],
                if ((record.note ?? '').isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    record.note!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.slate500,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

AppStatusType _chipStatus(String status) {
  switch (status.toUpperCase()) {
    case 'ABSENT':
      return AppStatusType.absent;
    case 'LATE':
    case 'HALF_DAY':
      return AppStatusType.late;
    case 'LEAVE':
    case 'ON_LEAVE':
    case 'SICK_LEAVE':
    case 'EXCUSED_LEAVE':
    case 'UNEXCUSED_LEAVE':
      return AppStatusType.published;
    case 'HOLIDAY':
      return AppStatusType.draft;
    case 'PRESENT':
    default:
      return AppStatusType.present;
  }
}

Color _statusColor(String status) {
  switch (status.toUpperCase()) {
    case 'ABSENT':
      return AppColors.danger;
    case 'LATE':
    case 'HALF_DAY':
      return AppColors.warning;
    case 'LEAVE':
    case 'ON_LEAVE':
    case 'SICK_LEAVE':
    case 'EXCUSED_LEAVE':
    case 'UNEXCUSED_LEAVE':
      return AppColors.info;
    default:
      return AppColors.success;
  }
}

IconData _statusIcon(String status) {
  switch (status.toUpperCase()) {
    case 'ABSENT':
      return Icons.cancel_outlined;
    case 'LATE':
    case 'HALF_DAY':
      return Icons.schedule_rounded;
    case 'LEAVE':
    case 'ON_LEAVE':
    case 'SICK_LEAVE':
    case 'EXCUSED_LEAVE':
    case 'UNEXCUSED_LEAVE':
      return Icons.beach_access_outlined;
    default:
      return Icons.check_circle_outline_rounded;
  }
}

String _label(String value) {
  return value
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
      )
      .join(' ');
}

String _formatDate(DateTime value) {
  return NepaliBsCalendar.formatBsDate(value);
}

String _formatTime(DateTime value) {
  return NepaliBsCalendar.formatNepalTime(value);
}
