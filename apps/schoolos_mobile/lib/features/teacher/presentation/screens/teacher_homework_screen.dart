import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_access_state.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../../../teacher/presentation/widgets/teacher_app_widgets.dart';

class TeacherHomeworkScreen extends ConsumerWidget {
  const TeacherHomeworkScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendance = ref.watch(teacherAttendanceControllerProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 2,
      title: 'Homework',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Homework',
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            hasShadow: false,
            color: AppColors.primaryLight,
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.18),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_clock_rounded, color: AppColors.primary),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'Create, draft, publish, and review actions are disabled until a compact /mobile/teacher/homework contract is confirmed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: TeacherTaskCard(
                  title: 'Assigned classes',
                  subtitle: 'Safe source: teacher attendance API',
                  icon: Icons.school_rounded,
                  iconColor: AppColors.success,
                  value: '${attendance.classes.length}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              const Expanded(
                child: TeacherTaskCard(
                  title: 'To review',
                  subtitle: 'Needs mobile DTO',
                  icon: Icons.rate_review_rounded,
                  iconColor: AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          const AppAccessState(
            title: 'Homework mobile API not confirmed',
            message:
                'The backend currently exposes the broader homework controller. This app will not show or mutate homework until a purpose-limited teacher-mobile DTO is added and verified.',
            icon: Icons.assignment_late_outlined,
          ),
        ],
      ),
    );
  }
}
