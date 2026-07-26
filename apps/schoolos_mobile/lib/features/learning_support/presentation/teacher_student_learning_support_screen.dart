import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../shared/utils/nepali_bs_calendar.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_exception_view.dart';
import '../../../shared/widgets/role_shell_scaffold.dart';
import '../../../shared/widgets/section_header.dart';
import '../../teacher/application/teacher_providers.dart';
import '../domain/learning_support_models.dart';

class TeacherStudentLearningSupportScreen extends ConsumerWidget {
  const TeacherStudentLearningSupportScreen({
    super.key,
    required this.studentId,
    required this.academicYearId,
    required this.classId,
    this.sectionId,
  });

  final String studentId;
  final String academicYearId;
  final String classId;
  final String? sectionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = TeacherLearningSupportQuery(
      studentId: studentId,
      academicYearId: academicYearId,
      classId: classId,
      sectionId: sectionId,
    );
    final validScope =
        studentId.isNotEmpty && academicYearId.isNotEmpty && classId.isNotEmpty;
    final isOnline = ref.watch(connectivityProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Student Learning Support',
      body: !validScope
          ? const AppEmptyState(
              title: 'Class context is missing',
              message:
                  'Open learning support from an assigned class student summary.',
              icon: Icons.lock_outline_rounded,
            )
          : !isOnline
          ? const AppEmptyState(
              title: 'Reconnect for current learning support',
              message:
                  'Checks and follow-up plans are online-only so the current school record stays authoritative.',
              icon: Icons.cloud_off_rounded,
            )
          : _TeacherLearningSupportBody(query: query),
    );
  }
}

class _TeacherLearningSupportBody extends ConsumerWidget {
  const _TeacherLearningSupportBody({required this.query});

  final TeacherLearningSupportQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = teacherLearningSupportProvider(query);
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(provider);
              await ref.read(provider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                _StudentHeader(data: data),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: 'Record check',
                        icon: Icons.fact_check_outlined,
                        onPressed:
                            data.availableOutcomes.any(
                              (outcome) => outcome.subject != null,
                            )
                            ? () => _recordCheck(context, ref, query, data)
                            : null,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: AppButton(
                        label: 'Start follow-up',
                        icon: Icons.add_task_rounded,
                        variant: AppButtonVariant.outlined,
                        onPressed: () =>
                            _startFollowUp(context, ref, query, data),
                      ),
                    ),
                  ],
                ),
                if (data.availableOutcomes.isEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'No active learning outcome is available for this assigned class.',
                    style: TextStyle(color: AppColors.slate500),
                  ),
                ],
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Recent classroom progress'),
                const SizedBox(height: AppSpacing.sm),
                if (data.outcomeProgress.isEmpty)
                  const _CalmEmpty(
                    message:
                        'No formative classroom check has been recorded yet.',
                  )
                else
                  for (final item in data.outcomeProgress) ...[
                    _ProgressCard(item: item),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Follow-up plans'),
                const SizedBox(height: AppSpacing.sm),
                if (data.interventions.isEmpty)
                  const _CalmEmpty(
                    message: 'No active learning follow-up is recorded.',
                  )
                else
                  for (final item in data.interventions) ...[
                    _InterventionCard(item: item),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                if (data.remedialGroups.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xl),
                  const SectionHeader(title: 'Current school support'),
                  const SizedBox(height: AppSpacing.sm),
                  for (final item in data.remedialGroups) ...[
                    _RemedialCard(item: item),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ],
                if (data.parentGuidance.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xl),
                  const SectionHeader(title: 'Parent guidance'),
                  const SizedBox(height: AppSpacing.sm),
                  for (final item in data.parentGuidance) ...[
                    _GuidanceCard(item: item),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          ),
        );
  }

  Future<void> _recordCheck(
    BuildContext context,
    WidgetRef ref,
    TeacherLearningSupportQuery query,
    TeacherStudentLearningSupport data,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FormativeCheckSheet(query: query, data: data),
    );
    if (saved == true) {
      ref.invalidate(teacherLearningSupportProvider(query));
    }
  }

  Future<void> _startFollowUp(
    BuildContext context,
    WidgetRef ref,
    TeacherLearningSupportQuery query,
    TeacherStudentLearningSupport data,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FollowUpSheet(query: query, student: data.student),
    );
    if (saved == true) {
      ref.invalidate(teacherLearningSupportProvider(query));
    }
  }
}

class _StudentHeader extends StatelessWidget {
  const _StudentHeader({required this.data});

  final TeacherStudentLearningSupport data;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            data.student.fullName,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            [
              data.student.className,
              if (data.student.sectionName != null) data.student.sectionName!,
              data.student.studentSystemId,
            ].join(' • '),
            style: const TextStyle(color: AppColors.slate500),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Current school record • Updated ${NepaliBsCalendar.formatBsDateTime(data.generatedAt)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.item});

  final LearningProgressItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${item.outcome.code} • ${item.outcome.title}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            '${_statusLabel(item.latestMasteryStatus)} • ${NepaliBsCalendar.formatBsDate(item.latestAssessedOn)}',
          ),
          if (item.parentSummary?.isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Text(item.parentSummary!),
          ],
        ],
      ),
    );
  }
}

class _InterventionCard extends StatelessWidget {
  const _InterventionCard({required this.item});

  final LearningInterventionCase item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              _Pill(label: _statusLabel(item.status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(item.concernSummary),
          if (item.nextFollowUpOn != null) ...[
            const SizedBox(height: 6),
            Text(
              'Follow up ${NepaliBsCalendar.formatBsDate(item.nextFollowUpOn!)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _RemedialCard extends StatelessWidget {
  const _RemedialCard({required this.item});

  final LearningRemedialSupport item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.name, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            '${item.subject.name} • ${item.scheduleNote ?? 'Schedule set by school'}',
          ),
        ],
      ),
    );
  }
}

class _GuidanceCard extends StatelessWidget {
  const _GuidanceCard({required this.item});

  final ParentLearningGuidance item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('${item.subject.name} • ${_statusLabel(item.status)}'),
          const SizedBox(height: 6),
          Text(item.homeActivity),
        ],
      ),
    );
  }
}

class _FormativeCheckSheet extends ConsumerStatefulWidget {
  const _FormativeCheckSheet({required this.query, required this.data});

  final TeacherLearningSupportQuery query;
  final TeacherStudentLearningSupport data;

  @override
  ConsumerState<_FormativeCheckSheet> createState() =>
      _FormativeCheckSheetState();
}

class _FormativeCheckSheetState extends ConsumerState<_FormativeCheckSheet> {
  late LearningSupportOutcome _outcome;
  String _kind = 'OBSERVATION';
  String _mastery = 'DEVELOPING';
  final _note = TextEditingController();
  final _parentSummary = TextEditingController();
  bool _saving = false;
  bool _failed = false;

  List<LearningSupportOutcome> get _outcomes => widget.data.availableOutcomes
      .where((outcome) => outcome.subject != null)
      .toList();

  @override
  void initState() {
    super.initState();
    _outcome = _outcomes.first;
  }

  @override
  void dispose() {
    _note.dispose();
    _parentSummary.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Record classroom check',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<LearningSupportOutcome>(
              initialValue: _outcome,
              decoration: const InputDecoration(labelText: 'Learning outcome'),
              items: [
                for (final outcome in _outcomes)
                  DropdownMenuItem(
                    value: outcome,
                    child: Text(
                      '${outcome.code} • ${outcome.title}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _outcome = value ?? _outcome),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Check type'),
              items: const [
                DropdownMenuItem(
                  value: 'OBSERVATION',
                  child: Text('Observation'),
                ),
                DropdownMenuItem(
                  value: 'EXIT_TICKET',
                  child: Text('Exit ticket'),
                ),
                DropdownMenuItem(value: 'ORAL', child: Text('Oral check')),
                DropdownMenuItem(value: 'PRACTICAL', child: Text('Practical')),
                DropdownMenuItem(value: 'CHECKLIST', child: Text('Checklist')),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _kind = value ?? _kind),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _mastery,
              decoration: const InputDecoration(labelText: 'Current progress'),
              items: const [
                DropdownMenuItem(value: 'BEGINNING', child: Text('Starting')),
                DropdownMenuItem(
                  value: 'DEVELOPING',
                  child: Text('Developing'),
                ),
                DropdownMenuItem(value: 'SECURE', child: Text('Secure')),
                DropdownMenuItem(value: 'EXTENDING', child: Text('Extending')),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _mastery = value ?? _mastery),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _note,
              maxLength: 1000,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Teacher note (optional)',
              ),
            ),
            TextField(
              controller: _parentSummary,
              maxLength: 600,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Parent-friendly summary (optional)',
              ),
            ),
            if (_failed)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'The check could not be saved. Review the details and try again.',
                  style: TextStyle(color: AppColors.danger),
                ),
              ),
            AppButton(
              label: 'Save check',
              isLoading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await ref
          .read(teacherRepositoryProvider)
          .recordFormativeCheck(
            studentId: widget.query.studentId,
            outcomeId: _outcome.id,
            academicYearId: widget.query.academicYearId,
            classId: widget.query.classId,
            sectionId: widget.query.sectionId,
            subjectId: _outcome.subject!.id,
            kind: _kind,
            masteryStatus: _mastery,
            assessedOn: DateTime.now(),
            note: _note.text,
            parentSummary: _parentSummary.text,
            clientSubmissionId: _newUuid(),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }
}

class _FollowUpSheet extends ConsumerStatefulWidget {
  const _FollowUpSheet({required this.query, required this.student});

  final TeacherLearningSupportQuery query;
  final LearningSupportStudent student;

  @override
  ConsumerState<_FollowUpSheet> createState() => _FollowUpSheetState();
}

class _FollowUpSheetState extends ConsumerState<_FollowUpSheet> {
  final _title = TextEditingController();
  final _concern = TextEditingController();
  final _parentSummary = TextEditingController();
  String _priority = 'ROUTINE';
  bool _saving = false;
  bool _failed = false;

  @override
  void dispose() {
    _title.dispose();
    _concern.dispose();
    _parentSummary.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Start learning follow-up',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(widget.student.fullName),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _title,
              maxLength: 160,
              decoration: const InputDecoration(labelText: 'Follow-up title'),
            ),
            TextField(
              controller: _concern,
              maxLength: 1200,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Classroom concern and evidence',
              ),
            ),
            DropdownButtonFormField<String>(
              initialValue: _priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: const [
                DropdownMenuItem(value: 'ROUTINE', child: Text('Routine')),
                DropdownMenuItem(value: 'IMPORTANT', child: Text('Important')),
                DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _priority = value ?? _priority),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _parentSummary,
              maxLength: 600,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Parent-friendly summary (optional)',
              ),
            ),
            if (_failed)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'The follow-up could not be started. Review the details and try again.',
                  style: TextStyle(color: AppColors.danger),
                ),
              ),
            AppButton(
              label: 'Start follow-up',
              isLoading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (_title.text.trim().length < 3 || _concern.text.trim().length < 8) {
      setState(() => _failed = true);
      return;
    }
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await ref
          .read(teacherRepositoryProvider)
          .startLearningFollowUp(
            studentId: widget.query.studentId,
            academicYearId: widget.query.academicYearId,
            priority: _priority,
            title: _title.text,
            concernSummary: _concern.text,
            parentVisibleSummary: _parentSummary.text,
            clientRequestId: _newUuid(),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }
}

class _CalmEmpty extends StatelessWidget {
  const _CalmEmpty({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      hasShadow: false,
      color: AppColors.slate50,
      child: Text(message),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.info.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.info,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

String _statusLabel(String value) => value
    .split('_')
    .where((part) => part.isNotEmpty)
    .map((part) => part[0] + part.substring(1).toLowerCase())
    .join(' ');

String _newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-'
      '${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}
