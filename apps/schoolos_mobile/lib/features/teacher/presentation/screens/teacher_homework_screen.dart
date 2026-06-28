import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/bs_date_picker.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/teacher_providers.dart';
import '../../domain/teacher_models.dart';
import '../widgets/teacher_app_widgets.dart';

class TeacherHomeworkScreen extends ConsumerStatefulWidget {
  const TeacherHomeworkScreen({super.key});

  @override
  ConsumerState<TeacherHomeworkScreen> createState() =>
      _TeacherHomeworkScreenState();
}

class _TeacherHomeworkScreenState extends ConsumerState<TeacherHomeworkScreen> {
  String? _status;

  @override
  Widget build(BuildContext context) {
    final provider = teacherHomeworkProvider(_status);
    final homework = ref.watch(provider);
    final scopes =
        homework.valueOrNull?.scopes ?? const <TeacherHomeworkScope>[];

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 2,
      title: 'Homework',
      floatingActionButton: scopes.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _showCreateSheet(scopes),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Create'),
            ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(provider.future),
        child: homework.when(
          loading: () => const _HomeworkLoading(),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (snapshot) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              112,
            ),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Homework',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Refresh homework',
                    onPressed: () => ref.invalidate(provider),
                    icon: const Icon(Icons.refresh_rounded),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _FilterChip(
                    label: 'All',
                    selected: _status == null,
                    onSelected: () => setState(() => _status = null),
                  ),
                  for (final status in const ['DRAFT', 'ASSIGNED', 'CLOSED'])
                    _FilterChip(
                      label: _statusLabel(status),
                      selected: _status == status,
                      onSelected: () => setState(() => _status = status),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: TeacherTaskCard(
                      title: 'Assignments',
                      subtitle: 'Assigned to your classes',
                      icon: Icons.school_rounded,
                      iconColor: AppColors.success,
                      value: '${snapshot.total}',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: TeacherTaskCard(
                      title: 'To review',
                      subtitle: 'Submitted work',
                      icon: Icons.rate_review_rounded,
                      iconColor: AppColors.warning,
                      value: '${snapshot.toReview}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              if (snapshot.scopes.isEmpty)
                const AppEmptyState(
                  title: 'No assigned teaching scope',
                  message:
                      'Homework becomes available after a class, section, and subject are assigned to you.',
                  icon: Icons.school_outlined,
                )
              else if (snapshot.items.isEmpty)
                AppEmptyState(
                  title: _status == null
                      ? 'No homework yet'
                      : 'No ${_statusLabel(_status!).toLowerCase()} homework',
                  message: _status == null
                      ? 'Create a draft for one of your assigned classes.'
                      : 'Choose another filter or create a new draft.',
                  icon: Icons.assignment_outlined,
                  actionLabel: 'Create homework',
                  onActionPressed: () => _showCreateSheet(snapshot.scopes),
                )
              else
                for (final item in snapshot.items) ...[
                  _HomeworkCard(
                    item: item,
                    onEdit: item.status == 'DRAFT'
                        ? () => _showEditSheet(item)
                        : null,
                    onPublish: item.status == 'DRAFT'
                        ? () => _publish(item)
                        : null,
                    onReview: item.submissions.toReview > 0
                        ? () => _showSubmissions(item)
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
              TeacherLastUpdatedLabel(
                value: snapshot.lastUpdated,
                cached: snapshot.fromCache,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _publish(TeacherHomeworkItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Publish homework?'),
        content: Text(
          'Publish “${item.title}” to ${item.classLabel}? Students and parents may see it immediately.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Publish'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(teacherRepositoryProvider).publishHomework(item.id);
      ref.invalidate(teacherHomeworkProvider);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Homework published.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Homework could not be published. Please retry.'),
          ),
        );
      }
    }
  }

  Future<void> _showCreateSheet(List<TeacherHomeworkScope> scopes) async {
    final title = TextEditingController();
    final instructions = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var selectedScope = scopes.first;
    var dueDate = DateTime.now().add(const Duration(days: 1));
    var submissionRequired = true;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Create homework draft',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  DropdownButtonFormField<TeacherHomeworkScope>(
                    initialValue: selectedScope,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Class and subject',
                    ),
                    items: [
                      for (final scope in scopes)
                        DropdownMenuItem(
                          value: scope,
                          child: Text(
                            scope.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: saving
                        ? null
                        : (value) {
                            if (value != null) {
                              setSheetState(() => selectedScope = value);
                            }
                          },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: title,
                    enabled: !saving,
                    maxLength: 160,
                    decoration: const InputDecoration(labelText: 'Title'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter a homework title.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: instructions,
                    enabled: !saving,
                    minLines: 3,
                    maxLines: 6,
                    maxLength: 5000,
                    decoration: const InputDecoration(
                      labelText: 'Instructions',
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter homework instructions.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_rounded),
                    title: const Text('Due date'),
                    subtitle: Text(NepaliBsCalendar.formatBsDate(dueDate)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: saving
                        ? null
                        : () async {
                            final picked = await showSchoolBsDatePicker(
                              context: context,
                              initialDate: dueDate,
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                            );
                            if (picked != null) {
                              setSheetState(() => dueDate = picked);
                            }
                          },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Student submission required'),
                    value: submissionRequired,
                    onChanged: saving
                        ? null
                        : (value) =>
                              setSheetState(() => submissionRequired = value),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              if (!formKey.currentState!.validate()) return;
                              setSheetState(() => saving = true);
                              try {
                                await ref
                                    .read(teacherRepositoryProvider)
                                    .createHomework(
                                      scope: selectedScope,
                                      title: title.text,
                                      instructions: instructions.text,
                                      dueDate: dueDate,
                                      submissionRequired: submissionRequired,
                                    );
                                ref.invalidate(teacherHomeworkProvider);
                                if (sheetContext.mounted) {
                                  Navigator.pop(sheetContext);
                                }
                                if (mounted) {
                                  ScaffoldMessenger.of(
                                    this.context,
                                  ).showSnackBar(
                                    const SnackBar(
                                      content: Text('Homework draft created.'),
                                    ),
                                  );
                                }
                              } catch (_) {
                                setSheetState(() => saving = false);
                                if (sheetContext.mounted) {
                                  ScaffoldMessenger.of(
                                    sheetContext,
                                  ).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Draft could not be created. Please retry.',
                                      ),
                                    ),
                                  );
                                }
                              }
                            },
                      icon: saving
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(saving ? 'Saving' : 'Save draft'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    title.dispose();
    instructions.dispose();
  }

  Future<void> _showEditSheet(TeacherHomeworkItem item) async {
    final title = TextEditingController(text: item.title);
    final instructions = TextEditingController(text: item.instructions);
    final formKey = GlobalKey<FormState>();
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    var dueDate = item.dueDate != null && item.dueDate!.isAfter(DateTime.now())
        ? item.dueDate!
        : tomorrow;
    var submissionRequired = item.submissionRequired;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Edit homework draft',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    item.classLabel,
                    style: const TextStyle(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    controller: title,
                    enabled: !saving,
                    maxLength: 160,
                    decoration: const InputDecoration(labelText: 'Title'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter a homework title.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: instructions,
                    enabled: !saving,
                    minLines: 3,
                    maxLines: 6,
                    maxLength: 5000,
                    decoration: const InputDecoration(
                      labelText: 'Instructions',
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter homework instructions.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_rounded),
                    title: const Text('Due date'),
                    subtitle: Text(NepaliBsCalendar.formatBsDate(dueDate)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: saving
                        ? null
                        : () async {
                            final picked = await showSchoolBsDatePicker(
                              context: context,
                              initialDate: dueDate,
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                            );
                            if (picked != null) {
                              setSheetState(() => dueDate = picked);
                            }
                          },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Student submission required'),
                    value: submissionRequired,
                    onChanged: saving
                        ? null
                        : (value) =>
                              setSheetState(() => submissionRequired = value),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              if (!formKey.currentState!.validate()) return;
                              setSheetState(() => saving = true);
                              try {
                                await ref
                                    .read(teacherRepositoryProvider)
                                    .updateHomeworkDraft(
                                      homeworkId: item.id,
                                      title: title.text,
                                      instructions: instructions.text,
                                      dueDate: dueDate,
                                      submissionRequired: submissionRequired,
                                    );
                                ref.invalidate(teacherHomeworkProvider);
                                if (sheetContext.mounted) {
                                  Navigator.pop(sheetContext);
                                }
                                if (mounted) {
                                  ScaffoldMessenger.of(
                                    this.context,
                                  ).showSnackBar(
                                    const SnackBar(
                                      content: Text('Homework draft updated.'),
                                    ),
                                  );
                                }
                              } catch (_) {
                                setSheetState(() => saving = false);
                                if (sheetContext.mounted) {
                                  ScaffoldMessenger.of(
                                    sheetContext,
                                  ).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Draft could not be updated. Please retry.',
                                      ),
                                    ),
                                  );
                                }
                              }
                            },
                      icon: saving
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(saving ? 'Saving' : 'Save changes'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    title.dispose();
    instructions.dispose();
  }

  Future<void> _showSubmissions(TeacherHomeworkItem item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _SubmissionsSheet(homework: item),
    );
    ref.invalidate(teacherHomeworkProvider);
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({
    required this.item,
    this.onEdit,
    this.onPublish,
    this.onReview,
  });

  final TeacherHomeworkItem item;
  final VoidCallback? onEdit;
  final VoidCallback? onPublish;
  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusChip(
                status: _statusType(item.status),
                label: _statusLabel(item.status),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            item.classLabel,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (item.instructions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              item.instructions,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            children: [
              _Meta(
                icon: Icons.event_rounded,
                label: item.dueDate == null
                    ? 'No due date'
                    : 'Due ${NepaliBsCalendar.formatBsDate(item.dueDate!)}',
              ),
              _Meta(
                icon: Icons.upload_file_rounded,
                label: '${item.submissions.submitted} submitted',
              ),
              if (item.submissions.toReview > 0)
                _Meta(
                  icon: Icons.rate_review_rounded,
                  label: '${item.submissions.toReview} to review',
                ),
            ],
          ),
          if (onEdit != null || onPublish != null || onReview != null) ...[
            const Divider(height: AppSpacing.xl),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                if (onEdit != null)
                  OutlinedButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit'),
                  ),
                if (onReview != null)
                  OutlinedButton.icon(
                    onPressed: onReview,
                    icon: const Icon(Icons.rate_review_outlined),
                    label: const Text('Review'),
                  ),
                if (onPublish != null)
                  FilledButton.icon(
                    onPressed: onPublish,
                    icon: const Icon(Icons.publish_rounded),
                    label: const Text('Publish'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.slate500),
        const SizedBox(width: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _SubmissionsSheet extends ConsumerWidget {
  const _SubmissionsSheet({required this.homework});
  final TeacherHomeworkItem homework;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = teacherHomeworkSubmissionsProvider(homework.id);
    final submissions = ref.watch(provider);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, controller) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          0,
        ),
        child: submissions.when(
          loading: () => const _HomeworkLoading(),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (items) => ListView(
            controller: controller,
            children: [
              Text(
                homework.title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text('${items.length} student submissions'),
              const SizedBox(height: AppSpacing.lg),
              if (items.isEmpty)
                const AppEmptyState(
                  title: 'No submissions yet',
                  message: 'Submitted student work will appear here.',
                  icon: Icons.upload_file_outlined,
                )
              else
                for (final item in items) ...[
                  AppCard(
                    child: Row(
                      children: [
                        const CircleAvatar(
                          child: Icon(Icons.person_outline_rounded),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.studentName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                'Roll ${item.rollNumber} • ${_statusLabel(item.status)}',
                              ),
                            ],
                          ),
                        ),
                        if (item.status == 'SUBMITTED' || item.status == 'LATE')
                          IconButton.filledTonal(
                            tooltip: 'Review submission',
                            onPressed: () => _review(context, ref, item),
                            icon: const Icon(Icons.rate_review_rounded),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _review(
    BuildContext context,
    WidgetRef ref,
    TeacherHomeworkSubmission submission,
  ) async {
    final remarks = TextEditingController();
    final status = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Review ${submission.studentName}'),
        content: TextField(
          controller: remarks,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Feedback or correction reason',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          OutlinedButton(
            onPressed: () {
              if (remarks.text.trim().isNotEmpty) {
                Navigator.pop(dialogContext, 'NEEDS_CORRECTION');
              }
            },
            child: const Text('Return'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, 'REVIEWED'),
            child: const Text('Reviewed'),
          ),
        ],
      ),
    );
    if (status == null || !context.mounted) {
      remarks.dispose();
      return;
    }
    try {
      await ref
          .read(teacherRepositoryProvider)
          .reviewHomeworkSubmission(
            submissionId: submission.id,
            status: status,
            teacherRemarks: status == 'REVIEWED' ? remarks.text : null,
            correctionRemarks: status == 'NEEDS_CORRECTION'
                ? remarks.text
                : null,
          );
      ref.invalidate(teacherHomeworkSubmissionsProvider(homework.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Submission review saved.')),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Review could not be saved. Please retry.'),
          ),
        );
      }
    } finally {
      remarks.dispose();
    }
  }
}

class _HomeworkLoading extends StatelessWidget {
  const _HomeworkLoading();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppSkeleton(width: double.infinity, height: 72),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 280),
        ],
      ),
    );
  }
}

String _statusLabel(String status) {
  return switch (status) {
    'DRAFT' => 'Draft',
    'ASSIGNED' => 'Published',
    'CLOSED' => 'Closed',
    'CANCELLED' => 'Cancelled',
    'NOT_SUBMITTED' => 'Not submitted',
    'SUBMITTED' => 'Submitted',
    'LATE' => 'Late',
    'REVIEWED' => 'Reviewed',
    'NEEDS_CORRECTION' => 'Needs correction',
    'EXCUSED' => 'Excused',
    _ => status,
  };
}

AppStatusType _statusType(String status) {
  return switch (status) {
    'DRAFT' => AppStatusType.draft,
    'ASSIGNED' => AppStatusType.published,
    'CLOSED' || 'REVIEWED' => AppStatusType.completed,
    'CANCELLED' || 'NEEDS_CORRECTION' => AppStatusType.rejected,
    _ => AppStatusType.pending,
  };
}
