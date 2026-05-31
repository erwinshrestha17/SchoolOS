import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../parent/application/parent_providers.dart';
import '../../../parent/domain/parent_models.dart';
import '../../../parent/presentation/widgets/last_updated_label.dart';
import '../../../parent/presentation/widgets/parent_state_view.dart';
import '../../application/attendance_providers.dart';
import '../widgets/attendance_calendar.dart';
import '../widgets/attendance_status_helpers.dart';

class ParentAttendanceScreen extends ConsumerWidget {
  const ParentAttendanceScreen({
    super.key,
    required this.studentId,
    this.role = 'PARENT',
    this.selectedIndex = 1,
  });

  final String studentId;
  final String role;
  final int selectedIndex;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentState = ref.watch(parentControllerProvider);
    final parentController = ref.read(parentControllerProvider.notifier);
    final effectiveStudentId = studentId == 'selected-child'
        ? parentState.selectedChildId
        : studentId;

    return RoleShellScaffold(
      role: role,
      selectedIndex: selectedIndex,
      title: 'Attendance',
      body: ParentStateView(
        status: studentId == 'selected-child'
            ? parentState.status
            : ParentDataStatus.success,
        message: parentState.message,
        onRetry: parentController.load,
        child: effectiveStudentId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before viewing attendance.',
                icon: Icons.fact_check_rounded,
              )
            : _ParentAttendanceContent(studentId: effectiveStudentId),
      ),
    );
  }
}

class _ParentAttendanceContent extends ConsumerWidget {
  const _ParentAttendanceContent({required this.studentId});

  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendance = ref.watch(parentAttendanceProvider(studentId));

    return attendance.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 112),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 320),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load attendance',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentAttendanceProvider(studentId)),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () async =>
            ref.invalidate(parentAttendanceProvider(studentId)),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            LastUpdatedLabel(
              lastUpdated: data.summary.lastUpdated,
              isOffline: data.isOffline,
            ),
            const SizedBox(height: AppSpacing.lg),
            DashboardCard(
              title: 'Today',
              value: data.summary.todayLabel ?? data.summary.todayStatus.label,
              icon: Icons.fact_check_rounded,
              iconColor: data.summary.todayStatus.color,
              subtitle: '${data.summary.studentName} attendance for today.',
            ),
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              child: Row(
                children: [
                  _CountBlock(
                    label: 'Absent',
                    value: data.summary.absentCount,
                    color: AppColors.danger,
                  ),
                  _CountBlock(
                    label: 'Late',
                    value: data.summary.lateCount,
                    color: AppColors.warning,
                  ),
                  _CountBlock(
                    label: 'Leave',
                    value: data.summary.leaveCount,
                    color: AppColors.info,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'This month'),
            const SizedBox(height: AppSpacing.sm),
            AppCard(child: AttendanceCalendar(days: data.days)),
          ],
        ),
      ),
    );
  }
}

class StudentAttendanceScreen extends StatelessWidget {
  const StudentAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ParentAttendanceScreen(
      studentId: 'student-self',
      role: 'STUDENT',
      selectedIndex: 1,
    );
  }
}

class _CountBlock extends StatelessWidget {
  const _CountBlock({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$value',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
