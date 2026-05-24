import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final List<Map<String, String>> mockNotifications = [
      {
        'title': 'Sports Meet Postponed',
        'body':
            'Annual Sports Meet postponed to June 10 due to weather conditions. Regular classes will run.',
        'time': '2 hours ago',
        'type': 'alert',
      },
      {
        'title': 'Fee Invoice Generated',
        'body':
            'Tuition invoice for June 2026 is ready. Please view fee cards to pay online.',
        'time': '1 day ago',
        'type': 'fee',
      },
      {
        'title': 'Homework Assigned',
        'body':
            'Science Teacher added new assignment: "Solve unit 4 exercises". Due tomorrow.',
        'time': '2 days ago',
        'type': 'homework',
      },
    ];

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go(AppRoutes.home),
        ),
        title: const Text('Notifications'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: mockNotifications.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          final item = mockNotifications[index];
          final type = item['type'];

          Color typeColor = AppColors.primary;
          IconData typeIcon = Icons.notifications_rounded;

          if (type == 'alert') {
            typeColor = AppColors.danger;
            typeIcon = Icons.campaign_rounded;
          } else if (type == 'fee') {
            typeColor = AppColors.success;
            typeIcon = Icons.payments_rounded;
          } else if (type == 'homework') {
            typeColor = AppColors.secondary;
            typeIcon = Icons.menu_book_rounded;
          }

          return AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: typeColor.withValues(alpha: isDark ? 0.15 : 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(typeIcon, color: typeColor, size: 20),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['title']!,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item['body']!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: isDark
                              ? AppColors.slate300
                              : AppColors.slate600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        item['time']!,
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
