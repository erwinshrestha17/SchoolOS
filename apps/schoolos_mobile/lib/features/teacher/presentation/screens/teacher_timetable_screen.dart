import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/teacher_providers.dart';
import '../../domain/teacher_models.dart';
import '../widgets/teacher_app_widgets.dart';

class TeacherTimetableScreen extends ConsumerWidget {
  const TeacherTimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetable = ref.watch(teacherTimetableProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Timetable',
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(teacherTimetableProvider.future),
        child: timetable.when(
          loading: () => const _TimetableLoading(),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(teacherTimetableProvider),
          ),
          data: (snapshot) => _TimetableBody(snapshot: snapshot),
        ),
      ),
    );
  }
}

class _TimetableBody extends StatelessWidget {
  const _TimetableBody({required this.snapshot});

  final TeacherTimetableSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final grouped = _groupByDay(snapshot.items);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Text(
          'Timetable',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          _rangeLabel(snapshot.rangeStart, snapshot.rangeEnd),
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppColors.slate500,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (snapshot.fromCache)
          const AppCard(
            color: AppColors.warningLight,
            child: Text(
              'You are offline. Showing the last saved timetable.',
              style: TextStyle(
                color: AppColors.warningDark,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        if (snapshot.fromCache) const SizedBox(height: AppSpacing.md),
        _TodayChangesCard(changes: snapshot.todayChanges),
        const SizedBox(height: AppSpacing.lg),
        if (snapshot.items.isEmpty)
          const AppEmptyState(
            title: 'No timetable published',
            message:
                'Assigned periods will appear after the school publishes your timetable.',
            icon: Icons.event_busy_rounded,
          )
        else
          for (final entry in grouped.entries) ...[
            Text(
              entry.key,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: AppSpacing.sm),
            for (final item in entry.value) ...[
              _TimetablePeriodCard(item: item),
              const SizedBox(height: AppSpacing.md),
            ],
            const SizedBox(height: AppSpacing.sm),
          ],
        TeacherLastUpdatedLabel(
          value: snapshot.lastUpdated,
          cached: snapshot.fromCache,
        ),
      ],
    );
  }
}

class _TodayChangesCard extends StatelessWidget {
  const _TodayChangesCard({required this.changes});

  final List<TeacherTimetableSubstitution> changes;

  @override
  Widget build(BuildContext context) {
    if (changes.isEmpty) {
      return const TeacherTaskCard(
        title: 'Today changes',
        subtitle:
            'No substitution, cancellation, or room change assigned today',
        icon: Icons.swap_calls_rounded,
        iconColor: AppColors.success,
      );
    }

    return AppCard(
      color: AppColors.primaryLight,
      hasShadow: false,
      border: Border.all(color: AppColors.primary.withValues(alpha: 0.18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.swap_calls_rounded, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Today changes',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          for (final change in changes) ...[
            _SubstitutionTile(change: change),
            if (change != changes.last) const Divider(height: AppSpacing.lg),
          ],
        ],
      ),
    );
  }
}

class _TimetablePeriodCard extends StatelessWidget {
  const _TimetablePeriodCard({required this.item});

  final TeacherTimetableItem item;

  @override
  Widget build(BuildContext context) {
    final hasChange = item.substitution != null || item.status != 'SCHEDULED';
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.classLabel,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              StatusChip(
                status: hasChange
                    ? AppStatusType.pending
                    : AppStatusType.approved,
                label: _statusLabel(item.status),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${item.startsAt} - ${item.endsAt} | ${item.subjectName}',
            style: const TextStyle(
              color: AppColors.slate600,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (item.room != null && item.room!.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Room ${item.room}',
              style: const TextStyle(color: AppColors.slate500),
            ),
          ],
          if (item.substitution != null) ...[
            const Divider(height: AppSpacing.lg),
            _SubstitutionTile(change: item.substitution!),
          ],
        ],
      ),
    );
  }
}

class _SubstitutionTile extends StatelessWidget {
  const _SubstitutionTile({required this.change});

  final TeacherTimetableSubstitution change;

  @override
  Widget build(BuildContext context) {
    final owner = change.role == 'SUBSTITUTE'
        ? 'You are covering this period'
        : 'You are marked unavailable for this period';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.change_circle_rounded, color: AppColors.primary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                change.classLabel,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 2),
              Text(
                '${change.startsAt} - ${change.endsAt} | ${change.reason}',
                style: const TextStyle(color: AppColors.slate600),
              ),
              const SizedBox(height: 4),
              Text(
                [
                  owner,
                  if (change.substituteTeacherName != null)
                    'Substitute: ${change.substituteTeacherName}',
                  if (change.absentTeacherName != null)
                    'Absent: ${change.absentTeacherName}',
                ].join('\n'),
                style: const TextStyle(color: AppColors.slate500),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        StatusChip(
          status: AppStatusType.pending,
          label: _statusLabel(change.status),
        ),
      ],
    );
  }
}

class _TimetableLoading extends StatelessWidget {
  const _TimetableLoading();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppSkeleton(width: double.infinity, height: 88),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 180),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 220),
        ],
      ),
    );
  }
}

Map<String, List<TeacherTimetableItem>> _groupByDay(
  List<TeacherTimetableItem> items,
) {
  final result = <String, List<TeacherTimetableItem>>{};
  for (final item in items) {
    final date = item.date;
    final key = date == null
        ? 'Published periods'
        : DateFormat.EEEE().format(date);
    result.putIfAbsent(key, () => <TeacherTimetableItem>[]).add(item);
  }
  return result;
}

String _rangeLabel(DateTime? start, DateTime? end) {
  if (start == null || end == null) return 'Published teacher schedule';
  return '${DateFormat.MMMd().format(start)} - ${DateFormat.MMMd().format(end)}';
}

String _statusLabel(String status) {
  return switch (status) {
    'SCHEDULED' => 'Scheduled',
    'SUBSTITUTED' => 'Substituted',
    'CHANGED' => 'Changed',
    'ASSIGNED' => 'Assigned',
    'COMPLETED' => 'Completed',
    'CANCELLED' => 'Cancelled',
    _ => status,
  };
}
