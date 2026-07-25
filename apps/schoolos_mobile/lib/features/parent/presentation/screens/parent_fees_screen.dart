import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/errors/app_exception.dart';
import '../widgets/parent_state_view.dart';
import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/utils/money_format.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
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
      selectedIndex: 5,
      // Fees needs the dashboard summary, which is deliberately not cached for
      // offline use. When it is missing because the device is offline, say so
      // with the offline surface rather than a generic failure.
      body: ParentStateView(
        status: child != null && summary == null && state.isOffline
            ? ParentDataStatus.offline
            : state.status,
        message: state.message,
        onRetry: controller.load,
        child: child == null || summary == null
            ? const SizedBox.shrink()
            : RefreshIndicator(
                onRefresh: controller.load,
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
                      const SizedBox(height: 14),
                      _FeesContent(child: child, summary: summary),
                    ] else
                      for (final linkedChild in state.children) ...[
                        _ChildFeesSection(child: linkedChild),
                        const SizedBox(height: 18),
                      ],
                  ],
                ),
              ),
      ),
    );
  }
}

class _ChildFeesSection extends ConsumerWidget {
  const _ChildFeesSection({required this.child});

  final GuardianChild child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(parentDashboardSummaryProvider(child.id));
    return summary.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Could not load fees for ${child.name}.'),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () =>
                  ref.invalidate(parentDashboardSummaryProvider(child.id)),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
      data: (summary) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ParentSectionHeader(title: child.name),
          const SizedBox(height: 8),
          _FeesContent(child: child, summary: summary),
        ],
      ),
    );
  }
}

class _FeesContent extends ConsumerWidget {
  const _FeesContent({required this.child, required this.summary});

  final GuardianChild child;
  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readiness = ref.watch(
      parentPaymentGatewayReadinessProvider(child.id),
    );
    return Column(
      children: [
        _FeesSummaryCard(summary: summary),
        const SizedBox(height: 12),
        _PaymentReadinessCard(readiness: readiness),
        const SizedBox(height: 20),
        if (summary.recentInvoices.isEmpty) ...[
          const ParentSectionHeader(title: 'Bills'),
          const SizedBox(height: 8),
          const PortalCard(child: Text('No bills for this child yet.')),
        ] else
          for (final group in groupInvoicesByDueMonth(
            summary.recentInvoices,
          )) ...[
            _MonthHeader(group: group),
            const SizedBox(height: 8),
            for (final invoice in group.invoices) ...[
              _InvoiceCard(
                childId: child.id,
                invoice: invoice,
                readiness: readiness.valueOrNull,
                readinessLoading: readiness.isLoading,
              ),
              const SizedBox(height: 12),
            ],
            const SizedBox(height: 8),
          ],
        const SizedBox(height: 10),
        const ParentSectionHeader(title: 'Your receipts'),
        const SizedBox(height: 8),
        if (summary.recentReceipts.isEmpty)
          const PortalCard(
            child: Text(
              'No receipts yet. A receipt appears here once the school confirms your payment.',
            ),
          )
        else
          for (final receipt in summary.recentReceipts) ...[
            _ReceiptCard(childId: child.id, receipt: receipt),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

/// Bills that fall due in the same Bikram Sambat month.
class ParentFeeMonthGroup {
  const ParentFeeMonthGroup({
    required this.label,
    required this.invoices,
    required this.sortKey,
  });

  final String label;
  final List<ParentFeeInvoice> invoices;

  /// `year * 12 + month`, or -1 when the school gave no due date.
  final int sortKey;

  num get outstanding =>
      invoices.fold<num>(0, (sum, item) => sum + item.outstandingAmount);
}

/// Groups bills by the BS month they fall due, newest month first.
///
/// Deliberately keyed on `dueDate` rather than `FeeBillingRun.runMonth`: that
/// field's calendar convention is unenforced (the DTO accepts any year over
/// 2000, the finance spec uses AD 2026, seeded invoice numbers use BS 2083),
/// so a month label taken from it could name the wrong month. A due date is a
/// real timestamp and converts unambiguously. The label says "Due in ..." for
/// the same reason - it is true whatever period the school billed for.
List<ParentFeeMonthGroup> groupInvoicesByDueMonth(
  List<ParentFeeInvoice> invoices,
) {
  final buckets = <int, List<ParentFeeInvoice>>{};
  final labels = <int, String>{};

  for (final invoice in invoices) {
    final due = DateTime.tryParse(invoice.dueDate ?? '');
    if (due == null) {
      buckets.putIfAbsent(-1, () => []).add(invoice);
      labels[-1] = 'No due date given';
      continue;
    }
    final bs = NepaliBsCalendar.fromAd(due);
    final key = bs.year * 12 + bs.month;
    buckets.putIfAbsent(key, () => []).add(invoice);
    labels[key] = 'Due in ${NepaliBsCalendar.monthName(bs.month)} ${bs.year}';
  }

  final keys = buckets.keys.toList()..sort((a, b) => b.compareTo(a));
  return [
    for (final key in keys)
      ParentFeeMonthGroup(
        label: labels[key] ?? 'Bills',
        sortKey: key,
        invoices: buckets[key]!
          ..sort((a, b) => (a.dueDate ?? '').compareTo(b.dueDate ?? '')),
      ),
  ];
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.group});

  final ParentFeeMonthGroup group;

  @override
  Widget build(BuildContext context) {
    final owing = group.outstanding > 0;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: ParentSectionHeader(title: group.label)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              owing ? '${_money(group.outstanding)} to pay' : 'All paid',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: owing
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentReadinessCard extends StatelessWidget {
  const _PaymentReadinessCard({required this.readiness});

  final AsyncValue<ParentPaymentGatewayReadiness> readiness;

  @override
  Widget build(BuildContext context) {
    return readiness.when(
      loading: () => PortalCard(
        child: Row(
          children: [
            const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Checking if you can pay online…',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ),
          ],
        ),
      ),
      error: (_, _) => const PortalCard(
        color: ParentPortalColors.orangeSoft,
        child: Text(
          'We cannot start a payment right now. Nothing has been charged.',
          style: TextStyle(color: ParentPortalColors.muted),
        ),
      ),
      data: (value) => PortalCard(
        color: value.enabled
            ? ParentPortalColors.greenSoft
            : ParentPortalColors.orangeSoft,
        child: Row(
          children: [
            Icon(
              value.enabled
                  ? Icons.verified_user_outlined
                  : Icons.lock_outline_rounded,
              color: value.enabled
                  ? ParentPortalColors.green
                  : ParentPortalColors.orange,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusBadge(
                    label: value.enabled
                        ? value.sandbox
                              ? 'Test mode'
                              : 'You can pay online'
                        : 'Not available',
                    color: value.enabled
                        ? ParentPortalColors.green
                        : ParentPortalColors.orange,
                    background: value.enabled
                        ? ParentPortalColors.greenSoft
                        : ParentPortalColors.orangeSoft,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    value.message,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'You need internet to pay. Nothing is charged while you are offline.',
                    style: TextStyle(
                      color: ParentPortalColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeesSummaryCard extends StatelessWidget {
  const _FeesSummaryCard({required this.summary});

  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    final hasDues = summary.feesDue > 0;
    // The backend reports status PAID whenever nothing is outstanding, which
    // includes a child the school has never billed. Announcing "Paid" there
    // claims a settlement that never happened, and would mask a school that
    // simply has not issued this term's invoices yet.
    final nothingBilled = !hasDues && summary.feesTotalAmount <= 0;
    return PortalCard(
      child: Row(
        children: [
          FeatureIcon(
            hasDues
                ? Icons.warning_amber_rounded
                : nothingBilled
                ? Icons.receipt_long_rounded
                : Icons.check_circle_rounded,
            color: hasDues
                ? ParentPortalColors.orange
                : nothingBilled
                ? ParentPortalColors.muted
                : ParentPortalColors.green,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Fee status',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
                Text(
                  hasDues
                      ? _money(summary.feesDue)
                      : nothingBilled
                      ? 'Not billed'
                      : 'Paid',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: ParentPortalColors.navy,
                  ),
                ),
                Text(
                  hasDues
                      ? 'Paid ${_money(summary.feesPaidAmount)} of ${_money(summary.feesTotalAmount)}'
                      : nothingBilled
                      ? 'The school has not sent a bill for this child yet.'
                      : 'Nothing left to pay.',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                Text(
                  nothingBilled
                      ? 'Nothing is payable right now.'
                      : !hasDues
                      ? 'Your payment receipts are saved below.'
                      : summary.nextFeeDueDate == null
                      ? 'The school has not set a due date.'
                      : 'Next due ${_date(summary.nextFeeDueDate)}',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          StatusBadge(
            label: hasDues
                ? summary.feesStatus == 'PARTIAL'
                      ? 'Partial'
                      : '${summary.overdueFeesCount} overdue'
                : nothingBilled
                ? 'No invoices'
                : 'Paid',
            color: hasDues
                ? ParentPortalColors.orange
                : nothingBilled
                ? ParentPortalColors.muted
                : ParentPortalColors.green,
            background: hasDues
                ? ParentPortalColors.orangeSoft
                : nothingBilled
                ? ParentPortalColors.surfaceAlt
                : ParentPortalColors.greenSoft,
          ),
        ],
      ),
    );
  }
}

/// What the school actually charged for. The printed receipt has always listed
/// this; until now the app showed only a total, so a parent could not tell
/// tuition from transport without the paper copy.
class _BillBreakdown extends StatelessWidget {
  const _BillBreakdown({
    required this.invoice,
    required this.expanded,
    required this.onToggle,
  });

  final ParentFeeInvoice invoice;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    if (!invoice.isItemised) {
      return const Padding(
        padding: EdgeInsets.only(top: 8),
        child: Text(
          'The school has not itemised this bill.',
          style: TextStyle(color: ParentPortalColors.muted, fontSize: 12),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // A plain button rather than ExpansionTile: the tile brings its own
        // padding, divider and 56dp row height, which fights the card.
        Semantics(
          button: true,
          expanded: expanded,
          child: TextButton.icon(
            onPressed: onToggle,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 8),
              minimumSize: const Size(0, 44),
              tapTargetSize: MaterialTapTargetSize.padded,
              foregroundColor: ParentPortalColors.green,
            ),
            icon: Icon(
              expanded
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 20,
            ),
            label: Text(
              expanded ? 'Hide details' : 'See what this covers',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
        if (expanded) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: ParentPortalColors.surfaceAlt,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                for (final line in invoice.lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _BreakdownRow(
                      label: line.quantity > 1
                          ? '${line.name} × ${line.quantity}'
                          : line.name,
                      amount: _money(line.totalAmount),
                    ),
                  ),
                if (invoice.vatAmount > 0) ...[
                  _BreakdownRow(
                    label: 'VAT',
                    amount: _money(invoice.vatAmount),
                  ),
                  const SizedBox(height: 8),
                ],
                const Divider(height: 12),
                _BreakdownRow(
                  label: 'Total',
                  amount: _money(invoice.totalAmount),
                  emphasised: true,
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({
    required this.label,
    required this.amount,
    this.emphasised = false,
  });

  final String label;
  final String amount;
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: emphasised ? FontWeight.w900 : FontWeight.w600,
      color: emphasised ? ParentPortalColors.navy : ParentPortalColors.muted,
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: style)),
        const SizedBox(width: 12),
        Text(amount, style: style.copyWith(color: ParentPortalColors.navy)),
      ],
    );
  }
}

/// The backend status is a database enum (ISSUED, PARTIAL, PAID). A parent
/// wants to know whether they still owe money.
String _billStatusLabel(ParentFeeInvoice invoice) {
  if (invoice.isSettled) return 'Paid';
  if (invoice.isOverdue) return 'Overdue';
  if (invoice.paidAmount > 0) return 'Part paid';
  return 'To pay';
}

class _InvoiceCard extends ConsumerStatefulWidget {
  const _InvoiceCard({
    required this.childId,
    required this.invoice,
    required this.readiness,
    required this.readinessLoading,
  });

  final String childId;
  final ParentFeeInvoice invoice;
  final ParentPaymentGatewayReadiness? readiness;
  final bool readinessLoading;

  @override
  ConsumerState<_InvoiceCard> createState() => _InvoiceCardState();
}

class _InvoiceCardState extends ConsumerState<_InvoiceCard> {
  bool _startingPayment = false;
  bool _showBreakdown = false;
  String? _paymentRequestKey;

  @override
  Widget build(BuildContext context) {
    final invoice = widget.invoice;
    final canPay = widget.readiness?.enabled == true && !_startingPayment;
    final paymentStatusMessage = widget.readinessLoading
        ? 'Checking if you can pay online…'
        : widget.readiness?.enabled == true
        ? 'You can pay online. The school confirms every payment.'
        : widget.readiness?.message ??
              'This school does not accept online payment right now.';
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
                    // The bill is the parent's; the invoice number is the
                    // school's filing reference, so it reads underneath
                    // rather than as the heading.
                    const Text(
                      'School fees',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'Due ${_date(invoice.dueDate)}',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    Text(
                      invoice.invoiceNumber,
                      style: const TextStyle(
                        color: ParentPortalColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: _billStatusLabel(invoice),
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
          // Wrap, not Row: a seven-figure fee at large text scale cannot
          // share a phone width three ways, and "Rs 12,345,678" has no break
          // point for a Text to wrap on. Wrap reflows to a second run instead
          // of overflowing.
          Wrap(
            spacing: 20,
            runSpacing: 12,
            children: [
              _FeeMetric('Total', _money(invoice.totalAmount)),
              _FeeMetric('Paid', _money(invoice.paidAmount)),
              _FeeMetric('Left to pay', _money(invoice.outstandingAmount)),
            ],
          ),
          const SizedBox(height: 4),
          _BillBreakdown(
            invoice: invoice,
            expanded: _showBreakdown,
            onToggle: () => setState(() => _showBreakdown = !_showBreakdown),
          ),
          if (invoice.outstandingAmount > 0) ...[
            const SizedBox(height: 12),
            Text(
              paymentStatusMessage,
              style: const TextStyle(
                color: ParentPortalColors.muted,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: canPay ? _confirmAndStartPayment : null,
                icon: _startingPayment
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        widget.readinessLoading
                            ? Icons.hourglass_top_rounded
                            : canPay
                            ? Icons.open_in_new_rounded
                            : Icons.lock_outline_rounded,
                      ),
                label: Text(
                  _startingPayment
                      ? 'Opening payment…'
                      : widget.readinessLoading
                      ? 'Checking…'
                      : canPay
                      ? 'Pay ${_money(invoice.outstandingAmount)}'
                      : 'Online payment not available',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmAndStartPayment() async {
    final readiness = widget.readiness;
    if (readiness == null || !readiness.enabled) return;
    final providers = readiness.providers.isNotEmpty
        ? readiness.providers
        : [if (readiness.providerName != null) readiness.providerName!];
    if (providers.isEmpty) return;
    final provider = providers.length == 1
        ? providers.first
        : await _chooseProvider(providers, sandbox: readiness.sandbox);
    if (provider == null || !mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Pay ${_money(widget.invoice.outstandingAmount)}?'),
        content: Text(
          'School fees · due ${_date(widget.invoice.dueDate)}\nPaying with ${_providerLabel(provider)}${readiness.sandbox ? '\n\nTest mode: this is a practice payment, not a real one.' : ''}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _startingPayment = true);
    // Held across retries so an ambiguous failure replays the same attempt
    // instead of creating a second payment. It is cleared once an attempt is
    // confirmed settled, so a later payment is a genuinely new request.
    _paymentRequestKey ??= _newPaymentRequestKey();
    try {
      if (readiness.sandbox) {
        final result = await ref
            .read(parentRepositoryProvider)
            .payInvoiceInSandbox(
              childId: widget.childId,
              invoiceId: widget.invoice.id,
              amount: widget.invoice.outstandingAmount,
              provider: provider,
              idempotencyKey: _paymentRequestKey!,
            );
        if (result.status != 'SUCCEEDED') {
          throw StateError('Sandbox payment was not confirmed.');
        }
        // Settled. A replayed key would return this same receipt instead of
        // collecting the next instalment.
        _paymentRequestKey = null;
        await ref
            .read(parentControllerProvider.notifier)
            .load(childId: widget.childId);
        if (!mounted) return;
        showFeatureSnack(
          context,
          'Test payment recorded${result.receiptNumber == null ? '' : ' • Receipt ${result.receiptNumber}'}.',
        );
        return;
      }
      final intent = await ref
          .read(parentRepositoryProvider)
          .initiatePayment(
            childId: widget.childId,
            invoiceId: widget.invoice.id,
            amount: widget.invoice.outstandingAmount,
            provider: provider,
            idempotencyKey: _paymentRequestKey!,
          );
      final checkoutUrl = Uri.tryParse(intent.checkoutUrl ?? '');
      if (intent.status != 'READY' ||
          checkoutUrl == null ||
          checkoutUrl.scheme != 'https') {
        throw StateError(
          'Payment provider did not return a safe checkout URL.',
        );
      }
      final launched = await launchUrl(
        checkoutUrl,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        throw StateError('Secure checkout could not be opened.');
      }
      if (!mounted) return;
      showFeatureSnack(
        context,
        'Payment page opened. Your receipt appears here once the school confirms it.',
      );
    } catch (error) {
      if (!mounted) return;
      showFeatureSnack(context, _safePaymentFailureMessage(error));
    } finally {
      if (mounted) setState(() => _startingPayment = false);
    }
  }

  Future<String?> _chooseProvider(
    List<String> providers, {
    required bool sandbox,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'How do you want to pay?',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              for (final provider in providers)
                ListTile(
                  leading: const FeatureIcon(Icons.account_balance_rounded),
                  title: Text(
                    _providerLabel(provider),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    sandbox
                        ? 'Practice payment, confirmed straight away'
                        : 'Opens a secure page. You need internet.',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.pop(context, provider),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceiptCard extends ConsumerStatefulWidget {
  const _ReceiptCard({required this.childId, required this.receipt});

  final String childId;
  final ParentFeeReceipt receipt;

  @override
  ConsumerState<_ReceiptCard> createState() => _ReceiptCardState();
}

class _ReceiptCardState extends ConsumerState<_ReceiptCard> {
  bool _downloading = false;
  bool _sharing = false;

  @override
  Widget build(BuildContext context) {
    final busy = _downloading || _sharing;
    final issuedAt = _receiptDate(widget.receipt.issuedAt);
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                      widget.receipt.receiptNumber,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      '${widget.receipt.invoiceNumber} - ${_money(widget.receipt.amount)}',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    if (issuedAt != null)
                      Text(
                        'Issued $issuedAt',
                        style: const TextStyle(
                          color: ParentPortalColors.muted,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Save receipt',
                onPressed: busy ? null : () => _downloadReceipt(context),
                icon: _downloading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_rounded),
              ),
              IconButton(
                tooltip: 'Share receipt',
                onPressed: busy ? null : () => _shareReceipt(context),
                icon: _sharing
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Official receipt. Only you can open it.',
            style: TextStyle(color: ParentPortalColors.muted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadReceipt(BuildContext context) async {
    if (_downloading || _sharing) return;
    setState(() => _downloading = true);
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadReceiptPdf(childId: widget.childId, receipt: widget.receipt);
      if (!context.mounted) return;
      showFeatureSnack(context, 'Receipt downloaded: ${file.fileName}');
    } catch (error) {
      if (!context.mounted) return;
      showFeatureSnack(context, _safeReceiptFailureMessage(error));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _shareReceipt(BuildContext context) async {
    if (_downloading || _sharing) return;
    setState(() => _sharing = true);
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadReceiptPdf(childId: widget.childId, receipt: widget.receipt);
      await const FileShareService().shareFile(
        filePath: file.filePath,
        mimeType: 'application/pdf',
        subject: file.fileName,
      );
      if (!context.mounted) return;
      showFeatureSnack(context, 'Receipt ready to share.');
    } catch (error) {
      if (!context.mounted) return;
      showFeatureSnack(context, _safeReceiptFailureMessage(error));
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }
}

String _safePaymentFailureMessage(Object error) {
  if (error is NetworkException || error is TimeoutException) {
    return 'We could not start the payment. You need internet, and nothing was charged.';
  }
  if (error is AppException) {
    return error.message;
  }
  return 'We could not start the payment. Nothing was charged. Please try again.';
}

String _safeReceiptFailureMessage(Object error) {
  if (error is NetworkException || error is TimeoutException) {
    return 'We could not open this receipt. Check your internet and try again.';
  }
  if (error is AppException) {
    return error.message;
  }
  return 'This receipt is not available right now. Please try again later.';
}

String? _receiptDate(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return null;
  return NepaliBsCalendar.formatBsDate(date);
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

String _money(num value) => formatMoney(value);

String _date(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'not set';
  return NepaliBsCalendar.formatBsDate(date);
}

String _newPaymentRequestKey() {
  final random = Random.secure();
  final entropy = List.generate(
    4,
    (_) => random.nextInt(1 << 32).toRadixString(16).padLeft(8, '0'),
  ).join();
  return 'parent-${DateTime.now().microsecondsSinceEpoch}-$entropy';
}

String _providerLabel(String value) => switch (value) {
  'ESEWA' => 'eSewa',
  'KHALTI' => 'Khalti',
  'CONNECT_IPS' => 'connectIPS',
  _ => value,
};
