import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';

class ParentDashboard extends ConsumerStatefulWidget {
  const ParentDashboard({super.key});

  @override
  ConsumerState<ParentDashboard> createState() => _ParentDashboardState();
}

class _ParentDashboardState extends ConsumerState<ParentDashboard> {
  String _selectedChildId = '1';

  final List<Map<String, dynamic>> _children = [
    {
      'id': '1',
      'name': 'Aarav Shrestha',
      'class': 'Grade 4 - Lotus',
      'roll': 'Roll No. 12',
      'avatarUrl':
          'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=80',
    },
    {
      'id': '2',
      'name': 'Anika Shrestha',
      'class': 'Grade 1 - Jasmine',
      'roll': 'Roll No. 04',
      'avatarUrl':
          'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=120&q=80',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final selectedChild = _children.firstWhere(
      (c) => c['id'] == _selectedChildId,
    );

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 0,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Role & Welcome Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Namaste, Parent',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Welcome to your guardian space',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
                const RoleBadge(role: 'PARENT'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // Child Switcher Card
            Text(
              'Select Child',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.slate300 : AppColors.slate700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 72,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _children.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, index) {
                  final child = _children[index];
                  final isSelected = _selectedChildId == child['id'];

                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedChildId = child['id'] as String;
                      });
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.parentAccent.withValues(
                                alpha: isDark ? 0.15 : 0.08,
                              )
                            : (isDark ? AppColors.slate900 : Colors.white),
                        borderRadius: BorderRadius.circular(AppRadius.xl),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.parentAccent
                              : (isDark
                                    ? AppColors.slate800
                                    : AppColors.slate200),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          UserAvatar(
                            name: child['name'] as String,
                            radius: 20,
                            borderColor: AppColors.parentAccent,
                            borderWidth: isSelected ? 1.5 : 0,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                child['name'] as String,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: isSelected
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.slate800,
                                ),
                              ),
                              Text(
                                child['class'] as String,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.slate500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Hero Card for selected child
            AppGradientCard(
              gradient: const LinearGradient(
                colors: AppColors.parentGradient,
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
                          selectedChild['name'] as String,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          '${selectedChild['class']} • ${selectedChild['roll']}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                          ),
                          child: const Text(
                            'Bus Status: En Route',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  UserAvatar(
                    name: selectedChild['name'] as String,
                    radius: 36,
                    borderColor: Colors.white,
                    borderWidth: 2,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Today's Status Cards
            const SectionHeader(title: "Today's Summary"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'Attendance',
              value: '94% (Monthly)',
              icon: Icons.check_circle_outline_rounded,
              iconColor: AppColors.success,
              badge: const StatusChip(status: AppStatusType.present),
              subtitle: 'Marked Present today at 09:12 AM',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Pending Homework',
              value: _selectedChildId == '1'
                  ? '2 Assignments'
                  : '0 Assignments',
              icon: Icons.menu_book_rounded,
              iconColor: AppColors.primary,
              subtitle: _selectedChildId == '1'
                  ? 'Science (Due tomorrow) & Math (Due Friday)'
                  : 'All homework completed for today',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Fee Status',
              value: _selectedChildId == '1' ? 'NPR 4,200 Due' : 'NPR 0 (Paid)',
              icon: Icons.account_balance_wallet_rounded,
              iconColor: _selectedChildId == '1'
                  ? AppColors.warning
                  : AppColors.success,
              badge: StatusChip(
                status: _selectedChildId == '1'
                    ? AppStatusType.due
                    : AppStatusType.paid,
              ),
              subtitle: _selectedChildId == '1'
                  ? 'Tuition & Library fees due by June 5'
                  : 'Cleared all dues for the current term',
            ),
            const SizedBox(height: AppSpacing.xl),

            // Quick Actions Grid
            const SectionHeader(title: "Quick Tasks"),
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
                  title: 'Track Bus',
                  icon: Icons.location_on_rounded,
                  color: AppColors.driverAccent,
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Transport tracking will open when live route data is connected.',
                        ),
                      ),
                    );
                  },
                ),
                QuickActionCard(
                  title: 'Pay Fees',
                  icon: Icons.payments_rounded,
                  color: AppColors.success,
                  onTap: () => context.go(AppRoutes.parentFees),
                ),
                QuickActionCard(
                  title: 'Chat Teacher',
                  icon: Icons.chat_bubble_rounded,
                  color: AppColors.primary,
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Parent-teacher chat will open after messaging permissions are enabled.',
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xxl),

            // Latest Notice Section
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.campaign_rounded,
                        color: AppColors.danger,
                        size: 20,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Latest Notice',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppColors.slate900,
                        ),
                      ),
                      const Spacer(),
                      const StatusChip(status: AppStatusType.published),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Annual Sports Meet postponed to June 10 due to weather conditions. Regular classes will run on original dates.',
                    style: TextStyle(fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Posted by Principal on May 22, 2026',
                    style: TextStyle(fontSize: 11, color: AppColors.slate500),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
