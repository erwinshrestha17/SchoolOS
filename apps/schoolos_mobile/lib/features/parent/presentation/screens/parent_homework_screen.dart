import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentHomeworkScreen extends ConsumerWidget {
  const ParentHomeworkScreen({
    super.key,
    this.role = 'PARENT',
    this.selectedIndex = 4,
    this.title = 'Homework',
  });

  final String role;
  final int selectedIndex;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;
    final isStudent = role.toUpperCase() == 'STUDENT';

    return RoleShellScaffold(
      role: role,
      selectedIndex: selectedIndex,
      title: title,
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? AppEmptyState(
                title: isStudent
                    ? 'No student profile linked'
                    : 'No child selected',
                message: isStudent
                    ? 'Ask the school office to link this login to a student profile.'
                    : 'Select a child before viewing homework.',
                icon: Icons.menu_book_rounded,
              )
            : _HomeworkList(childId: childId),
      ),
    );
  }
}

class _HomeworkList extends ConsumerWidget {
  const _HomeworkList({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homework = ref.watch(parentHomeworkProvider(childId));

    return homework.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 132),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 92),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 92),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load homework',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentHomeworkProvider(childId)),
      ),
      data: (items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentHomeworkProvider(childId));
          await ref.read(parentHomeworkProvider(childId).future);
        },
        child: items.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: const [
                  AppEmptyState(
                    title: 'No homework assigned',
                    message:
                        'Published homework from teachers will appear here.',
                    icon: Icons.menu_book_rounded,
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  _HomeworkSummary(items: items),
                  const SizedBox(height: AppSpacing.xl),
                  const SectionHeader(title: 'Assignments'),
                  const SizedBox(height: AppSpacing.sm),
                  for (final item in items) ...[
                    _HomeworkCard(item: item),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
      ),
    );
  }
}

class _HomeworkSummary extends StatelessWidget {
  const _HomeworkSummary({required this.items});

  final List<ParentHomeworkItem> items;

  @override
  Widget build(BuildContext context) {
    final pending = items.where((item) => item.isPending).length;
    final nextDue =
        items
            .map((item) => DateTime.tryParse(item.dueAt ?? item.dueDate ?? ''))
            .whereType<DateTime>()
            .where((date) => date.isAfter(DateTime.now()))
            .toList()
          ..sort();

    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: const Icon(
              Icons.menu_book_rounded,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pending == 0 ? 'Homework is clear' : '$pending pending',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  nextDue.isEmpty
                      ? 'No upcoming due date from school.'
                      : 'Next due ${DateFormat('MMM d').format(nextDue.first)}.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(
            status: pending == 0
                ? AppStatusType.completed
                : AppStatusType.pending,
          ),
        ],
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.item});

  final ParentHomeworkItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => _showHomeworkDetail(context, item),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: _statusColor(item).withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(Icons.assignment_rounded, color: _statusColor(item)),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusChip(
                      status: _statusType(item),
                      label: _statusLabel(item),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${item.subjectName} • ${_dueText(item)}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
                if (item.attachmentCount > 0) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${item.attachmentCount} attachment${item.attachmentCount == 1 ? '' : 's'}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.info,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

void _showHomeworkDetail(BuildContext context, ParentHomeworkItem item) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.sm),
            StatusChip(status: _statusType(item), label: _statusLabel(item)),
            const SizedBox(height: AppSpacing.lg),
            _DetailRow(label: 'Subject', value: item.subjectName),
            _DetailRow(label: 'Due', value: _dueText(item)),
            _DetailRow(label: 'Attachments', value: '${item.attachmentCount}'),
            if (item.submittedAt != null)
              _DetailRow(
                label: 'Submitted',
                value: _date(item.submittedAt!) ?? 'Submitted',
              ),
            if (item.score != null)
              _DetailRow(label: 'Score', value: '${item.score}'),
            if (item.feedback != null && item.feedback!.isNotEmpty)
              _DetailRow(label: 'Feedback', value: item.feedback!),
          ],
        ),
      );
    },
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

AppStatusType _statusType(ParentHomeworkItem item) {
  if (_isLate(item)) {
    return AppStatusType.late;
  }
  if (item.submissionStatus == 'SUBMITTED' ||
      item.submissionStatus == 'CHECKED' ||
      item.submissionStatus == 'REVIEWED') {
    return AppStatusType.completed;
  }
  return AppStatusType.pending;
}

Color _statusColor(ParentHomeworkItem item) {
  switch (_statusType(item)) {
    case AppStatusType.completed:
      return AppColors.success;
    case AppStatusType.late:
      return AppColors.danger;
    default:
      return AppColors.warning;
  }
}

String _statusLabel(ParentHomeworkItem item) {
  if (_isLate(item)) {
    return 'Late';
  }
  return item.submissionStatus
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

bool _isLate(ParentHomeworkItem item) {
  if (!item.isPending) {
    return false;
  }
  final due = DateTime.tryParse(item.dueAt ?? item.dueDate ?? '');
  return due != null && due.isBefore(DateTime.now());
}

String _dueText(ParentHomeworkItem item) {
  return _date(item.dueAt ?? item.dueDate) ?? 'Due date not set';
}

String? _date(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) {
    return null;
  }
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return null;
  }
  return DateFormat('MMM d, yyyy').format(parsed);
}
