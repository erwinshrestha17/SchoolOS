import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../parent/application/parent_providers.dart';
import '../../../parent/presentation/widgets/parent_state_view.dart';
import '../../application/learning_providers.dart';
import '../../domain/learning_summary_models.dart';

class LearningSummaryScreen extends ConsumerWidget {
  const LearningSummaryScreen({
    super.key,
    this.role = 'PARENT',
    this.selectedIndex = 4,
    this.title = 'Learning',
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
                    : 'Select a child before viewing learning progress.',
                icon: Icons.school_rounded,
              )
            : isStudent
            ? _StudentLearningSummary(childId: childId)
            : _ParentLearningSummary(childId: childId),
      ),
    );
  }
}

class _ParentLearningSummary extends ConsumerWidget {
  const _ParentLearningSummary({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(parentLearningSummariesProvider(childId));

    return summary.when(
      loading: () => const _LearningLoading(),
      error: (_, _) => AppErrorView(
        title: 'Could not load learning summary',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentLearningSummariesProvider(childId)),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const _LearningEmpty();
        }
        return _LearningSummaryList(
          summary: items.first,
          onRefresh: () async {
            ref.invalidate(parentLearningSummariesProvider(childId));
            await ref.read(parentLearningSummariesProvider(childId).future);
          },
        );
      },
    );
  }
}

class _StudentLearningSummary extends ConsumerWidget {
  const _StudentLearningSummary({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(studentLearningSummaryProvider(childId));

    return summary.when(
      loading: () => const _LearningLoading(),
      error: (_, _) => AppErrorView(
        title: 'Could not load learning summary',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(studentLearningSummaryProvider(childId)),
      ),
      data: (item) => _LearningSummaryList(
        summary: item,
        onRefresh: () async {
          ref.invalidate(studentLearningSummaryProvider(childId));
          await ref.read(studentLearningSummaryProvider(childId).future);
        },
      ),
    );
  }
}

class _LearningSummaryList extends StatelessWidget {
  const _LearningSummaryList({required this.summary, required this.onRefresh});

  final LearningSummary summary;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final progressItems = summary.progress.isEmpty
        ? [...summary.strongTopics, ...summary.needsPracticeTopics]
        : summary.progress;

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _SummaryHeader(summary: summary),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Recent completions'),
          const SizedBox(height: AppSpacing.sm),
          if (summary.recentCompletedActivities.isEmpty)
            const AppEmptyState(
              title: 'No completed learning activities',
              message: 'Submitted school learning activities will appear here.',
              icon: Icons.menu_book_rounded,
            )
          else
            for (final activity in summary.recentCompletedActivities) ...[
              _CompletionCard(activity: activity),
              const SizedBox(height: AppSpacing.md),
            ],
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Learning focus'),
          const SizedBox(height: AppSpacing.sm),
          if (progressItems.isEmpty)
            const AppEmptyState(
              title: 'No topic summary yet',
              message: 'Supportive topic labels appear after submissions.',
              icon: Icons.insights_rounded,
            )
          else
            for (final topic in progressItems.take(8)) ...[
              _TopicCard(topic: topic),
              const SizedBox(height: AppSpacing.md),
            ],
        ],
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  const _SummaryHeader({required this.summary});

  final LearningSummary summary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: _labelColor(
                summary.supportiveLabel.label,
              ).withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(
              Icons.school_rounded,
              color: _labelColor(summary.supportiveLabel.label),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary.studentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [
                    if (summary.className != null) summary.className,
                    if (summary.sectionName != null) summary.sectionName,
                  ].whereType<String>().join(' - '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  '${summary.activityCount} activity completion(s)',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(
            status: _statusForLabel(summary.supportiveLabel.label),
            label: summary.supportiveLabel.text,
          ),
        ],
      ),
    );
  }
}

class _CompletionCard extends StatelessWidget {
  const _CompletionCard({required this.activity});

  final LearningCompletedActivity activity;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded, color: AppColors.success),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [
                    if (activity.subjectName != null) activity.subjectName,
                    if (activity.accuracy != null)
                      '${activity.accuracy!.round()}% accuracy',
                  ].whereType<String>().join(' - '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
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

class _TopicCard extends StatelessWidget {
  const _TopicCard({required this.topic});

  final LearningProgressTopic topic;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Icon(Icons.insights_rounded, color: _labelColor(topic.label)),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  topic.activityTitle ?? topic.subjectName ?? 'Learning topic',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${topic.labelText} - ${topic.completedCount} completion(s)',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(
            status: _statusForLabel(topic.label),
            label: topic.labelText,
          ),
        ],
      ),
    );
  }
}

class _LearningLoading extends StatelessWidget {
  const _LearningLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppSkeleton(width: double.infinity, height: 132),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 92),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 92),
        ],
      ),
    );
  }
}

class _LearningEmpty extends StatelessWidget {
  const _LearningEmpty();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: const [
        AppEmptyState(
          title: 'No learning summary yet',
          message: 'Submitted school learning activities will appear here.',
          icon: Icons.school_rounded,
        ),
      ],
    );
  }
}

AppStatusType _statusForLabel(String label) {
  switch (label) {
    case 'STRONG':
      return AppStatusType.completed;
    case 'READY':
      return AppStatusType.published;
    case 'IMPROVING':
      return AppStatusType.pending;
    default:
      return AppStatusType.pending;
  }
}

Color _labelColor(String label) {
  switch (label) {
    case 'STRONG':
      return AppColors.success;
    case 'READY':
      return AppColors.primary;
    case 'IMPROVING':
      return AppColors.warning;
    default:
      return AppColors.slate500;
  }
}
