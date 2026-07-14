import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../notices/application/notices_providers.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalUpdatesTab extends ConsumerStatefulWidget {
  const ParentPortalUpdatesTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  ConsumerState<ParentPortalUpdatesTab> createState() =>
      _ParentPortalUpdatesTabState();
}

class _ParentPortalUpdatesTabState extends ConsumerState<ParentPortalUpdatesTab>
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
    if (item.unreadCount > 0) {
      try {
        await ref.read(noticesRepositoryProvider).markNoticeRead(item.id);
        ref.invalidate(parentPortalDataProvider);
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not mark this update as read.'),
            ),
          );
        }
      }
    }
    if (!context.mounted) return;
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
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge(
                label: item.audience,
                icon: item.audience == 'Whole school'
                    ? Icons.apartment_rounded
                    : Icons.person_pin_circle_outlined,
                color: ParentPortalColors.blue,
                backgroundColor: ParentPortalColors.blueSoft,
              ),
              if (item.isImportant)
                const StatusBadge(
                  label: 'Important',
                  color: ParentPortalColors.orange,
                  backgroundColor: Colors.white,
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                switch (item.category) {
                  ParentUpdateCategory.notice => 'Read',
                  ParentUpdateCategory.message => 'View',
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
      Icons.notifications_none_rounded,
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
