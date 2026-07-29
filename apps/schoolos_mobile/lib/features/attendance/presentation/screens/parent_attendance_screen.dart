import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../shared/utils/date_display_preference.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../parent/presentation/widgets/parent_state_view.dart';
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
      // Shared state mapping: offline, module-locked, permission-denied and
      // session-expired each get their own surface instead of collapsing into
      // one generic error.
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: child == null
            ? const SizedBox.shrink()
            : RefreshIndicator(
                onRefresh: controller.load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                  children: [
                    ParentApiChildSelector(
                      child: child,
                      children: state.children,
                      onChanged: controller.selectChild,
                      statusLabel: state.isOffline ? 'Offline copy' : null,
                    ),
                    const SizedBox(height: 14),
                    _AttendanceBody(studentId: child.id),
                  ],
                ),
              ),
      ),
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
  DateTime? _selectedDate;

  static DateTime _currentMonth() {
    final now = NepaliBsCalendar.getNepalNow();
    return DateTime(now.year, now.month);
  }

  bool get _canGoNext => _visibleMonth.isBefore(_currentMonth());

  void _goToPreviousMonth() {
    setState(() {
      _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month - 1);
      _selectedDate = null;
    });
  }

  void _goToNextMonth() {
    if (!_canGoNext) return;
    setState(() {
      _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + 1);
      _selectedDate = null;
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
    final datePreference = ref.watch(dateDisplayPreferenceProvider);
    return attendance.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentAttendanceProvider(query)),
      ),
      data: (data) {
        final selectedDay = data.days
            .where(
              (day) =>
                  _selectedDate != null &&
                  _sameCalendarDay(day.date, _selectedDate!),
            )
            .firstOrNull;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TodayCard(
              summary: data.summary,
              isOffline: data.isOffline,
              onRefresh: () => ref.invalidate(parentAttendanceProvider(query)),
            ),
            const SizedBox(height: 14),
            _MonthlyAttendanceCard(
              month: _visibleMonth,
              summary: data.summary,
              days: data.days,
              selectedDay: selectedDay,
              selectedDate: _selectedDate,
              onSelectDate: (date) => setState(() => _selectedDate = date),
              onPrevious: _goToPreviousMonth,
              onNext: _canGoNext ? _goToNextMonth : null,
              datePreference: datePreference,
            ),
            const SizedBox(height: 14),
            _CorrectionActionCard(
              studentId: widget.studentId,
              days: data.days,
              selectedDay: selectedDay,
              isOffline: data.isOffline,
              datePreference: datePreference,
            ),
            const SizedBox(height: 20),
            _RecentCorrectionRequests(
              studentId: widget.studentId,
              days: data.days,
              isOffline: data.isOffline,
              datePreference: datePreference,
            ),
          ],
        );
      },
    );
  }
}

class _CorrectionActionCard extends ConsumerWidget {
  const _CorrectionActionCard({
    required this.studentId,
    required this.days,
    required this.selectedDay,
    required this.isOffline,
    required this.datePreference,
  });

  final String studentId;
  final List<AttendanceDay> days;
  final AttendanceDay? selectedDay;
  final bool isOffline;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isOffline) {
      return const PortalCard(
        padding: EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FeatureIcon(
              Icons.wifi_off_rounded,
              color: ParentPortalColors.orange,
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Attendance correction requests need internet. Reconnect to submit a request.',
              ),
            ),
          ],
        ),
      );
    }

    final requests = ref.watch(parentAttendanceCorrectionsProvider(studentId));
    final selectedIsEligible =
        selectedDay != null &&
        _recordedCorrectionDays(
          days,
        ).any((day) => _sameCalendarDay(day.date, selectedDay!.date));
    final hasPendingRequest =
        selectedDay != null &&
        (requests.valueOrNull ?? const <ParentAttendanceCorrection>[]).any(
          (request) =>
              request.status == 'PENDING' &&
              _sameCalendarDay(request.attendanceDate, selectedDay!.date),
        );

    return PortalCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(
                Icons.edit_calendar_rounded,
                color: ParentPortalColors.blue,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Attendance looks incorrect?',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      selectedDay == null
                          ? 'Select a recorded date from the calendar and ask the school to review it.'
                          : hasPendingRequest
                          ? 'A request for this attendance record is already pending review.'
                          : selectedIsEligible
                          ? '${formatPreferredDate(selectedDay!.date, datePreference)} is selected.'
                          : 'This date does not have a recorded attendance status to correct.',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.tonalIcon(
              onPressed:
                  !selectedIsEligible || hasPendingRequest || requests.isLoading
                  ? null
                  : () => _openCorrectionRequestSheet(
                      context,
                      studentId: studentId,
                      days: days,
                      initialDate: selectedDay!.date,
                      datePreference: datePreference,
                    ),
              icon: const Icon(Icons.edit_calendar_rounded),
              label: const Text('Request correction'),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentCorrectionRequests extends ConsumerWidget {
  const _RecentCorrectionRequests({
    required this.studentId,
    required this.days,
    required this.isOffline,
    required this.datePreference,
  });

  final String studentId;
  final List<AttendanceDay> days;
  final bool isOffline;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isOffline) {
      return const SizedBox.shrink();
    }
    final requests = ref.watch(parentAttendanceCorrectionsProvider(studentId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Correction requests',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: ParentPortalColors.navy,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        requests.when(
          loading: () => const PortalCard(
            padding: EdgeInsets.all(18),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (_, _) => PortalCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const Expanded(
                  child: Text('Correction requests could not be loaded.'),
                ),
                TextButton(
                  onPressed: () => ref.invalidate(
                    parentAttendanceCorrectionsProvider(studentId),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const PortalCard(
                padding: EdgeInsets.all(14),
                child: Text(
                  'No correction requests yet.',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
              );
            }
            final preview = items.take(2).toList();
            return PortalCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Column(
                children: [
                  for (var index = 0; index < preview.length; index++) ...[
                    if (index > 0) const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: _CorrectionRequestRow(
                        studentId: studentId,
                        item: preview[index],
                        days: days,
                        compact: true,
                        datePreference: datePreference,
                      ),
                    ),
                  ],
                  if (items.length > 2) ...[
                    const Divider(height: 1),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton.icon(
                        onPressed: () => _showAllCorrectionRequests(
                          context,
                          studentId: studentId,
                          items: items,
                          days: days,
                          datePreference: datePreference,
                        ),
                        icon: const Icon(Icons.history_rounded),
                        label: const Text('View all correction requests'),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _CorrectionRequestRow extends ConsumerWidget {
  const _CorrectionRequestRow({
    required this.studentId,
    required this.item,
    required this.days,
    this.compact = false,
    required this.datePreference,
  });

  final String studentId;
  final ParentAttendanceCorrection item;
  final List<AttendanceDay> days;
  final bool compact;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _correctionStatusColor(item.status);
    final response = _parentSafeCorrectionText(item.reviewReason);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                formatPreferredDate(item.attendanceDate, datePreference),
                style: const TextStyle(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            _CorrectionStatusBadge(status: item.status),
          ],
        ),
        Text(
          'Requested ${formatPreferredDate(item.requestedAt, datePreference)}',
          style: const TextStyle(color: ParentPortalColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 6),
        Text(
          '${_statusLabel(item.previousStatus)} → ${_statusLabel(item.requestedStatus)}',
          style: TextStyle(color: color, fontWeight: FontWeight.w800),
        ),
        if (!compact) ...[
          const SizedBox(height: 4),
          Text(
            _parentSafeCorrectionText(item.reason) ??
                'You asked the school to review this attendance record.',
          ),
        ],
        if (response != null) ...[
          const SizedBox(height: 4),
          Text(
            'School response: $response',
            style: const TextStyle(color: ParentPortalColors.muted),
            maxLines: compact ? 2 : null,
            overflow: compact ? TextOverflow.ellipsis : null,
          ),
        ] else if (item.status == 'PENDING') ...[
          const SizedBox(height: 4),
          const Text(
            'The school has not responded yet.',
            style: TextStyle(color: ParentPortalColors.muted),
          ),
        ],
        if (item.canCancel || item.canResubmit) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (item.canCancel)
                TextButton.icon(
                  onPressed: () => _confirmCorrectionCancellation(
                    context,
                    ref,
                    studentId,
                    item,
                    datePreference,
                  ),
                  icon: const Icon(Icons.close_rounded),
                  label: const Text('Cancel request'),
                ),
              if (item.canResubmit)
                TextButton.icon(
                  onPressed: () => _openCorrectionRequestSheet(
                    context,
                    studentId: studentId,
                    days: days,
                    initialDate: item.attendanceDate,
                    initialStatus: item.requestedStatus,
                    datePreference: datePreference,
                  ),
                  icon: Icon(
                    item.status == 'REJECTED'
                        ? Icons.rate_review_outlined
                        : Icons.add_rounded,
                  ),
                  label: Text(
                    item.status == 'REJECTED'
                        ? 'Review reason and resubmit'
                        : 'Create a new request',
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _CorrectionStatusBadge extends StatelessWidget {
  const _CorrectionStatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, background, icon) = switch (status) {
      'APPROVED' => (
        ParentPortalColors.green,
        ParentPortalColors.greenSoft,
        Icons.check_circle_rounded,
      ),
      'REJECTED' => (
        ParentPortalColors.red,
        ParentPortalColors.redSoft,
        Icons.cancel_rounded,
      ),
      'CANCELLED' => (
        ParentPortalColors.muted,
        ParentPortalColors.surfaceAlt,
        Icons.remove_circle_outline_rounded,
      ),
      _ => (
        ParentPortalColors.orange,
        ParentPortalColors.orangeSoft,
        Icons.schedule_rounded,
      ),
    };
    return StatusBadge(
      label: _correctionStatusLabel(status),
      color: color,
      backgroundColor: background,
      icon: icon,
    );
  }
}

class _MonthlyAttendanceCard extends StatelessWidget {
  const _MonthlyAttendanceCard({
    required this.month,
    required this.summary,
    required this.days,
    required this.selectedDay,
    required this.selectedDate,
    required this.onSelectDate,
    required this.datePreference,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime month;
  final AttendanceSummary summary;
  final List<AttendanceDay> days;
  final AttendanceDay? selectedDay;
  final DateTime? selectedDate;
  final ValueChanged<DateTime> onSelectDate;
  final DateDisplayPreference datePreference;
  final VoidCallback onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MonthNavHeader(
            month: month,
            onPrevious: onPrevious,
            onNext: onNext,
            datePreference: datePreference,
          ),
          const Divider(height: 20),
          _AttendanceOverview(summary: summary),
          const Divider(height: 24),
          _MonthCalendar(
            month: month,
            days: days,
            selectedDate: selectedDate,
            onSelectDate: onSelectDate,
            datePreference: datePreference,
          ),
          if (selectedDate != null) ...[
            const Divider(height: 24),
            _SelectedDateDetails(
              date: selectedDate!,
              day: selectedDay,
              datePreference: datePreference,
            ),
          ],
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
    required this.datePreference,
  });

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback? onNext;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context) {
    final labels = _monthPeriodLabels(month, datePreference);
    return Row(
      children: [
        IconButton(
          tooltip: 'Previous month',
          onPressed: onPrevious,
          icon: const Icon(Icons.chevron_left_rounded),
        ),
        Expanded(
          child: Column(
            children: [
              Text(
                labels.$1,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                labels.$2,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: ParentPortalColors.muted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Next month',
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right_rounded),
        ),
      ],
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({
    required this.summary,
    required this.isOffline,
    required this.onRefresh,
  });

  final AttendanceSummary summary;
  final bool isOffline;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(summary.todayStatus);
    return PortalCard(
      padding: const EdgeInsets.all(14),
      color: summary.todayStatus == AttendanceStatus.unknown
          ? ParentPortalColors.blueSoft
          : color.withValues(alpha: .10),
      borderColor: summary.todayStatus == AttendanceStatus.unknown
          ? ParentPortalColors.blue.withValues(alpha: .24)
          : color.withValues(alpha: .18),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FeatureIcon(_statusIcon(summary.todayStatus), color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      summary.todayStatus == AttendanceStatus.unknown
                          ? 'Today’s attendance is not available yet'
                          : summary.todayLabel ??
                                _statusLabel(summary.todayStatus),
                      style: TextStyle(
                        color: summary.todayStatus == AttendanceStatus.unknown
                            ? ParentPortalColors.navy
                            : color,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isOffline
                          ? 'Showing the last saved attendance summary.'
                          : summary.todayStatus == AttendanceStatus.unknown
                          ? 'The school has not completed attendance for today. This page will update after attendance is submitted.'
                          : 'Updated from the school attendance record.',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${isOffline ? 'Last saved' : 'Last checked'}: ${NepaliBsCalendar.formatNepalTime(summary.lastUpdated)}',
                  style: const TextStyle(
                    color: ParentPortalColors.muted,
                    fontSize: 12,
                  ),
                ),
              ),
              if (!isOffline)
                TextButton.icon(
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Refresh'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttendanceOverview extends StatelessWidget {
  const _AttendanceOverview({required this.summary});

  final AttendanceSummary summary;

  @override
  Widget build(BuildContext context) {
    final total = summary.totalMarked;
    final rate = summary.attendancePercentage;
    final rateColor = (rate ?? 0) >= 90
        ? ParentPortalColors.green
        : (rate ?? 0) >= 75
        ? ParentPortalColors.orange
        : ParentPortalColors.red;

    return Column(
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
                      value: rate == null ? 0 : rate / 100,
                      strokeWidth: 7,
                      strokeCap: StrokeCap.round,
                      backgroundColor: ParentPortalColors.surfaceAlt,
                      valueColor: AlwaysStoppedAnimation(rateColor),
                    ),
                  ),
                  Text(
                    rate == null ? '—' : '${_formatPercentage(rate)}%',
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
                    rate == null
                        ? 'Attendance rate unavailable'
                        : '${_formatPercentage(rate)}% attendance',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    total == 0
                        ? 'No marked attendance days in this period yet.'
                        : '${summary.presentCount} of $total marked days recorded as present',
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
          const SizedBox(height: 10),
          Text(
            'The school’s current calculation counts only Present as present. Late and leave are reported separately.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
          ),
        ],
      ],
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

class _MonthCalendar extends StatelessWidget {
  const _MonthCalendar({
    required this.month,
    required this.days,
    required this.selectedDate,
    required this.onSelectDate,
    required this.datePreference,
  });

  final DateTime month;
  final List<AttendanceDay> days;
  final DateTime? selectedDate;
  final ValueChanged<DateTime> onSelectDate;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context) {
    final byDay = <int, AttendanceStatus>{
      for (final day in days) day.date.day: day.status,
    };
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final firstWeekday = DateTime(month.year, month.month, 1).weekday % 7;
    final today = NepaliBsCalendar.getNepalNow();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final statusesUsed = byDay.values.toSet();

    return Column(
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
            final date = DateTime(month.year, month.month, dayNum);
            return _AttendanceDayCell(
              date: date,
              status: byDay[dayNum],
              isToday: date == todayOnly,
              isSelected:
                  selectedDate != null && _sameCalendarDay(date, selectedDate!),
              isFuture: date.isAfter(todayOnly),
              onTap: () => onSelectDate(date),
              datePreference: datePreference,
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
    required this.date,
    required this.status,
    required this.isToday,
    required this.isSelected,
    required this.isFuture,
    required this.onTap,
    required this.datePreference,
  });

  final DateTime date;
  final AttendanceStatus? status;
  final bool isToday;
  final bool isSelected;
  final bool isFuture;
  final VoidCallback onTap;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context) {
    final color = status == null ? null : _statusColor(status!);
    final bsDate = NepaliBsCalendar.fromAd(date);
    final stateLabel = status == null
        ? isFuture
              ? 'Future date'
              : 'No attendance record'
        : _statusLabel(status!);
    return Semantics(
      button: true,
      selected: isSelected,
      label:
          '${formatPreferredDate(date, datePreference)}, $stateLabel${isToday ? ', today' : ''}',
      child: InkResponse(
        onTap: onTap,
        radius: 24,
        child: Center(
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color?.withValues(alpha: .14),
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(color: ParentPortalColors.navy, width: 2)
                  : null,
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      datePreference == DateDisplayPreference.gregorian
                          ? '${date.day}'
                          : '${bsDate.day}',
                      style: TextStyle(
                        color: isFuture
                            ? ParentPortalColors.muted.withValues(alpha: .6)
                            : color ?? ParentPortalColors.muted,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    if (datePreference == DateDisplayPreference.both)
                      Text(
                        'AD ${date.day}',
                        style: TextStyle(
                          color: ParentPortalColors.muted.withValues(
                            alpha: .78,
                          ),
                          fontSize: 8,
                          height: .9,
                        ),
                      ),
                  ],
                ),
                if (isToday)
                  const Positioned(
                    bottom: 3,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: ParentPortalColors.navy,
                        shape: BoxShape.circle,
                      ),
                      child: SizedBox(width: 4, height: 4),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SelectedDateDetails extends StatelessWidget {
  const _SelectedDateDetails({
    required this.date,
    required this.day,
    required this.datePreference,
  });

  final DateTime date;
  final AttendanceDay? day;
  final DateDisplayPreference datePreference;

  @override
  Widget build(BuildContext context) {
    final status = day?.status;
    final today = NepaliBsCalendar.getNepalNow();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final isFuture = date.isAfter(todayOnly);
    final title = formatPreferredDate(date, datePreference, long: true);
    final secondaryDate = formatSecondaryDate(date, datePreference);
    final detail = status != null
        ? _statusLabel(status)
        : isFuture
        ? 'Future date'
        : _sameCalendarDay(date, todayOnly)
        ? 'Attendance not marked'
        : 'No attendance record';

    return Semantics(
      liveRegion: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeatureIcon(
            status == null ? Icons.event_note_rounded : _statusIcon(status),
            color: status == null
                ? ParentPortalColors.muted
                : _statusColor(status),
            size: 40,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (secondaryDate != null)
                  Text(
                    secondaryDate,
                    style: const TextStyle(
                      color: ParentPortalColors.muted,
                      fontSize: 12,
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  detail,
                  style: TextStyle(
                    color: status == null
                        ? ParentPortalColors.muted
                        : _statusColor(status),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (day?.remark?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 3),
                  Text(
                    day!.remark!.trim(),
                    style: const TextStyle(color: ParentPortalColors.muted),
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

Future<void> _showAllCorrectionRequests(
  BuildContext context, {
  required String studentId,
  required List<ParentAttendanceCorrection> items,
  required List<AttendanceDay> days,
  required DateDisplayPreference datePreference,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .82,
      minChildSize: .5,
      maxChildSize: .95,
      builder: (context, scrollController) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Text(
              'Correction request history',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.separated(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(height: 28),
              itemBuilder: (context, index) => _CorrectionRequestRow(
                studentId: studentId,
                item: items[index],
                days: days,
                datePreference: datePreference,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

Future<void> _openCorrectionRequestSheet(
  BuildContext context, {
  required String studentId,
  required List<AttendanceDay> days,
  DateTime? initialDate,
  AttendanceStatus? initialStatus,
  required DateDisplayPreference datePreference,
}) async {
  final recordedDays = _recordedCorrectionDays(days);
  if (recordedDays.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('No recorded attendance day is available in this month.'),
      ),
    );
    return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _CorrectionRequestSheet(
      studentId: studentId,
      days: recordedDays,
      initialDate: initialDate,
      initialStatus: initialStatus,
      datePreference: datePreference,
    ),
  );
}

class _CorrectionRequestSheet extends ConsumerStatefulWidget {
  const _CorrectionRequestSheet({
    required this.studentId,
    required this.days,
    this.initialDate,
    this.initialStatus,
    required this.datePreference,
  });

  final String studentId;
  final List<AttendanceDay> days;
  final DateTime? initialDate;
  final AttendanceStatus? initialStatus;
  final DateDisplayPreference datePreference;

  @override
  ConsumerState<_CorrectionRequestSheet> createState() =>
      _CorrectionRequestSheetState();
}

class _CorrectionRequestSheetState
    extends ConsumerState<_CorrectionRequestSheet> {
  late final TextEditingController _reasonController;
  late DateTime _selectedDate;
  late AttendanceStatus _requestedStatus;
  String? _validationMessage;

  @override
  void initState() {
    super.initState();
    _reasonController = TextEditingController();
    _selectedDate =
        widget.days
            .where(
              (day) =>
                  widget.initialDate != null &&
                  _sameCalendarDay(day.date, widget.initialDate!),
            )
            .firstOrNull
            ?.date ??
        widget.days.first.date;
    _requestedStatus =
        widget.initialStatus ??
        _correctionStatusOptions.firstWhere(
          (status) => status != _selectedDay.status,
          orElse: () => AttendanceStatus.present,
        );
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  AttendanceDay get _selectedDay => widget.days.firstWhere(
    (day) => _sameCalendarDay(day.date, _selectedDate),
  );

  @override
  Widget build(BuildContext context) {
    final controllerState = ref.watch(
      parentAttendanceCorrectionControllerProvider(widget.studentId),
    );
    final saving = controllerState.isLoading;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Request attendance correction',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'The school will review this request. Attendance changes only after approval.',
              style: TextStyle(color: ParentPortalColors.muted),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<DateTime>(
              initialValue: _selectedDate,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Recorded day'),
              items: widget.days
                  .map(
                    (day) => DropdownMenuItem<DateTime>(
                      value: day.date,
                      child: Text(
                        '${formatPreferredDate(day.date, widget.datePreference)} • ${_statusLabel(day.status)}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: saving
                  ? null
                  : (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedDate = value;
                        if (_requestedStatus == _selectedDay.status) {
                          _requestedStatus = _correctionStatusOptions
                              .firstWhere(
                                (status) => status != _selectedDay.status,
                              );
                        }
                        _validationMessage = null;
                      });
                    },
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<AttendanceStatus>(
              initialValue: _requestedStatus,
              decoration: const InputDecoration(
                labelText: 'Correct attendance to',
              ),
              items: _correctionStatusOptions
                  .map(
                    (status) => DropdownMenuItem<AttendanceStatus>(
                      value: status,
                      child: Text(_statusLabel(status)),
                    ),
                  )
                  .toList(),
              onChanged: saving
                  ? null
                  : (value) {
                      if (value == null) return;
                      setState(() {
                        _requestedStatus = value;
                        _validationMessage = null;
                      });
                    },
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _reasonController,
              minLines: 3,
              maxLines: 5,
              maxLength: 500,
              enabled: !saving,
              decoration: InputDecoration(
                labelText: 'Why is this attendance incorrect?',
                helperText: 'Add at least 8 characters.',
                errorText: _validationMessage,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: saving ? null : _submit,
                child: Text(saving ? 'Submitting...' : 'Submit request'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.length < 8) {
      setState(() {
        _validationMessage = 'Please explain the correction in more detail.';
      });
      return;
    }
    if (_requestedStatus == _selectedDay.status) {
      setState(() {
        _validationMessage =
            'Choose a status different from the recorded attendance.';
      });
      return;
    }

    final saved = await ref
        .read(
          parentAttendanceCorrectionControllerProvider(
            widget.studentId,
          ).notifier,
        )
        .create(
          attendanceDate: _selectedDate,
          requestedStatus: _requestedStatus,
          reason: reason,
        );
    if (!mounted) return;
    if (!saved) {
      setState(() {
        _validationMessage =
            'The request could not be submitted. Check the latest status and try again.';
      });
      return;
    }
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Attendance correction requested.')),
    );
  }
}

Future<void> _confirmCorrectionCancellation(
  BuildContext context,
  WidgetRef ref,
  String studentId,
  ParentAttendanceCorrection item,
  DateDisplayPreference datePreference,
) async {
  final reasonController = TextEditingController();
  String? validationMessage;
  var saving = false;
  final cancelled = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Cancel correction request?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              formatPreferredDate(item.attendanceDate, datePreference),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              enabled: !saving,
              decoration: InputDecoration(
                labelText: 'Cancellation reason',
                errorText: validationMessage,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: saving
                ? null
                : () => Navigator.pop(dialogContext, false),
            child: const Text('Keep request'),
          ),
          FilledButton(
            onPressed: saving
                ? null
                : () async {
                    final reason = reasonController.text.trim();
                    if (reason.length < 8) {
                      setDialogState(() {
                        validationMessage =
                            'Please add a clear cancellation reason.';
                      });
                      return;
                    }
                    setDialogState(() {
                      saving = true;
                      validationMessage = null;
                    });
                    final saved = await ref
                        .read(
                          parentAttendanceCorrectionControllerProvider(
                            studentId,
                          ).notifier,
                        )
                        .cancel(requestId: item.id, reason: reason);
                    if (!dialogContext.mounted) return;
                    if (saved) {
                      Navigator.pop(dialogContext, true);
                    } else {
                      setDialogState(() {
                        saving = false;
                        validationMessage =
                            'The request could not be cancelled. Refresh and try again.';
                      });
                    }
                  },
            child: Text(saving ? 'Cancelling...' : 'Cancel request'),
          ),
        ],
      ),
    ),
  );
  reasonController.dispose();
  if (cancelled == true && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Correction request cancelled.')),
    );
  }
}

List<AttendanceDay> _recordedCorrectionDays(List<AttendanceDay> days) {
  final today = NepaliBsCalendar.today();
  final recorded = days.where((day) {
    final date = NepaliBsCalendar.fromAd(day.date);
    final isFuture =
        date.year > today.year ||
        (date.year == today.year && date.month > today.month) ||
        (date.year == today.year &&
            date.month == today.month &&
            date.day > today.day);
    return !isFuture && _correctionStatusOptions.contains(day.status);
  }).toList();
  recorded.sort((left, right) => right.date.compareTo(left.date));
  return recorded;
}

bool _sameCalendarDay(DateTime left, DateTime right) =>
    left.year == right.year &&
    left.month == right.month &&
    left.day == right.day;

const _correctionStatusOptions = <AttendanceStatus>[
  AttendanceStatus.present,
  AttendanceStatus.absent,
  AttendanceStatus.late,
  AttendanceStatus.halfDay,
  AttendanceStatus.leave,
];

Color _correctionStatusColor(String status) {
  return switch (status) {
    'APPROVED' => ParentPortalColors.green,
    'REJECTED' => ParentPortalColors.red,
    'CANCELLED' => ParentPortalColors.muted,
    _ => ParentPortalColors.orange,
  };
}

String _correctionStatusLabel(String status) {
  return switch (status) {
    'APPROVED' => 'Approved',
    'REJECTED' => 'Rejected',
    'CANCELLED' => 'Cancelled',
    _ => 'Pending review',
  };
}

GuardianChild? _selectedChild(ParentState state, String? studentId) {
  if (state.children.isEmpty) return null;
  if (studentId != null && studentId.isNotEmpty) {
    // An explicit child in the route is a request for that child. If it is not
    // linked, deny rather than silently swapping in another child's
    // attendance under the requested child's URL.
    final matches = state.children.where((child) => child.id == studentId);
    return matches.isEmpty ? null : matches.first;
  }
  // No child in the route: the screen is the generic entry point, so the
  // active selection is the right one to show.
  return state.selectedChild ?? state.children.first;
}

Color _statusColor(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => ParentPortalColors.green,
    AttendanceStatus.late => ParentPortalColors.orange,
    AttendanceStatus.absent => ParentPortalColors.red,
    AttendanceStatus.halfDay => ParentPortalColors.orange,
    AttendanceStatus.leave => ParentPortalColors.blue,
    AttendanceStatus.festival ||
    AttendanceStatus.holiday => ParentPortalColors.purple,
    AttendanceStatus.unknown => ParentPortalColors.muted,
  };
}

IconData _statusIcon(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => Icons.check_rounded,
    AttendanceStatus.late => Icons.schedule_rounded,
    AttendanceStatus.absent => Icons.close_rounded,
    AttendanceStatus.halfDay => Icons.timelapse_rounded,
    AttendanceStatus.leave => Icons.event_busy_rounded,
    AttendanceStatus.festival ||
    AttendanceStatus.holiday => Icons.celebration_rounded,
    AttendanceStatus.unknown => Icons.help_outline_rounded,
  };
}

String _statusLabel(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => 'Present',
    AttendanceStatus.late => 'Late',
    AttendanceStatus.absent => 'Absent',
    AttendanceStatus.halfDay => 'Half day',
    AttendanceStatus.leave => 'Leave',
    AttendanceStatus.festival => 'Festival',
    AttendanceStatus.holiday => 'Holiday',
    AttendanceStatus.unknown => 'Not recorded',
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

(String, String) _monthPeriodLabels(
  DateTime month,
  DateDisplayPreference preference,
) {
  final first = DateTime.utc(month.year, month.month, 1);
  final last = DateTime.utc(month.year, month.month + 1, 0);
  final bsLabel = NepaliBsCalendar.formatDateRange(
    NepaliBsCalendar.fromAd(first),
    NepaliBsCalendar.fromAd(last),
  );
  final adLabel = '${_monthNames[month.month - 1]} ${month.year}';
  return switch (preference) {
    DateDisplayPreference.bikramSambat => (bsLabel, 'Bikram Sambat period'),
    DateDisplayPreference.gregorian => (adLabel, 'Gregorian period'),
    DateDisplayPreference.both => (bsLabel, adLabel),
  };
}

String _formatPercentage(double value) {
  final rounded = value.roundToDouble();
  return rounded == value
      ? rounded.toInt().toString()
      : value.toStringAsFixed(1);
}

String? _parentSafeCorrectionText(String? value) {
  final text = value?.trim();
  if (text == null || text.isEmpty) return null;
  final lower = text.toLowerCase();
  final looksInternal =
      lower.contains('stage 2') ||
      lower.contains('local check') ||
      lower.contains('e2e') ||
      lower.contains('test fixture') ||
      RegExp(r'\b[0-9a-f]{8}\b', caseSensitive: false).hasMatch(text);
  if (looksInternal) {
    return 'The school attendance record needs another review.';
  }
  return text;
}
