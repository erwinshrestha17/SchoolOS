import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../parent/application/parent_portal_providers.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../application/notices_providers.dart';
import '../../domain/notice_models.dart';
import '../widgets/notice_helpers.dart';

class NotificationCenterScreen extends ConsumerWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(parentNotificationsProvider);

    return AppScaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
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
          ? AppErrorView(
              title: 'Could not load notifications',
              message: 'Please try again in a moment.',
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
                  const SizedBox(height: AppSpacing.lg),
                  if (notifications.items.any((item) => !item.isRead)) ...[
                    _GroupHeader(
                      title: 'Unread',
                      count: notifications.items
                          .where((item) => !item.isRead)
                          .length,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    for (final item in notifications.items.where(
                      (item) => !item.isRead,
                    )) ...[
                      _NotificationTile(
                        item: item,
                        onTap: () => _openNotification(context, ref, item),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                  _GroupHeader(
                    title: 'Earlier',
                    count: notifications.items
                        .where((item) => item.isRead)
                        .length,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final item in notifications.items.where(
                    (item) => item.isRead,
                  )) ...[
                    _NotificationTile(
                      item: item,
                      onTap: () => _openNotification(context, ref, item),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
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
                  state.unreadCount == 0
                      ? 'All caught up'
                      : '${state.unreadCount} unread update${state.unreadCount == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'Opening a notification marks it read.',
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
      hasShadow: !item.isRead,
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(item.category.icon, color: color),
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
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.slate600),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${item.category.label} • ${DateFormat('MMM d, h:mm a').format(item.createdAt)}',
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
