import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
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
          _CorrectionSection(
            studentId: widget.studentId,
            days: data.days,
            isOffline: data.isOffline,
          ),
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

class _CorrectionSection extends ConsumerWidget {
  const _CorrectionSection({
    required this.studentId,
    required this.days,
    required this.isOffline,
  });

  final String studentId;
  final List<AttendanceDay> days;
  final bool isOffline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isOffline) {
      return const PortalCard(
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
                'Attendance correction requests need internet. Reconnect to submit or check their status.',
              ),
            ),
          ],
        ),
      );
    }

    final requests = ref.watch(parentAttendanceCorrectionsProvider(studentId));
    return PortalCard(
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
                      'Need a correction?',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Text(
                      'Ask the school to review a recorded attendance day.',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _recordedCorrectionDays(days).isEmpty
                  ? null
                  : () => _openCorrectionRequestSheet(
                      context,
                      studentId: studentId,
                      days: days,
                    ),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Request a correction'),
            ),
          ),
          if (_recordedCorrectionDays(days).isEmpty) ...[
            const SizedBox(height: 8),
            const Text(
              'No recorded attendance day is available in this month.',
              style: TextStyle(color: ParentPortalColors.muted),
            ),
          ],
          const Divider(height: 28),
          Text(
            'Recent requests',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          requests.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (_, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Correction requests could not be loaded.',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
                TextButton(
                  onPressed: () => ref.invalidate(
                    parentAttendanceCorrectionsProvider(studentId),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
            data: (items) => items.isEmpty
                ? const Text(
                    'No correction requests yet.',
                    style: TextStyle(color: ParentPortalColors.muted),
                  )
                : Column(
                    children: [
                      for (var index = 0; index < items.length; index++) ...[
                        if (index > 0) const Divider(height: 20),
                        _CorrectionRequestRow(
                          studentId: studentId,
                          item: items[index],
                          days: days,
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

class _CorrectionRequestRow extends ConsumerWidget {
  const _CorrectionRequestRow({
    required this.studentId,
    required this.item,
    required this.days,
  });

  final String studentId;
  final ParentAttendanceCorrection item;
  final List<AttendanceDay> days;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _correctionStatusColor(item.status);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                NepaliBsCalendar.formatBsDate(item.attendanceDate),
                style: const TextStyle(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            StatusBadge(label: _correctionStatusLabel(item.status)),
          ],
        ),
        const SizedBox(height: 5),
        Text(
          '${_statusLabel(item.previousStatus)} → ${_statusLabel(item.requestedStatus)}',
          style: TextStyle(color: color, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(item.reason),
        if (item.reviewReason?.trim().isNotEmpty == true) ...[
          const SizedBox(height: 4),
          Text(
            'School response: ${item.reviewReason}',
            style: const TextStyle(color: ParentPortalColors.muted),
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
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Request again'),
                ),
            ],
          ),
        ],
      ],
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

Future<void> _openCorrectionRequestSheet(
  BuildContext context, {
  required String studentId,
  required List<AttendanceDay> days,
  DateTime? initialDate,
  AttendanceStatus? initialStatus,
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
    ),
  );
}

class _CorrectionRequestSheet extends ConsumerStatefulWidget {
  const _CorrectionRequestSheet({
    required this.studentId,
    required this.days,
    this.initialDate,
    this.initialStatus,
  });

  final String studentId;
  final List<AttendanceDay> days;
  final DateTime? initialDate;
  final AttendanceStatus? initialStatus;

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
                        '${NepaliBsCalendar.formatBsDate(day.date)} • ${_statusLabel(day.status)}',
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
              NepaliBsCalendar.formatBsDate(item.attendanceDate),
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
    'REJECTED' || 'CANCELLED' => ParentPortalColors.red,
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

String _monthLabel(DateTime month) =>
    '${_monthNames[month.month - 1]} ${month.year}';
