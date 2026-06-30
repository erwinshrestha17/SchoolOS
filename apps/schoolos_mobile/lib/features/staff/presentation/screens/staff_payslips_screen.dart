import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/staff_providers.dart';
import '../../domain/staff_models.dart';

class StaffPayslipsScreen extends ConsumerWidget {
  const StaffPayslipsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payslips = ref.watch(staffPayslipsProvider);

    return RoleShellScaffold(
      role: 'STAFF',
      selectedIndex: 3,
      title: 'My Payslips',
      body: payslips.when(
        loading: () => const AppLoading(message: 'Loading payslips...'),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(staffPayslipsProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(staffPayslipsProvider);
            await ref.read(staffPayslipsProvider.future);
          },
          child: items.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: AppSpacing.xxxl),
                    AppEmptyState(
                      title: 'No payslips yet',
                      message:
                          'Issued payroll slips will appear here after payroll is posted.',
                      icon: Icons.receipt_long_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: items.length + 1,
                  separatorBuilder: (_, index) => index == 0
                      ? const SizedBox(height: AppSpacing.sm)
                      : const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return const SectionHeader(title: 'Payroll History');
                    }
                    final payslip = items[index - 1];
                    return _PayslipCard(
                      payslip: payslip,
                      onDownload: () => _downloadPayslip(context, ref, payslip),
                      onShare: () => _sharePayslip(context, ref, payslip),
                    );
                  },
                ),
        ),
      ),
    );
  }

  Future<void> _downloadPayslip(
    BuildContext context,
    WidgetRef ref,
    StaffPayslip payslip,
  ) async {
    try {
      final download = await ref
          .read(staffRepositoryProvider)
          .downloadPayslipPdf(payslip);
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Saved ${download.fileName}')));
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not download payslip PDF.')),
      );
    }
  }

  Future<void> _sharePayslip(
    BuildContext context,
    WidgetRef ref,
    StaffPayslip payslip,
  ) async {
    try {
      final download = await ref
          .read(staffRepositoryProvider)
          .downloadPayslipPdf(payslip);
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
          content: Text('Payslip was saved, but sharing is unavailable.'),
        ),
      );
    }
  }
}

class _PayslipCard extends StatelessWidget {
  const _PayslipCard({
    required this.payslip,
    required this.onDownload,
    required this.onShare,
  });

  final StaffPayslip payslip;
  final VoidCallback onDownload;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payslip.periodLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      payslip.payslipNumber.isEmpty
                          ? 'Payslip'
                          : payslip.payslipNumber,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.slate500,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: payslip.status == 'ISSUED'
                    ? AppStatusType.published
                    : AppStatusType.draft,
                label: _label(payslip.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _AmountColumn(
                  label: 'Gross',
                  value: _money(payslip.grossSalary),
                ),
              ),
              Expanded(
                child: _AmountColumn(
                  label: 'Deductions',
                  value: _money(payslip.deductionAmount),
                ),
              ),
              Expanded(
                child: _AmountColumn(
                  label: 'Net Pay',
                  value: _money(payslip.netSalary),
                  emphasize: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(
                payslip.paymentStatus == 'PAID'
                    ? Icons.verified_rounded
                    : Icons.schedule_rounded,
                size: 16,
                color: payslip.paymentStatus == 'PAID'
                    ? AppColors.success
                    : AppColors.warning,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Payment ${_label(payslip.paymentStatus)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.slate500,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          if (payslip.payslipNumber.isNotEmpty) ...[
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
        ],
      ),
    );
  }
}

class _AmountColumn extends StatelessWidget {
  const _AmountColumn({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.slate500, fontSize: 11),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: emphasize ? AppColors.successDark : AppColors.slate800,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

String _money(double value) {
  return 'NPR ${value.toStringAsFixed(0)}';
}

String _label(String value) {
  return value
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
      )
      .join(' ');
}
