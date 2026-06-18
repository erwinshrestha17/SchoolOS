import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentCanteenScreen extends ConsumerWidget {
  const ParentCanteenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = state.selectedChild;

    return ParentDetailScaffold(
      title: 'Canteen Wallet',
      selectedIndex: 4,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.success when child != null => RefreshIndicator(
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
              _CanteenBody(childId: child.id),
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _CanteenBody extends ConsumerWidget {
  const _CanteenBody({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canteen = ref.watch(parentCanteenProvider(childId));

    return canteen.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentCanteenProvider(childId)),
      ),
      data: (info) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _WalletCard(info: info),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Active meal plans'),
          const SizedBox(height: 8),
          if (info.activeMealPlans.isEmpty)
            const PortalCard(child: Text('No active meal plan assigned.'))
          else
            for (final plan in info.activeMealPlans) ...[
              PortalCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const FeatureIcon(Icons.restaurant_menu_rounded),
                  title: Text(
                    plan.name,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text(plan.mealType),
                ),
              ),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Recent wallet activity'),
          const SizedBox(height: 8),
          if (info.recentTransactions.isEmpty)
            const PortalCard(child: Text('No canteen transactions yet.'))
          else
            PortalCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (
                    var index = 0;
                    index < info.recentTransactions.length;
                    index++
                  ) ...[
                    _TransactionTile(item: info.recentTransactions[index]),
                    if (index != info.recentTransactions.length - 1)
                      const Divider(height: 1),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Menu preview'),
          const SizedBox(height: 8),
          if (info.menuItems.isEmpty)
            const PortalCard(child: Text('No active menu items available.'))
          else
            for (final item in info.menuItems.take(6)) ...[
              PortalCard(
                child: Row(
                  children: [
                    const FeatureIcon(Icons.lunch_dining_rounded),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          Text(
                            item.category,
                            style: const TextStyle(
                              color: ParentPortalColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      _money(item.unitPrice),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
        ],
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
    return PortalCard(
      color: ParentPortalColors.greenSoft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(
                Icons.account_balance_wallet_rounded,
                color: ParentPortalColors.green,
                size: 58,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Current balance',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                    Text(
                      balance == null ? 'No wallet' : _money(balance),
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: ParentPortalColors.navy,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: info.isLowBalance ? 'Low balance' : 'OK',
                color: info.isLowBalance
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
                background: info.isLowBalance
                    ? ParentPortalColors.orangeSoft
                    : Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => showUnavailableWorkflowSnack(
              context,
              'Canteen top-up is not enabled in the parent app yet.',
            ),
            icon: const Icon(Icons.lock_outline_rounded),
            label: const Text('Top-up unavailable'),
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.item});

  final ParentCanteenTransaction item;

  @override
  Widget build(BuildContext context) {
    final credit = item.amount > 0;
    return ListTile(
      leading: FeatureIcon(
        credit ? Icons.add_card_rounded : Icons.lunch_dining_rounded,
        color: credit ? ParentPortalColors.green : ParentPortalColors.orange,
        size: 40,
      ),
      title: Text(
        item.note?.isNotEmpty == true ? item.note! : item.type,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      subtitle: Text('Balance after ${_money(item.balanceAfter)}'),
      trailing: Text(
        '${credit ? '+' : ''}${_money(item.amount)}',
        style: TextStyle(
          fontWeight: FontWeight.w900,
          color: credit ? ParentPortalColors.green : ParentPortalColors.navy,
        ),
      ),
    );
  }
}

String _money(num value) => 'NPR ${value.toStringAsFixed(0)}';
