import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_state_view.dart';

const _activityCategories = <String>[
  'LEARNING',
  'OUTDOOR_PLAY',
  'ART_AND_CRAFT',
  'CELEBRATION',
  'SPORTS',
  'GENERAL',
];

class ParentActivityScreen extends ConsumerWidget {
  const ParentActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;
    String? guardianId;
    if (childId != null) {
      for (final child in state.children) {
        if (child.id == childId) {
          guardianId = child.guardianId;
          break;
        }
      }
    }

    return ParentDetailScaffold(
      title: 'Activity',
      selectedIndex: 5,
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
            : _ActivityContent(childId: childId, guardianId: guardianId),
      ),
    );
  }
}

class _ActivityContent extends ConsumerStatefulWidget {
  const _ActivityContent({required this.childId, required this.guardianId});

  final String childId;
  final String? guardianId;

  @override
  ConsumerState<_ActivityContent> createState() => _ActivityContentState();
}

class _ActivityContentState extends ConsumerState<_ActivityContent> {
  String? _category;
  String? _month;

  @override
  Widget build(BuildContext context) {
    final filter = ParentActivityFeedFilter(
      childId: widget.childId,
      category: _category,
      month: _month,
    );
    final activity = ref.watch(parentActivityFeedFilteredProvider(filter));
    final milestones = ref.watch(
      parentMilestonesProvider(ParentMilestonesFilter(childId: widget.childId)),
    );

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
      error: (error, _) => AppExceptionView(
        error: error,
        onRetry: () =>
            ref.invalidate(parentActivityFeedFilteredProvider(filter)),
      ),
      data: (items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentActivityFeedFilteredProvider(filter));
          await ref.read(parentActivityFeedFilteredProvider(filter).future);
        },
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _FilterBar(
              category: _category,
              month: _month,
              onCategoryChanged: (value) => setState(() => _category = value),
              onMonthChanged: (value) => setState(() => _month = value),
            ),
            const SizedBox(height: AppSpacing.md),
            _MilestoneSummaryCard(milestonesAsync: milestones),
            const SizedBox(height: AppSpacing.md),
            if (items.isEmpty)
              const AppEmptyState(
                title: 'No activity yet',
                message:
                    'Class activities and milestones will appear here after approval.',
                icon: Icons.auto_awesome_rounded,
              )
            else
              for (final item in items) ...[
                _ActivityCard(item: item, guardianId: widget.guardianId),
                const SizedBox(height: AppSpacing.md),
              ],
          ],
        ),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.category,
    required this.month,
    required this.onCategoryChanged,
    required this.onMonthChanged,
  });

  final String? category;
  final String? month;
  final ValueChanged<String?> onCategoryChanged;
  final ValueChanged<String?> onMonthChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          DropdownButton<String?>(
            value: category,
            hint: const Text('All categories'),
            underline: const SizedBox.shrink(),
            onChanged: onCategoryChanged,
            items: [
              const DropdownMenuItem(
                value: null,
                child: Text('All categories'),
              ),
              for (final value in _activityCategories)
                DropdownMenuItem(value: value, child: Text(_labelize(value))),
            ],
          ),
          OutlinedButton.icon(
            icon: const Icon(Icons.calendar_month_rounded, size: 18),
            label: Text(month ?? 'Any month'),
            onPressed: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: now,
                firstDate: DateTime(now.year - 3),
                lastDate: now,
              );
              if (picked != null) {
                onMonthChanged(
                  '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}',
                );
              }
            },
          ),
          if (category != null || month != null)
            TextButton(
              onPressed: () {
                onCategoryChanged(null);
                onMonthChanged(null);
              },
              child: const Text('Clear'),
            ),
        ],
      ),
    );
  }
}

class _MilestoneSummaryCard extends StatelessWidget {
  const _MilestoneSummaryCard({required this.milestonesAsync});

  final AsyncValue<List<ParentMilestone>> milestonesAsync;

  @override
  Widget build(BuildContext context) {
    return milestonesAsync.when(
      loading: () => const AppSkeleton(width: double.infinity, height: 88),
      error: (_, _) => const SizedBox.shrink(),
      data: (milestones) {
        if (milestones.isEmpty) return const SizedBox.shrink();
        final recent = milestones.take(3).toList();
        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.emoji_events_rounded,
                    color: AppColors.parentAccent,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Recent milestones',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final milestone in recent)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Text(
                    '${milestone.milestone} · ${_labelize(milestone.domain)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _ActivityCard extends ConsumerStatefulWidget {
  const _ActivityCard({required this.item, required this.guardianId});

  final ParentActivityItem item;
  final String? guardianId;

  @override
  ConsumerState<_ActivityCard> createState() => _ActivityCardState();
}

class _ActivityCardState extends ConsumerState<_ActivityCard> {
  bool _reacting = false;

  Future<void> _react(String reaction) async {
    final guardianId = widget.guardianId;
    if (guardianId == null || _reacting) return;
    setState(() => _reacting = true);
    try {
      await ref
          .read(parentRepositoryProvider)
          .submitActivityReaction(
            postId: widget.item.id,
            guardianId: guardianId,
            reaction: reaction,
          );
    } catch (_) {
      // Reaction failures are non-critical; the UI simply stays unchanged.
    } finally {
      if (mounted) setState(() => _reacting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final previewable = item.attachments.where(
      (attachment) => attachment.canPreview,
    );
    final preview = previewable.isEmpty ? null : previewable.first;

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
          if (preview != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ProtectedActivityPreview(
              attachment: preview,
              additionalCount: item.attachments.length - 1,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Text(
                '${item.attachmentCount} attachments',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.slate500,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (widget.guardianId != null)
                for (final reaction in const ['HEART', 'CLAP', 'STAR'])
                  IconButton(
                    tooltip: _labelize(reaction),
                    onPressed: _reacting ? null : () => _react(reaction),
                    icon: Icon(switch (reaction) {
                      'HEART' => Icons.favorite_rounded,
                      'CLAP' => Icons.front_hand_rounded,
                      _ => Icons.star_rounded,
                    }, size: 20),
                  )
              else
                Text(
                  '${item.reactionCount} reactions',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProtectedActivityPreview extends ConsumerWidget {
  const _ProtectedActivityPreview({
    required this.attachment,
    required this.additionalCount,
  });

  final ParentActivityAttachment attachment;
  final int additionalCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preview = ref.watch(
      parentActivityPreviewProvider(attachment.previewPath),
    );

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: preview.when(
          loading: () => Container(
            color: AppColors.slate100,
            child: const Center(child: CircularProgressIndicator()),
          ),
          error: (_, _) => Container(
            color: AppColors.slate100,
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.image_not_supported_outlined),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Protected media is unavailable.',
                  textAlign: TextAlign.center,
                ),
                IconButton(
                  tooltip: 'Retry media',
                  onPressed: () => ref.invalidate(
                    parentActivityPreviewProvider(attachment.previewPath),
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
          ),
          data: (bytes) => Stack(
            fit: StackFit.expand,
            children: [
              Image.memory(
                bytes,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                errorBuilder: (_, _, _) => Container(
                  color: AppColors.slate100,
                  alignment: Alignment.center,
                  child: const Icon(Icons.broken_image_outlined),
                ),
              ),
              if (additionalCount > 0)
                Positioned(
                  right: AppSpacing.sm,
                  bottom: AppSpacing.sm,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.72),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '+$additionalCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
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
  return NepaliBsCalendar.formatBsDate(parsed);
}
