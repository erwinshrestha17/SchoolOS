import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentLibraryScreen extends ConsumerWidget {
  const ParentLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = state.selectedChild;

    return ParentDetailScaffold(
      title: 'Library',
      selectedIndex: 5,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.success when child != null => RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              ParentApiChildSelector(
                child: child,
                children: state.children,
                onChanged: controller.selectChild,
              ),
              const SizedBox(height: 14),
              _LibraryBody(childId: child.id),
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _LibraryBody extends ConsumerWidget {
  const _LibraryBody({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(parentLibraryProvider(childId));
    return library.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentLibraryProvider(childId)),
      ),
      data: (info) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _LibrarySummary(info: info),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Currently borrowed'),
          const SizedBox(height: 8),
          if (info.activeIssues.isEmpty)
            const PortalCard(child: Text('No active borrowed books.'))
          else
            for (final issue in info.activeIssues) ...[
              _IssueCard(issue: issue),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Recent history'),
          const SizedBox(height: 8),
          if (info.recentHistory.isEmpty)
            const PortalCard(child: Text('No recent library history.'))
          else
            PortalCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (
                    var index = 0;
                    index < info.recentHistory.length;
                    index++
                  ) ...[
                    _HistoryTile(issue: info.recentHistory[index]),
                    if (index != info.recentHistory.length - 1)
                      const Divider(height: 1),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _LibrarySummary extends StatelessWidget {
  const _LibrarySummary({required this.info});

  final ParentLibraryInfo info;

  @override
  Widget build(BuildContext context) {
    final dueSoon = info.activeIssues.where((issue) => !issue.isOverdue).length;
    final fines = info.fines.fold<num>(
      0,
      (sum, fine) => sum + fine.outstandingAmount,
    );
    return PortalCard(
      child: Row(
        children: [
          Expanded(
            child: _LibraryMetric(
              Icons.menu_book_rounded,
              '${info.activeIssues.length}',
              'borrowed',
              ParentPortalColors.green,
            ),
          ),
          Expanded(
            child: _LibraryMetric(
              Icons.schedule_rounded,
              '$dueSoon',
              'active',
              ParentPortalColors.orange,
            ),
          ),
          Expanded(
            child: _LibraryMetric(
              Icons.error_rounded,
              _money(fines),
              'fines',
              ParentPortalColors.red,
            ),
          ),
        ],
      ),
    );
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({required this.issue});

  final ParentLibraryIssue issue;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      onTap: () => _loanDetail(context, issue),
      child: Row(
        children: [
          FeatureIcon(
            Icons.auto_stories_rounded,
            color: issue.isOverdue
                ? ParentPortalColors.red
                : ParentPortalColors.blue,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  issue.bookTitle,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  issue.author ?? 'Author unavailable',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 7),
                StatusBadge(
                  label: 'Due ${_date(issue.dueAt)}',
                  color: issue.isOverdue
                      ? ParentPortalColors.red
                      : ParentPortalColors.blue,
                  background: issue.isOverdue
                      ? ParentPortalColors.redSoft
                      : ParentPortalColors.blueSoft,
                ),
              ],
            ),
          ),
          const ListChevron(),
        ],
      ),
    );
  }

  void _loanDetail(BuildContext context, ParentLibraryIssue issue) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FeatureIcon(Icons.auto_stories_rounded, size: 60),
              const SizedBox(height: 12),
              Text(
                issue.bookTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Due ${_date(issue.dueAt)}\nBarcode ${issue.barcode ?? 'not available'}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.issue});

  final ParentLibraryIssue issue;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(
        Icons.history_rounded,
        color: ParentPortalColors.green,
      ),
      title: Text(issue.bookTitle),
      subtitle: Text(
        issue.returnedAt == null
            ? issue.status
            : 'Returned ${_date(issue.returnedAt)}',
      ),
    );
  }
}

class _LibraryMetric extends StatelessWidget {
  const _LibraryMetric(this.icon, this.value, this.label, this.color);

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      FeatureIcon(icon, color: color, size: 44),
      const SizedBox(height: 6),
      Text(
        value,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
      ),
      Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
      ),
    ],
  );
}

String _money(num value) =>
    value <= 0 ? 'NPR 0' : 'NPR ${value.toStringAsFixed(0)}';

String _date(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'not set';
  return '${date.year}-${_two(date.month)}-${_two(date.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
