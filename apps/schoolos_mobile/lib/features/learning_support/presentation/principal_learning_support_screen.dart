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
import '../../../shared/widgets/section_header.dart';
import '../../principal/application/principal_providers.dart';
import '../../principal/presentation/screens/principal_screens.dart';
import '../domain/learning_support_models.dart';

class PrincipalLearningSupportScreen extends ConsumerStatefulWidget {
  const PrincipalLearningSupportScreen({super.key});

  @override
  ConsumerState<PrincipalLearningSupportScreen> createState() =>
      _PrincipalLearningSupportScreenState();
}

class _PrincipalLearningSupportScreenState
    extends ConsumerState<PrincipalLearningSupportScreen> {
  bool _showCases = false;

  @override
  Widget build(BuildContext context) {
    final isOnline = ref.watch(connectivityProvider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'Learning Support',
      subtitle: 'Explainable signals and school follow-up plans',
      showBack: true,
      child: !isOnline
          ? const AppEmptyState(
              title: 'Reconnect for current learning support',
              message:
                  'Leadership signals and follow-up decisions are online-only and are not saved on this device.',
              icon: Icons.cloud_off_rounded,
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AppCard(
                  hasShadow: false,
                  color: Color(0xFFF0F7FF),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.rule_rounded, color: AppColors.info),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Signals use fixed school rules and current records. They are not predictions or student comparisons.',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(
                      value: false,
                      label: Text('Needs attention'),
                      icon: Icon(Icons.visibility_outlined),
                    ),
                    ButtonSegment(
                      value: true,
                      label: Text('Follow-up plans'),
                      icon: Icon(Icons.assignment_outlined),
                    ),
                  ],
                  selected: {_showCases},
                  onSelectionChanged: (selection) {
                    setState(() => _showCases = selection.first);
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                if (_showCases)
                  _CasesList(onChanged: _refreshAll)
                else
                  _AttentionList(onOpenCase: _openCase),
              ],
            ),
    );
  }

  void _refreshAll() {
    ref.invalidate(principalLearningAttentionProvider);
    ref.invalidate(principalLearningCasesProvider);
  }

  Future<void> _openCase(String caseId) async {
    try {
      final item = await ref.read(principalLearningCaseProvider(caseId).future);
      if (!mounted) return;
      await _showCaseSheet(context, ref, item);
      _refreshAll();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This follow-up plan could not be opened.'),
        ),
      );
    }
  }
}

class _AttentionList extends ConsumerWidget {
  const _AttentionList({required this.onOpenCase});

  final Future<void> Function(String caseId) onOpenCase;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = principalLearningAttentionProvider;
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (page) {
            if (page.items.isEmpty) {
              return const AppEmptyState(
                title: 'No rule-based signal needs attention',
                message:
                    'The current attendance, formative, and homework sources did not produce a follow-up signal.',
                icon: Icons.check_circle_outline_rounded,
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionHeader(
                  title: '${page.total} student follow-up signal(s)',
                ),
                const SizedBox(height: AppSpacing.sm),
                for (final item in page.items) ...[
                  _AttentionCard(
                    item: item,
                    onTap: item.activeInterventionCaseId == null
                        ? null
                        : () => onOpenCase(item.activeInterventionCaseId!),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Text(
                  'Rules ${page.rulesVersion} • Updated ${NepaliBsCalendar.formatBsDateTime(page.generatedAt)}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            );
          },
        );
  }
}

class _CasesList extends ConsumerWidget {
  const _CasesList({required this.onChanged});

  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = principalLearningCasesProvider;
    return ref
        .watch(provider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const AppEmptyState(
                title: 'No learning follow-up plan',
                message:
                    'Teacher and school follow-up plans will appear here when recorded.',
                icon: Icons.assignment_outlined,
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionHeader(title: '${items.length} recent plan(s)'),
                const SizedBox(height: AppSpacing.sm),
                for (final item in items) ...[
                  _CaseCard(
                    item: item,
                    onTap: () async {
                      await _showCaseSheet(context, ref, item);
                      ref.invalidate(provider);
                      ref.invalidate(principalLearningAttentionProvider);
                      onChanged();
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            );
          },
        );
  }
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({required this.item, this.onTap});

  final LearningAttentionItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final unavailableSources = item.sourceStates.entries
        .where(
          (entry) => entry.value == 'unavailable' || entry.value == 'locked',
        )
        .map((entry) => _statusLabel(entry.key))
        .toList();
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.student.fullName,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              _StatusPill(label: _statusLabel(item.attentionLevel)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              item.student.className,
              if (item.student.sectionName != null) item.student.sectionName!,
              item.student.studentSystemId,
            ].join(' • '),
            style: const TextStyle(color: AppColors.slate500),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final reason in item.reasons) ...[
            Text(
              reason.label,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            Text(reason.explanation),
            const SizedBox(height: 6),
          ],
          if (unavailableSources.isNotEmpty)
            Text(
              'Unavailable source: ${unavailableSources.join(', ')}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
            ),
          if (item.activeInterventionCaseId != null) ...[
            const Divider(),
            const Row(
              children: [
                Icon(Icons.assignment_turned_in_outlined, size: 18),
                SizedBox(width: 6),
                Text(
                  'Open current follow-up plan',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                Spacer(),
                Icon(Icons.chevron_right_rounded),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CaseCard extends StatelessWidget {
  const _CaseCard({required this.item, required this.onTap});

  final LearningInterventionCase item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              _StatusPill(label: _statusLabel(item.status)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${item.student.fullName} • ${item.student.className}',
            style: const TextStyle(color: AppColors.slate500),
          ),
          const SizedBox(height: 8),
          Text(
            item.concernSummary,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Text(
            'Priority ${_statusLabel(item.priority)} • Updated ${NepaliBsCalendar.formatBsDate(item.updatedAt)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

Future<void> _showCaseSheet(
  BuildContext context,
  WidgetRef ref,
  LearningInterventionCase initial,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CaseDetailSheet(initial: initial),
  );
}

class _CaseDetailSheet extends ConsumerStatefulWidget {
  const _CaseDetailSheet({required this.initial});

  final LearningInterventionCase initial;

  @override
  ConsumerState<_CaseDetailSheet> createState() => _CaseDetailSheetState();
}

class _CaseDetailSheetState extends ConsumerState<_CaseDetailSheet> {
  late LearningInterventionCase _item = widget.initial;
  bool _loading = false;

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
            Row(
              children: [
                Expanded(
                  child: Text(
                    _item.title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                _StatusPill(label: _statusLabel(_item.status)),
              ],
            ),
            const SizedBox(height: 4),
            Text('${_item.student.fullName} • ${_item.student.className}'),
            const SizedBox(height: AppSpacing.md),
            Text(_item.concernSummary),
            if (_item.parentVisibleSummary?.isNotEmpty == true) ...[
              const SizedBox(height: AppSpacing.md),
              AppCard(
                hasShadow: false,
                color: AppColors.info.withValues(alpha: 0.08),
                child: Text('Parent update: ${_item.parentVisibleSummary!}'),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            const SectionHeader(title: 'Timeline'),
            const SizedBox(height: AppSpacing.sm),
            if (_item.entries.isEmpty)
              const Text('No follow-up entry has been recorded yet.')
            else
              for (final entry in _item.entries) ...[
                AppCard(
                  hasShadow: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _statusLabel(entry.entryType),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(entry.body),
                      const SizedBox(height: 4),
                      Text(
                        '${NepaliBsCalendar.formatBsDateTime(entry.createdAt)}${entry.parentVisible ? ' • Shared with parent' : ''}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Add note',
                    icon: Icons.note_add_outlined,
                    isLoading: _loading,
                    onPressed: _addEntry,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: 'Update status',
                    icon: Icons.sync_alt_rounded,
                    variant: AppButtonVariant.outlined,
                    isLoading: _loading,
                    onPressed: _validTransitions(_item.status).isEmpty
                        ? null
                        : _updateStatus,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _reload() async {
    final next = await ref
        .read(principalRepositoryProvider)
        .getLearningInterventionCase(_item.id);
    if (mounted) setState(() => _item = next);
  }

  Future<void> _addEntry() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _EntrySheet(caseId: _item.id),
    );
    if (saved == true) {
      setState(() => _loading = true);
      try {
        await _reload();
      } finally {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  Future<void> _updateStatus() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _StatusSheet(item: _item),
    );
    if (saved == true) {
      setState(() => _loading = true);
      try {
        await _reload();
      } finally {
        if (mounted) setState(() => _loading = false);
      }
    }
  }
}

class _EntrySheet extends ConsumerStatefulWidget {
  const _EntrySheet({required this.caseId});

  final String caseId;

  @override
  ConsumerState<_EntrySheet> createState() => _EntrySheetState();
}

class _EntrySheetState extends ConsumerState<_EntrySheet> {
  final _body = TextEditingController();
  String _type = 'NOTE';
  bool _parentVisible = false;
  bool _saving = false;
  bool _failed = false;

  @override
  void dispose() {
    _body.dispose();
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
              'Add follow-up entry',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Entry type'),
              items: const [
                DropdownMenuItem(value: 'NOTE', child: Text('Note')),
                DropdownMenuItem(value: 'ACTION', child: Text('Action')),
                DropdownMenuItem(value: 'FOLLOW_UP', child: Text('Follow-up')),
                DropdownMenuItem(value: 'PROGRESS', child: Text('Progress')),
                DropdownMenuItem(
                  value: 'PARENT_CONTACT',
                  child: Text('Parent contact'),
                ),
                DropdownMenuItem(
                  value: 'ESCALATION',
                  child: Text('Escalation'),
                ),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _type = value ?? _type),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _body,
              maxLength: 2000,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Entry details'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Share this entry with the parent'),
              subtitle: const Text(
                'Only use plain, supportive language suitable for the linked guardian.',
              ),
              value: _parentVisible,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _parentVisible = value),
            ),
            if (_failed)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'The entry could not be saved. Review it and try again.',
                  style: TextStyle(color: AppColors.danger),
                ),
              ),
            AppButton(
              label: 'Save entry',
              isLoading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (_body.text.trim().length < 2) {
      setState(() => _failed = true);
      return;
    }
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await ref
          .read(principalRepositoryProvider)
          .addLearningInterventionEntry(
            caseId: widget.caseId,
            entryType: _type,
            body: _body.text,
            parentVisible: _parentVisible,
            clientRequestId: _newPrincipalUuid(),
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

class _StatusSheet extends ConsumerStatefulWidget {
  const _StatusSheet({required this.item});

  final LearningInterventionCase item;

  @override
  ConsumerState<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends ConsumerState<_StatusSheet> {
  late String _status = _validTransitions(widget.item.status).first;
  final _reason = TextEditingController();
  final _resolution = TextEditingController();
  bool _saving = false;
  bool _failed = false;

  @override
  void dispose() {
    _reason.dispose();
    _resolution.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final needsResolution = _status == 'RESOLVED' || _status == 'CLOSED';
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
              'Update follow-up status',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(labelText: 'New status'),
              items: [
                for (final value in _validTransitions(widget.item.status))
                  DropdownMenuItem(
                    value: value,
                    child: Text(_statusLabel(value)),
                  ),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _status = value ?? _status),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _reason,
              maxLength: 600,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason for this change',
              ),
            ),
            if (needsResolution)
              TextField(
                controller: _resolution,
                maxLength: 1200,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Resolution summary',
                ),
              ),
            if (_failed)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'The status could not be changed. Refresh the plan and try again.',
                  style: TextStyle(color: AppColors.danger),
                ),
              ),
            AppButton(
              label: 'Update status',
              isLoading: _saving,
              onPressed: () => _save(needsResolution),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save(bool needsResolution) async {
    if (_reason.text.trim().length < 4 ||
        (needsResolution && _resolution.text.trim().length < 8)) {
      setState(() => _failed = true);
      return;
    }
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await ref
          .read(principalRepositoryProvider)
          .updateLearningIntervention(
            caseId: widget.item.id,
            status: _status,
            reason: _reason.text,
            expectedVersion: widget.item.version,
            resolutionSummary: needsResolution ? _resolution.text : null,
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

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label});

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

List<String> _validTransitions(String status) => switch (status) {
  'OPEN' => const ['IN_PROGRESS', 'MONITORING', 'RESOLVED'],
  'IN_PROGRESS' => const ['MONITORING', 'RESOLVED'],
  'MONITORING' => const ['IN_PROGRESS', 'RESOLVED'],
  'RESOLVED' => const ['IN_PROGRESS', 'CLOSED'],
  _ => const [],
};

String _statusLabel(String value) => value
    .split('_')
    .where((part) => part.isNotEmpty)
    .map((part) => part[0] + part.substring(1).toLowerCase())
    .join(' ');

String _newPrincipalUuid() {
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
