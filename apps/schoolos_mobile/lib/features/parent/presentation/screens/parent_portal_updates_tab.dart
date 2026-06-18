import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../application/parent_feature_state.dart';
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
  bool attending = false;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final noticeRead = ref.watch(
      parentFeatureControllerProvider.select((state) => state.noticeRead),
    );
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
        for (final item in items) ...[
          _UpdateCard(
            item: item,
            attending: attending,
            isRead: item.category == ParentUpdateCategory.notice && noticeRead,
            onTap: () => _handleItem(context, item),
          ),
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
    switch (item.category) {
      case ParentUpdateCategory.event:
        final result = await showModalBottomSheet<bool>(
          context: context,
          showDragHandle: true,
          builder: (context) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Parent–Teacher Meeting',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  const Text('Friday, 10:00 AM–2:00 PM • For Aarohi, LKG-A'),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: Text(attending ? 'Keep RSVP' : 'Confirm attendance'),
                  ),
                ],
              ),
            ),
          ),
        );
        if (result == true) setState(() => attending = true);
      case ParentUpdateCategory.gallery:
        context.push(AppRoutes.parentActivity);
      case ParentUpdateCategory.message:
        context.push(AppRoutes.parentChat);
      case ParentUpdateCategory.notice:
        context.push(AppRoutes.noticeDetail(item.id));
    }
  }
}

class _UpdateCard extends StatelessWidget {
  const _UpdateCard({
    required this.item,
    required this.attending,
    required this.isRead,
    required this.onTap,
  });

  final ParentPortalUpdate item;
  final bool attending;
  final bool isRead;
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
              if (item.unreadCount > 0 && !isRead)
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
                  ParentUpdateCategory.notice => isRead ? 'Read ✓' : 'Read',
                  ParentUpdateCategory.message => 'Reply',
                  ParentUpdateCategory.event => attending ? 'Going ✓' : 'RSVP',
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
