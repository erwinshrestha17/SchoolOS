import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
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
    final currentOrNextPeriod = _currentOrNextPeriod(state.todayPeriods);

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
                        'Today, $displayName',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Daily classroom work - $email',
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
            if (state.isOffline && state.lastUpdated != null) ...[
              Text(
                'Offline data • Last updated ${_lastUpdatedLabel(context, state.lastUpdated!)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.warning,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
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
            else if (state.error != null)
              AppExceptionView(error: state.error!, onRetry: controller.load)
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
                title: 'Attendance pending',
                value: '${state.pendingAttendanceCount} class(es)',
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
                title: 'Current / next period',
                value: currentOrNextPeriod == null
                    ? 'No period today'
                    : currentOrNextPeriod.className,
                icon: Icons.schedule_rounded,
                iconColor: AppColors.teacherAccent,
                subtitle: currentOrNextPeriod == null
                    ? 'Your published timetable has no assigned period today.'
                    : '${currentOrNextPeriod.startsAt}-${currentOrNextPeriod.endsAt} • ${currentOrNextPeriod.subjectName}',
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
                    title: 'Classes',
                    icon: Icons.school_rounded,
                    color: AppColors.info,
                    onTap: () => context.go(AppRoutes.teacherClasses),
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

String _attendanceSubtitle(TeacherAttendanceState state) {
  if (state.entries.isEmpty) {
    return 'Open attendance after the roster is available.';
  }
  if (state.hasUnsavedChanges) {
    return 'Review and submit pending attendance changes.';
  }
  if (state.attendance.isSubmitted) {
    return 'Attendance was submitted and is now read-only.';
  }
  return 'Attendance has not been submitted for this class yet.';
}

String _attendanceStatusLabel(TeacherAttendanceState state) {
  if (state.hasUnsavedChanges) {
    return state.syncStatus == AttendanceSyncStatus.queued ? 'Queued' : 'Draft';
  }
  if (state.syncStatus == AttendanceSyncStatus.failed) {
    return 'Failed';
  }
  if (state.attendance.hasConflict) {
    return 'Conflict';
  }
  if (state.attendance.isSubmitted) {
    return 'Submitted';
  }
  return 'Pending';
}

AppStatusType _attendanceStatusType(TeacherAttendanceState state) {
  if (state.attendance.hasConflict ||
      state.syncStatus == AttendanceSyncStatus.failed) {
    return AppStatusType.rejected;
  }
  if (state.hasUnsavedChanges || !state.attendance.isSubmitted) {
    return AppStatusType.pending;
  }
  return AppStatusType.completed;
}

Color _attendanceColor(TeacherAttendanceState state) {
  if (state.syncStatus == AttendanceSyncStatus.failed ||
      state.attendance.hasConflict) {
    return AppColors.danger;
  }
  if (state.hasUnsavedChanges || state.entries.isEmpty) {
    return AppColors.warning;
  }
  return AppColors.success;
}

String _syncLabel(AttendanceSyncStatus status) {
  switch (status) {
    case AttendanceSyncStatus.draft:
      return 'Draft';
    case AttendanceSyncStatus.queued:
      return 'Queued';
    case AttendanceSyncStatus.syncing:
      return 'Syncing';
    case AttendanceSyncStatus.synced:
      return 'Synced';
    case AttendanceSyncStatus.failed:
      return 'Failed';
    case AttendanceSyncStatus.conflict:
      return 'Conflict';
  }
}

String _lastUpdatedLabel(BuildContext context, DateTime value) {
  return TimeOfDay.fromDateTime(value.toLocal()).format(context);
}

TeacherTodayPeriod? _currentOrNextPeriod(List<TeacherTodayPeriod> periods) {
  if (periods.isEmpty) return null;
  final now = TimeOfDay.now();
  final nowMinutes = now.hour * 60 + now.minute;
  for (final period in periods) {
    final parts = period.endsAt.split(':');
    if (parts.length < 2) continue;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) continue;
    if (hour * 60 + minute >= nowMinutes) return period;
  }
  return null;
}
