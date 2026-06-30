import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/platform/file_share_service.dart';
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
        _ => PortalErrorState(onRetry: controller.load),
      },
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
      error: (_, _) =>
          PortalCard(child: Text('Could not load fees for ${child.name}.')),
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
        const ParentSectionHeader(title: 'Invoices'),
        const SizedBox(height: 8),
        if (summary.recentInvoices.isEmpty)
          const PortalCard(child: Text('No issued invoices for this child.'))
        else
          for (final invoice in summary.recentInvoices) ...[
            _InvoiceCard(
              childId: child.id,
              invoice: invoice,
              readiness: readiness.valueOrNull,
              readinessLoading: readiness.isLoading,
            ),
            const SizedBox(height: 12),
          ],
        const SizedBox(height: 18),
        const ParentSectionHeader(title: 'Confirmed receipts'),
        const SizedBox(height: 8),
        if (summary.recentReceipts.isEmpty)
          const PortalCard(
            child: Text(
              'No confirmed receipts available yet. Receipts appear after the backend confirms payment.',
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
                'Checking the school payment provider...',
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
          'We could not confirm payment provider readiness. No payment can be started from mobile.',
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
                              ? 'Sandbox ready'
                              : 'Online ready'
                        : 'Unavailable',
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
                    'SchoolOS never queues fee payments offline.',
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
                  'Fee status',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
                Text(
                  hasDues ? _money(summary.feesDue) : 'Paid',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: ParentPortalColors.navy,
                  ),
                ),
                Text(
                  hasDues
                      ? 'Paid ${_money(summary.feesPaidAmount)} of ${_money(summary.feesTotalAmount)}'
                      : 'No outstanding school fee balance from the backend.',
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                Text(
                  !hasDues
                      ? 'Receipts remain available after confirmation.'
                      : summary.nextFeeDueDate == null
                      ? 'No upcoming due date from school.'
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
                : 'Paid',
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
  String? _paymentRequestKey;

  @override
  Widget build(BuildContext context) {
    final invoice = widget.invoice;
    final canPay = widget.readiness?.enabled == true && !_startingPayment;
    final paymentStatusMessage = widget.readinessLoading
        ? 'Checking provider readiness before payment.'
        : widget.readiness?.enabled == true
        ? 'Payment starts online only and remains backend-gated.'
        : widget.readiness?.message ??
              'Online payment is not available for this school right now.';
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
                      ? 'Starting secure payment...'
                      : widget.readinessLoading
                      ? 'Checking payment provider'
                      : canPay
                      ? 'Pay ${_money(invoice.outstandingAmount)}'
                      : 'Payment unavailable',
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
        title: const Text('Continue to secure payment?'),
        content: Text(
          '${widget.invoice.invoiceNumber}\nAmount: ${_money(widget.invoice.outstandingAmount)}\nProvider: ${_providerLabel(provider)}${readiness.sandbox ? '\n\nSandbox mode: this test payment will be confirmed immediately.' : ''}',
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
        await ref
            .read(parentControllerProvider.notifier)
            .load(childId: widget.childId);
        if (!mounted) return;
        showFeatureSnack(
          context,
          'Sandbox payment confirmed${result.receiptNumber == null ? '' : ' • Receipt ${result.receiptNumber}'}.',
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
        'Secure checkout opened. The receipt will appear after payment confirmation.',
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
                'Choose payment provider',
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
                        ? 'Sandbox payment - confirmed immediately'
                        : 'Secure online checkout - internet required',
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
                tooltip: 'Download protected receipt',
                onPressed: busy ? null : () => _downloadReceipt(context),
                icon: _downloading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_rounded),
              ),
              IconButton(
                tooltip: 'Share protected receipt',
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
            'Protected PDF. Available only after confirmed backend receipt generation.',
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
    return 'Payment could not be started. This action needs internet and no charge was recorded.';
  }
  if (error is AppException) {
    return error.message;
  }
  return 'Payment could not be started. No charge was recorded. Please try again.';
}

String _safeReceiptFailureMessage(Object error) {
  if (error is NetworkException || error is TimeoutException) {
    return 'We could not download this receipt. Check your connection and try again.';
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

String _money(num value) => 'NPR ${value.toStringAsFixed(0)}';

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
