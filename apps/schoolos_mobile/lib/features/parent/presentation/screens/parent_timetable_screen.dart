import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentTimetableScreen extends ConsumerWidget {
  const ParentTimetableScreen({
    super.key,
    this.role = 'PARENT',
    this.selectedIndex = 4,
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

    return RoleShellScaffold(
      role: role,
      selectedIndex: selectedIndex,
      title: title,
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? AppEmptyState(
                title: isStudent
                    ? 'No student profile linked'
                    : 'No child selected',
                message: isStudent
                    ? 'Ask the school office to link this login to a student profile.'
                    : 'Select a child before viewing timetable.',
                icon: Icons.event_note_rounded,
              )
            : _TimetableContent(childId: childId),
      ),
    );
  }
}

class _TimetableContent extends ConsumerWidget {
  const _TimetableContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetable = ref.watch(parentTimetableProvider(childId));

    return timetable.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 120),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 96),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load timetable',
        message: 'Please try again in a moment.',
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

        final grouped = <int, List<ParentTimetableSlot>>{};
        for (final slot in data.slots) {
          grouped.putIfAbsent(slot.dayOfWeek, () => []).add(slot);
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(parentTimetableProvider(childId));
            await ref.read(parentTimetableProvider(childId).future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.versionName ?? 'Published timetable',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${data.slots.length} scheduled periods',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              for (final entry in grouped.entries) ...[
                SectionHeader(title: _dayLabel(entry.key)),
                const SizedBox(height: AppSpacing.sm),
                for (final slot in entry.value) ...[
                  _TimetableSlotCard(slot: slot),
                  const SizedBox(height: AppSpacing.md),
                ],
              ],
            ],
          ),
        );
      },
    );
  }
}

class _TimetableSlotCard extends StatelessWidget {
  const _TimetableSlotCard({required this.slot});

  final ParentTimetableSlot slot;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 68,
            child: Text(
              '${slot.startsAt}\n${slot.endsAt}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  slot.subjectName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [
                    slot.teacherName,
                    if (slot.room != null && slot.room!.isNotEmpty) slot.room,
                    if (slot.periodName != null && slot.periodName!.isNotEmpty)
                      slot.periodName,
                  ].whereType<String>().join(' • '),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
