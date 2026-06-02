import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
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
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Monitoring & approvals • $email',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.slate500,
                          fontSize: 13,
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

            // Profile info gradient card
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
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        const Text(
                          'Administrative workspace',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'Active Approvals: 3 Pending Review',
                          style: TextStyle(color: Colors.white60, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
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

            // Metrics and summaries
            const SectionHeader(title: "Daily School Snapshot"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'Student Attendance Today',
              value: '91.8% Present',
              icon: Icons.people_outline_rounded,
              iconColor: AppColors.primary,
              subtitle: '864/941 Students boarded or arrived in class',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Today Collection',
              value: 'NPR 1,84,500',
              icon: Icons.monetization_on_rounded,
              iconColor: AppColors.success,
              subtitle: '12 Fee transactions processed today',
            ),
            const SizedBox(height: AppSpacing.xl),

            // Pending Approvals List
            const SectionHeader(title: "Pending Approvals"),
            const SizedBox(height: AppSpacing.sm),

            AppCard(
              child: Column(
                children: [
                  _buildApprovalRow(
                    context,
                    'Staff Leave Request',
                    'Hari Prasad (Accountant)',
                    '3 Days (Casual)',
                    AppStatusType.pending,
                  ),
                  const Divider(),
                  _buildApprovalRow(
                    context,
                    'Equipment Purchase',
                    'Science Lab Chemicals',
                    'NPR 25,000 Budget',
                    AppStatusType.pending,
                  ),
                  const Divider(),
                  _buildApprovalRow(
                    context,
                    'Substitution Request',
                    'Grade 5 Maths (Mrs. Sharma)',
                    'Period 3 Substitution',
                    AppStatusType.pending,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Quick Actions Grid
            const SectionHeader(title: "Emergency notice & tools"),
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
                  title: 'Send Alert',
                  icon: Icons.notifications_active_rounded,
                  color: AppColors.danger,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'School Log',
                  icon: Icons.receipt_long_rounded,
                  color: AppColors.primary,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'Bus Map',
                  icon: Icons.map_rounded,
                  color: AppColors.driverAccent,
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApprovalRow(
    BuildContext context,
    String category,
    String requestBy,
    String detail,
    AppStatusType status,
  ) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  category,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: isDark ? Colors.white : AppColors.slate800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$requestBy • $detail',
                  style: TextStyle(fontSize: 11, color: AppColors.slate500),
                ),
              ],
            ),
          ),
          StatusChip(status: status, label: 'Review'),
        ],
      ),
    );
  }
}
