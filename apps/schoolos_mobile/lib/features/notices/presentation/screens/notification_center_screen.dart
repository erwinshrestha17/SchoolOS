import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
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
    final notifications = ref.watch(notificationCenterProvider);

    return AppScaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: notifications.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              AppSkeleton(width: double.infinity, height: 96),
              SizedBox(height: AppSpacing.md),
              AppSkeleton(width: double.infinity, height: 96),
            ],
          ),
        ),
        error: (_, _) => AppErrorView(
          title: 'Could not load notifications',
          message: 'Please try again in a moment.',
          onRetry: () => ref.invalidate(notificationCenterProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const AppEmptyState(
              title: 'No notifications',
              message: 'School alerts and reminders will appear here.',
              icon: Icons.notifications_none_rounded,
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationCenterProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemBuilder: (context, index) =>
                  _NotificationTile(item: items[index]),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemCount: items.length,
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item});

  final NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final color = item.category.color;

    return AppCard(
      hasShadow: !item.isRead,
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
