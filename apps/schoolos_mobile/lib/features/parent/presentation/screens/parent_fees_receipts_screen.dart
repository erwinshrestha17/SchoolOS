import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_feature_state.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentFeesReceiptsScreen extends ConsumerWidget {
  const ParentFeesReceiptsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paid = ref.watch(
      parentFeatureControllerProvider.select((s) => s.invoicePaid),
    );
    return ParentDetailScaffold(
      title: 'Fees & Receipts',
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const ParentSectionHeader(title: 'Family summary'),
          const SizedBox(height: 8),
          PortalCard(
            child: Row(
              children: [
                const FeatureIcon(
                  Icons.groups_rounded,
                  color: ParentPortalColors.orange,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total dues',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                      Text(
                        paid ? 'NPR 0' : 'NPR 4,500',
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const Text(
                        'Across 2 children',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Due date',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                    Text(
                      paid ? 'Paid' : '25 Ashadh',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    StatusBadge(
                      label: paid ? 'All paid' : '1 invoice due',
                      color: paid
                          ? ParentPortalColors.green
                          : ParentPortalColors.orange,
                      background: paid
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.orangeSoft,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Invoices by child'),
          const SizedBox(height: 8),
          PortalCard(
            borderColor: paid
                ? ParentPortalColors.border
                : ParentPortalColors.orange.withValues(alpha: .4),
            child: Column(
              children: [
                Row(
                  children: [
                    const AvatarInitials(
                      name: 'Aarohi Shrestha',
                      radius: 28,
                      color: ParentPortalColors.orange,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Aarohi Shrestha • LKG-A',
                            style: TextStyle(fontWeight: FontWeight.w900),
                          ),
                          Text(
                            'June Tuition Fee',
                            style: TextStyle(color: ParentPortalColors.purple),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(
                      label: paid ? 'Paid' : 'Unpaid',
                      color: paid
                          ? ParentPortalColors.green
                          : ParentPortalColors.orange,
                      background: paid
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.orangeSoft,
                    ),
                  ],
                ),
                const Divider(height: 24),
                const Row(
                  children: [
                    Expanded(
                      child: _ReceiptMetric('Invoice no.', 'INV-2025-0612'),
                    ),
                    Expanded(child: _ReceiptMetric('Amount', 'NPR 4,500')),
                    Expanded(child: _ReceiptMetric('Due date', '25 Ashadh')),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => showFeatureSnack(
                          context,
                          'Invoice preview opened.',
                        ),
                        icon: const Icon(Icons.description_outlined),
                        label: const Text('View invoice'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: paid ? null : () => _pay(context, ref),
                        icon: const Icon(Icons.credit_card),
                        label: Text(paid ? 'Paid' : 'Pay now'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          const PortalCard(
            child: Row(
              children: [
                AvatarInitials(name: 'Aarav Shrestha', radius: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Aarav Shrestha • Nursery-A',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text('No dues this month'),
                      Text(
                        'You’re all set',
                        style: TextStyle(color: ParentPortalColors.green),
                      ),
                    ],
                  ),
                ),
                StatusBadge(label: 'Paid'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Recent receipts'),
          const SizedBox(height: 8),
          PortalCard(
            child: Row(
              children: [
                const FeatureIcon(
                  Icons.receipt_long_rounded,
                  color: ParentPortalColors.green,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'June Tuition Fee',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'Aarav Shrestha • Nursery-A',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                      Text(
                        'Receipt no. RCPT-2025-0548',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'NPR 4,500',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'Paid on\n10 Ashadh, 2082',
                      textAlign: TextAlign.end,
                      style: TextStyle(
                        fontSize: 11,
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => showFeatureSnack(
                    context,
                    'Receipt downloaded to the local preview.',
                  ),
                  icon: const Icon(
                    Icons.download_rounded,
                    color: ParentPortalColors.purple,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => _history(context),
            icon: const Icon(Icons.history_rounded),
            label: const Text('View all receipts'),
          ),
        ],
      ),
    );
  }

  Future<void> _pay(BuildContext context, WidgetRef ref) async {
    final method = await showMockPaymentSheet(context);
    if (method != null) {
      ref.read(parentFeatureControllerProvider.notifier).completePayment();
      if (context.mounted) {
        showFeatureSnack(context, 'Payment completed with $method.');
      }
    }
  }

  void _history(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => const SafeArea(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Receipt history',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            ListTile(
              leading: Icon(
                Icons.receipt_long,
                color: ParentPortalColors.green,
              ),
              title: Text('June Tuition Fee'),
              subtitle: Text('RCPT-2025-0548 • NPR 4,500'),
            ),
            ListTile(
              leading: Icon(
                Icons.receipt_long,
                color: ParentPortalColors.green,
              ),
              title: Text('May Tuition Fee'),
              subtitle: Text('RCPT-2083-00391 • NPR 4,500'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ReceiptMetric extends StatelessWidget {
  const _ReceiptMetric(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
      ),
      Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
      ),
    ],
  );
}
