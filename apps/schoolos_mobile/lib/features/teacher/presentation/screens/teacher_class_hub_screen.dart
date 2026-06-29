import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../../../attendance/domain/attendance_models.dart';
import '../../../teacher/presentation/widgets/teacher_app_widgets.dart';

class TeacherClassHubScreen extends ConsumerStatefulWidget {
  const TeacherClassHubScreen({super.key, required this.classSectionId});

  final String classSectionId;

  @override
  ConsumerState<TeacherClassHubScreen> createState() =>
      _TeacherClassHubScreenState();
}

class _TeacherClassHubScreenState extends ConsumerState<TeacherClassHubScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(teacherAttendanceControllerProvider.notifier)
          .load(requestedClassSectionId: widget.classSectionId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);
    final selected = state.selectedClass;

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Class Hub',
      body: RefreshIndicator(
        onRefresh: () =>
            controller.load(requestedClassSectionId: widget.classSectionId),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            if (state.isLoading)
              const AppSkeleton(width: double.infinity, height: 280)
            else if (state.error != null)
              AppExceptionView(
                error: state.error!,
                onRetry: () => controller.load(
                  requestedClassSectionId: widget.classSectionId,
                ),
              )
            else if (selected == null)
              AppEmptyState(
                title: 'Class not available',
                message:
                    'This class is not assigned to you or is no longer available.',
                icon: Icons.lock_outline_rounded,
                actionLabel: 'Back to classes',
                onActionPressed: () => context.go(AppRoutes.teacherClasses),
              )
            else ...[
              Text(
                selected.name,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                selected.subject,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: AppColors.slate500),
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                children: [
                  Expanded(
                    child: TeacherTaskCard(
                      title: 'Students',
                      subtitle: 'Roster returned by teacher mobile API',
                      icon: Icons.groups_rounded,
                      iconColor: AppColors.info,
                      value: '${state.entries.length}',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: TeacherTaskCard(
                      title: 'Attendance',
                      subtitle: state.attendance.isSubmitted
                          ? 'Submitted'
                          : state.attendance.isLocked
                          ? 'Locked'
                          : 'Ready to mark',
                      icon: Icons.fact_check_rounded,
                      iconColor: state.attendance.isSubmitted
                          ? AppColors.success
                          : AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              TeacherTaskCard(
                title: 'Take attendance',
                subtitle: 'Open the scoped attendance register for this class.',
                icon: Icons.how_to_reg_rounded,
                iconColor: AppColors.primary,
                status: StatusChip(
                  status: state.attendance.isSubmitted
                      ? AppStatusType.completed
                      : AppStatusType.pending,
                  label: state.attendance.isSubmitted ? 'Submitted' : 'To mark',
                ),
                onTap: () => context.go(
                  AppRoutes.teacherAttendanceFor(widget.classSectionId),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TeacherTaskCard(
                title: 'Homework',
                subtitle:
                    'Mobile teacher homework needs a purpose-limited backend DTO before class actions are enabled.',
                icon: Icons.menu_book_rounded,
                iconColor: AppColors.teacherAccent,
                onTap: () => context.go(AppRoutes.teacherHomework),
              ),
              const SizedBox(height: AppSpacing.md),
              TeacherTaskCard(
                title: 'Messages',
                subtitle: 'Open scoped parent-teacher threads.',
                icon: Icons.chat_bubble_rounded,
                iconColor: AppColors.info,
                onTap: () => context.go(AppRoutes.teacherMessages),
              ),
              const SizedBox(height: AppSpacing.xl),
              const SectionHeader(title: 'Student summaries'),
              const SizedBox(height: AppSpacing.sm),
              AppCard(
                child: Column(
                  children: [
                    for (final entry in state.entries.take(5)) ...[
                      _StudentSummaryRow(
                        entry: entry,
                        onTap: () =>
                            _showStudentSummary(context, ref, selected, entry),
                      ),
                      if (entry != state.entries.take(5).last) const Divider(),
                    ],
                    if (state.entries.length > 5) ...[
                      const Divider(),
                      Text(
                        '${state.entries.length - 5} more student(s) available in attendance.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              if (state.lastUpdated != null)
                TeacherLastUpdatedLabel(
                  value: state.lastUpdated!,
                  cached: state.isOffline,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StudentSummaryRow extends StatelessWidget {
  const _StudentSummaryRow({required this.entry, required this.onTap});

  final AttendanceStudentEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: AppColors.info.withValues(alpha: 0.12),
        foregroundColor: AppColors.info,
        child: Text(entry.rollNumber),
      ),
      title: Text(
        entry.studentName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text('Roll ${entry.rollNumber}'),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}

Future<void> _showStudentSummary(
  BuildContext context,
  WidgetRef ref,
  TeacherClassSection classSection,
  AttendanceStudentEntry entry,
) {
  final future = ref
      .read(attendanceRepositoryProvider)
      .getTeacherStudentSummary(classSection, entry.studentId);

  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            0,
            AppSpacing.lg,
            AppSpacing.xl,
          ),
          child: FutureBuilder<TeacherStudentSummary>(
            future: future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const SizedBox(
                  height: 180,
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return const AppCard(
                  child: Text('Student summary is unavailable.'),
                );
              }

              final summary = snapshot.data!;
              final attendance = summary.attendance;
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    summary.student.name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    [
                      summary.student.className,
                      if (summary.student.sectionName != null)
                        summary.student.sectionName!,
                      if (summary.student.rollNumber != null)
                        'Roll ${summary.student.rollNumber}',
                    ].join(' • '),
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryMetric(
                          label: 'Present',
                          value: '${attendance.present}',
                          color: AppColors.success,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _SummaryMetric(
                          label: 'Absent',
                          value: '${attendance.absent}',
                          color: AppColors.danger,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _SummaryMetric(
                          label: 'Late',
                          value: '${attendance.late}',
                          color: AppColors.warning,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppCard(
                    hasShadow: false,
                    color: AppColors.slate50,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Recent register window',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        StatusChip(
                          status: _studentSummaryStatus(attendance.lastStatus),
                          label: _studentStatusLabel(attendance.lastStatus),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      );
    },
  );
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      color: color.withValues(alpha: 0.08),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

AppStatusType _studentSummaryStatus(String? status) {
  return switch (status) {
    'ABSENT' => AppStatusType.absent,
    'LATE' => AppStatusType.late,
    'LEAVE' ||
    'SICK_LEAVE' ||
    'EXCUSED_LEAVE' ||
    'UNEXCUSED_LEAVE' => AppStatusType.pending,
    'PRESENT' => AppStatusType.present,
    _ => AppStatusType.pending,
  };
}

String _studentStatusLabel(String? status) {
  if (status == null || status.trim().isEmpty) {
    return 'No record';
  }
  return status
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}
