import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/errors/app_exception.dart';
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
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                0,
              ),
              sliver: SliverList.list(
                children: [
                  _FilterBar(
                    category: _category,
                    month: _month,
                    onCategoryChanged: (value) =>
                        setState(() => _category = value),
                    onMonthChanged: (value) => setState(() => _month = value),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _MilestoneSummaryCard(milestonesAsync: milestones),
                  const SizedBox(height: AppSpacing.md),
                ],
              ),
            ),
            if (items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: AppEmptyState(
                    title: 'No activity yet',
                    message:
                        'Class activities and milestones will appear here after approval.',
                    icon: Icons.auto_awesome_rounded,
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                sliver: SliverList.builder(
                  itemCount: items.length,
                  itemBuilder: (context, index) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: _ActivityCard(
                      item: items[index],
                      guardianId: widget.guardianId,
                      filter: filter,
                    ),
                  ),
                ),
              ),
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

class _ActivityCard extends ConsumerWidget {
  const _ActivityCard({
    required this.item,
    required this.guardianId,
    required this.filter,
  });

  final ParentActivityItem item;
  final String? guardianId;
  final ParentActivityFeedFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seenState = ref.watch(parentActivitySeenProvider(item.id));
    final isSeen =
        item.isSeen || seenState.status == ParentActivitySeenStatus.seen;
    final isPending = seenState.status == ParentActivitySeenStatus.pending;
    final thumbnailReady = item.attachments.where(
      (attachment) => attachment.canLoadThumbnail,
    );
    final thumbnail = thumbnailReady.isEmpty ? null : thumbnailReady.first;

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
          if (thumbnail != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ProtectedActivityThumbnail(
              attachment: thumbnail,
              additionalCount: item.attachments.length - 1,
            ),
          ] else if (item.attachments.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _ActivityMediaPlaceholder(attachment: item.attachments.first),
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
              if (guardianId != null)
                if (isSeen)
                  const Chip(
                    avatar: Icon(Icons.check_circle_rounded, size: 18),
                    label: Text('Seen'),
                  )
                else
                  OutlinedButton.icon(
                    onPressed: isPending
                        ? null
                        : () async {
                            final marked = await ref
                                .read(
                                  parentActivitySeenProvider(item.id).notifier,
                                )
                                .markSeen(
                                  postId: item.id,
                                  guardianId: guardianId!,
                                );
                            if (marked) {
                              ref.invalidate(
                                parentActivityFeedFilteredProvider(filter),
                              );
                            }
                          },
                    icon: isPending
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline_rounded),
                    label: Text(isPending ? 'Marking…' : 'Mark as read'),
                  ),
            ],
          ),
          if (seenState.status == ParentActivitySeenStatus.failed &&
              seenState.error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _activitySeenErrorMessage(seenState.error!),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.danger,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _activitySeenErrorMessage(AppException error) {
  return switch (error) {
    NetworkException() =>
      'Internet access is required to mark this activity as read.',
    SessionExpiredException() =>
      'Your session expired. Sign in again before marking this activity.',
    PermissionException() =>
      'This activity is no longer available for the selected child.',
    NotFoundAppException() =>
      'This activity was archived or is no longer available.',
    ModuleLockedException() =>
      'Activity Feed is not currently available for your school.',
    _ => 'This activity could not be marked as read. Please try again.',
  };
}

class _ProtectedActivityThumbnail extends ConsumerWidget {
  const _ProtectedActivityThumbnail({
    required this.attachment,
    required this.additionalCount,
  });

  final ParentActivityAttachment attachment;
  final int additionalCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final thumbnail = ref.watch(
      parentActivityThumbnailProvider(attachment.thumbnailPath),
    );

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: thumbnail.when(
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
                    parentActivityThumbnailProvider(attachment.thumbnailPath),
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
          ),
          data: (bytes) => InkWell(
            onTap: attachment.canPreview
                ? () => showDialog<void>(
                    context: context,
                    builder: (_) =>
                        _ActivityMediaDialog(attachment: attachment),
                  )
                : null,
            child: Stack(
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
                if (attachment.canPreview)
                  const Positioned(
                    left: AppSpacing.sm,
                    bottom: AppSpacing.sm,
                    child: Chip(
                      avatar: Icon(Icons.open_in_full_rounded, size: 16),
                      label: Text('Open photo'),
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
      ),
    );
  }
}

class _ActivityMediaPlaceholder extends StatelessWidget {
  const _ActivityMediaPlaceholder({required this.attachment});

  final ParentActivityAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final failed = attachment.processingStatus.toUpperCase() == 'FAILED';
    return InkWell(
      onTap: attachment.canPreview
          ? () => showDialog<void>(
              context: context,
              builder: (_) => _ActivityMediaDialog(attachment: attachment),
            )
          : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(minHeight: 120),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              failed
                  ? Icons.image_not_supported_outlined
                  : Icons.hourglass_top_rounded,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              failed
                  ? 'This activity photo is unavailable.'
                  : 'This activity photo is being prepared.',
              textAlign: TextAlign.center,
            ),
            if (attachment.canPreview) ...[
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Tap to open the protected photo.',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActivityMediaDialog extends ConsumerWidget {
  const _ActivityMediaDialog({required this.attachment});

  final ParentActivityAttachment attachment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preview = ref.watch(
      parentActivityPreviewProvider(attachment.previewPath),
    );
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720, maxHeight: 720),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(attachment.fileName),
              trailing: IconButton(
                tooltip: 'Close photo',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
            Flexible(
              child: preview.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.xl),
                  child: CircularProgressIndicator(),
                ),
                error: (_, _) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.image_not_supported_outlined),
                      const SizedBox(height: AppSpacing.sm),
                      const Text('Protected media is unavailable.'),
                      TextButton(
                        onPressed: () => ref.invalidate(
                          parentActivityPreviewProvider(attachment.previewPath),
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
                data: (bytes) => InteractiveViewer(
                  child: Image.memory(bytes, fit: BoxFit.contain),
                ),
              ),
            ),
          ],
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
