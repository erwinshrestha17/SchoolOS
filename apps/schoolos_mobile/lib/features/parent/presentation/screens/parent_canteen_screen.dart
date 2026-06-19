import 'dart:math';

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
          _WalletCard(info: info, childId: childId),
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
          const ParentSectionHeader(title: 'What your child consumed'),
          const SizedBox(height: 8),
          if (info.recentServings.isEmpty)
            const PortalCard(
              child: Text('No meal consumption has been recorded yet.'),
            )
          else
            PortalCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (
                    var index = 0;
                    index < info.recentServings.length;
                    index++
                  ) ...[
                    _ServingTile(item: info.recentServings[index]),
                    if (index != info.recentServings.length - 1)
                      const Divider(height: 1),
                  ],
                ],
              ),
            ),
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
          const ParentSectionHeader(title: 'School cooked menu'),
          const SizedBox(height: 8),
          if (info.menuItems.where((item) => item.isMealItem).isEmpty)
            const PortalCard(
              child: Text('The school has not published a cooked menu.'),
            )
          else
            for (final item
                in info.menuItems.where((item) => item.isMealItem).take(6)) ...[
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
                            [
                              item.category,
                              if (item.description?.isNotEmpty == true)
                                item.description,
                            ].whereType<String>().join(' • '),
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

class _ServingTile extends StatelessWidget {
  const _ServingTile({required this.item});

  final ParentMealServing item;

  @override
  Widget build(BuildContext context) {
    final consumed = item.status == 'SERVED';
    return ListTile(
      leading: FeatureIcon(
        consumed ? Icons.restaurant_rounded : Icons.no_meals_rounded,
        color: consumed ? ParentPortalColors.green : ParentPortalColors.orange,
        size: 40,
      ),
      title: Text(
        item.notes?.isNotEmpty == true
            ? item.notes!
            : item.mealPlanName ?? item.mealType,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      subtitle: Text('${_dateLabel(item.mealDate)} • ${_label(item.mealType)}'),
      trailing: StatusBadge(
        label: consumed ? 'Consumed' : _label(item.status),
        color: consumed ? ParentPortalColors.green : ParentPortalColors.orange,
        background: consumed
            ? ParentPortalColors.greenSoft
            : ParentPortalColors.orangeSoft,
      ),
    );
  }
}

class _WalletCard extends ConsumerStatefulWidget {
  const _WalletCard({required this.info, required this.childId});

  final ParentCanteenInfo info;
  final String childId;

  @override
  ConsumerState<_WalletCard> createState() => _WalletCardState();
}

class _WalletCardState extends ConsumerState<_WalletCard> {
  bool _isToppingUp = false;
  String? _requestKey;

  @override
  Widget build(BuildContext context) {
    final balance = widget.info.walletBalance;
    final readiness = ref.watch(
      parentPaymentGatewayReadinessProvider(widget.childId),
    );
    final canTopUp = readiness.valueOrNull?.sandbox == true && !_isToppingUp;
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
                label: widget.info.isLowBalance ? 'Low balance' : 'OK',
                color: widget.info.isLowBalance
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
                background: widget.info.isLowBalance
                    ? ParentPortalColors.orangeSoft
                    : Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: canTopUp ? _topUp : null,
            icon: _isToppingUp
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    canTopUp
                        ? Icons.add_card_rounded
                        : Icons.lock_outline_rounded,
                  ),
            label: Text(
              _isToppingUp
                  ? 'Adding balance...'
                  : canTopUp
                  ? 'Sandbox top-up'
                  : 'Top-up unavailable',
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _topUp() async {
    final readiness = await ref.read(
      parentPaymentGatewayReadinessProvider(widget.childId).future,
    );
    if (!readiness.sandbox || readiness.providers.isEmpty || !mounted) return;
    var amount = 1000;
    var provider = readiness.providers.first;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Sandbox wallet top-up'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Choose amount'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final value in const [500, 1000, 2000])
                    ChoiceChip(
                      label: Text(_money(value)),
                      selected: amount == value,
                      onSelected: (_) => setDialogState(() => amount = value),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Payment provider'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: provider,
                items: [
                  for (final item in readiness.providers)
                    DropdownMenuItem(
                      value: item,
                      child: Text(_providerLabel(item)),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) {
                    setDialogState(() => provider = value);
                  }
                },
              ),
              const SizedBox(height: 12),
              const Text(
                'This is a test payment. SchoolOS will add the amount immediately.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Confirm top-up'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isToppingUp = true);
    _requestKey ??= _sandboxRequestKey();
    try {
      final result = await ref
          .read(parentRepositoryProvider)
          .topUpCanteenInSandbox(
            childId: widget.childId,
            amount: amount,
            provider: provider,
            idempotencyKey: _requestKey!,
          );
      ref.invalidate(parentCanteenProvider(widget.childId));
      await ref.read(parentCanteenProvider(widget.childId).future);
      if (!mounted) return;
      showFeatureSnack(
        context,
        '${_providerLabel(provider)} sandbox top-up added. Balance ${_money(result.walletBalance ?? 0)}.',
      );
    } catch (_) {
      if (!mounted) return;
      showFeatureSnack(
        context,
        'Top-up failed. No wallet balance was changed.',
      );
    } finally {
      if (mounted) setState(() => _isToppingUp = false);
    }
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

String _dateLabel(String? value) {
  final date = DateTime.tryParse(value ?? '')?.toLocal();
  if (date == null) return 'Date not recorded';
  return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}

String _label(String value) => value
    .toLowerCase()
    .split('_')
    .map(
      (part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}',
    )
    .join(' ');

String _providerLabel(String value) => switch (value) {
  'ESEWA' => 'eSewa',
  'KHALTI' => 'Khalti',
  'CONNECT_IPS' => 'connectIPS',
  _ => value,
};

String _sandboxRequestKey() {
  final random = Random.secure();
  return 'canteen-${DateTime.now().microsecondsSinceEpoch}-${random.nextInt(1 << 32).toRadixString(16)}';
}
