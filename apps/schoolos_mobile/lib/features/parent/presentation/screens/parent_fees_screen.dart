import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_feature_state.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentFeesScreen extends ConsumerWidget {
  const ParentFeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paid = ref.watch(
      parentFeatureControllerProvider.select((state) => state.invoicePaid),
    );
    return ParentDetailScaffold(
      title: 'Fees & Payments',
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const ParentSectionHeader(title: 'Family summary'),
          const SizedBox(height: 8),
          PortalCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
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
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: ParentPortalColors.navy,
                            ),
                          ),
                          Text(
                            paid ? 'Paid today' : 'Due by 25 Ashadh',
                            style: const TextStyle(
                              color: ParentPortalColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(
                      label: paid ? 'All paid' : '1 invoice due',
                      color: paid
                          ? ParentPortalColors.green
                          : ParentPortalColors.orange,
                      background: paid
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.orangeSoft,
                      icon: paid
                          ? Icons.check_circle_rounded
                          : Icons.warning_amber_rounded,
                    ),
                  ],
                ),
                const Divider(height: 26),
                Row(
                  children: [
                    const AvatarInitials(
                      name: 'Aarohi Shrestha',
                      radius: 17,
                      color: ParentPortalColors.red,
                    ),
                    const SizedBox(width: 6),
                    const AvatarInitials(name: 'Aarav Shrestha', radius: 17),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        paid
                            ? 'Both children have no dues'
                            : 'Aarohi has 1 invoice due • Aarav has no dues',
                        style: const TextStyle(color: ParentPortalColors.muted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const ParentSectionHeader(title: 'Invoices'),
          const SizedBox(height: 8),
          PortalCard(
            borderColor: paid
                ? ParentPortalColors.border
                : ParentPortalColors.red.withValues(alpha: .35),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const AvatarInitials(
                      name: 'Aarohi Shrestha',
                      radius: 28,
                      color: ParentPortalColors.red,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Aarohi Shrestha • LKG-A',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'June Tuition Fee',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: ParentPortalColors.navy,
                            ),
                          ),
                          Text(
                            'Invoice INV-2083-00458',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(
                      label: paid ? 'Paid' : 'Unpaid',
                      color: paid
                          ? ParentPortalColors.green
                          : ParentPortalColors.red,
                      background: paid
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.redSoft,
                    ),
                  ],
                ),
                const Divider(height: 24),
                const Row(
                  children: [
                    Expanded(child: _FeeMetric('Amount', 'NPR 4,500')),
                    Expanded(child: _FeeMetric('Due', '25 Ashadh')),
                  ],
                ),
                const SizedBox(height: 12),
                if (!paid)
                  const PortalCard(
                    color: ParentPortalColors.redSoft,
                    padding: EdgeInsets.all(10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.error_rounded,
                          color: ParentPortalColors.red,
                          size: 18,
                        ),
                        SizedBox(width: 7),
                        Text(
                          'Payment due in 3 days',
                          style: TextStyle(
                            color: ParentPortalColors.red,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: paid ? null : () => _pay(context, ref),
                        icon: Icon(
                          paid
                              ? Icons.check_rounded
                              : Icons.credit_card_rounded,
                        ),
                        label: Text(paid ? 'Paid' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _invoicePreview(context),
                        icon: const Icon(Icons.description_outlined),
                        label: const Text('View invoice'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
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
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'No dues this month',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'You’re all set!',
                        style: TextStyle(color: ParentPortalColors.green),
                      ),
                    ],
                  ),
                ),
                StatusBadge(label: 'Paid'),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const ParentSectionHeader(title: 'Recent receipt'),
          const SizedBox(height: 8),
          PortalCard(
            onTap: () => _receiptPreview(context),
            child: const Row(
              children: [
                FeatureIcon(Icons.receipt_long_rounded),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Aarohi Shrestha • LKG-A',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                      Text(
                        'May Tuition Fee',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'Receipt RCPT-2083-00391',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'NPR 4,500',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'Paid on 25 Jestha',
                      style: TextStyle(
                        color: ParentPortalColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                SizedBox(width: 4),
                ListChevron(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pay(BuildContext context, WidgetRef ref) async {
    final method = await showMockPaymentSheet(context);
    if (method == null || !context.mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete mock payment?'),
        content: Text('Pay NPR 4,500 with $method?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Complete payment'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(parentFeatureControllerProvider.notifier).completePayment();
      if (context.mounted) {
        showFeatureSnack(context, 'Payment completed. Receipt is ready.');
      }
    }
  }

  void _invoicePreview(BuildContext context) => _preview(
    context,
    'June Tuition Fee',
    'Invoice INV-2083-00458\nAarohi Shrestha • NPR 4,500',
  );
  void _receiptPreview(BuildContext context) => _preview(
    context,
    'May Tuition Fee receipt',
    'Receipt RCPT-2083-00391\nPaid on 25 Jestha',
  );
  void _preview(BuildContext context, String title, String body) =>
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const FeatureIcon(Icons.description_rounded, size: 60),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 18),
              ],
            ),
          ),
        ),
      );
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
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
      ),
    ],
  );
}
