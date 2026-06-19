import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/attendance_providers.dart';
import '../../domain/attendance_models.dart';
import '../widgets/attendance_status_helpers.dart';
import '../widgets/attendance_status_segment.dart';

class TeacherAttendanceScreen extends ConsumerStatefulWidget {
  const TeacherAttendanceScreen({super.key, this.classSectionId});

  final String? classSectionId;

  @override
  ConsumerState<TeacherAttendanceScreen> createState() =>
      _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState
    extends ConsumerState<TeacherAttendanceScreen> {
  String _studentSearch = '';

  @override
  void initState() {
    super.initState();
    if (widget.classSectionId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref
            .read(teacherAttendanceControllerProvider.notifier)
            .load(requestedClassSectionId: widget.classSectionId);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);
    final filteredEntries = state.entries.where((entry) {
      final query = _studentSearch.trim().toLowerCase();
      if (query.isEmpty) return true;
      return entry.studentName.toLowerCase().contains(query) ||
          entry.rollNumber.toLowerCase().contains(query);
    }).toList();

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 1,
      title: 'Attendance',
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
          : state.error != null
          ? AppExceptionView(error: state.error!, onRetry: controller.load)
          : state.entries.isEmpty
          ? AppEmptyState(
              title: 'No students in this roster',
              message: 'No active students are assigned to this class today.',
              icon: Icons.group_off_rounded,
              actionLabel: 'Retry',
              onActionPressed: controller.load,
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
                const SizedBox(height: AppSpacing.md),
                AppCard(
                  color: AppColors.primaryLight,
                  hasShadow: false,
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.18),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.verified_user_outlined,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          'You can take attendance only for your assigned class.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: AppColors.primaryDark,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _AttendanceSummary(state: state),
                if (state.message != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _SyncBanner(state: state, controller: controller),
                ],
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Students'),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded),
                    hintText: 'Search students',
                  ),
                  onChanged: (value) => setState(() => _studentSearch = value),
                ),
                const SizedBox(height: AppSpacing.md),
                if (filteredEntries.isEmpty)
                  AppEmptyState(
                    title: 'No matching students',
                    message: 'Try another student name or roll number.',
                    icon: Icons.search_off_rounded,
                  )
                else
                  for (final entry in filteredEntries) ...[
                    _AttendanceStudentRow(
                      entry: entry,
                      isReadOnly: state.isReadOnly || state.isSubmitting,
                      onChanged: (status) =>
                          controller.markStudent(entry.studentId, status),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
              ],
            ),
      floatingActionButton: state.hasUnsavedChanges && !state.isReadOnly
          ? Padding(
              padding: const EdgeInsets.only(left: AppSpacing.xl),
              child: AppButton(
                label: state.isSubmitting
                    ? 'Syncing attendance'
                    : state.isOffline
                    ? 'Queue draft'
                    : state.syncStatus == AttendanceSyncStatus.failed
                    ? 'Retry sync'
                    : state.syncStatus == AttendanceSyncStatus.queued
                    ? 'Retry sync'
                    : 'Submit attendance',
                icon: state.isOffline
                    ? Icons.save_rounded
                    : Icons.cloud_done_rounded,
                onPressed: state.isSubmitting
                    ? null
                    : () => _confirmSubmit(context, controller, state),
              ),
            )
          : null,
    );
  }

  Future<void> _confirmSubmit(
    BuildContext context,
    TeacherAttendanceController controller,
    TeacherAttendanceState state,
  ) async {
    if (state.isOffline) {
      await controller.submit();
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit attendance?'),
        content: Text(
          'Submit ${state.entries.length} student record(s) for ${state.selectedClass?.name ?? 'this class'}? This register becomes read-only after submission.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Review'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (confirmed == true) await controller.submit();
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
                    lastDate: DateTime.now(),
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
                onPressed: state.isReadOnly ? null : controller.bulkMarkPresent,
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
  const _SyncBanner({required this.state, required this.controller});

  final TeacherAttendanceState state;
  final TeacherAttendanceController controller;

  @override
  Widget build(BuildContext context) {
    final status = switch (state.syncStatus) {
      AttendanceSyncStatus.draft => AppStatusType.draft,
      AttendanceSyncStatus.queued => AppStatusType.pending,
      AttendanceSyncStatus.syncing => AppStatusType.pending,
      AttendanceSyncStatus.synced => AppStatusType.approved,
      AttendanceSyncStatus.failed => AppStatusType.rejected,
      AttendanceSyncStatus.conflict => AppStatusType.rejected,
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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.message!),
                if (state.isOffline && state.lastUpdated != null)
                  Text(
                    'Last updated ${TimeOfDay.fromDateTime(state.lastUpdated!.toLocal()).format(context)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          if (state.draftClientSubmissionId != null && !state.isSubmitting)
            TextButton(
              onPressed: controller.discardDraft,
              child: const Text('Discard'),
            ),
        ],
      ),
    );
  }
}

class _AttendanceStudentRow extends StatelessWidget {
  const _AttendanceStudentRow({
    required this.entry,
    required this.onChanged,
    required this.isReadOnly,
  });

  final AttendanceStudentEntry entry;
  final ValueChanged<AttendanceStatus> onChanged;
  final bool isReadOnly;

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
          AbsorbPointer(
            absorbing: isReadOnly,
            child: Opacity(
              opacity: isReadOnly ? 0.7 : 1,
              child: AttendanceStatusSegment(
                value: entry.status,
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceSummary extends StatelessWidget {
  const _AttendanceSummary({required this.state});

  final TeacherAttendanceState state;

  @override
  Widget build(BuildContext context) {
    final counts = {
      for (final status in const [
        AttendanceStatus.present,
        AttendanceStatus.absent,
        AttendanceStatus.late,
        AttendanceStatus.leave,
      ])
        status: state.entries.where((entry) => entry.status == status).length,
    };
    final label = state.attendance.hasConflict
        ? 'Conflict review required'
        : state.attendance.isLocked
        ? 'Locked - read only'
        : state.attendance.isSubmitted
        ? 'Submitted - read only'
        : '${state.changedCount} student(s) changed';

    return AppCard(
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final status in counts.keys)
                StatusChip(
                  status: switch (status) {
                    AttendanceStatus.present => AppStatusType.present,
                    AttendanceStatus.absent => AppStatusType.absent,
                    AttendanceStatus.late => AppStatusType.late,
                    AttendanceStatus.leave => AppStatusType.approved,
                    _ => AppStatusType.draft,
                  },
                  label: '${status.label}: ${counts[status]}',
                ),
            ],
          ),
        ],
      ),
    );
  }
}
