import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalUpdatesTab extends StatefulWidget {
  const ParentPortalUpdatesTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  State<ParentPortalUpdatesTab> createState() => _ParentPortalUpdatesTabState();
}

class _ParentPortalUpdatesTabState extends State<ParentPortalUpdatesTab>
    with AutomaticKeepAliveClientMixin {
  ParentUpdateCategory? selected;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final items = selected == null
        ? widget.data.updates
        : widget.data.updates
              .where((item) => item.category == selected)
              .toList();
    return ListView(
      key: const PageStorageKey('parent-updates'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _filter('All', null),
              _filter('Notices', ParentUpdateCategory.notice),
              _filter('Messages', ParentUpdateCategory.message),
              _filter('Events', ParentUpdateCategory.event),
              _filter('Gallery', ParentUpdateCategory.gallery),
            ],
          ),
        ),
        const SizedBox(height: 22),
        if (items.isEmpty)
          const PortalCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No updates match this filter.')),
            ),
          )
        else
          for (final item in items) ...[
            _UpdateCard(item: item, onTap: () => _handleItem(context, item)),
            const SizedBox(height: 14),
          ],
      ],
    );
  }

  Widget _filter(String label, ParentUpdateCategory? value) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChildSelectorChip(
        label: label,
        selected: selected == value,
        onSelected: () => setState(() => selected = value),
      ),
    );
  }

  Future<void> _handleItem(
    BuildContext context,
    ParentPortalUpdate item,
  ) async {
    final route = item.route;
    if (route != null && route.isNotEmpty && route != '/parent/updates') {
      context.push(route);
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('This update does not have a mobile action yet.'),
      ),
    );
  }
}

class _UpdateCard extends StatelessWidget {
  const _UpdateCard({required this.item, required this.onTap});

  final ParentPortalUpdate item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = _style(item.category);
    return PortalCard(
      onTap: onTap,
      borderColor: item.isPinned
          ? ParentPortalColors.orange.withValues(alpha: .35)
          : ParentPortalColors.border,
      color: item.isPinned ? ParentPortalColors.orangeSoft : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: style.$2,
                  shape: BoxShape.circle,
                ),
                child: Icon(style.$1, color: style.$3, size: 21),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.isPinned)
                      const Text(
                        'PINNED',
                        style: TextStyle(
                          color: ParentPortalColors.orange,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: .8,
                        ),
                      ),
                    Text(
                      item.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.unreadCount > 0)
                StatusBadge(
                  label: '${item.unreadCount}',
                  color: Colors.white,
                  backgroundColor: ParentPortalColors.green,
                ),
            ],
          ),
          const SizedBox(height: 13),
          Text(item.body, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 7),
          Text(
            item.metadata,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (item.isImportant)
                const StatusBadge(
                  label: 'Important',
                  color: ParentPortalColors.orange,
                  backgroundColor: Colors.white,
                ),
              const Spacer(),
              Text(
                switch (item.category) {
                  ParentUpdateCategory.notice => 'Read',
                  ParentUpdateCategory.message => 'Reply',
                  ParentUpdateCategory.event => 'Open',
                  ParentUpdateCategory.gallery => 'View gallery',
                },
                style: TextStyle(color: style.$3, fontWeight: FontWeight.w900),
              ),
              const SizedBox(width: 4),
              Icon(Icons.arrow_forward_rounded, size: 17, color: style.$3),
            ],
          ),
        ],
      ),
    );
  }
}

(IconData, Color, Color) _style(ParentUpdateCategory category) {
  return switch (category) {
    ParentUpdateCategory.notice => (
      Icons.campaign_outlined,
      ParentPortalColors.orangeSoft,
      ParentPortalColors.orange,
    ),
    ParentUpdateCategory.message => (
      Icons.chat_bubble_outline_rounded,
      ParentPortalColors.purpleSoft,
      ParentPortalColors.purple,
    ),
    ParentUpdateCategory.event => (
      Icons.event_outlined,
      ParentPortalColors.blueSoft,
      ParentPortalColors.blue,
    ),
    ParentUpdateCategory.gallery => (
      Icons.photo_library_outlined,
      ParentPortalColors.greenSoft,
      ParentPortalColors.green,
    ),
  };
}
