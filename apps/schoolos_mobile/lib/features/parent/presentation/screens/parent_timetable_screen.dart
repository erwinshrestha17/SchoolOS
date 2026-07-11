import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';
import '../widgets/parent_state_view.dart';

class ParentTimetableScreen extends ConsumerWidget {
  const ParentTimetableScreen({
    super.key,
    this.role = 'PARENT',
    this.selectedIndex = 5,
    this.title = 'Timetable',
  });

  final String role;
  final int selectedIndex;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;
    final isStudent = role.toUpperCase() == 'STUDENT';
    final showAllChildren = !isStudent && state.children.length > 1;

    return ParentDetailScaffold(
      title: title,
      selectedIndex: selectedIndex,
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: showAllChildren
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  for (final child in state.children) ...[
                    _TimetableContent(
                      key: ValueKey(child.id),
                      childId: child.id,
                      child: child,
                      embedded: true,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ],
              )
            : childId == null
            ? AppEmptyState(
                title: isStudent
                    ? 'No student profile linked'
                    : 'No child selected',
                message: isStudent
                    ? 'Ask the school office to link this login to a student profile.'
                    : 'Select a child before viewing timetable.',
                icon: Icons.event_note_rounded,
              )
            : _TimetableContent(childId: childId, child: state.selectedChild),
      ),
    );
  }
}

class _TimetableContent extends ConsumerWidget {
  const _TimetableContent({
    super.key,
    required this.childId,
    this.child,
    this.embedded = false,
  });

  final String childId;
  final GuardianChild? child;
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetable = ref.watch(parentTimetableProvider(childId));
    final profile = ref.watch(parentChildProfileProvider(childId));

    return timetable.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 132),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 72),
            SizedBox(height: AppSpacing.xl),
            AppSkeleton(width: double.infinity, height: 112),
          ],
        ),
      ),
      error: (error, _) => AppExceptionView(
        error: error,
        onRetry: () => ref.invalidate(parentTimetableProvider(childId)),
      ),
      data: (data) {
        if (data.slots.isEmpty) {
          return const AppEmptyState(
            title: 'No timetable published',
            message: 'Published class timetable will appear here.',
            icon: Icons.event_note_rounded,
          );
        }

        final view = ParentTimetableView(
          child: child,
          timetable: data,
          classTeacher: profile.valueOrNull?.classTeacher,
        );

        if (embedded) {
          return view;
        }

        return RefreshIndicator(
          color: ParentPortalColors.green,
          onRefresh: () async {
            ref.invalidate(parentTimetableProvider(childId));
            await ref.read(parentTimetableProvider(childId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            children: [view],
          ),
        );
      },
    );
  }
}

class ParentTimetableView extends StatefulWidget {
  const ParentTimetableView({
    super.key,
    required this.child,
    required this.timetable,
    required this.classTeacher,
  });

  final GuardianChild? child;
  final ParentTimetable timetable;
  final String? classTeacher;

  @override
  State<ParentTimetableView> createState() => _ParentTimetableViewState();
}

class _ParentTimetableViewState extends State<ParentTimetableView> {
  late int selectedDay;

  List<int> get availableDays {
    final days = widget.timetable.slots.map((slot) => slot.dayOfWeek).toSet();
    return const [
      7,
      1,
      2,
      3,
      4,
      5,
      6,
    ].where((day) => days.contains(day)).toList();
  }

  @override
  void initState() {
    super.initState();
    selectedDay = _initialDay(availableDays);
  }

  @override
  void didUpdateWidget(covariant ParentTimetableView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!availableDays.contains(selectedDay)) {
      selectedDay = _initialDay(availableDays);
    }
  }

  @override
  Widget build(BuildContext context) {
    final days = availableDays;
    final slots =
        widget.timetable.slots
            .where((slot) => slot.dayOfWeek == selectedDay)
            .toList()
          ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TimetableHeaderCard(
          child: widget.child,
          timetable: widget.timetable,
          classTeacher: widget.classTeacher,
        ),
        const SizedBox(height: AppSpacing.lg),
        _WeekdaySelector(
          days: days,
          selectedDay: selectedDay,
          onSelected: (day) => setState(() => selectedDay = day),
        ),
        const SizedBox(height: AppSpacing.lg),
        _DayHeader(day: selectedDay, periodCount: slots.length),
        const SizedBox(height: AppSpacing.md),
        if (slots.isEmpty)
          const AppEmptyState(
            title: 'No periods scheduled',
            message: 'There are no published periods for this day.',
            icon: Icons.calendar_today_outlined,
          )
        else
          for (var index = 0; index < slots.length; index++) ...[
            _TimetableSlotCard(slot: slots[index], index: index),
            if (index != slots.length - 1)
              const SizedBox(height: AppSpacing.md),
          ],
      ],
    );
  }
}

class _TimetableHeaderCard extends StatelessWidget {
  const _TimetableHeaderCard({
    required this.child,
    required this.timetable,
    required this.classTeacher,
  });

  final GuardianChild? child;
  final ParentTimetable timetable;
  final String? classTeacher;

  @override
  Widget build(BuildContext context) {
    final classTeacherLabel = classTeacher?.trim().isNotEmpty == true
        ? classTeacher!.trim()
        : 'Class teacher not assigned';
    return PortalCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: const BoxDecoration(
              color: ParentPortalColors.greenSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.school_outlined,
              color: ParentPortalColors.green,
              size: 30,
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child?.name ?? 'Published timetable',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [
                    if (child != null) child!.classSection,
                    classTeacherLabel,
                  ].join(' • '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: ParentPortalColors.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '${timetable.versionName ?? 'Published timetable'} • ${timetable.slots.length} scheduled periods',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WeekdaySelector extends StatelessWidget {
  const _WeekdaySelector({
    required this.days,
    required this.selectedDay,
    required this.onSelected,
  });

  final List<int> days;
  final int selectedDay;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      child: Row(
        children: [
          for (final day in days)
            Expanded(
              child: Semantics(
                button: true,
                selected: day == selectedDay,
                label: _dayLabel(day),
                child: InkWell(
                  key: ValueKey('timetable-day-$day'),
                  onTap: () => onSelected(day),
                  borderRadius: AppRadius.borderRadiusMax,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    constraints: const BoxConstraints(minHeight: 44),
                    alignment: Alignment.center,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: day == selectedDay
                          ? ParentPortalColors.green
                          : ParentPortalColors.surfaceAlt,
                      borderRadius: AppRadius.borderRadiusMax,
                    ),
                    child: Text(
                      _shortDayLabel(day),
                      maxLines: 1,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: day == selectedDay
                            ? Colors.white
                            : ParentPortalColors.navy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day, required this.periodCount});

  final int day;
  final int periodCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          Icons.calendar_today_outlined,
          color: ParentPortalColors.navy,
          size: 22,
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Text(
            _dayLabel(day),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        StatusBadge(
          icon: Icons.schedule_rounded,
          label: '$periodCount ${periodCount == 1 ? 'period' : 'periods'}',
          color: ParentPortalColors.navy,
          backgroundColor: ParentPortalColors.surfaceAlt,
        ),
      ],
    );
  }
}

class _TimetableSlotCard extends StatelessWidget {
  const _TimetableSlotCard({required this.slot, required this.index});

  final ParentTimetableSlot slot;
  final int index;

  @override
  Widget build(BuildContext context) {
    final visual = _subjectVisual(slot.subjectName, index);
    return PortalCard(
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Container(width: 5, color: visual.color),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 310;
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 54,
                      child: Text(
                        '${slot.startsAt}\n${slot.endsAt}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                          color: ParentPortalColors.muted,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 44,
                      color: ParentPortalColors.border,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: visual.softColor,
                        borderRadius: AppRadius.borderRadiusLG,
                      ),
                      child: Icon(visual.icon, color: visual.color, size: 23),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            slot.subjectName,
                            maxLines: compact ? 2 : 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: ParentPortalColors.navy,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            [
                              slot.teacherName,
                              if (slot.room?.trim().isNotEmpty == true)
                                slot.room!.trim(),
                            ].join(' • '),
                            maxLines: compact ? 2 : 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: ParentPortalColors.muted,
                                  fontSize: 11,
                                ),
                          ),
                          if (compact) ...[
                            const SizedBox(height: AppSpacing.sm),
                            _PeriodBadge(slot: slot, visual: visual),
                          ],
                        ],
                      ),
                    ),
                    if (!compact) ...[
                      const SizedBox(width: AppSpacing.sm),
                      _PeriodBadge(slot: slot, visual: visual),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PeriodBadge extends StatelessWidget {
  const _PeriodBadge({required this.slot, required this.visual});

  final ParentTimetableSlot slot;
  final _SubjectVisual visual;

  @override
  Widget build(BuildContext context) {
    final label = slot.periodName?.trim().isNotEmpty == true
        ? slot.periodName!.trim()
        : 'Period';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: visual.softColor,
        borderRadius: AppRadius.borderRadiusSM,
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: visual.color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SubjectVisual {
  const _SubjectVisual({
    required this.color,
    required this.softColor,
    required this.icon,
  });

  final Color color;
  final Color softColor;
  final IconData icon;
}

_SubjectVisual _subjectVisual(String subjectName, int index) {
  final subject = subjectName.toLowerCase();
  if (subject.contains('math')) {
    return const _SubjectVisual(
      color: ParentPortalColors.purple,
      softColor: ParentPortalColors.purpleSoft,
      icon: Icons.calculate_outlined,
    );
  }
  if (subject.contains('science') || subject.contains('health')) {
    return const _SubjectVisual(
      color: Color(0xFF5AAA3A),
      softColor: Color(0xFFF0F8E9),
      icon: Icons.science_outlined,
    );
  }
  if (subject.contains('computer') || subject.contains('digital')) {
    return const _SubjectVisual(
      color: ParentPortalColors.blue,
      softColor: ParentPortalColors.blueSoft,
      icon: Icons.desktop_windows_outlined,
    );
  }
  if (subject.contains('art') || subject.contains('creative')) {
    return const _SubjectVisual(
      color: Color(0xFFD94B8A),
      softColor: Color(0xFFFFEDF5),
      icon: Icons.palette_outlined,
    );
  }
  if (subject.contains('social') || subject.contains('geography')) {
    return const _SubjectVisual(
      color: ParentPortalColors.orange,
      softColor: ParentPortalColors.orangeSoft,
      icon: Icons.public_rounded,
    );
  }
  if (subject.contains('moral') ||
      subject.contains('english') ||
      subject.contains('nepali') ||
      subject.contains('language')) {
    return const _SubjectVisual(
      color: ParentPortalColors.green,
      softColor: ParentPortalColors.greenSoft,
      icon: Icons.menu_book_outlined,
    );
  }

  const fallbacks = [
    _SubjectVisual(
      color: ParentPortalColors.purple,
      softColor: ParentPortalColors.purpleSoft,
      icon: Icons.auto_stories_outlined,
    ),
    _SubjectVisual(
      color: ParentPortalColors.blue,
      softColor: ParentPortalColors.blueSoft,
      icon: Icons.school_outlined,
    ),
    _SubjectVisual(
      color: ParentPortalColors.orange,
      softColor: ParentPortalColors.orangeSoft,
      icon: Icons.lightbulb_outline_rounded,
    ),
    _SubjectVisual(
      color: ParentPortalColors.green,
      softColor: ParentPortalColors.greenSoft,
      icon: Icons.menu_book_outlined,
    ),
  ];
  return fallbacks[index % fallbacks.length];
}

int _initialDay(List<int> days) {
  if (days.isEmpty) return 1;
  final today = DateTime.now().weekday;
  return days.contains(today) ? today : days.first;
}

String _shortDayLabel(int day) {
  const days = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  };
  return days[day] ?? 'Day';
}

String _dayLabel(int day) {
  const days = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
  };
  return days[day] ?? 'Day $day';
}
