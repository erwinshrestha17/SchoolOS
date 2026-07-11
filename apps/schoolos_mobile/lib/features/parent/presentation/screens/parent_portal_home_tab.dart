import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../core/storage/app_preferences_service.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalHomeTab extends ConsumerStatefulWidget {
  const ParentPortalHomeTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  ConsumerState<ParentPortalHomeTab> createState() =>
      _ParentPortalHomeTabState();
}

class _ParentPortalHomeTabState extends ConsumerState<ParentPortalHomeTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final linkedCount = widget.data.children.length;
    final activeChild = widget.data.activeChild;
    final actions = activeChild == null
        ? const <_ParentAction>[]
        : _actionsFor(activeChild);
    final visibleUpdates = activeChild == null
        ? const <ParentPortalUpdate>[]
        : widget.data.updates
              .where(
                (update) =>
                    update.childId == null || update.childId == activeChild.id,
              )
              .toList();

    if (activeChild == null) {
      return ListView(
        key: const PageStorageKey('parent-home-no-child'),
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
        children: const [
          PortalCard(
            child: Column(
              children: [
                Icon(
                  Icons.family_restroom_outlined,
                  size: 44,
                  color: ParentPortalColors.muted,
                ),
                SizedBox(height: 12),
                Text(
                  'No linked child',
                  style: TextStyle(
                    color: ParentPortalColors.navy,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Ask the school office to confirm your guardian link. Child information stays hidden until access is active.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.refresh(parentPortalDataProvider.future),
      child: ListView(
        key: const PageStorageKey('parent-home'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Text(
            'Namaste, ${_firstName(widget.data.parentName)}',
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
                  '${activeChild.name} • ${activeChild.classSection} • ${activeChild.attendanceTime}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (linkedCount > 1) ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final child in widget.data.children) ...[
                    ChildSelectorChip(
                      label: child.name.split(' ').first,
                      selected: activeChild.id == child.id,
                      onSelected: () => _selectChild(child.id),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ] else
            const SizedBox(height: 8),
          if (actions.isNotEmpty) ...[
            PortalCard(
              color: ParentPortalColors.orangeSoft,
              borderColor: ParentPortalColors.orange.withValues(alpha: .35),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      AvatarInitials(
                        name: activeChild.name,
                        radius: 21,
                        backgroundColor: Colors.white,
                        foregroundColor: ParentPortalColors.orange,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '${activeChild.name} needs your attention',
                          style: const TextStyle(
                            color: ParentPortalColors.navy,
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  for (var index = 0; index < actions.length; index++) ...[
                    if (index > 0) const SizedBox(height: 9),
                    _AttentionLine(
                      icon: actions[index].icon,
                      text: actions[index].label,
                      onTap: () => context.push(actions[index].route),
                    ),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => context.push(actions.first.route),
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
          ],
          ParentSectionHeader(
            title: '${activeChild.name.split(' ').first}\'s school day',
          ),
          const SizedBox(height: 10),
          ParentChildCard(
            child: activeChild,
            compact: true,
            onTap: () =>
                context.push(AppRoutes.parentChildDetail(activeChild.id)),
          ),
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
                icon: Icons.fact_check_outlined,
                title: 'Attendance',
                color: ParentPortalColors.orange,
                onTap: () => context.push(AppRoutes.parentAttendance),
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
                onTap: () => context.push(AppRoutes.parentCalendar),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const ParentSectionHeader(title: 'Latest update'),
          const SizedBox(height: 10),
          if (visibleUpdates.isEmpty)
            const PortalCard(child: Text('No updates from school yet.'))
          else
            PortalCard(
              onTap: () => context.push(
                visibleUpdates.first.route ?? AppRoutes.parentUpdates,
              ),
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
                          visibleUpdates.first.title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: ParentPortalColors.navy,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        Text(
                          visibleUpdates.first.body,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          visibleUpdates.first.metadata,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: ParentPortalColors.muted),
                        ),
                      ],
                    ),
                  ),
                  const ListChevron(),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _selectChild(String childId) async {
    if (widget.data.activeChild?.id == childId) return;
    ref.read(parentActiveChildIdProvider.notifier).state = childId;
    await ref.read(appPreferencesServiceProvider).saveSelectedChildId(childId);
  }
}

class _AttentionLine extends StatelessWidget {
  const _AttentionLine({
    required this.icon,
    required this.text,
    required this.onTap,
  });

  final IconData icon;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(icon, size: 19, color: ParentPortalColors.orange),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: ParentPortalColors.orange,
            ),
          ],
        ),
      ),
    );
  }
}

class _ParentAction {
  const _ParentAction({
    required this.icon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final String label;
  final String route;
}

List<_ParentAction> _actionsFor(ParentPortalChild child) {
  final actions = <_ParentAction>[];
  final transport = '${child.transport} ${child.transportDetail ?? ''}'
      .toLowerCase();

  if (transport.contains('stale') || transport.contains('delayed')) {
    actions.add(
      const _ParentAction(
        icon: Icons.directions_bus_outlined,
        label: 'Review the latest transport update',
        route: AppRoutes.parentTransport,
      ),
    );
  }
  if (child.feesDue > 0) {
    actions.add(
      _ParentAction(
        icon: Icons.account_balance_wallet_outlined,
        label: 'NPR ${child.feesDue.toStringAsFixed(0)} fees due',
        route: AppRoutes.parentFees,
      ),
    );
  }
  if (child.homeworkPending > 0) {
    actions.add(
      _ParentAction(
        icon: Icons.menu_book_outlined,
        label:
            '${child.homeworkPending} homework item${child.homeworkPending == 1 ? '' : 's'} due',
        route: Uri(
          path: AppRoutes.parentHomework,
          queryParameters: {'child': child.id},
        ).toString(),
      ),
    );
  }
  if (child.unreadUpdates > 0) {
    actions.add(
      _ParentAction(
        icon: Icons.notifications_none_rounded,
        label:
            '${child.unreadUpdates} unread update${child.unreadUpdates == 1 ? '' : 's'}',
        route: AppRoutes.parentUpdates,
      ),
    );
  }

  return actions;
}

String _firstName(String value) {
  final parts = value.trim().split(RegExp(r'\s+'));
  return parts.isEmpty || parts.first.isEmpty ? 'Parent' : parts.first;
}
