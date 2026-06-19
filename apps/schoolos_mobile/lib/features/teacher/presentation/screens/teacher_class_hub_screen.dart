import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../attendance/application/attendance_providers.dart';
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
