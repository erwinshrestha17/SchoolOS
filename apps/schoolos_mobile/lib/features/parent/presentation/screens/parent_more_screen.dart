import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';

class ParentMoreScreen extends StatelessWidget {
  const ParentMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'More',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader(title: 'Daily modules'),
            const SizedBox(height: AppSpacing.sm),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: AppSpacing.md,
              mainAxisSpacing: AppSpacing.md,
              childAspectRatio: 0.96,
              children: [
                _moduleAction(
                  context,
                  'Homework',
                  Icons.menu_book_rounded,
                  AppColors.primary,
                  route: AppRoutes.parentHomework,
                ),
                _moduleAction(
                  context,
                  'Timetable',
                  Icons.event_note_rounded,
                  AppColors.studentAccent,
                  route: AppRoutes.parentTimetable,
                ),
                _moduleAction(
                  context,
                  'Exams & Results',
                  Icons.analytics_rounded,
                  AppColors.teacherAccent,
                  route: AppRoutes.parentReportCards,
                ),
                _moduleAction(
                  context,
                  'Transport',
                  Icons.directions_bus_rounded,
                  AppColors.driverAccent,
                  route: AppRoutes.parentTransport,
                ),
                _moduleAction(
                  context,
                  'Canteen',
                  Icons.restaurant_rounded,
                  AppColors.success,
                  route: AppRoutes.parentCanteen,
                ),
                _moduleAction(
                  context,
                  'Chat',
                  Icons.forum_rounded,
                  AppColors.parentAccent,
                  route: AppRoutes.parentChat,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            QuickActionCard(
              title: 'Activity feed',
              icon: Icons.auto_awesome_rounded,
              color: AppColors.parentAccent,
              onTap: () => context.go(AppRoutes.parentActivity),
            ),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Support'),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: Column(
                children: [
                  _SupportRow(
                    icon: Icons.help_outline_rounded,
                    title: 'Help desk',
                    subtitle: 'Message the class teacher or school office.',
                    onTap: () => context.go(AppRoutes.parentChat),
                  ),
                  const Divider(),
                  _SupportRow(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy',
                    subtitle: 'Review account preferences and session state.',
                    onTap: () => context.go(AppRoutes.settings),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  QuickActionCard _moduleAction(
    BuildContext context,
    String title,
    IconData icon,
    Color color, {
    required String route,
  }) {
    return QuickActionCard(
      title: title,
      icon: icon,
      color: color,
      onTap: () => context.go(route),
    );
  }
}

class _SupportRow extends StatelessWidget {
  const _SupportRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
          ],
        ),
      ),
    );
  }
}
