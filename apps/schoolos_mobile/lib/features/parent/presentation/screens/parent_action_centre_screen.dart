import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/network/connectivity_provider.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_action_centre_models.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentActionCentreScreen extends ConsumerStatefulWidget {
  const ParentActionCentreScreen({super.key, this.initialStudentId});

  final String? initialStudentId;

  @override
  ConsumerState<ParentActionCentreScreen> createState() =>
      _ParentActionCentreScreenState();
}

class _ParentActionCentreScreenState
    extends ConsumerState<ParentActionCentreScreen> {
  String? _studentId;

  @override
  void initState() {
    super.initState();
    _studentId = widget.initialStudentId?.trim();
    if (_studentId?.isEmpty ?? false) _studentId = null;
  }

  @override
  Widget build(BuildContext context) {
    final parentState = ref.watch(parentControllerProvider);
    final isOnline = ref.watch(connectivityProvider);

    return ParentDetailScaffold(
      title: 'Action Centre',
      selectedIndex: 0,
      body: !isOnline ? _offlineBody() : _onlineBody(parentState),
    );
  }

  Widget _offlineBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const FeatureIcon(Icons.cloud_off_rounded),
              const SizedBox(height: 12),
              Text(
                'Reconnect to view current actions',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Action Centre is live-only because deadlines, balances, and confirmations can change. Private task details are not saved on this device.',
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _onlineBody(ParentState parentState) {
    if (parentState.children.isEmpty &&
        parentState.status == ParentDataStatus.loading) {
      return const PortalLoadingState();
    }
    if (parentState.children.isEmpty) {
      return const Center(
        child: Text('No active child is linked to this account.'),
      );
    }

    final linkedIds = parentState.children.map((child) => child.id).toSet();
    final selectedStudentId =
        _studentId != null && linkedIds.contains(_studentId)
        ? _studentId
        : null;
    final actionCentre = ref.watch(
      parentActionCentreProvider(selectedStudentId),
    );

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(parentActionCentreProvider(selectedStudentId));
        await ref.read(parentActionCentreProvider(selectedStudentId).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          _ScopeSelector(
            children: parentState.children,
            selectedStudentId: selectedStudentId,
            onChanged: (value) => setState(() => _studentId = value),
          ),
          const SizedBox(height: 14),
          actionCentre.when(
            loading: () => const PortalLoadingState(),
            error: (error, _) => _ErrorCard(
              message: _safeError(error),
              onRetry: () =>
                  ref.invalidate(parentActionCentreProvider(selectedStudentId)),
            ),
            data: (data) =>
                _ActionCentreContent(data: data, onOpen: _openAction),
          ),
        ],
      ),
    );
  }

  Future<void> _openAction(ParentActionItem item) async {
    final route = item.route;
    if (route == null) return;

    final childId = item.child?.id;
    if (childId != null &&
        ref.read(parentControllerProvider).selectedChildId != childId) {
      await ref.read(parentControllerProvider.notifier).selectChild(childId);
      if (!mounted) return;
    }
    context.push(route);
  }
}

class _ActionCentreContent extends StatelessWidget {
  const _ActionCentreContent({required this.data, required this.onOpen});

  final ParentActionCentre data;
  final ValueChanged<ParentActionItem> onOpen;

  @override
  Widget build(BuildContext context) {
    final sourceIssues = data.sources.entries
        .where((entry) => !entry.value.isAvailable)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  StatusBadge(
                    label: data.isLive ? 'Live' : 'Unavailable',
                    icon: data.isLive
                        ? Icons.sync_rounded
                        : Icons.cloud_off_rounded,
                  ),
                  const Spacer(),
                  Text(
                    NepaliBsCalendar.formatBsDateTime(data.generatedAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '${data.summary.visibleActionCount} visible '
                '${data.summary.visibleActionCount == 1 ? 'action' : 'actions'}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (data.summary.urgentCount > 0) ...[
                const SizedBox(height: 4),
                Text(
                  '${data.summary.urgentCount} marked urgent',
                  style: const TextStyle(
                    color: ParentPortalColors.red,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
              if (data.summary.isPartial) ...[
                const SizedBox(height: 8),
                const Text(
                  'This is a partial view. Some school areas are locked or could not be loaded.',
                ),
              ],
            ],
          ),
        ),
        if (sourceIssues.isNotEmpty) ...[
          const SizedBox(height: 14),
          _SourceCoverageCard(entries: sourceIssues),
        ],
        const SizedBox(height: 20),
        const ParentSectionHeader(title: 'Needs attention'),
        const SizedBox(height: 10),
        if (data.items.isEmpty)
          const PortalCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.task_alt_rounded, color: ParentPortalColors.green),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No action is visible in the school areas available right now.',
                  ),
                ),
              ],
            ),
          )
        else
          for (final item in data.items) ...[
            _ActionCard(item: item, onOpen: () => onOpen(item)),
            const SizedBox(height: 12),
          ],
        if (data.truncated) ...[
          const SizedBox(height: 2),
          const PortalCard(
            child: Text(
              'More actions are available. Complete urgent items first, then refresh this view.',
            ),
          ),
        ],
      ],
    );
  }
}

class _ScopeSelector extends StatelessWidget {
  const _ScopeSelector({
    required this.children,
    required this.selectedStudentId,
    required this.onChanged,
  });

  final List<GuardianChild> children;
  final String? selectedStudentId;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final selected = selectedStudentId == null
        ? null
        : children.where((child) => child.id == selectedStudentId).firstOrNull;
    return PortalCard(
      child: Row(
        children: [
          const FeatureIcon(Icons.family_restroom_rounded),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  selected?.name ?? 'All linked children',
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  selected?.classSection ??
                      'Tasks across ${children.length} linked ${children.length == 1 ? 'child' : 'children'}',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          PopupMenuButton<String?>(
            tooltip: 'Choose child scope',
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
            onSelected: onChanged,
            itemBuilder: (_) => [
              const PopupMenuItem<String?>(
                value: null,
                child: Text('All linked children'),
              ),
              for (final child in children)
                PopupMenuItem<String?>(
                  value: child.id,
                  child: Text('${child.name} • ${child.classSection}'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.item, required this.onOpen});

  final ParentActionItem item;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final dueAt = item.dueAt;
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FeatureIcon(
                _sourceIcon(item.source),
                color: item.isUrgent
                    ? ParentPortalColors.red
                    : ParentPortalColors.purple,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(item.description),
                  ],
                ),
              ),
            ],
          ),
          if (item.child != null || dueAt != null || item.isUrgent) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (item.child != null)
                  StatusBadge(
                    label: item.child!.name,
                    icon: Icons.person_outline_rounded,
                  ),
                if (dueAt != null)
                  StatusBadge(
                    label:
                        '${item.isOverdue ? 'Overdue' : 'Due'} ${NepaliBsCalendar.formatBsDate(dueAt, short: true)} BS',
                    icon: item.isOverdue
                        ? Icons.warning_amber_rounded
                        : Icons.event_outlined,
                  ),
                if (item.isUrgent)
                  const StatusBadge(
                    label: 'Urgent',
                    icon: Icons.priority_high_rounded,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: item.route == null ? null : onOpen,
              child: Text(
                item.route == null ? 'Action unavailable' : item.actionLabel,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceCoverageCard extends StatelessWidget {
  const _SourceCoverageCard({required this.entries});

  final List<MapEntry<String, ParentActionSourceState>> entries;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Coverage',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          for (final entry in entries) ...[
            Text(
              '${_sourceLabel(entry.key)}: ${entry.value.reason ?? _sourceStatusLabel(entry.value.status)}',
            ),
            if (entry != entries.last) const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

IconData _sourceIcon(String source) {
  return switch (source) {
    'notices' => Icons.campaign_outlined,
    'homework' => Icons.menu_book_outlined,
    'fees' => Icons.receipt_long_outlined,
    'attendance' => Icons.fact_check_outlined,
    'serviceRequests' => Icons.support_agent_outlined,
    'exams' => Icons.event_note_outlined,
    _ => Icons.task_alt_rounded,
  };
}

String _sourceLabel(String source) {
  return switch (source) {
    'notices' => 'Notices',
    'homework' => 'Homework',
    'fees' => 'Fees',
    'attendance' => 'Attendance',
    'serviceRequests' => 'Help & Support',
    'exams' => 'Examinations',
    _ => 'School actions',
  };
}

String _sourceStatusLabel(String status) {
  return switch (status) {
    'partial' => 'Only part of this area could be checked.',
    'locked' => 'This school area is not enabled.',
    _ => 'This school area could not be checked.',
  };
}

String _safeError(Object error) {
  if (error is AppException) return error.message;
  return 'Current actions could not be loaded. Please try again.';
}
