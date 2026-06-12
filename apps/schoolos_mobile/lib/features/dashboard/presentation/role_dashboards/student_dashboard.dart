import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../parent/application/parent_providers.dart';
import '../../../parent/domain/parent_models.dart';
import '../../../parent/presentation/widgets/parent_state_view.dart';

class StudentDashboard extends ConsumerWidget {
  const StudentDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'STUDENT',
      selectedIndex: 0,
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: state.dashboard == null
            ? const AppEmptyState(
                title: 'No student profile linked',
                message:
                    'Ask the school office to link this login to a student profile.',
                icon: Icons.school_rounded,
              )
            : _StudentDashboardContent(summary: state.dashboard!),
      ),
    );
  }
}

class _StudentDashboardContent extends StatelessWidget {
  const _StudentDashboardContent({required this.summary});

  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    final child = summary.child;
    final homeworkLabel = summary.homeworkPending == 0
        ? 'Clear'
        : '${summary.homeworkPending} pending';
    final feesLabel = summary.feesDue == 0 ? 'Clear' : _money(summary.feesDue);
    final canteenLabel = summary.canteenBalance == 0
        ? 'No balance'
        : _money(summary.canteenBalance);

    return RefreshIndicator(
      onRefresh: () async {
        final container = ProviderScope.containerOf(context);
        await container.read(parentControllerProvider.notifier).load();
      },
      child: ListView(
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
                      'Hi, ${_firstName(child.name)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Your school day at a glance.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const RoleBadge(role: 'STUDENT'),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          AppGradientCard(
            gradient: const LinearGradient(
              colors: AppColors.studentGradient,
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
                        child.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        child.classSection.isEmpty
                            ? 'Class section pending'
                            : child.classSection,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white70,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        [
                          if (child.rollNumber.isNotEmpty)
                            'Roll ${child.rollNumber}',
                          if (child.academicYear.isNotEmpty) child.academicYear,
                        ].join(' - '),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white60,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                UserAvatar(
                  name: child.name,
                  radius: 36,
                  borderColor: Colors.white,
                  borderWidth: 2,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: "Today's overview"),
          const SizedBox(height: AppSpacing.sm),
          DashboardCard(
            title: 'Attendance',
            value: summary.attendanceToday,
            icon: Icons.fact_check_rounded,
            iconColor: AppColors.teacherAccent,
            subtitle: 'Updated from the school attendance register.',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Homework',
            value: homeworkLabel,
            icon: Icons.assignment_rounded,
            iconColor: AppColors.studentAccent,
            subtitle: summary.nextHomeworkDueAt == null
                ? 'No upcoming due date from school.'
                : 'Next due ${_date(summary.nextHomeworkDueAt!)}.',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Fees',
            value: feesLabel,
            icon: Icons.account_balance_wallet_rounded,
            iconColor: summary.feesDue == 0
                ? AppColors.success
                : AppColors.warning,
            subtitle: summary.overdueFeesCount == 0
                ? 'No overdue invoice in the mobile summary.'
                : '${summary.overdueFeesCount} overdue invoice(s).',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Canteen',
            value: canteenLabel,
            icon: Icons.restaurant_rounded,
            iconColor: summary.canteenIsLowBalance
                ? AppColors.warning
                : AppColors.success,
            subtitle: summary.canteenIsLowBalance
                ? 'Wallet balance is below the school threshold.'
                : 'Meal wallet summary from the canteen.',
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Quick links'),
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
                title: 'Homework',
                icon: Icons.assignment_rounded,
                color: AppColors.studentAccent,
                onTap: () => context.go(AppRoutes.studentHomework),
              ),
              QuickActionCard(
                title: 'Timetable',
                icon: Icons.event_note_rounded,
                color: AppColors.info,
                onTap: () => context.go(AppRoutes.studentTimetable),
              ),
              QuickActionCard(
                title: 'Learning',
                icon: Icons.school_rounded,
                color: AppColors.success,
                onTap: () => context.go(AppRoutes.studentLearning),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _firstName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) {
    return 'Student';
  }
  return trimmed.split(RegExp(r'\s+')).first;
}

String _money(num value) {
  final amount = value % 1 == 0
      ? value.toInt().toString()
      : value.toStringAsFixed(2);
  return 'NPR $amount';
}

String _date(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return 'available soon';
  }
  return '${_month(parsed.month)} ${parsed.day}';
}

String _month(int month) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (month < 1 || month > 12) {
    return 'Date';
  }
  return months[month - 1];
}
