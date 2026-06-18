import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentReportCardsScreen extends ConsumerWidget {
  const ParentReportCardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = state.selectedChild;

    return ParentDetailScaffold(
      title: 'Report Cards',
      selectedIndex: 4,
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
              const SizedBox(height: 16),
              _ReportCardsBody(childId: child.id),
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _ReportCardsBody extends ConsumerWidget {
  const _ReportCardsBody({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(parentReportCardsProvider(childId));
    return cards.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentReportCardsProvider(childId)),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const PortalCard(
            child: Text('No published report cards are available yet.'),
          );
        }

        return Column(
          children: [
            for (final card in items) ...[
              _ReportCardTile(childId: childId, card: card),
              const SizedBox(height: 14),
            ],
            const PortalCard(
              color: ParentPortalColors.surfaceAlt,
              child: Text(
                'Unpublished results are hidden until finalized by the school.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ReportCardTile extends ConsumerWidget {
  const _ReportCardTile({required this.childId, required this.card});

  final String childId;
  final ParentReportCard card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(
                Icons.description_rounded,
                color: ParentPortalColors.green,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.examTerm,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${card.academicYear} - Published ${_date(card.publishedAt)}',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
              const StatusBadge(label: 'Published', icon: Icons.check_rounded),
            ],
          ),
          const SizedBox(height: 14),
          PortalCard(
            color: ParentPortalColors.greenSoft,
            child: Row(
              children: [
                Expanded(
                  child: _ResultMetric(
                    'Percentage',
                    '${card.percentage.toStringAsFixed(1)}%',
                  ),
                ),
                Expanded(child: _ResultMetric('Grade', card.grade)),
                Expanded(
                  child: _ResultMetric(
                    'GPA',
                    card.gpa == null ? '-' : card.gpa!.toStringAsFixed(2),
                  ),
                ),
              ],
            ),
          ),
          if (card.remarks?.isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Text(card.remarks!, style: const TextStyle(height: 1.45)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: card.hasFile
                  ? () => _downloadReportCard(context, ref)
                  : null,
              icon: const Icon(Icons.download_rounded),
              label: Text(card.hasFile ? 'Download PDF' : 'No file'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadReportCard(BuildContext context, WidgetRef ref) async {
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadReportCardPdf(childId: childId, reportCard: card);
      if (!context.mounted) return;
      showFeatureSnack(context, 'Report card downloaded: ${file.fileName}');
    } catch (_) {
      if (!context.mounted) return;
      showFeatureSnack(context, 'Report card PDF is not available right now.');
    }
  }
}

class _ResultMetric extends StatelessWidget {
  const _ResultMetric(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: ParentPortalColors.green,
          fontSize: 22,
          fontWeight: FontWeight.w900,
        ),
      ),
    ],
  );
}

String _date(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'date unavailable';
  return '${date.year}-${_two(date.month)}-${_two(date.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
