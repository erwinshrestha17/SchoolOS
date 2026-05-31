import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentFeesScreen extends ConsumerWidget {
  const ParentFeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 2,
      title: 'Fees',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (state.dashboard != null) ...[
                _FeeBalanceCard(summary: state.dashboard!),
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Invoices'),
                const SizedBox(height: AppSpacing.sm),
                if (state.dashboard!.recentInvoices.isEmpty)
                  const AppEmptyState(
                    title: 'No invoices yet',
                    message:
                        'Fee invoices from the school will appear here when published.',
                    icon: Icons.receipt_long_rounded,
                  )
                else
                  for (final invoice in state.dashboard!.recentInvoices) ...[
                    _InvoiceCard(invoice: invoice),
                    const SizedBox(height: AppSpacing.md),
                  ],
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: 'Receipts'),
                const SizedBox(height: AppSpacing.sm),
                if (state.dashboard!.recentReceipts.isEmpty)
                  const AppEmptyState(
                    title: 'No receipts yet',
                    message:
                        'Receipts from confirmed school payments will appear here.',
                    icon: Icons.verified_rounded,
                  )
                else
                  for (final receipt in state.dashboard!.recentReceipts) ...[
                    _ReceiptCard(
                      receipt: receipt,
                      onDownload: () => _downloadReceipt(
                        context,
                        ref,
                        state.dashboard!.child.id,
                        receipt,
                      ),
                      onShare: () => _shareReceipt(
                        context,
                        ref,
                        state.dashboard!.child.id,
                        receipt,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _downloadReceipt(
    BuildContext context,
    WidgetRef ref,
    String childId,
    ParentFeeReceipt receipt,
  ) async {
    try {
      final download = await ref
          .read(parentRepositoryProvider)
          .downloadReceiptPdf(childId: childId, receipt: receipt);
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Saved ${download.fileName}')),
      );
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not download receipt PDF.')),
      );
    }
  }

  Future<void> _shareReceipt(
    BuildContext context,
    WidgetRef ref,
    String childId,
    ParentFeeReceipt receipt,
  ) async {
    try {
      final download = await ref
          .read(parentRepositoryProvider)
          .downloadReceiptPdf(childId: childId, receipt: receipt);
      await const FileShareService().shareFile(
        filePath: download.filePath,
        mimeType: 'application/pdf',
        subject: download.fileName,
      );
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Receipt was saved, but sharing is unavailable.'),
        ),
      );
    }
  }
}

class _FeeBalanceCard extends StatelessWidget {
  const _FeeBalanceCard({required this.summary});

  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final hasDues = summary.feesDue > 0;

    return AppCard(
      color: isDark ? AppColors.slate900 : AppColors.primaryLight,
      border: Border.all(
        color: AppColors.primary.withValues(alpha: isDark ? 0.4 : 0.16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Current balance',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: isDark ? AppColors.slate300 : AppColors.slate600,
                      ),
                    ),
                    Text(
                      hasDues ? '${_money(summary.feesDue)} due' : 'No dues',
                      style: theme.textTheme.headlineLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : AppColors.slate900,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: hasDues ? AppStatusType.due : AppStatusType.paid,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _MiniMetric(
                  title: 'Overdue',
                  value: '${summary.overdueFeesCount}',
                  icon: Icons.warning_amber_rounded,
                  iconColor: summary.overdueFeesCount > 0
                      ? AppColors.warning
                      : AppColors.success,
                  subtitle: 'Invoices past due date.',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _MiniMetric(
                  title: 'Next due',
                  value: _date(summary.nextFeeDueDate) ?? 'None',
                  icon: Icons.event_available_rounded,
                  iconColor: AppColors.info,
                  subtitle: 'From published invoices.',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: hasDues ? 'View payment options' : 'All fees are clear',
            icon: hasDues ? Icons.lock_rounded : Icons.verified_rounded,
            onPressed: hasDues
                ? () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Online payment will open after the school enables mobile payment permissions.',
                        ),
                      ),
                    );
                  }
                : null,
          ),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({
    required this.title,
    required this.value,
    required this.icon,
    required this.iconColor,
    required this.subtitle,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? AppColors.slate800 : Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: isDark ? AppColors.slate700 : AppColors.slate200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
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
    final hasDue = invoice.outstandingAmount > 0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.receipt_long_rounded, color: AppColors.primary),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.invoiceNumber,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Due ${_date(invoice.dueDate) ?? 'not set'}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: hasDue ? AppStatusType.due : AppStatusType.paid,
                label: invoice.isOverdue ? 'Overdue' : null,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              _AmountBlock(label: 'Total', value: invoice.totalAmount),
              _AmountBlock(label: 'Paid', value: invoice.paidAmount),
              _AmountBlock(label: 'Due', value: invoice.outstandingAmount),
            ],
          ),
          if (invoice.receipts.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final receipt in invoice.receipts)
                  Chip(
                    avatar: const Icon(Icons.verified_rounded, size: 18),
                    label: Text(receipt.receiptNumber),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({
    required this.receipt,
    required this.onDownload,
    required this.onShare,
  });

  final ParentFeeReceipt receipt;
  final VoidCallback onDownload;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: const Icon(
                  Icons.verified_rounded,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      receipt.receiptNumber,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${receipt.invoiceNumber} - ${_labelize(receipt.method)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _date(receipt.issuedAt ?? receipt.paidAt) ??
                          'Issued date pending',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Text(
                _money(receipt.amount),
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onDownload,
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Download'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onShare,
                  icon: const Icon(Icons.ios_share_rounded, size: 18),
                  label: const Text('Share'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AmountBlock extends StatelessWidget {
  const _AmountBlock({required this.label, required this.value});

  final String label;
  final num value;

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
            _money(value),
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

String _money(num value) {
  final amount = value % 1 == 0
      ? value.toInt().toString()
      : value.toStringAsFixed(2);
  return 'NPR $amount';
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

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}
