import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_feature_state.dart';
import '../../domain/parent_feature_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentCanteenScreen extends ConsumerStatefulWidget {
  const ParentCanteenScreen({super.key});
  @override
  ConsumerState<ParentCanteenScreen> createState() =>
      _ParentCanteenScreenState();
}

class _ParentCanteenScreenState extends ConsumerState<ParentCanteenScreen> {
  ChildProfile child = parentChildren.first;
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(parentFeatureControllerProvider);
    final balance = child.id == 'aarav' ? state.walletBalance : 340;
    return ParentDetailScaffold(
      title: 'Canteen Wallet',
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          ParentChildSelector(
            child: child,
            showPresence: true,
            onChanged: (value) => setState(() => child = value),
          ),
          const SizedBox(height: 14),
          PortalCard(
            color: ParentPortalColors.greenSoft,
            child: Column(
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
                            'NPR $balance',
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: ParentPortalColors.navy,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Align(
                  alignment: Alignment.centerRight,
                  child: StatusBadge(
                    label: 'Sufficient balance',
                    icon: Icons.check_rounded,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: _editReminder,
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                'Low reminder: NPR ${state.lowBalanceReminder}',
                                style: const TextStyle(
                                  color: ParentPortalColors.muted,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.edit_rounded,
                              size: 16,
                              color: ParentPortalColors.muted,
                            ),
                          ],
                        ),
                      ),
                    ),
                    FilledButton(
                      onPressed: () => _topUp(context),
                      child: const Text('Top up now'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          PortalCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ParentSectionHeader(title: 'Weekly spending'),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (final day in const [
                      ('Mon', 80),
                      ('Tue', 50),
                      ('Wed', 120),
                      ('Thu', 45),
                      ('Fri', 0),
                    ])
                      Expanded(
                        child: Column(
                          children: [
                            Container(
                              width: 38,
                              height: (day.$2 == 0 ? 8 : day.$2 * .45)
                                  .toDouble(),
                              decoration: BoxDecoration(
                                color: day.$2 == 120
                                    ? ParentPortalColors.orange
                                    : day.$2 == 0
                                    ? ParentPortalColors.surfaceAlt
                                    : ParentPortalColors.green,
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(day.$1, style: const TextStyle(fontSize: 12)),
                            Text(
                              day.$2 == 0 ? '—' : 'NPR ${day.$2}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: ParentPortalColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                const PortalCard(
                  color: ParentPortalColors.purpleSoft,
                  padding: EdgeInsets.all(10),
                  child: Text(
                    'Total spent this week:  NPR 295',
                    style: TextStyle(
                      color: ParentPortalColors.purple,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Recent activity'),
          const SizedBox(height: 8),
          PortalCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (
                  var i = 0;
                  i < state.walletTransactions.take(4).length;
                  i++
                ) ...[
                  ListTile(
                    leading: FeatureIcon(
                      state.walletTransactions[i].amount > 0
                          ? Icons.add_card_rounded
                          : Icons.lunch_dining_rounded,
                      color: state.walletTransactions[i].amount > 0
                          ? ParentPortalColors.green
                          : ParentPortalColors.orange,
                      size: 40,
                    ),
                    title: Text(
                      state.walletTransactions[i].title,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text(state.walletTransactions[i].time),
                    trailing: Text(
                      '${state.walletTransactions[i].amount > 0 ? '+' : '-'} NPR ${state.walletTransactions[i].amount.abs()}',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: state.walletTransactions[i].amount > 0
                            ? ParentPortalColors.green
                            : ParentPortalColors.navy,
                      ),
                    ),
                  ),
                  if (i < state.walletTransactions.take(4).length - 1)
                    const Divider(height: 1),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          PortalCard(
            color: ParentPortalColors.purpleSoft,
            child: Row(
              children: [
                const FeatureIcon(Icons.receipt_long_rounded),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lunch purchased 3 times this week',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'Average spend per lunch: NPR 65',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => showFeatureSnack(
                    context,
                    'Top up using eSewa, Khalti, or the school cashier.',
                  ),
                  child: const Text('Top-up instructions'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _topUp(BuildContext context) async {
    final method = await showMockPaymentSheet(
      context,
      title: 'Top up canteen wallet',
    );
    if (method == null || !context.mounted) return;
    ref.read(parentFeatureControllerProvider.notifier).topUp(500);
    showFeatureSnack(context, 'NPR 500 added with $method.');
  }

  Future<void> _editReminder() async {
    final controller = TextEditingController(
      text: '${ref.read(parentFeatureControllerProvider).lowBalanceReminder}',
    );
    final value = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Low balance reminder'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            prefixText: 'NPR ',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, int.tryParse(controller.text)),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value != null) {
      ref
          .read(parentFeatureControllerProvider.notifier)
          .setLowBalanceReminder(value);
    }
  }
}
