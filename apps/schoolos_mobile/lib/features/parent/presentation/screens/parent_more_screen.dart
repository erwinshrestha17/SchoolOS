import 'package:flutter/material.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';

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
                ),
                _moduleAction(
                  context,
                  'Timetable',
                  Icons.event_note_rounded,
                  AppColors.studentAccent,
                ),
                _moduleAction(
                  context,
                  'Report Card',
                  Icons.analytics_rounded,
                  AppColors.teacherAccent,
                ),
                _moduleAction(
                  context,
                  'Transport',
                  Icons.directions_bus_rounded,
                  AppColors.driverAccent,
                ),
                _moduleAction(
                  context,
                  'Canteen',
                  Icons.restaurant_rounded,
                  AppColors.success,
                ),
                _moduleAction(
                  context,
                  'Chat',
                  Icons.forum_rounded,
                  AppColors.parentAccent,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Homework today'),
            const SizedBox(height: AppSpacing.sm),
            const DashboardCard(
              title: 'Science',
              value: 'Plant lifecycle worksheet',
              icon: Icons.science_rounded,
              iconColor: AppColors.studentAccent,
              badge: StatusChip(status: AppStatusType.pending),
              subtitle: 'Due tomorrow before first period.',
            ),
            const SizedBox(height: AppSpacing.md),
            const DashboardCard(
              title: 'Mathematics',
              value: 'Fractions practice',
              icon: Icons.calculate_rounded,
              iconColor: AppColors.primary,
              badge: StatusChip(status: AppStatusType.pending),
              subtitle: 'Due Friday. Teacher will review in class.',
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
                    subtitle: 'Ask the school office for account or fee help.',
                    onTap: () => _comingSoon(context, 'Help desk'),
                  ),
                  const Divider(),
                  _SupportRow(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy',
                    subtitle: 'Review how SchoolOS protects school data.',
                    onTap: () => _comingSoon(context, 'Privacy'),
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
    Color color,
  ) {
    return QuickActionCard(
      title: title,
      icon: icon,
      color: color,
      onTap: () => _comingSoon(context, title),
    );
  }

  void _comingSoon(BuildContext context, String label) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '$label will open when that mobile module is connected to the backend.',
        ),
      ),
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
