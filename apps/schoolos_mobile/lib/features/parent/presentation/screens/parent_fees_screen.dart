import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/env_config.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/utils/money_format.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';
import '../widgets/parent_state_view.dart';

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
      showGlobalActions: false,
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
                    ParentApiChildSelector(
                      child: child,
                      children: state.children,
                      onChanged: controller.selectChild,
                      statusLabel: state.isOffline ? 'Offline copy' : null,
                    ),
                    const SizedBox(height: 14),
                    _FeesContent(child: child, summary: summary),
                  ],
                ),
              ),
      ),
    );
  }
}

enum _FeeListTab { outstanding, history }

class _FeesContent extends ConsumerStatefulWidget {
  const _FeesContent({required this.child, required this.summary});

  final GuardianChild child;
  final ParentDashboardSummary summary;

  @override
  ConsumerState<_FeesContent> createState() => _FeesContentState();
}

class _FeesContentState extends ConsumerState<_FeesContent> {
  _FeeListTab _tab = _FeeListTab.outstanding;
  bool _sandboxBannerDismissed = false;

  @override
  Widget build(BuildContext context) {
    final child = widget.child;
    final summary = widget.summary;
    final readiness = ref.watch(
      parentPaymentGatewayReadinessProvider(child.id),
    );
    final outstandingInvoices = summary.recentInvoices
        .where((invoice) => !invoice.isSettled)
        .toList();
    final historyInvoices = summary.recentInvoices
        .where((invoice) => invoice.isSettled)
        .toList();
    final visibleInvoices = _tab == _FeeListTab.outstanding
        ? outstandingInvoices
        : historyInvoices;
    final showSandboxBanner =
        !EnvConfig.isProduction &&
        !_sandboxBannerDismissed &&
        readiness.valueOrNull?.sandbox == true;

    return Column(
      children: [
        _FeesSummaryCard(summary: summary),
        if (showSandboxBanner) ...[
          const SizedBox(height: 10),
          _SandboxPaymentBanner(
            onDismiss: () => setState(() => _sandboxBannerDismissed = true),
          ),
        ],
        const SizedBox(height: 16),
        _FeeTabs(
          selected: _tab,
          outstandingCount: outstandingInvoices.length,
          onSelected: (value) => setState(() => _tab = value),
        ),
        const SizedBox(height: 18),
        ParentSectionHeader(
          title: _tab == _FeeListTab.outstanding
              ? 'Outstanding fees'
              : 'Recent payment history',
        ),
        const SizedBox(height: 8),
        if (visibleInvoices.isEmpty)
          _EmptyFeeList(
            tab: _tab,
            hasAnyInvoices: summary.recentInvoices.isNotEmpty,
          )
        else
          for (final group in groupInvoicesByDueMonth(visibleInvoices)) ...[
            _MonthHeader(group: group, tab: _tab),
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
      ],
    );
  }
}

class _FeeTabs extends StatelessWidget {
  const _FeeTabs({
    required this.selected,
    required this.outstandingCount,
    required this.onSelected,
  });

  final _FeeListTab selected;
  final int outstandingCount;
  final ValueChanged<_FeeListTab> onSelected;

  @override
  Widget build(BuildContext context) {
    Widget tabButton(_FeeListTab value, String label) {
      final selectedTab = selected == value;
      return Expanded(
        child: Semantics(
          selected: selectedTab,
          button: true,
          child: InkWell(
            onTap: () => onSelected(value),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              decoration: BoxDecoration(
                color: selectedTab
                    ? ParentPortalColors.greenSoft
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selectedTab
                      ? ParentPortalColors.green
                      : ParentPortalColors.muted,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: ParentPortalColors.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          tabButton(
            _FeeListTab.outstanding,
            outstandingCount > 0
                ? 'Outstanding $outstandingCount'
                : 'Outstanding',
          ),
          tabButton(_FeeListTab.history, 'History'),
        ],
      ),
    );
  }
}

class _EmptyFeeList extends StatelessWidget {
  const _EmptyFeeList({required this.tab, required this.hasAnyInvoices});

  final _FeeListTab tab;
  final bool hasAnyInvoices;

  @override
  Widget build(BuildContext context) {
    final outstanding = tab == _FeeListTab.outstanding;
    return PortalCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeatureIcon(
            outstanding
                ? Icons.check_circle_outline_rounded
                : Icons.receipt_long_outlined,
            size: 40,
            color: outstanding
                ? ParentPortalColors.green
                : ParentPortalColors.muted,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  outstanding
                      ? 'No outstanding fees'
                      : 'No payment history yet',
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  outstanding
                      ? 'There is nothing to pay right now.'
                      : hasAnyInvoices
                      ? 'Confirmed payments and receipts will appear here.'
                      : 'The school has not issued an invoice for this child.',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SandboxPaymentBanner extends StatelessWidget {
  const _SandboxPaymentBanner({required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ParentPortalColors.blueSoft,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: ParentPortalColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.science_outlined,
                  size: 20,
                  color: ParentPortalColors.blue,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sandbox payment mode',
                        style: TextStyle(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'No real money will be charged.',
                        style: TextStyle(
                          color: ParentPortalColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Dismiss sandbox notice',
                  onPressed: onDismiss,
                  icon: const Icon(Icons.close_rounded, size: 20),
                ),
              ],
            ),
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(44, 36),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  title: const Text('Sandbox payment mode'),
                  content: const Text(
                    'This build records practice payments for school testing. '
                    'Payments are unavailable offline.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ),
              child: const Text('Learn more'),
            ),
          ],
        ),
      ),
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

/// Groups bills by the BS month of their due date, newest month first.
///
/// Deliberately keyed on `dueDate` rather than `FeeBillingRun.runMonth`: that
/// field's calendar convention is unenforced (the DTO accepts any year over
/// 2000, the finance spec uses AD 2026, seeded invoice numbers use BS 2083),
/// so a fee-period label taken from it could name the wrong month. A due date
/// is a real timestamp and converts unambiguously. The neutral month heading
/// avoids describing a settled invoice as still due.
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
    labels[key] = '${NepaliBsCalendar.monthName(bs.month)} ${bs.year}';
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
  const _MonthHeader({required this.group, required this.tab});

  final ParentFeeMonthGroup group;
  final _FeeListTab tab;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: ParentSectionHeader(
        title: tab == _FeeListTab.outstanding
            ? 'Due in ${group.label}'
            : group.label,
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
    final nothingBilled = !hasDues && summary.feesTotalAmount <= 0;
    return PortalCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Outstanding balance',
            style: TextStyle(color: ParentPortalColors.muted),
          ),
          const SizedBox(height: 2),
          Text(
            _money(summary.feesDue),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: ParentPortalColors.navy,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                hasDues
                    ? Icons.info_outline_rounded
                    : nothingBilled
                    ? Icons.receipt_long_outlined
                    : Icons.check_circle_rounded,
                size: 18,
                color: hasDues
                    ? ParentPortalColors.orange
                    : nothingBilled
                    ? ParentPortalColors.muted
                    : ParentPortalColors.green,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  hasDues
                      ? summary.feesStatus == 'PARTIAL'
                            ? '${_money(summary.feesPaidAmount)} paid so far.'
                            : '${summary.overdueFeesCount > 0 ? '${summary.overdueFeesCount} overdue. ' : ''}Payment is still due.'
                      : nothingBilled
                      ? 'No fee invoice has been issued.'
                      : 'All fees are paid.',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Text(
            hasDues
                ? summary.nextFeeDueDate == null
                      ? 'Next payment: Due date not set'
                      : 'Next payment: ${_date(summary.nextFeeDueDate)}'
                : 'Next payment: No upcoming invoice',
            style: const TextStyle(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w700,
            ),
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
  const _BillBreakdown({required this.invoice, required this.expanded});

  final ParentFeeInvoice invoice;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    if (!expanded) return const SizedBox.shrink();

    if (!invoice.isItemised &&
        invoice.waivers.isEmpty &&
        invoice.refunds.isEmpty) {
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
        const SizedBox(height: 8),
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
                _BreakdownRow(label: 'VAT', amount: _money(invoice.vatAmount)),
                const SizedBox(height: 8),
              ],
              if (invoice.waivers.isNotEmpty) ...[
                const Divider(height: 12),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Approved discounts and waivers',
                    style: TextStyle(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                for (final waiver in invoice.waivers)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _BreakdownRow(
                      label: waiver.reason,
                      amount: '-${_money(waiver.amount)}',
                    ),
                  ),
              ],
              if (invoice.refunds.isNotEmpty) ...[
                const Divider(height: 12),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Refunds and corrections',
                    style: TextStyle(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                for (final refund in invoice.refunds)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _BreakdownRow(
                      label: refund.refundedAt == null
                          ? refund.reason
                          : '${refund.reason} · ${_date(refund.refundedAt)}',
                      amount: _money(refund.amount),
                    ),
                  ),
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
  return 'Due';
}

enum _PaymentAttemptState { idle, processing, checkoutOpened, failed }

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
  bool _showBreakdown = false;
  String? _paymentRequestKey;
  String? _paymentFailureMessage;
  _PaymentAttemptState _paymentState = _PaymentAttemptState.idle;

  @override
  Widget build(BuildContext context) {
    final invoice = widget.invoice;
    final receipt = _latestReceipt(invoice.receipts);
    final readinessProviders = widget.readiness?.providers.isNotEmpty == true
        ? widget.readiness!.providers
        : [
            if (widget.readiness?.providerName != null)
              widget.readiness!.providerName!,
          ];
    final sandboxAllowed =
        !EnvConfig.isProduction || widget.readiness?.sandbox != true;
    final canPay =
        widget.readiness?.enabled == true &&
        readinessProviders.isNotEmpty &&
        sandboxAllowed &&
        (_paymentState == _PaymentAttemptState.idle ||
            _paymentState == _PaymentAttemptState.failed);
    final paymentStatusMessage = !sandboxAllowed
        ? 'Test payments are unavailable in this build.'
        : widget.readinessLoading
        ? 'Checking if you can pay online…'
        : widget.readiness?.enabled == true
        ? 'Payments are unavailable offline.'
        : widget.readiness?.message ??
              'This school does not accept online payment right now.';
    final statusLabel = switch (_paymentState) {
      _PaymentAttemptState.processing => 'Processing',
      _PaymentAttemptState.checkoutOpened => 'Processing',
      _PaymentAttemptState.failed => 'Payment failed',
      _ => _billStatusLabel(invoice),
    };
    final statusColor = switch (_paymentState) {
      _PaymentAttemptState.processing ||
      _PaymentAttemptState.checkoutOpened => ParentPortalColors.blue,
      _PaymentAttemptState.failed => ParentPortalColors.red,
      _ =>
        invoice.isSettled
            ? ParentPortalColors.green
            : ParentPortalColors.orange,
    };
    final statusBackground = switch (_paymentState) {
      _PaymentAttemptState.processing ||
      _PaymentAttemptState.checkoutOpened => ParentPortalColors.blueSoft,
      _PaymentAttemptState.failed => ParentPortalColors.redSoft,
      _ =>
        invoice.isSettled
            ? ParentPortalColors.greenSoft
            : ParentPortalColors.orangeSoft,
    };

    return PortalCard(
      padding: const EdgeInsets.all(16),
      borderColor: invoice.isOverdue
          ? ParentPortalColors.orange.withValues(alpha: .4)
          : ParentPortalColors.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'School fees',
                      style: TextStyle(
                        color: ParentPortalColors.navy,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: StatusBadge(
                  label: statusLabel,
                  color: statusColor,
                  background: statusBackground,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            invoice.isSettled
                ? _money(invoice.totalAmount)
                : '${_money(invoice.outstandingAmount)} due',
            style: const TextStyle(
              color: ParentPortalColors.navy,
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          if (invoice.isSettled)
            Text(
              receipt?.paidAt == null
                  ? 'Payment confirmed'
                  : 'Paid on ${_date(receipt!.paidAt)}',
              style: const TextStyle(color: ParentPortalColors.muted),
            )
          else ...[
            Text(
              invoice.dueDate == null
                  ? 'Due date not set'
                  : 'Due ${_date(invoice.dueDate)}',
              style: TextStyle(
                color: invoice.isOverdue
                    ? ParentPortalColors.orange
                    : ParentPortalColors.muted,
                fontWeight: invoice.isOverdue
                    ? FontWeight.w700
                    : FontWeight.w400,
              ),
            ),
            if (invoice.paidAmount > 0)
              Text(
                '${_money(invoice.paidAmount)} paid so far',
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
          ],
          Text(
            'Invoice ${invoice.invoiceNumber}',
            style: const TextStyle(
              color: ParentPortalColors.muted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (invoice.isSettled)
                FilledButton.icon(
                  onPressed: receipt == null
                      ? null
                      : () => _showReceiptDetails(context, receipt),
                  icon: const Icon(Icons.receipt_long_rounded),
                  label: Text(
                    receipt == null ? 'Receipt unavailable' : 'View receipt',
                  ),
                )
              else
                FilledButton.icon(
                  onPressed: canPay ? _confirmAndStartPayment : null,
                  icon: _paymentState == _PaymentAttemptState.processing
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          widget.readinessLoading
                              ? Icons.hourglass_top_rounded
                              : canPay
                              ? Icons.lock_open_rounded
                              : Icons.lock_outline_rounded,
                        ),
                  label: Text(
                    _paymentState == _PaymentAttemptState.processing
                        ? 'Starting payment…'
                        : widget.readinessLoading
                        ? 'Checking…'
                        : canPay
                        ? invoice.paidAmount > 0
                              ? 'Pay remaining'
                              : 'Pay now'
                        : 'Payment unavailable',
                  ),
                ),
              if (!invoice.isSettled && receipt != null)
                OutlinedButton.icon(
                  onPressed: () => _showReceiptDetails(context, receipt),
                  icon: const Icon(Icons.receipt_long_rounded),
                  label: const Text('View receipt'),
                ),
              OutlinedButton.icon(
                onPressed:
                    invoice.isItemised ||
                        invoice.waivers.isNotEmpty ||
                        invoice.refunds.isNotEmpty
                    ? () => setState(() => _showBreakdown = !_showBreakdown)
                    : null,
                icon: Icon(
                  _showBreakdown
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                ),
                label: Text(
                  invoice.isItemised ||
                          invoice.waivers.isNotEmpty ||
                          invoice.refunds.isNotEmpty
                      ? _showBreakdown
                            ? 'Hide breakdown'
                            : 'View fee breakdown'
                      : 'Breakdown unavailable',
                ),
              ),
            ],
          ),
          _BillBreakdown(invoice: invoice, expanded: _showBreakdown),
          if (invoice.outstandingAmount > 0) ...[
            const SizedBox(height: 8),
            if (_paymentState == _PaymentAttemptState.checkoutOpened)
              _PaymentAttemptNotice(
                color: ParentPortalColors.blueSoft,
                icon: Icons.hourglass_top_rounded,
                message:
                    'Payment is being checked. Do not start another payment.',
                actionLabel: 'Refresh status',
                onAction: _refreshPaymentStatus,
              )
            else if (_paymentState == _PaymentAttemptState.failed)
              _PaymentAttemptNotice(
                color: ParentPortalColors.redSoft,
                icon: Icons.error_outline_rounded,
                message:
                    _paymentFailureMessage ??
                    'The payment could not be started. Nothing was charged.',
                actionLabel: canPay ? 'Try again' : null,
                onAction: canPay ? _confirmAndStartPayment : null,
              )
            else
              Text(
                paymentStatusMessage,
                style: const TextStyle(
                  color: ParentPortalColors.muted,
                  fontSize: 12,
                ),
              ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmAndStartPayment() async {
    final readiness = widget.readiness;
    if (readiness == null ||
        !readiness.enabled ||
        (EnvConfig.isProduction && readiness.sandbox)) {
      return;
    }
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

    setState(() {
      _paymentState = _PaymentAttemptState.processing;
      _paymentFailureMessage = null;
    });
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
        setState(() => _paymentState = _PaymentAttemptState.idle);
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
      setState(() => _paymentState = _PaymentAttemptState.checkoutOpened);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _paymentState = _PaymentAttemptState.failed;
        _paymentFailureMessage = _safePaymentFailureMessage(error);
      });
    }
  }

  Future<void> _refreshPaymentStatus() async {
    await ref
        .read(parentControllerProvider.notifier)
        .load(childId: widget.childId);
    if (!mounted) return;
    setState(() => _paymentState = _PaymentAttemptState.idle);
  }

  void _showReceiptDetails(BuildContext context, ParentFeeReceipt receipt) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) =>
          _ReceiptDetailsSheet(childId: widget.childId, receipt: receipt),
    );
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

class _PaymentAttemptNotice extends StatelessWidget {
  const _PaymentAttemptNotice({
    required this.color,
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final Color color;
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: ParentPortalColors.navy),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: ParentPortalColors.navy),
            ),
          ),
          if (actionLabel != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

class _ReceiptDetailsSheet extends ConsumerStatefulWidget {
  const _ReceiptDetailsSheet({required this.childId, required this.receipt});

  final String childId;
  final ParentFeeReceipt receipt;

  @override
  ConsumerState<_ReceiptDetailsSheet> createState() =>
      _ReceiptDetailsSheetState();
}

class _ReceiptDetailsSheetState extends ConsumerState<_ReceiptDetailsSheet> {
  bool _downloading = false;
  bool _sharing = false;

  @override
  Widget build(BuildContext context) {
    final busy = _downloading || _sharing;
    final paidAt = _receiptDate(widget.receipt.paidAt);
    final issuedAt = _receiptDate(widget.receipt.issuedAt);

    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                FeatureIcon(
                  Icons.verified_rounded,
                  color: ParentPortalColors.green,
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Official receipt',
                        style: TextStyle(
                          color: ParentPortalColors.navy,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'Protected and available only to authorised guardians.',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              _money(widget.receipt.amount),
              style: const TextStyle(
                color: ParentPortalColors.navy,
                fontSize: 28,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            _ReceiptDetailRow(
              label: 'Receipt number',
              value: widget.receipt.receiptNumber,
            ),
            _ReceiptDetailRow(
              label: 'Invoice number',
              value: widget.receipt.invoiceNumber,
            ),
            if (paidAt != null)
              _ReceiptDetailRow(label: 'Payment date', value: paidAt),
            _ReceiptDetailRow(
              label: 'Payment method',
              value: _paymentMethodLabel(widget.receipt.method),
            ),
            _ReceiptDetailRow(
              label: 'Payment reference',
              value: widget.receipt.paymentId,
            ),
            if (issuedAt != null)
              _ReceiptDetailRow(label: 'Receipt issued', value: issuedAt),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: busy ? null : () => _downloadReceipt(context),
                icon: _downloading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_rounded),
                label: const Text('Download receipt'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: busy ? null : () => _shareReceipt(context),
                icon: _sharing
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share_rounded),
                label: const Text('Share receipt'),
              ),
            ),
          ],
        ),
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

class _ReceiptDetailRow extends StatelessWidget {
  const _ReceiptDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 124,
            child: Text(
              label,
              style: const TextStyle(color: ParentPortalColors.muted),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
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

ParentFeeReceipt? _latestReceipt(List<ParentFeeReceipt> receipts) {
  if (receipts.isEmpty) return null;
  final sorted = [...receipts]
    ..sort((a, b) => _receiptTimestamp(b).compareTo(_receiptTimestamp(a)));
  return sorted.first;
}

int _receiptTimestamp(ParentFeeReceipt receipt) =>
    DateTime.tryParse(
      receipt.paidAt ?? receipt.issuedAt ?? '',
    )?.millisecondsSinceEpoch ??
    0;

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

String _paymentMethodLabel(String value) => switch (value) {
  'CASH' => 'Cash',
  'BANK' || 'BANK_TRANSFER' => 'Bank transfer',
  'CARD' => 'Card',
  'MOBILE' => 'Mobile payment',
  'ESEWA' || 'KHALTI' || 'CONNECT_IPS' => _providerLabel(value),
  _ =>
    value
        .toLowerCase()
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' '),
};
