import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_access_state.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../widgets/teacher_app_widgets.dart';

class TeacherTimetableScreen extends ConsumerWidget {
  const TeacherTimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Timetable',
      body: RefreshIndicator(
        onRefresh: controller.load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text(
              'Timetable',
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: AppSpacing.md),
            AppCard(
              color: AppColors.primaryLight,
              hasShadow: false,
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.18),
              ),
              child: Text(
                'Today is shown from the confirmed teacher attendance/today endpoint. Weekly timetable and substitutions need a purpose-limited teacher mobile timetable DTO.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.primaryDark,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            if (state.isLoading)
              const AppSkeleton(width: double.infinity, height: 280)
            else if (state.error != null)
              AppExceptionView(error: state.error!, onRetry: controller.load)
            else if (state.todayPeriods.isEmpty)
              const AppEmptyState(
                title: 'No periods today',
                message: 'No assigned periods are published for today.',
                icon: Icons.event_busy_rounded,
              )
            else
              for (final period in state.todayPeriods) ...[
                TeacherTaskCard(
                  title: period.className,
                  subtitle:
                      '${period.startsAt} - ${period.endsAt} • ${period.subjectName}',
                  icon: Icons.event_note_rounded,
                  iconColor: AppColors.primary,
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            const SizedBox(height: AppSpacing.lg),
            const AppAccessState(
              title: 'Substitution alerts unavailable',
              message:
                  'Substitution and weekly timetable data require mobile DTO confirmation before this app can display them.',
              icon: Icons.swap_calls_rounded,
            ),
          ],
        ),
      ),
    );
  }
}
