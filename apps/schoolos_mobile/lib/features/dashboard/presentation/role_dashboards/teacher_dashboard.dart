import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../../../attendance/domain/attendance_models.dart';

class TeacherDashboard extends ConsumerWidget {
  const TeacherDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);
    final displayName = user?.name ?? 'Teacher';
    final email = user?.email ?? 'teacher@schoolos.com';

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      body: RefreshIndicator(
        onRefresh: controller.load,
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
                        'Welcome, $displayName',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Teacher Space - $email',
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
                const RoleBadge(role: 'TEACHER'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
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
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          state.isLoading
                              ? 'Loading assigned classes'
                              : '${state.classes.length} assigned class(es)',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white70,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _selectedClassLabel(state),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
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
            if (state.isLoading)
              const _TeacherDashboardLoading()
            else ...[
              const SectionHeader(title: 'Assigned classes'),
              const SizedBox(height: AppSpacing.sm),
              if (state.classes.isEmpty)
                AppEmptyState(
                  title: 'No assigned class',
                  message:
                      state.message ??
                      'Assigned class sections will appear after the school maps this teacher account.',
                  icon: Icons.calendar_today_rounded,
                  actionLabel: 'Retry',
                  onActionPressed: controller.load,
                )
              else
                AppCard(
                  child: Column(
                    children: [
                      for (final item in state.classes.take(4)) ...[
                        _ClassRow(
                          classSection: item,
                          isSelected: item.id == state.selectedClassId,
                        ),
                        if (item != state.classes.take(4).last) const Divider(),
                      ],
                    ],
                  ),
                ),
              const SizedBox(height: AppSpacing.xl),
              const SectionHeader(title: 'Classroom focus'),
              const SizedBox(height: AppSpacing.sm),
              DashboardCard(
                title: 'Today attendance',
                value: _attendanceProgress(state),
                icon: Icons.fact_check_rounded,
                iconColor: _attendanceColor(state),
                badge: StatusChip(
                  status: _attendanceStatusType(state),
                  label: _attendanceStatusLabel(state),
                ),
                subtitle: _attendanceSubtitle(state),
                onTap: () => context.go(AppRoutes.teacherAttendance),
              ),
              const SizedBox(height: AppSpacing.md),
              DashboardCard(
                title: 'Roster loaded',
                value: '${state.entries.length} students',
                icon: Icons.groups_rounded,
                iconColor: AppColors.teacherAccent,
                subtitle: state.selectedClass == null
                    ? 'Select an assigned class to load the roster.'
                    : state.selectedClass!.name,
              ),
              const SizedBox(height: AppSpacing.md),
              DashboardCard(
                title: 'Sync status',
                value: _syncLabel(state.syncStatus),
                icon: Icons.cloud_done_rounded,
                iconColor: state.syncStatus == AttendanceSyncStatus.failed
                    ? AppColors.danger
                    : AppColors.success,
                subtitle:
                    state.message ??
                    (state.isOffline
                        ? 'Offline mode is active.'
                        : 'Attendance data is synced with SchoolOS.'),
              ),
              const SizedBox(height: AppSpacing.xl),
              const SectionHeader(title: 'Quick teacher tools'),
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
                    color: AppColors.primary,
                    onTap: () => context.go(AppRoutes.teacherAttendance),
                  ),
                  QuickActionCard(
                    title: 'Refresh',
                    icon: Icons.sync_rounded,
                    color: AppColors.success,
                    onTap: controller.load,
                  ),
                  QuickActionCard(
                    title: 'Notices',
                    icon: Icons.campaign_rounded,
                    color: AppColors.info,
                    onTap: () => context.go(AppRoutes.notices),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TeacherDashboardLoading extends StatelessWidget {
  const _TeacherDashboardLoading();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        AppSkeleton(width: double.infinity, height: 112),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 94),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 94),
      ],
    );
  }
}

class _ClassRow extends StatelessWidget {
  const _ClassRow({required this.classSection, required this.isSelected});

  final TeacherClassSection classSection;
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  classSection.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  classSection.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
          StatusChip(
            status: isSelected ? AppStatusType.approved : AppStatusType.draft,
            label: isSelected ? 'Selected' : 'Assigned',
          ),
        ],
      ),
    );
  }
}

String _selectedClassLabel(TeacherAttendanceState state) {
  final selected = state.selectedClass;
  if (selected == null) {
    return 'Attendance roster will load after class assignment.';
  }
  return '${selected.name} - ${selected.subject}';
}

String _attendanceProgress(TeacherAttendanceState state) {
  if (state.entries.isEmpty) {
    return 'No roster';
  }
  final present = state.entries
      .where((entry) => entry.status == AttendanceStatus.present)
      .length;
  return '$present/${state.entries.length} present';
}

String _attendanceSubtitle(TeacherAttendanceState state) {
  if (state.entries.isEmpty) {
    return 'Open attendance after the roster is available.';
  }
  if (state.hasUnsavedChanges) {
    return 'Review and submit pending attendance changes.';
  }
  return 'Roster loaded from the purpose-limited mobile attendance API.';
}

String _attendanceStatusLabel(TeacherAttendanceState state) {
  if (state.hasUnsavedChanges) {
    return 'Draft';
  }
  if (state.syncStatus == AttendanceSyncStatus.failed) {
    return 'Failed';
  }
  if (state.entries.isEmpty) {
    return 'Pending';
  }
  return 'Synced';
}

AppStatusType _attendanceStatusType(TeacherAttendanceState state) {
  if (state.hasUnsavedChanges || state.entries.isEmpty) {
    return AppStatusType.pending;
  }
  if (state.syncStatus == AttendanceSyncStatus.failed) {
    return AppStatusType.rejected;
  }
  return AppStatusType.completed;
}

Color _attendanceColor(TeacherAttendanceState state) {
  if (state.syncStatus == AttendanceSyncStatus.failed) {
    return AppColors.danger;
  }
  if (state.hasUnsavedChanges || state.entries.isEmpty) {
    return AppColors.warning;
  }
  return AppColors.success;
}

String _syncLabel(AttendanceSyncStatus status) {
  switch (status) {
    case AttendanceSyncStatus.pending:
      return 'Pending';
    case AttendanceSyncStatus.synced:
      return 'Synced';
    case AttendanceSyncStatus.failed:
      return 'Failed';
  }
}
