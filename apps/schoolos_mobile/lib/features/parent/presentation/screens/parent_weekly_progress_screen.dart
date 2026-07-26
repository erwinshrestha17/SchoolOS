import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/network/connectivity_provider.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_action_centre_models.dart';
import '../../domain/parent_models.dart';
import '../../domain/parent_weekly_progress_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentWeeklyProgressScreen extends ConsumerWidget {
  const ParentWeeklyProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentState = ref.watch(parentControllerProvider);
    final isOnline = ref.watch(connectivityProvider);

    return ParentDetailScaffold(
      title: 'Weekly Progress',
      selectedIndex: 5,
      body: !isOnline
          ? const _OfflineBody()
          : _OnlineBody(parentState: parentState),
    );
  }
}

class _OfflineBody extends StatelessWidget {
  const _OfflineBody();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const FeatureIcon(Icons.cloud_off_rounded),
              const SizedBox(height: 12),
              Text(
                'Reconnect to view current weekly progress',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'This view combines live attendance, homework, teacher feedback, published results, and parent actions. Private digest data is not saved on this device.',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OnlineBody extends ConsumerWidget {
  const _OnlineBody({required this.parentState});

  final ParentState parentState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (parentState.children.isEmpty &&
        parentState.status == ParentDataStatus.loading) {
      return const PortalLoadingState();
    }
    final child = parentState.selectedChild;
    if (child == null) {
      return _ParentLoadState(
        message: parentState.message ?? 'No active child is linked.',
        onRetry: () => ref.read(parentControllerProvider.notifier).load(),
      );
    }

    final progress = ref.watch(parentWeeklyProgressProvider(child.id));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(parentWeeklyProgressProvider(child.id));
        await ref.read(parentWeeklyProgressProvider(child.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          ParentApiChildSelector(
            child: child,
            children: parentState.children,
            onChanged: ref.read(parentControllerProvider.notifier).selectChild,
          ),
          const SizedBox(height: 14),
          progress.when(
            loading: () => const PortalLoadingState(),
            error: (error, _) => _ParentLoadState(
              message: _safeError(error),
              onRetry: () =>
                  ref.invalidate(parentWeeklyProgressProvider(child.id)),
            ),
            data: (data) {
              if (data.student.id != child.id || !data.isLive) {
                return _ParentLoadState(
                  message:
                      'Current weekly progress could not be confirmed for this child.',
                  onRetry: () =>
                      ref.invalidate(parentWeeklyProgressProvider(child.id)),
                );
              }
              return _WeeklyProgressContent(
                data: data,
                onOpenAction: (item) => _openAction(context, ref, item),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _openAction(
    BuildContext context,
    WidgetRef ref,
    ParentActionItem item,
  ) async {
    final route = item.route;
    if (route == null) return;
    final childId = item.child?.id;
    if (childId != null &&
        ref.read(parentControllerProvider).selectedChildId != childId) {
      await ref.read(parentControllerProvider.notifier).selectChild(childId);
      if (!context.mounted) return;
    }
    context.push(route);
  }
}

class _WeeklyProgressContent extends StatelessWidget {
  const _WeeklyProgressContent({
    required this.data,
    required this.onOpenAction,
  });

  final ParentWeeklyProgress data;
  final ValueChanged<ParentActionItem> onOpenAction;

  @override
  Widget build(BuildContext context) {
    final sourceIssues = data.sources.entries
        .where((entry) => entry.value.hasIssue)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PeriodCard(data: data),
        if (sourceIssues.isNotEmpty) ...[
          const SizedBox(height: 14),
          _SourceCoverageCard(entries: sourceIssues),
        ],
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Attendance'),
        const SizedBox(height: 8),
        _AttendanceCard(data: data),
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Homework'),
        const SizedBox(height: 8),
        _HomeworkCard(data: data),
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Published result trend'),
        const SizedBox(height: 8),
        _AcademicTrendCard(data: data),
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Teacher comments'),
        const SizedBox(height: 8),
        _TeacherComments(data: data),
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Upcoming deadlines'),
        const SizedBox(height: 8),
        _DeadlineList(data: data, onOpenAction: onOpenAction),
        const SizedBox(height: 22),
        const ParentSectionHeader(title: 'Required parent actions'),
        const SizedBox(height: 8),
        _RequiredActions(data: data, onOpenAction: onOpenAction),
      ],
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.data});

  final ParentWeeklyProgress data;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const StatusBadge(label: 'Live', icon: Icons.sync_rounded),
              const Spacer(),
              Text(
                NepaliBsCalendar.formatBsDateTime(data.generatedAt),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${data.student.name} • ${data.student.classSection}',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'BS: ${NepaliBsCalendar.formatBsDate(data.period.startAt)} to '
            '${NepaliBsCalendar.formatBsDate(data.period.endAt)}',
            style: const TextStyle(
              color: ParentPortalColors.muted,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (data.isPartial) ...[
            const SizedBox(height: 9),
            const Text(
              'This digest is partial because one or more school areas are locked or temporarily unavailable.',
            ),
          ],
        ],
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.data});

  final ParentWeeklyProgress data;

  @override
  Widget build(BuildContext context) {
    final attendance = data.attendance;
    if (!attendance.hasData) {
      return _UnavailableSection(
        icon: Icons.fact_check_outlined,
        message: _sourceReason(
          data,
          'attendance',
          'No attendance was recorded in this seven-day period.',
        ),
      );
    }
    return PortalCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FeatureIcon(
            Icons.fact_check_outlined,
            color: ParentPortalColors.blue,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_percent(attendance.attendanceRate)} attendance across '
                  '${attendance.recordedDays} recorded ${attendance.recordedDays == 1 ? 'day' : 'days'}',
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${attendance.presentDays} present • '
                  '${attendance.absentDays} absent • '
                  '${attendance.lateDays} late'
                  '${attendance.excusedDays == 0 ? '' : ' • ${attendance.excusedDays} excused'}',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.data});

  final ParentWeeklyProgress data;

  @override
  Widget build(BuildContext context) {
    final homework = data.homework;
    if (!homework.hasData) {
      return _UnavailableSection(
        icon: Icons.menu_book_outlined,
        message: _sourceReason(
          data,
          'homework',
          'No submission-required homework was due in this period.',
        ),
      );
    }
    return PortalCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FeatureIcon(
            Icons.menu_book_outlined,
            color: ParentPortalColors.purple,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${homework.completedCount} of ${homework.requiredCount} completed',
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${_percent(homework.completionRate)} completion'
                  '${homework.needsFollowUpCount == 0 ? '' : ' • ${homework.needsFollowUpCount} needs follow-up'}',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AcademicTrendCard extends StatelessWidget {
  const _AcademicTrendCard({required this.data});

  final ParentWeeklyProgress data;

  @override
  Widget build(BuildContext context) {
    final trend = data.academicTrend;
    if (!trend.hasComparableEvidence) {
      return _UnavailableSection(
        icon: Icons.insights_outlined,
        message:
            trend.reason ??
            _sourceReason(
              data,
              'academics',
              'Two comparable published results are not available.',
            ),
      );
    }
    final current = trend.current!;
    final previous = trend.previous!;
    final directionLabel = switch (trend.direction) {
      'IMPROVED' => 'Improved',
      'DECLINED' => 'Declined',
      _ => 'Stable',
    };
    final directionColor = switch (trend.direction) {
      'IMPROVED' => ParentPortalColors.green,
      'DECLINED' => ParentPortalColors.orange,
      _ => ParentPortalColors.blue,
    };
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FeatureIcon(Icons.insights_rounded, color: directionColor),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '$directionLabel by ${_points(trend.changePoints)} percentage points',
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${previous.termName}: ${_percent(previous.percentage)}  →  '
            '${current.termName}: ${_percent(current.percentage)}',
          ),
          const SizedBox(height: 6),
          const Text(
            'Shown only because both published results use the same academic year and subject mark structure.',
            style: TextStyle(color: ParentPortalColors.muted),
          ),
        ],
      ),
    );
  }
}

class _TeacherComments extends StatelessWidget {
  const _TeacherComments({required this.data});

  final ParentWeeklyProgress data;

  @override
  Widget build(BuildContext context) {
    if (data.teacherComments.isEmpty) {
      return _UnavailableSection(
        icon: Icons.chat_bubble_outline_rounded,
        message: _sourceReason(
          data,
          'comments',
          'No parent-visible teacher feedback was shared this period.',
        ),
      );
    }
    return Column(
      children: [
        for (final comment in data.teacherComments) ...[
          PortalCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const FeatureIcon(
                      Icons.chat_bubble_outline_rounded,
                      color: ParentPortalColors.green,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            comment.subject,
                            style: const TextStyle(
                              color: ParentPortalColors.navy,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            comment.title,
                            style: const TextStyle(
                              color: ParentPortalColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      NepaliBsCalendar.formatBsDate(comment.sharedAt),
                      style: const TextStyle(
                        color: ParentPortalColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(comment.comment),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _DeadlineList extends StatelessWidget {
  const _DeadlineList({required this.data, required this.onOpenAction});

  final ParentWeeklyProgress data;
  final ValueChanged<ParentActionItem> onOpenAction;

  @override
  Widget build(BuildContext context) {
    if (data.upcomingDeadlines.isEmpty) {
      return const _UnavailableSection(
        icon: Icons.event_available_outlined,
        message: 'No visible deadline is due in the next seven days.',
      );
    }
    return Column(
      children: [
        for (final item in data.upcomingDeadlines) ...[
          _ActionCard(item: item, onOpen: () => onOpenAction(item)),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _RequiredActions extends StatelessWidget {
  const _RequiredActions({required this.data, required this.onOpenAction});

  final ParentWeeklyProgress data;
  final ValueChanged<ParentActionItem> onOpenAction;

  @override
  Widget build(BuildContext context) {
    if (data.requiredActions.isEmpty) {
      return _UnavailableSection(
        icon: Icons.task_alt_rounded,
        message: _sourceReason(
          data,
          'actions',
          'No required parent action is visible right now.',
        ),
      );
    }
    return Column(
      children: [
        for (final item in data.requiredActions) ...[
          _ActionCard(item: item, onOpen: () => onOpenAction(item)),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.item, required this.onOpen});

  final ParentActionItem item;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FeatureIcon(
                item.isUrgent
                    ? Icons.priority_high_rounded
                    : Icons.event_note_rounded,
                color: item.isUrgent
                    ? ParentPortalColors.red
                    : ParentPortalColors.blue,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(item.description),
                    if (item.dueAt != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        '${item.isOverdue ? 'Overdue' : 'Due'} '
                        '${NepaliBsCalendar.formatBsDate(item.dueAt!)}',
                        style: TextStyle(
                          color: item.isOverdue
                              ? ParentPortalColors.red
                              : ParentPortalColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: item.route == null ? null : onOpen,
              child: Text(
                item.route == null ? 'Action unavailable' : item.actionLabel,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceCoverageCard extends StatelessWidget {
  const _SourceCoverageCard({required this.entries});

  final List<MapEntry<String, ParentWeeklySourceState>> entries;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      color: ParentPortalColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Coverage note',
            style: TextStyle(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          for (final entry in entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '${_sourceLabel(entry.key)}: '
                '${entry.value.reason ?? _statusLabel(entry.value.status)}',
              ),
            ),
        ],
      ),
    );
  }
}

class _UnavailableSection extends StatelessWidget {
  const _UnavailableSection({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeatureIcon(icon, color: ParentPortalColors.muted),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _ParentLoadState extends StatelessWidget {
  const _ParentLoadState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: PortalCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FeatureIcon(Icons.refresh_rounded),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _sourceReason(
  ParentWeeklyProgress data,
  String source,
  String fallback,
) {
  return data.sources[source]?.reason ?? fallback;
}

String _sourceLabel(String source) {
  return switch (source) {
    'attendance' => 'Attendance',
    'homework' => 'Homework',
    'academics' => 'Published results',
    'comments' => 'Teacher comments',
    'actions' => 'Parent actions',
    _ => 'School information',
  };
}

String _statusLabel(String status) {
  return switch (status) {
    'partial' => 'Only part of this area could be checked.',
    'locked' => 'This school area is not enabled.',
    _ => 'This school area could not be checked.',
  };
}

String _safeError(Object error) {
  if (error is AppException) return error.message;
  return 'Current weekly progress could not be loaded. Please try again.';
}

String _percent(double? value) {
  if (value == null) return 'Unavailable';
  return '${_number(value)}%';
}

String _points(double? value) {
  if (value == null) return '0';
  return _number(value.abs());
}

String _number(double value) {
  return value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);
}
