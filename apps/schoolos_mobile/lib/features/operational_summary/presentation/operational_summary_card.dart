import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design_system/app_spacing.dart';
import '../application/operational_summary_providers.dart';
import '../domain/operational_summary_models.dart';

class OperationalSummaryCard extends ConsumerWidget {
  const OperationalSummaryCard({super.key, required this.persona});

  final OperationalMobilePersona persona;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(operationalSummaryProvider(persona));

    return summary.when(
      loading: () => const _SummaryShell(
        child: SizedBox(
          height: 72,
          child: Center(child: CircularProgressIndicator.adaptive()),
        ),
      ),
      error: (_, __) => _SummaryShell(
        child: Row(
          children: [
            const Expanded(
              child: Text('School summary is temporarily unavailable.'),
            ),
            TextButton(
              onPressed: () => ref.invalidate(operationalSummaryProvider(persona)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (value) => _SummaryBody(summary: value),
    );
  }
}

class _SummaryBody extends StatelessWidget {
  const _SummaryBody({required this.summary});

  final OperationalMobileSummary summary;

  @override
  Widget build(BuildContext context) {
    switch (summary.status) {
      case OperationalSummaryStatus.locked:
        return const _SummaryShell(
          child: Text('This module is not enabled for your school.'),
        );
      case OperationalSummaryStatus.permissionDenied:
        return const _SummaryShell(
          child: Text('You do not have access to this school summary.'),
        );
      case OperationalSummaryStatus.empty:
        return const _SummaryShell(
          child: Text('No items need attention right now.'),
        );
      case OperationalSummaryStatus.partial:
      case OperationalSummaryStatus.ready:
        final metrics = summary.metrics.entries.take(3).toList(growable: false);
        return _SummaryShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Operational snapshot',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (summary.status == OperationalSummaryStatus.partial) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Available information is shown. Some information is temporarily unavailable.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              if (metrics.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final metric in metrics)
                      _MetricChip(label: _label(metric.key), value: '${metric.value ?? '—'}'),
                  ],
                ),
              ],
              if (summary.hasAttention) ...[
                const SizedBox(height: AppSpacing.md),
                for (final item in summary.attentionItems.take(2))
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xs),
                    child: Text('• ${item.label} (${item.count})'),
                  ),
              ],
            ],
          ),
        );
    }
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 112),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 2),
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _SummaryShell extends StatelessWidget {
  const _SummaryShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: child,
    );
  }
}

String _label(String value) {
  return value.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (match) => '${match[1]} ${match[2]}');
}
