import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
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
      title: 'Exams & Results',
      selectedIndex: 4,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.success when child != null => RefreshIndicator(
          onRefresh: () async {
            for (final linkedChild in state.children) {
              ref.invalidate(parentExamScheduleProvider(linkedChild.id));
              ref.invalidate(parentReportCardsProvider(linkedChild.id));
            }
            await controller.load();
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              if (state.children.length == 1) ...[
                ParentApiChildSelector(
                  child: child,
                  children: state.children,
                  onChanged: controller.selectChild,
                  statusLabel: state.isOffline ? 'Offline copy' : null,
                ),
                const SizedBox(height: 16),
                const ParentSectionHeader(title: 'Published exam schedule'),
                const SizedBox(height: 8),
                _ExamScheduleBody(child: child),
                const SizedBox(height: 22),
                const ParentSectionHeader(title: 'Published results'),
                const SizedBox(height: 8),
                _ReportCardsBody(child: child),
              ] else
                for (final linkedChild in state.children) ...[
                  ParentSectionHeader(title: linkedChild.name),
                  const SizedBox(height: 8),
                  _ExamScheduleBody(child: linkedChild),
                  const SizedBox(height: 18),
                  _ReportCardsBody(child: linkedChild),
                  const SizedBox(height: 18),
                ],
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _ExamScheduleBody extends ConsumerWidget {
  const _ExamScheduleBody({required this.child});

  final GuardianChild child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedule = ref.watch(parentExamScheduleProvider(child.id));
    return schedule.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentExamScheduleProvider(child.id)),
      ),
      data: (data) {
        if (data.items.isEmpty) {
          return const PortalCard(
            child: Text('No published exam schedule is available yet.'),
          );
        }

        return Column(
          children: [
            for (final item in data.items) ...[
              _ExamScheduleTile(item: item),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _ExamScheduleTile extends StatelessWidget {
  const _ExamScheduleTile({required this.item});

  final ParentExamScheduleItem item;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const FeatureIcon(
            Icons.event_available_rounded,
            color: ParentPortalColors.blue,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.subjectName,
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.examTermName,
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 10),
                Text(
                  NepaliBsCalendar.formatBsDate(item.startsAt, long: true),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                Text(
                  '${NepaliBsCalendar.formatNepalTime(item.startsAt)} - '
                  '${NepaliBsCalendar.formatNepalTime(item.endsAt)}'
                  '${item.room == null ? '' : ' | ${item.room}'}',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          const StatusBadge(label: 'Published', icon: Icons.check_rounded),
        ],
      ),
    );
  }
}

class _ReportCardsBody extends ConsumerWidget {
  const _ReportCardsBody({required this.child});

  final GuardianChild child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(parentReportCardsProvider(child.id));
    return cards.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentReportCardsProvider(child.id)),
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
              _ReportCardTile(childId: child.id, child: child, card: card),
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
  const _ReportCardTile({
    required this.childId,
    required this.child,
    required this.card,
  });

  final String childId;
  final GuardianChild child;
  final ParentReportCard card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                      '${child.classSection} - Published ${_bsDate(card.publishedAt)}',
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
                    card.attendancePercentage == null ? 'GPA' : 'Attendance',
                    card.attendancePercentage == null
                        ? card.gpa == null
                              ? '-'
                              : card.gpa!.toStringAsFixed(2)
                        : '${card.attendancePercentage!.toStringAsFixed(0)}%',
                  ),
                ),
              ],
            ),
          ),
          if (card.subjects.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Text(
              'Subject grades',
              style: TextStyle(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final subject in card.subjects.take(6))
                  _SubjectGradeChip(subject: subject),
              ],
            ),
          ],
          if (_finalRemarks(card).isNotEmpty) ...[
            const SizedBox(height: 14),
            PortalCard(
              color: ParentPortalColors.greenSoft,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FeatureIcon(
                    Icons.format_quote_rounded,
                    color: ParentPortalColors.green,
                    size: 38,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _finalRemarks(card),
                      style: const TextStyle(height: 1.45),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: card.hasFile
                      ? () => _downloadReportCard(context, ref)
                      : null,
                  icon: const Icon(Icons.download_rounded),
                  label: Text(card.hasFile ? 'Download' : 'No file'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: card.hasFile
                      ? () => _shareReportCard(context, ref)
                      : null,
                  icon: const Icon(Icons.ios_share_rounded),
                  label: const Text('Share'),
                ),
              ),
            ],
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

  Future<void> _shareReportCard(BuildContext context, WidgetRef ref) async {
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadReportCardPdf(childId: childId, reportCard: card);
      await const FileShareService().shareFile(
        filePath: file.filePath,
        mimeType: 'application/pdf',
        subject: file.fileName,
      );
      if (!context.mounted) return;
      showFeatureSnack(context, 'Report card ready to share.');
    } catch (_) {
      if (!context.mounted) return;
      showFeatureSnack(context, 'Could not share this report card.');
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

class _SubjectGradeChip extends StatelessWidget {
  const _SubjectGradeChip({required this.subject});

  final ParentReportCardSubject subject;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 124,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ParentPortalColors.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ParentPortalColors.border),
      ),
      child: Column(
        children: [
          Text(
            subject.subjectName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subject.grade,
            style: const TextStyle(
              color: ParentPortalColors.green,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            '${subject.percentage.toStringAsFixed(0)}%',
            style: const TextStyle(color: ParentPortalColors.muted),
          ),
        ],
      ),
    );
  }
}

String _bsDate(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'date unavailable';
  final bs = NepaliBsCalendar.fromAd(date);
  return '${bs.day} ${bs.monthName} ${bs.year}';
}

String _finalRemarks(ParentReportCard card) {
  return (card.classTeacherRemark ?? card.remarks ?? '').trim();
}
