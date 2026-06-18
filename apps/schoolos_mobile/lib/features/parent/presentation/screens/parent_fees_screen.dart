import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentFeesScreen extends ConsumerWidget {
  const ParentFeesScreen({super.key, this.title = 'Fees & Payments'});

  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = state.selectedChild;
    final summary = state.dashboard;

    return ParentDetailScaffold(
      title: title,
      selectedIndex: 4,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.empty => const Center(
          child: Text('No linked children are available.'),
        ),
        ParentDataStatus.success when child != null && summary != null =>
          RefreshIndicator(
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
                _FeesSummaryCard(summary: summary),
                const SizedBox(height: 20),
                const ParentSectionHeader(title: 'Invoices'),
                const SizedBox(height: 8),
                if (summary.recentInvoices.isEmpty)
                  const PortalCard(
                    child: Text('No issued invoices for this child.'),
                  )
                else
                  for (final invoice in summary.recentInvoices) ...[
                    _InvoiceCard(invoice: invoice),
                    const SizedBox(height: 12),
                  ],
                const SizedBox(height: 18),
                const ParentSectionHeader(title: 'Confirmed receipts'),
                const SizedBox(height: 8),
                if (summary.recentReceipts.isEmpty)
                  const PortalCard(
                    child: Text('No confirmed receipts available yet.'),
                  )
                else
                  for (final receipt in summary.recentReceipts) ...[
                    _ReceiptCard(childId: child.id, receipt: receipt),
                    const SizedBox(height: 12),
                  ],
                const SizedBox(height: 12),
                const PortalCard(
                  color: ParentPortalColors.orangeSoft,
                  child: Text(
                    'Online payment is unavailable until the school enables a verified payment provider. Please pay through the school office or an approved school channel.',
                    style: TextStyle(color: ParentPortalColors.muted),
                  ),
                ),
              ],
            ),
          ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _FeesSummaryCard extends StatelessWidget {
  const _FeesSummaryCard({required this.summary});

  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    final hasDues = summary.feesDue > 0;
    return PortalCard(
      child: Row(
        children: [
          FeatureIcon(
            hasDues ? Icons.warning_amber_rounded : Icons.check_circle_rounded,
            color: hasDues
                ? ParentPortalColors.orange
                : ParentPortalColors.green,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Outstanding dues',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
                Text(
                  _money(summary.feesDue),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: ParentPortalColors.navy,
                  ),
                ),
                Text(
                  summary.nextFeeDueDate == null
                      ? 'No upcoming due date from school.'
                      : 'Next due ${_date(summary.nextFeeDueDate)}',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          StatusBadge(
            label: hasDues ? '${summary.overdueFeesCount} overdue' : 'Clear',
            color: hasDues
                ? ParentPortalColors.orange
                : ParentPortalColors.green,
            background: hasDues
                ? ParentPortalColors.orangeSoft
                : ParentPortalColors.greenSoft,
          ),
        ],
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice});

  final ParentFeeInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      borderColor: invoice.isOverdue
          ? ParentPortalColors.orange.withValues(alpha: .4)
          : ParentPortalColors.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(Icons.receipt_long_outlined),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.invoiceNumber,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'Due ${_date(invoice.dueDate)}',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: invoice.status,
                color: invoice.outstandingAmount > 0
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
                background: invoice.outstandingAmount > 0
                    ? ParentPortalColors.orangeSoft
                    : ParentPortalColors.greenSoft,
              ),
            ],
          ),
          const Divider(height: 24),
          Row(
            children: [
              Expanded(child: _FeeMetric('Total', _money(invoice.totalAmount))),
              Expanded(child: _FeeMetric('Paid', _money(invoice.paidAmount))),
              Expanded(
                child: _FeeMetric('Balance', _money(invoice.outstandingAmount)),
              ),
            ],
          ),
          if (invoice.outstandingAmount > 0) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => showUnavailableWorkflowSnack(
                  context,
                  'Online payment is not enabled for this school yet.',
                ),
                icon: const Icon(Icons.lock_outline_rounded),
                label: const Text('Payment unavailable'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReceiptCard extends ConsumerWidget {
  const _ReceiptCard({required this.childId, required this.receipt});

  final String childId;
  final ParentFeeReceipt receipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalCard(
      child: Row(
        children: [
          const FeatureIcon(
            Icons.verified_rounded,
            color: ParentPortalColors.green,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  receipt.receiptNumber,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  '${receipt.invoiceNumber} - ${_money(receipt.amount)}',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Download receipt',
            onPressed: () => _downloadReceipt(context, ref),
            icon: const Icon(Icons.download_rounded),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadReceipt(BuildContext context, WidgetRef ref) async {
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadReceiptPdf(childId: childId, receipt: receipt);
      if (!context.mounted) return;
      showFeatureSnack(context, 'Receipt downloaded: ${file.fileName}');
    } catch (_) {
      if (!context.mounted) return;
      showFeatureSnack(context, 'Receipt is not available right now.');
    }
  }
}

class _FeeMetric extends StatelessWidget {
  const _FeeMetric(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
      Text(
        value,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
      ),
    ],
  );
}

String _money(num value) => 'NPR ${value.toStringAsFixed(0)}';

String _date(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'not set';
  return '${date.year}-${_two(date.month)}-${_two(date.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
