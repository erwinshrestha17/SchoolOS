import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
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

class _AttendanceBody extends ConsumerStatefulWidget {
  const _AttendanceBody({required this.studentId});

  final String studentId;

  @override
  ConsumerState<_AttendanceBody> createState() => _AttendanceBodyState();
}

class _AttendanceBodyState extends ConsumerState<_AttendanceBody> {
  late DateTime _visibleMonth = _currentMonth();

  static DateTime _currentMonth() {
    final now = DateTime.now();
    return DateTime(now.year, now.month);
  }

  bool get _canGoNext => _visibleMonth.isBefore(_currentMonth());

  void _goToPreviousMonth() {
    setState(() {
      _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month - 1);
    });
  }

  void _goToNextMonth() {
    if (!_canGoNext) return;
    setState(() {
      _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final query = (
      studentId: widget.studentId,
      year: _visibleMonth.year,
      month: _visibleMonth.month,
    );
    final attendance = ref.watch(parentAttendanceProvider(query));
    return attendance.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentAttendanceProvider(query)),
      ),
      data: (data) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _TodayCard(summary: data.summary, isOffline: data.isOffline),
          const SizedBox(height: 14),
          _MonthNavHeader(
            month: _visibleMonth,
            onPrevious: _goToPreviousMonth,
            onNext: _canGoNext ? _goToNextMonth : null,
          ),
          const SizedBox(height: 14),
          _AttendanceOverviewCard(summary: data.summary),
          const SizedBox(height: 14),
          if (data.days.isEmpty)
            const PortalCard(
              child: Text('No attendance records for this month.'),
            )
          else
            _MonthCalendarCard(days: data.days),
        ],
      ),
    );
  }
}

class _MonthNavHeader extends StatelessWidget {
  const _MonthNavHeader({
    required this.month,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous month',
            onPressed: onPrevious,
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: Text(
              _monthLabel(month),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w900,
                fontSize: 16,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Next month',
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right_rounded),
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

class _AttendanceOverviewCard extends StatelessWidget {
  const _AttendanceOverviewCard({required this.summary});

  final AttendanceSummary summary;

  @override
  Widget build(BuildContext context) {
    final total =
        summary.presentCount +
        summary.absentCount +
        summary.lateCount +
        summary.leaveCount;
    final rate = total == 0 ? 0 : (summary.presentCount / total * 100).round();
    final rateColor = rate >= 90
        ? ParentPortalColors.green
        : rate >= 75
        ? ParentPortalColors.orange
        : ParentPortalColors.red;

    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox.expand(
                      child: CircularProgressIndicator(
                        value: total == 0 ? 0 : rate / 100,
                        strokeWidth: 7,
                        strokeCap: StrokeCap.round,
                        backgroundColor: ParentPortalColors.surfaceAlt,
                        valueColor: AlwaysStoppedAnimation(rateColor),
                      ),
                    ),
                    Text(
                      '$rate%',
                      style: TextStyle(
                        color: rateColor,
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Attendance rate',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      total == 0
                          ? 'No school days recorded this month yet.'
                          : '${summary.presentCount} of $total school days present',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (total > 0) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: AppRadius.borderRadiusMax,
              child: SizedBox(
                height: 8,
                child: Row(
                  children: [
                    if (summary.presentCount > 0)
                      Expanded(
                        flex: summary.presentCount,
                        child: Container(color: ParentPortalColors.green),
                      ),
                    if (summary.lateCount > 0)
                      Expanded(
                        flex: summary.lateCount,
                        child: Container(color: ParentPortalColors.orange),
                      ),
                    if (summary.leaveCount > 0)
                      Expanded(
                        flex: summary.leaveCount,
                        child: Container(color: ParentPortalColors.blue),
                      ),
                    if (summary.absentCount > 0)
                      Expanded(
                        flex: summary.absentCount,
                        child: Container(color: ParentPortalColors.red),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _StatChip(
                  color: ParentPortalColors.green,
                  label: 'Present',
                  value: summary.presentCount,
                ),
                _StatChip(
                  color: ParentPortalColors.orange,
                  label: 'Late',
                  value: summary.lateCount,
                ),
                _StatChip(
                  color: ParentPortalColors.red,
                  label: 'Absent',
                  value: summary.absentCount,
                ),
                if (summary.leaveCount > 0)
                  _StatChip(
                    color: ParentPortalColors.blue,
                    label: 'Leave',
                    value: summary.leaveCount,
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.color,
    required this.label,
    required this.value,
  });

  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$value',
          style: const TextStyle(
            color: ParentPortalColors.navy,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(color: ParentPortalColors.muted, fontSize: 12),
        ),
      ],
    );
  }
}

class _MonthCalendarCard extends StatelessWidget {
  const _MonthCalendarCard({required this.days});

  final List<AttendanceDay> days;

  @override
  Widget build(BuildContext context) {
    final byDay = <int, AttendanceStatus>{
      for (final day in days) day.date.day: day.status,
    };
    final anchor = days.first.date;
    final daysInMonth = DateTime(anchor.year, anchor.month + 1, 0).day;
    final firstWeekday = DateTime(anchor.year, anchor.month, 1).weekday % 7;
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final statusesUsed = byDay.values.toSet();

    return PortalCard(
      child: Column(
        children: [
          const Row(
            children: [
              _WeekdayLabel('S'),
              _WeekdayLabel('M'),
              _WeekdayLabel('T'),
              _WeekdayLabel('W'),
              _WeekdayLabel('T'),
              _WeekdayLabel('F'),
              _WeekdayLabel('S'),
            ],
          ),
          const SizedBox(height: 4),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1,
            ),
            itemCount: firstWeekday + daysInMonth,
            itemBuilder: (context, index) {
              if (index < firstWeekday) return const SizedBox.shrink();
              final dayNum = index - firstWeekday + 1;
              final date = DateTime(anchor.year, anchor.month, dayNum);
              return _AttendanceDayCell(
                day: dayNum,
                status: byDay[dayNum],
                isToday: date == todayOnly,
              );
            },
          ),
          if (statusesUsed.isNotEmpty) ...[
            const Divider(height: 24),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                for (final status in AttendanceStatus.values)
                  if (statusesUsed.contains(status))
                    _LegendDot(
                      color: _statusColor(status),
                      label: _statusLabel(status),
                    ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Text(
      label,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: ParentPortalColors.muted,
        fontWeight: FontWeight.w800,
        fontSize: 12,
      ),
    ),
  );
}

class _AttendanceDayCell extends StatelessWidget {
  const _AttendanceDayCell({
    required this.day,
    required this.status,
    required this.isToday,
  });

  final int day;
  final AttendanceStatus? status;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final color = status == null ? null : _statusColor(status!);
    return Container(
      margin: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: color?.withValues(alpha: .16),
        shape: BoxShape.circle,
        border: isToday
            ? Border.all(color: ParentPortalColors.navy, width: 1.4)
            : null,
      ),
      child: Center(
        child: Text(
          '$day',
          style: TextStyle(
            color: color ?? ParentPortalColors.muted,
            fontWeight: isToday ? FontWeight.w900 : FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            color: ParentPortalColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
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

const _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

String _monthLabel(DateTime month) =>
    '${_monthNames[month.month - 1]} ${month.year}';
