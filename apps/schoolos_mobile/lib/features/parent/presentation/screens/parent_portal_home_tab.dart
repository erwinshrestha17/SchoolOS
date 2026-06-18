import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalHomeTab extends StatefulWidget {
  const ParentPortalHomeTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  State<ParentPortalHomeTab> createState() => _ParentPortalHomeTabState();
}

class _ParentPortalHomeTabState extends State<ParentPortalHomeTab>
    with AutomaticKeepAliveClientMixin {
  String selectedChild = 'all';

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final children = selectedChild == 'all'
        ? widget.data.children
        : widget.data.children
              .where((child) => child.id == selectedChild)
              .toList();

    return ListView(
      key: const PageStorageKey('parent-home'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        Text(
          'Namaste, Erwin',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            color: ParentPortalColors.navy,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Row(
          children: [
            const Icon(
              Icons.family_restroom_rounded,
              size: 17,
              color: ParentPortalColors.muted,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '2 linked children • Updated ${widget.data.lastUpdated}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: ParentPortalColors.orangeSoft,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: ParentPortalColors.orange.withValues(alpha: .45),
              ),
            ),
            child: const FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    size: 17,
                    color: ParentPortalColors.orange,
                  ),
                  SizedBox(width: 7),
                  Text(
                    '1 item needs attention',
                    style: TextStyle(
                      color: ParentPortalColors.orange,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ChildSelectorChip(
                label: 'All children',
                selected: selectedChild == 'all',
                onSelected: () => setState(() => selectedChild = 'all'),
              ),
              const SizedBox(width: 8),
              for (final child in widget.data.children) ...[
                ChildSelectorChip(
                  label: child.name.split(' ').first,
                  selected: selectedChild == child.id,
                  onSelected: () => setState(() => selectedChild = child.id),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),
        const ParentSectionHeader(title: 'Today for your family'),
        const SizedBox(height: 10),
        PortalCard(
          child: Column(
            children: [
              const Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.fact_check_outlined,
                      value: '2/2',
                      label: 'present today',
                      color: ParentPortalColors.green,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.menu_book_outlined,
                      value: '1',
                      label: 'homework due',
                      color: ParentPortalColors.purple,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.notifications_none_rounded,
                      value: '1',
                      label: 'unread update',
                      color: ParentPortalColors.blue,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.directions_bus_outlined,
                      value: '3:15 PM',
                      label: 'next pickup',
                      color: ParentPortalColors.orange,
                    ),
                  ),
                ],
              ),
              const Divider(height: 28),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    size: 18,
                    color: ParentPortalColors.muted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Summaries refresh from school records. Pull down when you need the latest update.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        PortalCard(
          color: ParentPortalColors.orangeSoft,
          borderColor: ParentPortalColors.orange.withValues(alpha: .35),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  AvatarInitials(
                    name: 'Aarohi Shrestha',
                    radius: 21,
                    backgroundColor: Colors.white,
                    foregroundColor: ParentPortalColors.orange,
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Aarohi needs your attention',
                      style: TextStyle(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const _AttentionLine(
                icon: Icons.menu_book_outlined,
                text: 'Homework due tomorrow',
              ),
              const SizedBox(height: 9),
              const _AttentionLine(
                icon: Icons.account_balance_wallet_outlined,
                text: 'Tuition fee NPR 4,500 due in 3 days',
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push(AppRoutes.parentFees),
                  style: FilledButton.styleFrom(
                    backgroundColor: ParentPortalColors.orange,
                  ),
                  child: const Text('Review now'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const ParentSectionHeader(title: 'Children at a glance'),
        const SizedBox(height: 10),
        for (final child in children) ...[
          ParentChildCard(
            child: child,
            compact: true,
            onTap: () => context.push(AppRoutes.parentChildDetail(child.id)),
          ),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 12),
        const ParentSectionHeader(title: 'Quick actions'),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.55,
          children: [
            ActionTile(
              icon: Icons.event_busy_outlined,
              title: 'Report absence',
              color: ParentPortalColors.orange,
              onTap: () => _message(
                context,
                'Absence reporting opens when the school enables this workflow.',
              ),
            ),
            ActionTile(
              icon: Icons.chat_bubble_outline_rounded,
              title: 'Message teacher',
              color: ParentPortalColors.purple,
              onTap: () => context.push(AppRoutes.parentChat),
            ),
            ActionTile(
              icon: Icons.payments_outlined,
              title: 'Pay fees',
              color: ParentPortalColors.orange,
              onTap: () => context.push(AppRoutes.parentFees),
            ),
            ActionTile(
              icon: Icons.calendar_month_outlined,
              title: 'School calendar',
              color: ParentPortalColors.blue,
              onTap: () => _message(context, 'School calendar opened.'),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const ParentSectionHeader(title: 'Upcoming event'),
        const SizedBox(height: 10),
        PortalCard(
          onTap: () =>
              _message(context, 'Parent–Teacher Meeting details opened.'),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: ParentPortalColors.blueSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.event_outlined,
                  color: ParentPortalColors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Parent–Teacher Meeting',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Friday, 10:00 AM',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      'For Aarohi, LKG-A',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const ListChevron(),
            ],
          ),
        ),
      ],
    );
  }
}

class _AttentionLine extends StatelessWidget {
  const _AttentionLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 19, color: ParentPortalColors.orange),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

void _message(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
