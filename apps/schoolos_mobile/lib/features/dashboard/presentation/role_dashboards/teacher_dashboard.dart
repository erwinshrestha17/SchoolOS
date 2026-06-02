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

class TeacherDashboard extends ConsumerWidget {
  const TeacherDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final displayName = user?.name ?? 'Teacher';
    final email = user?.email ?? 'teacher@schoolos.com';

    return RoleShellScaffold(
      role: 'TEACHER',
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
                        'Teacher Space • $email',
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
                const RoleBadge(role: 'TEACHER'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // Profile info header
            AppGradientCard(
              gradient: const LinearGradient(
                colors: AppColors.teacherGradient,
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
                          'Class teacher and classroom operations',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'Today\'s Teaching Hours: 4 Periods',
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

            // Timetable summary
            const SectionHeader(title: "Today's Schedule"),
            const SizedBox(height: AppSpacing.sm),

            AppCard(
              child: Column(
                children: [
                  _buildClassRow(
                    context,
                    '09:30 AM',
                    'Grade 4 - Lotus',
                    'Mathematics',
                    'Completed',
                    AppStatusType.completed,
                  ),
                  const Divider(),
                  _buildClassRow(
                    context,
                    '11:15 AM',
                    'Grade 5 - Rose',
                    'Mathematics',
                    'Upcoming',
                    AppStatusType.pending,
                  ),
                  const Divider(),
                  _buildClassRow(
                    context,
                    '01:00 PM',
                    'Grade 4 - Lotus',
                    'Substitution (Science)',
                    'Upcoming',
                    AppStatusType.pending,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Tasks and summaries
            const SectionHeader(title: "My Classroom Focus"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'Today Attendance',
              value: 'Pending (Grade 4)',
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.danger,
              badge: const StatusChip(status: AppStatusType.due),
              subtitle: 'Attendance for Grade 4 - Lotus needs to be marked',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Unread Messages',
              value: '3 Parent Messages',
              icon: Icons.forum_rounded,
              iconColor: AppColors.teacherAccent,
              subtitle: 'Reply to Aarav\'s and Riya\'s guardians',
            ),
            const SizedBox(height: AppSpacing.xl),

            // Action Grid
            const SectionHeader(title: "Quick Teacher Tools"),
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
                  title: 'Mark Attendance',
                  icon: Icons.fact_check_rounded,
                  color: AppColors.primary,
                  onTap: () => context.go(AppRoutes.teacherAttendance),
                ),
                QuickActionCard(
                  title: 'Add Homework',
                  icon: Icons.note_add_rounded,
                  color: AppColors.success,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'Request Leave',
                  icon: Icons.time_to_leave_rounded,
                  color: AppColors.warning,
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClassRow(
    BuildContext context,
    String time,
    String grade,
    String subject,
    String statusText,
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
                  grade,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: isDark ? Colors.white : AppColors.slate800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$subject • $time',
                  style: TextStyle(fontSize: 11, color: AppColors.slate500),
                ),
              ],
            ),
          ),
          StatusChip(status: status, label: statusText),
        ],
      ),
    );
  }
}
