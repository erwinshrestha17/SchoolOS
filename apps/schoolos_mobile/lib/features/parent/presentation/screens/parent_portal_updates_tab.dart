import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../notices/application/notices_providers.dart';
import '../../../notices/presentation/widgets/notice_helpers.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_filter_sheet.dart';
import '../widgets/parent_portal_widgets.dart';

enum _UpdateFilter { all, unread, important, notices, events, gallery }

class ParentPortalUpdatesTab extends ConsumerStatefulWidget {
  const ParentPortalUpdatesTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  ConsumerState<ParentPortalUpdatesTab> createState() =>
      _ParentPortalUpdatesTabState();
}

class _ParentPortalUpdatesTabState extends ConsumerState<ParentPortalUpdatesTab>
    with AutomaticKeepAliveClientMixin {
  _UpdateFilter selected = _UpdateFilter.all;
  String? selectedChildId;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final items = widget.data.updates.where((item) {
      final matchesChild =
          selectedChildId == null ||
          item.childId == null ||
          item.childId == selectedChildId;
      if (!matchesChild) return false;
      return switch (selected) {
        _UpdateFilter.all => true,
        _UpdateFilter.unread => item.unreadCount > 0,
        _UpdateFilter.important =>
          item.isImportant ||
              item.isEmergency ||
              item.isPinned ||
              item.requiresAcknowledgement,
        _UpdateFilter.notices => item.category == ParentUpdateCategory.notice,
        _UpdateFilter.events => item.category == ParentUpdateCategory.event,
        _UpdateFilter.gallery => item.category == ParentUpdateCategory.gallery,
      };
    }).toList();
    return ListView(
      key: const PageStorageKey('parent-updates'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        _CommunicationGuide(
          unreadCount: widget.data.unreadUpdates,
          onOpenAlerts: () => context.push(AppRoutes.notifications),
        ),
        const SizedBox(height: 14),
        ParentFilterChoiceGroup<_UpdateFilter>(
          maxColumns: 3,
          options: const [
            ParentFilterOption(value: _UpdateFilter.all, label: 'All'),
            ParentFilterOption(value: _UpdateFilter.unread, label: 'Unread'),
            ParentFilterOption(
              value: _UpdateFilter.important,
              label: 'Important',
            ),
          ],
          selected:
              selected == _UpdateFilter.all ||
                  selected == _UpdateFilter.unread ||
                  selected == _UpdateFilter.important
              ? selected
              : null,
          onSelected: (value) => setState(() => selected = value),
        ),
        const SizedBox(height: 12),
        ParentFilterToolbar(
          title: 'School posts · ${items.length}',
          activeFilterCount: _activeFilterCount,
          onFilter: _showFilters,
        ),
        if (items.isEmpty)
          PortalCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  selected == _UpdateFilter.unread
                      ? 'No unread school posts.'
                      : 'No school posts match these filters.',
                ),
              ),
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

  int get _activeFilterCount {
    var count = 0;
    if (selected != _UpdateFilter.all) count++;
    if (selectedChildId != null) count++;
    return count;
  }

  Future<void> _showFilters() async {
    var nextFilter = selected;
    var nextChildId = selectedChildId ?? 'all';

    final selection = await showParentFilterSheet<_UpdateFilterSelection>(
      context: context,
      heightFactor: widget.data.children.length > 1 ? .72 : .64,
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          void clear() => setSheetState(() {
            nextFilter = _UpdateFilter.all;
            nextChildId = 'all';
          });

          return ParentFilterSheet(
            title: 'Filter school posts',
            onReset: clear,
            onClearAll: clear,
            onApply: () => Navigator.pop(
              context,
              _UpdateFilterSelection(
                filter: nextFilter,
                childId: nextChildId == 'all' ? null : nextChildId,
              ),
            ),
            body: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ParentFilterSection(
                  label: 'Status and type',
                  child: ParentFilterChoiceGroup<_UpdateFilter>(
                    maxColumns: 3,
                    options: const [
                      ParentFilterOption(
                        value: _UpdateFilter.all,
                        label: 'All',
                      ),
                      ParentFilterOption(
                        value: _UpdateFilter.unread,
                        label: 'Unread',
                      ),
                      ParentFilterOption(
                        value: _UpdateFilter.important,
                        label: 'Important',
                      ),
                      ParentFilterOption(
                        value: _UpdateFilter.notices,
                        label: 'Notices',
                      ),
                      // Historical message-type updates remain readable under
                      // All, but chat is not an active filter or destination.
                      ParentFilterOption(
                        value: _UpdateFilter.events,
                        label: 'Events',
                      ),
                      ParentFilterOption(
                        value: _UpdateFilter.gallery,
                        label: 'Gallery',
                      ),
                    ],
                    selected: nextFilter,
                    onSelected: (value) =>
                        setSheetState(() => nextFilter = value),
                  ),
                ),
                if (widget.data.children.length > 1) ...[
                  const SizedBox(height: 16),
                  ParentFilterSelectField<String>(
                    label: 'Child',
                    value: nextChildId,
                    options: [
                      const ParentFilterOption(
                        value: 'all',
                        label: 'All children',
                      ),
                      for (final child in widget.data.children)
                        ParentFilterOption(
                          value: child.id,
                          label: '${child.name} · ${child.classSection}',
                        ),
                    ],
                    onChanged: (value) =>
                        setSheetState(() => nextChildId = value),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
    if (selection == null || !mounted) return;
    setState(() {
      selected = selection.filter;
      selectedChildId = selection.childId;
    });
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

class _UpdateFilterSelection {
  const _UpdateFilterSelection({required this.filter, required this.childId});

  final _UpdateFilter filter;
  final String? childId;
}

class _UpdateCard extends StatelessWidget {
  const _UpdateCard({required this.item, required this.onTap});

  final ParentPortalUpdate item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = _style(item.category);
    final audience = _audienceLabel(item);
    final timestamp = item.createdAt == null
        ? ''
        : parentCommunicationTimestamp(item.createdAt!);

    return Semantics(
      button: true,
      label: '${item.title}. $audience. $timestamp',
      child: PortalCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        borderColor: item.isEmergency
            ? ParentPortalColors.red.withValues(alpha: .45)
            : item.isPinned
            ? ParentPortalColors.orange.withValues(alpha: .4)
            : ParentPortalColors.border,
        color: item.isPinned ? ParentPortalColors.orangeSoft : Colors.white,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: style.$2,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(style.$1, color: style.$3, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: ParentPortalColors.navy,
                                fontWeight: item.unreadCount > 0
                                    ? FontWeight.w900
                                    : FontWeight.w700,
                              ),
                        ),
                      ),
                      if (item.unreadCount > 0) ...[
                        const SizedBox(width: 8),
                        const _UnreadDot(),
                      ],
                    ],
                  ),
                  if (item.body.trim().isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      item.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (item.unreadCount > 0)
                        const _CompactState(label: 'Unread'),
                      if (item.isEmergency)
                        const _CompactState(
                          label: 'Emergency',
                          color: ParentPortalColors.red,
                          background: ParentPortalColors.redSoft,
                        )
                      else if (item.isImportant)
                        const _CompactState(
                          label: 'Urgent',
                          color: ParentPortalColors.orange,
                          background: ParentPortalColors.orangeSoft,
                        ),
                      if (item.isPinned)
                        const _CompactState(
                          label: 'Pinned',
                          icon: Icons.push_pin_outlined,
                        ),
                      if (item.requiresAcknowledgement)
                        const _CompactState(
                          label: 'Action required',
                          icon: Icons.task_alt_rounded,
                          color: ParentPortalColors.orange,
                          background: ParentPortalColors.orangeSoft,
                        ),
                      if (item.hasAttachment)
                        const _CompactState(
                          label: 'Attachment',
                          icon: Icons.attach_file_rounded,
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    [
                      audience,
                      timestamp,
                    ].where((value) => value.isNotEmpty).join(' · '),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: style.$3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommunicationGuide extends StatelessWidget {
  const _CommunicationGuide({
    required this.unreadCount,
    required this.onOpenAlerts,
  });

  final int unreadCount;
  final VoidCallback onOpenAlerts;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.all(14),
      color: ParentPortalColors.blueSoft,
      borderColor: ParentPortalColors.blue.withValues(alpha: .22),
      child: Row(
        children: [
          const Icon(Icons.campaign_outlined, color: ParentPortalColors.blue),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'School posts',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Formal notices, events and gallery updates stay here.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onOpenAlerts,
            child: Text(unreadCount > 0 ? 'Alerts ($unreadCount)' : 'Alerts'),
          ),
        ],
      ),
    );
  }
}

class _UnreadDot extends StatelessWidget {
  const _UnreadDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 9,
      height: 9,
      decoration: const BoxDecoration(
        color: ParentPortalColors.green,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _CompactState extends StatelessWidget {
  const _CompactState({
    required this.label,
    this.icon,
    this.color = ParentPortalColors.green,
    this.background = ParentPortalColors.greenSoft,
  });

  final String label;
  final IconData? icon;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String _audienceLabel(ParentPortalUpdate item) {
  final childName = item.childName?.trim() ?? '';
  final classSection = item.classSection?.trim() ?? '';
  if (childName.isNotEmpty) {
    return [
      childName,
      classSection,
    ].where((value) => value.isNotEmpty).join(' · ');
  }
  return item.audience;
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
