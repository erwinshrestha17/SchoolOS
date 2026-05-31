import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentCanteenScreen extends ConsumerWidget {
  const ParentCanteenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'Canteen',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before viewing canteen.',
                icon: Icons.restaurant_rounded,
              )
            : _CanteenContent(childId: childId),
      ),
    );
  }
}

class _CanteenContent extends ConsumerWidget {
  const _CanteenContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canteen = ref.watch(parentCanteenProvider(childId));

    return canteen.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 160),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 96),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load canteen',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentCanteenProvider(childId)),
      ),
      data: (info) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentCanteenProvider(childId));
          await ref.read(parentCanteenProvider(childId).future);
        },
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _WalletCard(info: info),
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Meal plans'),
            const SizedBox(height: AppSpacing.sm),
            if (info.activeMealPlans.isEmpty)
              const AppEmptyState(
                title: 'No active meal plan',
                message: 'Meal plans will appear after school enrollment.',
                icon: Icons.restaurant_menu_rounded,
              )
            else
              for (final plan in info.activeMealPlans) ...[
                AppCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.restaurant_menu_rounded,
                      color: AppColors.success,
                    ),
                    title: Text(plan.name),
                    subtitle: Text(_labelize(plan.mealType)),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            const SizedBox(height: AppSpacing.lg),
            const SectionHeader(title: 'Recent wallet activity'),
            const SizedBox(height: AppSpacing.sm),
            if (info.recentTransactions.isEmpty)
              const AppEmptyState(
                title: 'No transactions yet',
                message: 'Wallet activity will appear here.',
                icon: Icons.account_balance_wallet_rounded,
              )
            else
              for (final transaction in info.recentTransactions.take(5)) ...[
                _TransactionTile(transaction: transaction),
                const SizedBox(height: AppSpacing.md),
              ],
            const SizedBox(height: AppSpacing.lg),
            const SectionHeader(title: 'Menu preview'),
            const SizedBox(height: AppSpacing.sm),
            for (final item in info.menuItems.take(6)) ...[
              _MenuItemTile(item: item),
              const SizedBox(height: AppSpacing.md),
            ],
          ],
        ),
      ),
    );
  }
}

class _WalletCard extends StatelessWidget {
  const _WalletCard({required this.info});

  final ParentCanteenInfo info;

  @override
  Widget build(BuildContext context) {
    final balance = info.walletBalance;

    return AppCard(
      color: info.isLowBalance
          ? AppColors.warningLight
          : AppColors.successLight,
      border: Border.all(
        color: (info.isLowBalance ? AppColors.warning : AppColors.success)
            .withValues(alpha: 0.22),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(
              Icons.account_balance_wallet_rounded,
              color: info.isLowBalance ? AppColors.warning : AppColors.success,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Wallet balance',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.slate600,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  balance == null ? 'No wallet' : _money(balance),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: AppColors.slate900,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(
            status: info.isLowBalance ? AppStatusType.due : AppStatusType.paid,
            label: info.isLowBalance ? 'Low' : 'Healthy',
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final ParentCanteenTransaction transaction;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          const Icon(Icons.receipt_long_rounded, color: AppColors.primary),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _labelize(transaction.type),
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text(
                  _date(transaction.transactionDate) ?? 'Date not available',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
          Text(
            _money(transaction.amount),
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _MenuItemTile extends StatelessWidget {
  const _MenuItemTile({required this.item});

  final ParentMenuItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          const Icon(Icons.lunch_dining_rounded, color: AppColors.success),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text(
                  item.allergenTags.isEmpty
                      ? _labelize(item.category)
                      : '${_labelize(item.category)} • Allergens: ${item.allergenTags.join(', ')}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
          Text(
            _money(item.unitPrice),
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

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
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
