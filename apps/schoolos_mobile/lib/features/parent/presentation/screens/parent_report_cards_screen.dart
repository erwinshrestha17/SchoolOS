import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentReportCardsScreen extends ConsumerWidget {
  const ParentReportCardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'Report cards',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before viewing report cards.',
                icon: Icons.analytics_rounded,
              )
            : _ReportCardsContent(childId: childId),
      ),
    );
  }
}

class _ReportCardsContent extends ConsumerWidget {
  const _ReportCardsContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(parentReportCardsProvider(childId));

    return cards.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 132),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 132),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load report cards',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentReportCardsProvider(childId)),
      ),
      data: (items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentReportCardsProvider(childId));
          await ref.read(parentReportCardsProvider(childId).future);
        },
        child: items.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: const [
                  AppEmptyState(
                    title: 'No report cards published',
                    message:
                        'Published exam results will appear here when released.',
                    icon: Icons.analytics_rounded,
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  for (final card in items) ...[
                    _ReportCardTile(card: card),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
      ),
    );
  }
}

class _ReportCardTile extends StatelessWidget {
  const _ReportCardTile({required this.card});

  final ParentReportCard card;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.analytics_rounded, color: AppColors.primary),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.examTerm,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      [
                        card.academicYear,
                        if (_date(card.publishedAt) != null)
                          'Published ${_date(card.publishedAt)}',
                      ].where((item) => item.isNotEmpty).join(' • '),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(status: AppStatusType.completed, label: card.grade),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              _Metric(label: 'Percent', value: '${card.percentage}%'),
              _Metric(label: 'GPA', value: card.gpa?.toString() ?? '-'),
              _Metric(label: 'File', value: card.hasFile ? 'Ready' : 'None'),
            ],
          ),
          if (card.remarks != null && card.remarks!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              card.remarks!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.slate600),
            ),
          ],
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
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
