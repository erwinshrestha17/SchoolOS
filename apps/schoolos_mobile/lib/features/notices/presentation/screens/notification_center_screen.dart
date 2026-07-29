import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../parent/application/parent_portal_providers.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../application/notices_providers.dart';
import '../../domain/notice_models.dart';
import '../widgets/notice_helpers.dart';

enum _NotificationFilter { all, unread, important }

class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  ConsumerState<NotificationCenterScreen> createState() =>
      _NotificationCenterScreenState();
}

class _NotificationCenterScreenState
    extends ConsumerState<NotificationCenterScreen> {
  _NotificationFilter filter = _NotificationFilter.all;

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(parentNotificationsProvider);
    final visibleItems = notifications.items.where((item) {
      return switch (filter) {
        _NotificationFilter.all => true,
        _NotificationFilter.unread => !item.isRead,
        _NotificationFilter.important =>
          item.isImportant ||
              item.isPinned ||
              (item.requiresAcknowledgement && item.acknowledgedAt == null),
      };
    }).toList();
    final groupedItems = _groupNotifications(visibleItems);

    return AppScaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          if (notifications.unreadCount > 0)
            TextButton(
              onPressed: notifications.isWriting
                  ? null
                  : () async {
                      final ok = await ref
                          .read(parentNotificationsProvider.notifier)
                          .markAllRead();
                      if (ok) {
                        ref.invalidate(parentPortalDataProvider);
                      }
                    },
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: notifications.isLoading
          ? const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  AppSkeleton(width: double.infinity, height: 96),
                  SizedBox(height: AppSpacing.md),
                  AppSkeleton(width: double.infinity, height: 96),
                ],
              ),
            )
          : notifications.error != null
          ? AppExceptionView(
              error: notifications.error!,
              onRetry: () =>
                  ref.read(parentNotificationsProvider.notifier).refresh(),
            )
          : notifications.items.isEmpty
          ? const AppEmptyState(
              title: 'No notifications',
              message: 'School alerts and reminders will appear here.',
              icon: Icons.notifications_none_rounded,
            )
          : RefreshIndicator(
              onRefresh: () async {
                await ref.read(parentNotificationsProvider.notifier).refresh();
              },
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  _NotificationSummary(state: notifications),
                  const SizedBox(height: AppSpacing.md),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _filterChip('All', _NotificationFilter.all),
                        _filterChip('Unread', _NotificationFilter.unread),
                        _filterChip('Important', _NotificationFilter.important),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (visibleItems.isEmpty)
                    AppEmptyState(
                      title: filter == _NotificationFilter.unread
                          ? 'No unread alerts'
                          : 'No alerts match this filter',
                      message: filter == _NotificationFilter.unread
                          ? 'You’re all caught up.'
                          : 'Try a different filter.',
                      icon: Icons.notifications_none_rounded,
                    )
                  else
                    for (final group in groupedItems.entries) ...[
                      _GroupHeader(title: group.key, count: group.value.length),
                      const SizedBox(height: AppSpacing.sm),
                      for (final item in group.value) ...[
                        _NotificationTile(
                          item: item,
                          onTap: () => _openNotification(context, ref, item),
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                    ],
                ],
              ),
            ),
    );
  }

  Widget _filterChip(String label, _NotificationFilter value) {
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: FilterChip(
        label: Text(label),
        selected: filter == value,
        onSelected: (_) => setState(() => filter = value),
        showCheckmark: false,
      ),
    );
  }

  Future<void> _openNotification(
    BuildContext context,
    WidgetRef ref,
    ParentNotification item,
  ) async {
    if (!item.isRead) {
      final ok = await ref
          .read(parentNotificationsProvider.notifier)
          .markRead(item.id);
      if (ok) {
        ref.invalidate(parentPortalDataProvider);
      }
      if (!ok && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not mark notification as read.')),
        );
      }
    }
    if (!context.mounted) {
      return;
    }
    if (item.route.isEmpty || item.route == '/notifications') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This alert has no separate detail.')),
      );
      return;
    }
    try {
      context.push(item.route);
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This notification cannot be opened yet.'),
        ),
      );
    }
  }
}

class _NotificationSummary extends StatelessWidget {
  const _NotificationSummary({required this.state});

  final ParentNotificationsState state;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: const Icon(
              Icons.notifications_rounded,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notificationSummaryTitle(state.unreadCount),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  notificationSummaryMessage(state.unreadCount),
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

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(width: 8),
        Text(
          '$count',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
        ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, required this.onTap});

  final ParentNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = item.category.color;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      hasShadow: false,
      color: item.isRead ? Colors.white : AppColors.primaryLight,
      border: Border.all(
        color: item.isRead ? AppColors.slate200 : AppColors.primary,
      ),
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(item.category.icon, color: color, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: item.isRead ? FontWeight.w700 : FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.slate600),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [
                    item.category.label,
                    _notificationAudienceLabel(item),
                    parentCommunicationTimestamp(item.createdAt),
                  ].where((value) => value.isNotEmpty).join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
          if (!item.isRead)
            Container(
              width: 9,
              height: 9,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }
}

String notificationSummaryTitle(int unreadCount) {
  return unreadCount == 0
      ? 'No unread alerts'
      : '$unreadCount unread alert${unreadCount == 1 ? '' : 's'}';
}

String notificationSummaryMessage(int unreadCount) {
  return unreadCount == 0
      ? 'You’re all caught up. Earlier alerts remain below.'
      : 'Alerts open the related school update or child record.';
}

Map<String, List<ParentNotification>> _groupNotifications(
  List<ParentNotification> items,
) {
  final sorted = [...items]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  final groups = <String, List<ParentNotification>>{};
  for (final item in sorted) {
    final group = parentCommunicationTimeGroup(item.createdAt);
    groups.putIfAbsent(group, () => []).add(item);
  }
  return groups;
}

String _notificationAudienceLabel(ParentNotification item) {
  final childName = item.audience.childName?.trim() ?? '';
  final className = item.audience.className?.trim() ?? '';
  final sectionName = item.audience.sectionName?.trim() ?? '';
  if (childName.isNotEmpty) {
    return [
      childName,
      [className, sectionName].where((value) => value.isNotEmpty).join(' - '),
    ].where((value) => value.isNotEmpty).join(' · ');
  }
  return item.audience.type == 'ALL' ? 'Whole school' : item.audience.label;
}
