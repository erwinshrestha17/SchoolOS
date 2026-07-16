import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/bs_date_picker.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
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
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: AppSpacing.md),
                  Text('Loading assigned classes and roster…'),
                ],
              ),
            )
          : state.error != null
          ? AppExceptionView(error: state.error!, onRetry: controller.load)
          : state.entries.isEmpty
          ? RefreshIndicator(
              onRefresh: controller.load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  120,
                ),
                children: [
                  if (state.classes.isNotEmpty) ...[
                    _TeacherAttendanceHeader(
                      state: state,
                      controller: controller,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  AppEmptyState(
                    title: state.classes.isEmpty
                        ? 'No assigned attendance classes'
                        : 'No students in this roster',
                    message: state.classes.isEmpty
                        ? 'Classes assigned to you for the current school year will appear here.'
                        : 'No active students are assigned to this class today.',
                    icon: state.classes.isEmpty
                        ? Icons.school_outlined
                        : Icons.group_off_rounded,
                    actionLabel: 'Retry',
                    onActionPressed: controller.load,
                  ),
                ],
              ),
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
                      isReadOnly: state.isEditingLocked || state.isSubmitting,
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
                    : state.syncStatus == AttendanceSyncStatus.serverChecking
                    ? 'Check sync again'
                    : 'Submit attendance',
                icon: _submitActionIcon(state),
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
    if (state.isOffline || state.isReceiptPending) {
      await controller.submit();
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit attendance?'),
        content: _AttendanceSubmitSummary(state: state),
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

class _AttendanceSubmitSummary extends StatelessWidget {
  const _AttendanceSubmitSummary({required this.state});

  final TeacherAttendanceState state;

  @override
  Widget build(BuildContext context) {
    final exceptions = state.entries
        .where((entry) => entry.status != AttendanceStatus.present)
        .length;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Submit ${state.entries.length} student record(s) for ${state.selectedClass?.name ?? 'this class'}.',
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            StatusChip(
              status: state.changedCount == 0
                  ? AppStatusType.synced
                  : AppStatusType.draft,
              label: '${state.changedCount} changed',
            ),
            StatusChip(
              status: exceptions == 0
                  ? AppStatusType.present
                  : AppStatusType.pending,
              label: '$exceptions exception(s)',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'SchoolOS will use the saved mobile submission key so a retry does not create a duplicate register.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: AppColors.slate600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'After the server accepts this attendance, the register becomes read-only on mobile.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: AppColors.slate600),
        ),
      ],
    );
  }
}

Future<bool> _confirmDiscardUnsaved(BuildContext context, String action) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Discard unsaved attendance?'),
      content: Text(
        'You have attendance changes that have not been submitted yet. '
        'If you $action now, those changes will be lost.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Keep editing'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Discard'),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

IconData _submitActionIcon(TeacherAttendanceState state) {
  if (state.isOffline) return Icons.save_rounded;
  return switch (state.syncStatus) {
    AttendanceSyncStatus.failed => Icons.sync_problem_rounded,
    AttendanceSyncStatus.queued => Icons.cloud_sync_rounded,
    AttendanceSyncStatus.syncing => Icons.cloud_sync_rounded,
    AttendanceSyncStatus.serverChecking => Icons.manage_search_rounded,
    _ => Icons.cloud_done_rounded,
  };
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
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Class / section'),
            items: [
              for (final item in state.classes)
                DropdownMenuItem(
                  value: item.id,
                  child: Text('${item.name} • ${item.subject}'),
                ),
            ],
            onChanged: (value) async {
              if (value == null || value == state.selectedClassId) return;
              if (state.hasUnsavedChanges &&
                  !await _confirmDiscardUnsaved(context, 'switch classes')) {
                return;
              }
              controller.selectClass(value);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  state.date == null
                      ? 'Today'
                      : NepaliBsCalendar.formatBsDate(state.date!, long: true),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () async {
                  final picked = await showSchoolBsDatePicker(
                    context: context,
                    initialDate: state.date ?? DateTime.now(),
                    firstDate: DateTime(2024),
                    lastDate: DateTime.now(),
                  );
                  if (picked == null || !context.mounted) return;
                  if (state.hasUnsavedChanges &&
                      !await _confirmDiscardUnsaved(
                        context,
                        'change the date',
                      )) {
                    return;
                  }
                  await controller.selectDate(picked);
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
              SizedBox(
                width: 148,
                child: OutlinedButton.icon(
                  onPressed: state.isEditingLocked
                      ? null
                      : controller.bulkMarkPresent,
                  icon: const Icon(Icons.done_all_rounded),
                  label: const Text('All present'),
                ),
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
    final status = _statusType(state.syncStatus);
    final color = switch (state.syncStatus) {
      AttendanceSyncStatus.failed ||
      AttendanceSyncStatus.conflict => AppColors.dangerLight,
      AttendanceSyncStatus.queued ||
      AttendanceSyncStatus.syncing ||
      AttendanceSyncStatus.serverChecking => AppColors.warningLight,
      AttendanceSyncStatus.synced => AppColors.successLight,
      AttendanceSyncStatus.draft => AppColors.slate100,
    };
    final canRetry =
        state.hasUnsavedChanges &&
        !state.isSubmitting &&
        !state.isOffline &&
        (state.syncStatus == AttendanceSyncStatus.failed ||
            state.syncStatus == AttendanceSyncStatus.queued ||
            state.syncStatus == AttendanceSyncStatus.serverChecking);

    return AppCard(
      color: color.withValues(alpha: 0.58),
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(_statusIcon(state.syncStatus), color: AppColors.slate700),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        StatusChip(status: status),
                        Text(
                          _statusTitle(state),
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(state.message!),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _statusNextStep(state),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate600,
                      ),
                    ),
                    if (state.lastUpdated != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Last updated ${NepaliBsCalendar.formatNepalTime(state.lastUpdated!)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (canRetry ||
              (state.draftClientSubmissionId != null &&
                  !state.isSubmitting)) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                if (canRetry)
                  OutlinedButton.icon(
                    onPressed: controller.submit,
                    icon: const Icon(Icons.cloud_sync_rounded),
                    label: const Text('Retry sync'),
                  ),
                if (state.draftClientSubmissionId != null &&
                    !state.isSubmitting &&
                    !state.isReceiptPending)
                  TextButton.icon(
                    onPressed: controller.discardDraft,
                    icon: const Icon(Icons.delete_outline_rounded),
                    label: const Text('Discard draft'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

AppStatusType _statusType(AttendanceSyncStatus status) {
  return switch (status) {
    AttendanceSyncStatus.draft => AppStatusType.draft,
    AttendanceSyncStatus.queued => AppStatusType.queued,
    AttendanceSyncStatus.syncing => AppStatusType.syncing,
    AttendanceSyncStatus.serverChecking => AppStatusType.syncing,
    AttendanceSyncStatus.synced => AppStatusType.synced,
    AttendanceSyncStatus.failed => AppStatusType.failed,
    AttendanceSyncStatus.conflict => AppStatusType.failed,
  };
}

IconData _statusIcon(AttendanceSyncStatus status) {
  return switch (status) {
    AttendanceSyncStatus.draft => Icons.edit_note_rounded,
    AttendanceSyncStatus.queued => Icons.cloud_queue_rounded,
    AttendanceSyncStatus.syncing => Icons.cloud_sync_rounded,
    AttendanceSyncStatus.serverChecking => Icons.manage_search_rounded,
    AttendanceSyncStatus.synced => Icons.verified_rounded,
    AttendanceSyncStatus.failed => Icons.sync_problem_rounded,
    AttendanceSyncStatus.conflict => Icons.report_problem_outlined,
  };
}

String _statusTitle(TeacherAttendanceState state) {
  if (state.attendance.hasConflict ||
      state.syncStatus == AttendanceSyncStatus.conflict) {
    return 'Needs office review';
  }
  if (!state.isWorkingDay) return 'Not a working day';
  if (state.attendance.isLocked) return 'Attendance locked';
  if (state.attendance.isSubmitted) return 'Attendance submitted';
  if (state.draftReceiptState == AttendanceDraftReceiptState.rejected) {
    return 'Attendance not accepted';
  }
  return switch (state.syncStatus) {
    AttendanceSyncStatus.draft => 'Draft not submitted',
    AttendanceSyncStatus.queued => 'Saved on this phone',
    AttendanceSyncStatus.syncing => 'Syncing with SchoolOS',
    AttendanceSyncStatus.serverChecking => 'Checking server receipt',
    AttendanceSyncStatus.synced => 'Synced with SchoolOS',
    AttendanceSyncStatus.failed => 'Sync failed',
    AttendanceSyncStatus.conflict => 'Needs office review',
  };
}

String _statusNextStep(TeacherAttendanceState state) {
  if (state.attendance.hasConflict ||
      state.syncStatus == AttendanceSyncStatus.conflict) {
    return 'Ask the office to review the conflict before changing this register.';
  }
  if (!state.isWorkingDay) {
    return 'No mobile attendance action is available for this calendar day.';
  }
  if (state.attendance.isLocked) {
    return 'Use the school correction process if this date needs changes.';
  }
  if (state.attendance.isSubmitted) {
    return 'No further mobile action is needed for this class and date.';
  }
  if (state.draftReceiptState == AttendanceDraftReceiptState.rejected) {
    return 'Review and change the draft to create a new submission, or discard it if no longer needed.';
  }
  if (state.isOffline) {
    return 'Reconnect before official sync. Do not mark the same class on another device.';
  }
  return switch (state.syncStatus) {
    AttendanceSyncStatus.draft =>
      'Review exceptions, then submit attendance from this phone.',
    AttendanceSyncStatus.queued =>
      'Internet is available. Retry sync to send the saved draft.',
    AttendanceSyncStatus.syncing =>
      'Keep this screen open until SchoolOS confirms the result.',
    AttendanceSyncStatus.serverChecking =>
      'Keep this draft. Check the server roster before trying the sync again.',
    AttendanceSyncStatus.synced =>
      'SchoolOS has the latest attendance state for this screen.',
    AttendanceSyncStatus.failed =>
      'The draft remains on this device. Retry sync when the connection is stable.',
    AttendanceSyncStatus.conflict =>
      'Ask the office to review the conflict before changing this register.',
  };
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
