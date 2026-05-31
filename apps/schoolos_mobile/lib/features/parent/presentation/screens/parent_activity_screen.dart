import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentActivityScreen extends ConsumerWidget {
  const ParentActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'Activity',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before viewing activity.',
                icon: Icons.auto_awesome_rounded,
              )
            : _ActivityContent(childId: childId),
      ),
    );
  }
}

class _ActivityContent extends ConsumerWidget {
  const _ActivityContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activity = ref.watch(parentActivityFeedProvider(childId));

    return activity.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 132),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 132),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load activity',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentActivityFeedProvider(childId)),
      ),
      data: (items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentActivityFeedProvider(childId));
          await ref.read(parentActivityFeedProvider(childId).future);
        },
        child: items.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: const [
                  AppEmptyState(
                    title: 'No activity yet',
                    message:
                        'Class activities and milestones will appear here after approval.',
                    icon: Icons.auto_awesome_rounded,
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  for (final item in items) ...[
                    _ActivityCard(item: item),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.item});

  final ParentActivityItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.auto_awesome_rounded,
                color: AppColors.parentAccent,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      [
                        _labelize(item.category),
                        if (_date(item.publishedAt) != null)
                          _date(item.publishedAt)!,
                      ].join(' • '),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (item.caption.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(item.caption),
          ],
          const SizedBox(height: AppSpacing.md),
          Text(
            '${item.attachmentCount} attachments • ${item.reactionCount} reactions',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String? _date(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) {
    return null;
  }
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return null;
  }
  return DateFormat('MMM d, yyyy').format(parsed);
}
