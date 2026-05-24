import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';

class ParentFeesScreen extends StatelessWidget {
  const ParentFeesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 2,
      title: 'Fees',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppCard(
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
                                color: isDark
                                    ? AppColors.slate300
                                    : AppColors.slate600,
                              ),
                            ),
                            Text(
                              'NPR 4,200 due',
                              style: theme.textTheme.headlineLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: isDark
                                    ? Colors.white
                                    : AppColors.slate900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const StatusChip(status: AppStatusType.due),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: 'Pay safely',
                    icon: Icons.lock_rounded,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Secure fee payment will open after backend payment permissions are enabled.',
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Fee summary'),
            const SizedBox(height: AppSpacing.sm),
            const DashboardCard(
              title: 'Tuition fee',
              value: 'NPR 3,500',
              icon: Icons.school_rounded,
              iconColor: AppColors.primary,
              subtitle: 'Due by June 5, 2026.',
            ),
            const SizedBox(height: AppSpacing.md),
            const DashboardCard(
              title: 'Library fee',
              value: 'NPR 700',
              icon: Icons.local_library_rounded,
              iconColor: AppColors.warning,
              subtitle: 'Included in this billing cycle.',
            ),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Recent receipts'),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: Column(
                children: const [
                  _ReceiptRow(
                    title: 'April tuition',
                    amount: 'NPR 3,500',
                    date: 'Paid Apr 7',
                  ),
                  Divider(),
                  _ReceiptRow(
                    title: 'Transport fee',
                    amount: 'NPR 1,200',
                    date: 'Paid Apr 7',
                  ),
                  Divider(),
                  _ReceiptRow(
                    title: 'Canteen top-up',
                    amount: 'NPR 1,000',
                    date: 'Paid Mar 28',
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

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.title,
    required this.amount,
    required this.date,
  });

  final String title;
  final String amount;
  final String date;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          const Icon(Icons.receipt_long_rounded, color: AppColors.success),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  date,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            amount,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
