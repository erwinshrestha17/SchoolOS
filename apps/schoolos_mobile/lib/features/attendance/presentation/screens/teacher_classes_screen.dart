import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/attendance_providers.dart';
import '../../domain/attendance_models.dart';

class TeacherClassesScreen extends ConsumerWidget {
  const TeacherClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Assigned Classes',
      body: RefreshIndicator(
        onRefresh: controller.load,
        child: state.isLoading
            ? const _TeacherClassesLoading()
            : state.error != null
            ? AppExceptionView(error: state.error!, onRetry: controller.load)
            : state.syncStatus == AttendanceSyncStatus.failed &&
                  state.classes.isEmpty
            ? AppErrorView(
                title: 'Unable to load classes',
                message:
                    state.message ??
                    'Assigned classes could not be loaded for this teacher.',
                onRetry: controller.load,
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  const SectionHeader(title: 'Assigned classes'),
                  const SizedBox(height: AppSpacing.sm),
                  if (state.isOffline && state.lastUpdated != null) ...[
                    Text(
                      'Offline data • Last updated ${NepaliBsCalendar.formatNepalTime(state.lastUpdated!)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.warning,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (state.classes.isEmpty)
                    AppEmptyState(
                      title: 'No assigned class',
                      message:
                          state.message ??
                          'No classes are assigned to you yet. Your school administrator can update your teaching assignments.',
                      icon: Icons.calendar_today_rounded,
                      actionLabel: 'Retry',
                      onActionPressed: controller.load,
                    )
                  else ...[
                    Text(
                      '${state.classes.length} active class/subject assignment(s)',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.slate600,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (final classSection in state.classes) ...[
                      _TeacherClassTile(
                        classSection: classSection,
                        isSelected: classSection.id == state.selectedClassId,
                        onOpen: () async {
                          await controller.selectClass(classSection.id);
                          if (context.mounted) {
                            context.go(
                              AppRoutes.teacherClassDetail(classSection.id),
                            );
                          }
                        },
                        onAttendance: () async {
                          await controller.selectClass(classSection.id);
                          if (context.mounted) {
                            context.go(
                              AppRoutes.teacherAttendanceFor(classSection.id),
                            );
                          }
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    AppCard(
                      color: AppColors.primaryLight,
                      hasShadow: false,
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.18),
                      ),
                      child: Text(
                        'You can open only class sections returned by the teacher mobile API. Direct unassigned class routes are denied by the backend.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.primaryDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    AppCard(
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.teacherAccent.withValues(
                                alpha: 0.1,
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(
                              Icons.fact_check_rounded,
                              color: AppColors.teacherAccent,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Attendance roster',
                                  style: Theme.of(context).textTheme.titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  _rosterSummary(state),
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(color: AppColors.slate500),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: 'Open attendance',
                            onPressed: () =>
                                context.go(AppRoutes.teacherAttendance),
                            icon: const Icon(Icons.arrow_forward_rounded),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _TeacherClassTile extends StatelessWidget {
  const _TeacherClassTile({
    required this.classSection,
    required this.isSelected,
    required this.onOpen,
    required this.onAttendance,
  });

  final TeacherClassSection classSection;
  final bool isSelected;
  final VoidCallback onOpen;
  final VoidCallback onAttendance;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onOpen,
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppColors.teacherAccent.withValues(alpha: 0.12),
            foregroundColor: AppColors.teacherAccent,
            child: const Icon(Icons.school_rounded),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  classSection.name,
                  maxLines: 2,
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
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    StatusChip(
                      status: isSelected
                          ? AppStatusType.approved
                          : AppStatusType.draft,
                      label: isSelected ? 'Selected' : 'Assigned',
                    ),
                    StatusChip(
                      status: classSection.attendance?.isSubmitted == true
                          ? AppStatusType.completed
                          : AppStatusType.pending,
                      label: classSection.attendance?.isSubmitted == true
                          ? 'Submitted'
                          : classSection.attendance?.isLocked == true
                          ? 'Locked'
                          : 'To mark',
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          IconButton(
            tooltip: 'Take attendance',
            onPressed: onAttendance,
            icon: const Icon(Icons.fact_check_rounded),
          ),
        ],
      ),
    );
  }
}

class _TeacherClassesLoading extends StatelessWidget {
  const _TeacherClassesLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppSkeleton(width: double.infinity, height: 96),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 96),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 96),
        ],
      ),
    );
  }
}

String _rosterSummary(TeacherAttendanceState state) {
  final selectedClass = state.selectedClass;
  if (selectedClass == null) {
    return 'Select a class to open its attendance roster.';
  }
  if (state.entries.isEmpty) {
    return '${selectedClass.name} selected. Open attendance to load or review roster rows.';
  }
  return '${state.entries.length} student(s) loaded for ${selectedClass.name}.';
}
