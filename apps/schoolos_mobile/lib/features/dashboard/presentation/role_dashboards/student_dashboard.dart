import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/user_avatar.dart';

class StudentDashboard extends ConsumerWidget {
  const StudentDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RoleShellScaffold(
      role: 'STUDENT',
      selectedIndex: 0,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hey, Aarav!',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Ready for today\'s classes?',
                      style: TextStyle(color: AppColors.slate500, fontSize: 13),
                    ),
                  ],
                ),
                RoleBadge(role: 'STUDENT'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // Profile Info Header Card
            AppGradientCard(
              gradient: const LinearGradient(
                colors: AppColors.studentGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              child: const Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Aarav Shrestha',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: AppSpacing.xs),
                        Text(
                          'Grade 4 - Lotus • Roll No. 12',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        SizedBox(height: AppSpacing.md),
                        Text(
                          'Primary Contact: erwin@schoolos.com',
                          style: TextStyle(color: Colors.white60, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  UserAvatar(
                    name: 'Aarav Shrestha',
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
                  _buildTimetableRow(
                    context,
                    '09:30 AM - 10:15 AM',
                    'Mathematics',
                    'Classroom 4A',
                    isCurrent: true,
                  ),
                  const Divider(),
                  _buildTimetableRow(
                    context,
                    '10:15 AM - 11:00 AM',
                    'English Literature',
                    'Classroom 4A',
                  ),
                  const Divider(),
                  _buildTimetableRow(
                    context,
                    '11:00 AM - 11:15 AM',
                    'Morning Recess',
                    'Playground',
                    isBreak: true,
                  ),
                  const Divider(),
                  _buildTimetableRow(
                    context,
                    '11:15 AM - 12:00 PM',
                    'Computer Studies',
                    'Lab B',
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Homework and Canteen
            const SectionHeader(title: "My Stats"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'Homework Tasks',
              value: '2 Pending',
              icon: Icons.assignment_rounded,
              iconColor: AppColors.studentAccent,
              subtitle: 'Science (Due tomorrow) & Math (Due Friday)',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Canteen Balance',
              value: 'NPR 1,250',
              icon: Icons.restaurant_rounded,
              iconColor: AppColors.success,
              subtitle: 'Last spent NPR 150 on yesterday recess',
            ),
            const SizedBox(height: AppSpacing.xl),

            // Actions Grid
            const SectionHeader(title: "Quick Links"),
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
                  title: 'Attendance',
                  icon: Icons.fact_check_rounded,
                  color: AppColors.teacherAccent,
                  onTap: () => context.go(AppRoutes.studentAttendance),
                ),
                QuickActionCard(
                  title: 'Library',
                  icon: Icons.local_library_rounded,
                  color: AppColors.primary,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'Exams',
                  icon: Icons.quiz_rounded,
                  color: AppColors.adminAccent,
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimetableRow(
    BuildContext context,
    String time,
    String subject,
    String room, {
    bool isCurrent = false,
    bool isBreak = false,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 40,
            decoration: BoxDecoration(
              color: isCurrent
                  ? AppColors.studentAccent
                  : (isBreak ? AppColors.warning : AppColors.slate300),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject,
                  style: TextStyle(
                    fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 14,
                    color: isCurrent
                        ? AppColors.studentAccent
                        : (isDark ? Colors.white : AppColors.slate800),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  room,
                  style: TextStyle(fontSize: 11, color: AppColors.slate500),
                ),
              ],
            ),
          ),
          Text(
            time,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
              color: isCurrent ? AppColors.studentAccent : AppColors.slate500,
            ),
          ),
        ],
      ),
    );
  }
}
