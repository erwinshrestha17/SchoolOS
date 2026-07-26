import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/connectivity_provider.dart';
import '../../../shared/utils/nepali_bs_calendar.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../parent/application/parent_providers.dart';
import '../../parent/domain/parent_models.dart';
import '../../parent/presentation/widgets/parent_detail_widgets.dart';
import '../../parent/presentation/widgets/parent_portal_widgets.dart';
import '../domain/learning_support_models.dart';

class ParentLearningSupportScreen extends ConsumerWidget {
  const ParentLearningSupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentState = ref.watch(parentControllerProvider);
    final isOnline = ref.watch(connectivityProvider);

    return ParentDetailScaffold(
      title: 'Learning Support',
      selectedIndex: 5,
      body: !isOnline
          ? const _OfflineLearningSupport()
          : _ParentLearningSupportBody(parentState: parentState),
    );
  }
}

class _ParentLearningSupportBody extends ConsumerWidget {
  const _ParentLearningSupportBody({required this.parentState});

  final ParentState parentState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (parentState.children.isEmpty &&
        parentState.status == ParentDataStatus.loading) {
      return const PortalLoadingState();
    }
    final child = parentState.selectedChild;
    if (child == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppEmptyState(
            title: 'No linked child',
            message:
                parentState.message ??
                'No active child is linked to this guardian account.',
            icon: Icons.lock_outline_rounded,
            actionLabel: 'Try again',
            onActionPressed: () =>
                ref.read(parentControllerProvider.notifier).load(),
          ),
        ],
      );
    }

    final summary = ref.watch(parentLearningSupportProvider(child.id));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(parentLearningSupportProvider(child.id));
        await ref.read(parentLearningSupportProvider(child.id).future);
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
          summary.when(
            loading: () => const PortalLoadingState(),
            error: (_, _) => AppEmptyState(
              title: 'Learning support is unavailable',
              message:
                  'Current teacher guidance could not be loaded. No school record was changed.',
              icon: Icons.cloud_off_rounded,
              actionLabel: 'Try again',
              onActionPressed: () =>
                  ref.invalidate(parentLearningSupportProvider(child.id)),
            ),
            data: (data) {
              if (data.student.id != child.id) {
                return AppEmptyState(
                  title: 'This child is not available',
                  message:
                      'Learning support can only be opened for a child linked to your guardian account.',
                  icon: Icons.lock_outline_rounded,
                  actionLabel: 'Refresh',
                  onActionPressed: () =>
                      ref.invalidate(parentLearningSupportProvider(child.id)),
                );
              }
              return _LearningSupportContent(data: data);
            },
          ),
        ],
      ),
    );
  }
}

class _LearningSupportContent extends StatelessWidget {
  const _LearningSupportContent({required this.data});

  final ParentLearningSupportSummary data;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const AppEmptyState(
        title: 'No learning-support update yet',
        message:
            'Teacher-approved progress, support groups, and home guidance will appear here when available.',
        icon: Icons.school_outlined,
      );
    }

    final sourceIssues = data.sourceStates.entries
        .where((entry) => entry.value != 'available')
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const FeatureIcon(Icons.volunteer_activism_rounded),
              const SizedBox(height: 12),
              Text(
                'Supportive, teacher-approved updates',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'These updates explain current classroom support. They do not compare children or predict results.',
              ),
              const SizedBox(height: 10),
              Text(
                'Updated ${NepaliBsCalendar.formatBsDateTime(data.generatedAt)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ],
          ),
        ),
        if (sourceIssues.isNotEmpty) ...[
          const SizedBox(height: 14),
          PortalCard(
            child: Text(
              sourceIssues.every((entry) => entry.value == 'empty')
                  ? 'Some sections have no teacher-approved update yet.'
                  : 'Some learning-support sources are currently unavailable.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
            ),
          ),
        ],
        if (data.guidance.isNotEmpty) ...[
          const SizedBox(height: 22),
          const ParentSectionHeader(title: 'Try at home'),
          const SizedBox(height: 8),
          for (final item in data.guidance) ...[
            _GuidanceCard(item: item),
            const SizedBox(height: 10),
          ],
        ],
        if (data.outcomeProgress.isNotEmpty) ...[
          const SizedBox(height: 12),
          const ParentSectionHeader(title: 'Recent progress'),
          const SizedBox(height: 8),
          for (final item in data.outcomeProgress) ...[
            _ProgressCard(item: item),
            const SizedBox(height: 10),
          ],
        ],
        if (data.remedialSupport.isNotEmpty) ...[
          const SizedBox(height: 12),
          const ParentSectionHeader(title: 'School support'),
          const SizedBox(height: 8),
          for (final item in data.remedialSupport) ...[
            _RemedialCard(item: item),
            const SizedBox(height: 10),
          ],
        ],
        if (data.interventionUpdates.isNotEmpty) ...[
          const SizedBox(height: 12),
          const ParentSectionHeader(title: 'Follow-up updates'),
          const SizedBox(height: 8),
          for (final item in data.interventionUpdates) ...[
            _FollowUpCard(item: item),
            const SizedBox(height: 10),
          ],
        ],
      ],
    );
  }
}

class _GuidanceCard extends StatelessWidget {
  const _GuidanceCard({required this.item});

  final ParentLearningGuidance item;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${item.subject.name} • ${item.teacherName}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
          ),
          const SizedBox(height: 12),
          Text(
            item.skillExplanation,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color: ParentPortalColors.blueSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.home_work_outlined,
                    color: ParentPortalColors.blue,
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(item.homeActivity)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.item});

  final LearningProgressItem item;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${item.outcome.code} • ${item.outcome.title}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _CalmStatus(label: _masteryLabel(item.latestMasteryStatus)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.parentSummary ??
                'The teacher has recorded a recent classroom check.',
          ),
          const SizedBox(height: 8),
          Text(
            NepaliBsCalendar.formatBsDate(item.latestAssessedOn),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
          ),
        ],
      ),
    );
  }
}

class _RemedialCard extends StatelessWidget {
  const _RemedialCard({required this.item});

  final LearningRemedialSupport item;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.name,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${item.subject.name} • Starts ${NepaliBsCalendar.formatBsDate(item.startsOn)}',
          ),
          if (item.scheduleNote?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(item.scheduleNote!),
          ],
          if (item.parentSummary?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(item.parentSummary!),
          ],
        ],
      ),
    );
  }
}

class _FollowUpCard extends StatelessWidget {
  const _FollowUpCard({required this.item});

  final LearningParentInterventionUpdate item;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _CalmStatus(label: _statusLabel(item.status)),
            ],
          ),
          const SizedBox(height: 8),
          Text(item.summary),
          if (item.nextFollowUpOn != null) ...[
            const SizedBox(height: 8),
            Text(
              'Next follow-up ${NepaliBsCalendar.formatBsDate(item.nextFollowUpOn!)}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
            ),
          ],
        ],
      ),
    );
  }
}

class _CalmStatus extends StatelessWidget {
  const _CalmStatus({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: ParentPortalColors.blueSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: ParentPortalColors.blue,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _OfflineLearningSupport extends StatelessWidget {
  const _OfflineLearningSupport();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        AppEmptyState(
          title: 'Reconnect for current learning support',
          message:
              'Teacher guidance and follow-up plans are not saved on this device. Reconnect to view the current school record.',
          icon: Icons.cloud_off_rounded,
        ),
      ],
    );
  }
}

String _masteryLabel(String value) => switch (value) {
  'BEGINNING' => 'Starting',
  'DEVELOPING' => 'Developing',
  'SECURE' => 'Secure',
  'EXTENDING' => 'Extending',
  _ => 'Update',
};

String _statusLabel(String value) => value
    .split('_')
    .where((part) => part.isNotEmpty)
    .map((part) => part[0] + part.substring(1).toLowerCase())
    .join(' ');
