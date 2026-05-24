import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/attendance_providers.dart';
import '../../domain/attendance_models.dart';
import '../widgets/attendance_status_helpers.dart';
import '../widgets/attendance_status_segment.dart';

class TeacherAttendanceScreen extends ConsumerWidget {
  const TeacherAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 2,
      title: 'Mark Attendance',
      body: state.isLoading
          ? const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  AppSkeleton(width: double.infinity, height: 96),
                  SizedBox(height: AppSpacing.md),
                  AppSkeleton(width: double.infinity, height: 420),
                ],
              ),
            )
          : state.entries.isEmpty
          ? AppErrorView(
              title: 'No attendance sheet',
              message:
                  state.message ??
                  'No students are assigned for this class today.',
              onRetry: controller.load,
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                120,
              ),
              children: [
                _TeacherAttendanceHeader(state: state, controller: controller),
                if (state.message != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _SyncBanner(state: state),
                ],
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Students'),
                const SizedBox(height: AppSpacing.sm),
                for (final entry in state.entries) ...[
                  _AttendanceStudentRow(
                    entry: entry,
                    onChanged: (status) =>
                        controller.markStudent(entry.studentId, status),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
              ],
            ),
      floatingActionButton: state.hasUnsavedChanges
          ? Padding(
              padding: const EdgeInsets.only(left: AppSpacing.xl),
              child: AppButton(
                label: state.isOffline
                    ? 'Save offline draft'
                    : 'Submit attendance',
                icon: state.isOffline
                    ? Icons.save_rounded
                    : Icons.cloud_done_rounded,
                onPressed: controller.submit,
              ),
            )
          : null,
    );
  }
}

class _TeacherAttendanceHeader extends StatelessWidget {
  const _TeacherAttendanceHeader({
    required this.state,
    required this.controller,
  });

  final TeacherAttendanceState state;
  final TeacherAttendanceController controller;

  @override
  Widget build(BuildContext context) {
    final selectedClass = state.selectedClass;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            initialValue: state.selectedClassId,
            decoration: const InputDecoration(labelText: 'Class / section'),
            items: [
              for (final item in state.classes)
                DropdownMenuItem(
                  value: item.id,
                  child: Text('${item.name} • ${item.subject}'),
                ),
            ],
            onChanged: (value) {
              if (value != null) {
                controller.selectClass(value);
              }
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  state.date == null
                      ? 'Today'
                      : DateFormat('EEE, MMM d').format(state.date!),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: state.date ?? DateTime.now(),
                    firstDate: DateTime(2024),
                    lastDate: DateTime.now().add(const Duration(days: 1)),
                  );
                  if (picked != null) {
                    await controller.selectDate(picked);
                  }
                },
                icon: const Icon(Icons.calendar_today_rounded),
                label: const Text('Change'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  selectedClass == null
                      ? 'Select a class to continue.'
                      : '${state.entries.length} students ready for marking.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.slate600),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              OutlinedButton.icon(
                onPressed: controller.bulkMarkPresent,
                icon: const Icon(Icons.done_all_rounded),
                label: const Text('All present'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SyncBanner extends StatelessWidget {
  const _SyncBanner({required this.state});

  final TeacherAttendanceState state;

  @override
  Widget build(BuildContext context) {
    final status = switch (state.syncStatus) {
      AttendanceSyncStatus.pending => AppStatusType.pending,
      AttendanceSyncStatus.synced => AppStatusType.approved,
      AttendanceSyncStatus.failed => AppStatusType.rejected,
    };

    return AppCard(
      color: state.isOffline
          ? AppColors.warningLight.withValues(alpha: 0.5)
          : AppColors.primaryLight.withValues(alpha: 0.55),
      hasShadow: false,
      child: Row(
        children: [
          StatusChip(status: status),
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Text(state.message!)),
        ],
      ),
    );
  }
}

class _AttendanceStudentRow extends StatelessWidget {
  const _AttendanceStudentRow({required this.entry, required this.onChanged});

  final AttendanceStudentEntry entry;
  final ValueChanged<AttendanceStatus> onChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: entry.status.color.withValues(alpha: 0.12),
                foregroundColor: entry.status.color,
                child: Text(entry.rollNumber),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.studentName,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Roll ${entry.rollNumber} • ${entry.status.label}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          AttendanceStatusSegment(value: entry.status, onChanged: onChanged),
        ],
      ),
    );
  }
}
