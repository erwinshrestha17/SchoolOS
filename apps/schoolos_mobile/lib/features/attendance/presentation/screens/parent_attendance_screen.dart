import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../parent/application/parent_providers.dart';
import '../../../parent/domain/parent_models.dart';
import '../../../parent/presentation/widgets/parent_detail_widgets.dart';
import '../../../parent/presentation/widgets/parent_portal_widgets.dart';
import '../../application/attendance_providers.dart';
import '../../domain/attendance_models.dart';

class ParentAttendanceScreen extends ConsumerWidget {
  const ParentAttendanceScreen({super.key, this.studentId});

  final String? studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = _selectedChild(state, studentId);

    return ParentDetailScaffold(
      title: 'Attendance',
      selectedIndex: 2,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.success when child != null => RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              ParentApiChildSelector(
                child: child,
                children: state.children,
                onChanged: controller.selectChild,
              ),
              const SizedBox(height: 14),
              _AttendanceBody(studentId: child.id),
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class StudentAttendanceScreen extends ParentAttendanceScreen {
  const StudentAttendanceScreen({super.key}) : super();
}

class _AttendanceBody extends ConsumerWidget {
  const _AttendanceBody({required this.studentId});

  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendance = ref.watch(parentAttendanceProvider(studentId));
    return attendance.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentAttendanceProvider(studentId)),
      ),
      data: (data) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _TodayCard(summary: data.summary, isOffline: data.isOffline),
          const SizedBox(height: 14),
          _SummaryCard(summary: data.summary),
          const SizedBox(height: 14),
          const ParentSectionHeader(title: 'This month'),
          const SizedBox(height: 8),
          if (data.days.isEmpty)
            const PortalCard(child: Text('No attendance records this month.'))
          else
            PortalCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (
                    var index = 0;
                    index < data.days.take(12).length;
                    index++
                  ) ...[
                    _AttendanceDayTile(day: data.days[index]),
                    if (index != data.days.take(12).length - 1)
                      const Divider(height: 1),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.summary, required this.isOffline});

  final AttendanceSummary summary;
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(summary.todayStatus);
    return PortalCard(
      color: color.withValues(alpha: .10),
      child: Row(
        children: [
          FeatureIcon(_statusIcon(summary.todayStatus), color: color),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary.todayLabel ?? _statusLabel(summary.todayStatus),
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w900,
                    fontSize: 17,
                  ),
                ),
                Text(
                  isOffline
                      ? 'Showing last saved attendance summary.'
                      : 'Updated from school attendance records.',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});

  final AttendanceSummary summary;

  @override
  Widget build(BuildContext context) {
    final total =
        summary.presentCount +
        summary.absentCount +
        summary.lateCount +
        summary.leaveCount;
    final rate = total == 0 ? 0 : (summary.presentCount / total * 100).round();
    return PortalCard(
      child: Row(
        children: [
          Expanded(
            child: _Metric(
              label: 'Rate',
              value: '$rate%',
              color: ParentPortalColors.green,
            ),
          ),
          Expanded(
            child: _Metric(
              label: 'Present',
              value: '${summary.presentCount}',
              color: ParentPortalColors.green,
            ),
          ),
          Expanded(
            child: _Metric(
              label: 'Absent',
              value: '${summary.absentCount}',
              color: ParentPortalColors.red,
            ),
          ),
          Expanded(
            child: _Metric(
              label: 'Late',
              value: '${summary.lateCount}',
              color: ParentPortalColors.orange,
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceDayTile extends StatelessWidget {
  const _AttendanceDayTile({required this.day});

  final AttendanceDay day;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(day.status);
    return ListTile(
      leading: FeatureIcon(_statusIcon(day.status), color: color, size: 38),
      title: Text(
        '${day.date.year}-${_two(day.date.month)}-${_two(day.date.day)}',
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(_statusLabel(day.status), style: TextStyle(color: color)),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 22,
          fontWeight: FontWeight.w900,
        ),
      ),
    ],
  );
}

GuardianChild? _selectedChild(ParentState state, String? studentId) {
  if (state.children.isEmpty) return null;
  if (studentId != null && studentId.isNotEmpty) {
    return state.children.firstWhere(
      (child) => child.id == studentId,
      orElse: () => state.selectedChild ?? state.children.first,
    );
  }
  return state.selectedChild ?? state.children.first;
}

Color _statusColor(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => ParentPortalColors.green,
    AttendanceStatus.late => ParentPortalColors.orange,
    AttendanceStatus.absent => ParentPortalColors.red,
    AttendanceStatus.leave => ParentPortalColors.blue,
    AttendanceStatus.festival ||
    AttendanceStatus.holiday => ParentPortalColors.purple,
  };
}

IconData _statusIcon(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => Icons.check_rounded,
    AttendanceStatus.late => Icons.schedule_rounded,
    AttendanceStatus.absent => Icons.close_rounded,
    AttendanceStatus.leave => Icons.event_busy_rounded,
    AttendanceStatus.festival ||
    AttendanceStatus.holiday => Icons.celebration_rounded,
  };
}

String _statusLabel(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => 'Present',
    AttendanceStatus.late => 'Late',
    AttendanceStatus.absent => 'Absent',
    AttendanceStatus.leave => 'Leave',
    AttendanceStatus.festival => 'Festival',
    AttendanceStatus.holiday => 'Holiday',
  };
}

String _two(int value) => value.toString().padLeft(2, '0');
