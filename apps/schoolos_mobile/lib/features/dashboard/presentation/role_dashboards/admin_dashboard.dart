import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';

class AdminDashboard extends ConsumerWidget {
  const AdminDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final displayName = user?.name ?? 'Administrator';
    final email = user?.email ?? 'admin@schoolos.com';

    return RoleShellScaffold(
      role: 'ADMIN',
      selectedIndex: 0,
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, $displayName',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Admin mobile companion - $email',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const RoleBadge(role: 'ADMIN'),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          AppGradientCard(
            gradient: const LinearGradient(
              colors: AppColors.adminGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Mobile companion for admin alerts and account access',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white70,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Use the web console for live operational dashboards',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white60,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                UserAvatar(
                  name: displayName,
                  radius: 36,
                  borderColor: Colors.white,
                  borderWidth: 2,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Mobile admin scope'),
          const SizedBox(height: AppSpacing.sm),
          DashboardCard(
            title: 'Operations dashboard',
            value: 'Web console',
            icon: Icons.dashboard_customize_rounded,
            iconColor: AppColors.primary,
            badge: const StatusChip(
              status: AppStatusType.draft,
              label: 'Web-first',
            ),
            subtitle:
                'Live attendance, fees, transport maps, and approvals stay in the scoped web admin dashboard.',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Mobile notifications',
            value: 'Available',
            icon: Icons.notifications_active_rounded,
            iconColor: AppColors.success,
            subtitle:
                'Open the mobile notification center for account-visible updates.',
            onTap: () => context.go(AppRoutes.notifications),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Admin work queue'),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                _InfoRow(
                  icon: Icons.verified_user_rounded,
                  title: 'Approvals',
                  detail:
                      'Approval queues are intentionally web-only until mobile admin APIs are scoped.',
                ),
                const Divider(),
                _InfoRow(
                  icon: Icons.receipt_long_rounded,
                  title: 'Finance and payroll',
                  detail:
                      'Use the web console for cashier close, payroll posting, and accounting reports.',
                ),
                const Divider(),
                _InfoRow(
                  icon: Icons.directions_bus_rounded,
                  title: 'Transport operations',
                  detail:
                      'Driver and parent transport companion views are mobile-ready; admin live maps remain web-gated.',
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Quick access'),
          const SizedBox(height: AppSpacing.sm),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.md,
            childAspectRatio: 1.0,
            children: [
              QuickActionCard(
                title: 'Notices',
                icon: Icons.campaign_rounded,
                color: AppColors.danger,
                onTap: () => context.go(AppRoutes.notices),
              ),
              QuickActionCard(
                title: 'Alerts',
                icon: Icons.notifications_active_rounded,
                color: AppColors.primary,
                onTap: () => context.go(AppRoutes.notifications),
              ),
              QuickActionCard(
                title: 'Settings',
                icon: Icons.settings_rounded,
                color: AppColors.info,
                onTap: () => context.go(AppRoutes.settings),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.adminAccent),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : AppColors.slate800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
