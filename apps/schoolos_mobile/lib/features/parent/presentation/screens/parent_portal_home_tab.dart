import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../core/storage/app_preferences_service.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/utils/tap_guard.dart';
import '../../application/parent_dashboard_view_model.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_dashboard_cards.dart';
import '../widgets/parent_dashboard_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

/// Tab indices on [SchoolOsAppShell]. Switching tabs in place keeps the
/// already-built screens alive; pushing their routes would rebuild the whole
/// shell - and refetch the portal - on top of itself.
class ParentShellTab {
  const ParentShellTab._();

  static const home = 0;
  static const children = 1;
  static const homework = 2;
  static const updates = 3;
}

/// The parent "Today" dashboard.
///
/// Reads one already-loaded [ParentPortalData] and projects it through
/// [ParentDashboardViewModel]; every decision about what a status means, which
/// action is most urgent, and what is safe to print lives there, not here.
class ParentPortalHomeTab extends ConsumerStatefulWidget {
  const ParentPortalHomeTab({super.key, required this.data, this.onOpenTab});

  final ParentPortalData data;

  /// Switches the surrounding shell to another tab. Null in tests and in any
  /// host that has no tab bar, where the equivalent route is pushed instead.
  final ValueChanged<int>? onOpenTab;

  @override
  ConsumerState<ParentPortalHomeTab> createState() =>
      _ParentPortalHomeTabState();
}

class _ParentPortalHomeTabState extends ConsumerState<ParentPortalHomeTab>
    with AutomaticKeepAliveClientMixin, TapGuardMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final model = ParentDashboardViewModel.from(
      widget.data,
      now: DateTime.now(),
    );
    final child = model.child;

    if (child == null) {
      return _NoLinkedChildView(guardianName: model.guardianName);
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: CustomScrollView(
        key: const PageStorageKey('parent-home'),
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              _horizontalPadding(context),
              AppSpacing.sm,
              _horizontalPadding(context),
              AppSpacing.xl,
            ),
            sliver: SliverList.list(children: _sections(context, model, child)),
          ),
        ],
      ),
    );
  }

  List<Widget> _sections(
    BuildContext context,
    ParentDashboardViewModel model,
    ParentDashboardChild child,
  ) {
    final priority = model.priority;
    return [
      ParentDashboardHeader(
        guardianName: model.guardianName,
        childName: child.name,
        classSection: child.classSection,
        updatedLabel: 'Updated ${_timeLabel(model.lastUpdated)}',
        savedAtLabel: _timeLabel(model.lastUpdated),
        isStale: model.isStale,
      ),
      if (model.linkedChildCount > 1) ...[
        const SizedBox(height: AppSpacing.lg),
        _ChildSwitcherRow(
          children: widget.data.children,
          activeChildId: child.id,
          onSelect: _selectChild,
        ),
      ],
      const SizedBox(height: AppSpacing.lgPlus),
      if (priority != null) ...[
        PriorityAttentionCard(
          childName: child.name,
          action: priority,
          otherCount: model.otherPriorityCount,
          onReview: guardTap(() => context.push(priority.route)),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
      DashboardSectionHeader(
        title: '${child.firstName}\'s school day',
        actionLabel: 'View all',
        onAction: guardTap(
          () => _openTab(ParentShellTab.children, AppRoutes.parentChildren),
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      StudentDaySummaryCard(
        child: child,
        onOpenChild: guardTap(() => context.push(child.route)),
        onOpenStatus: (row) {
          if (acceptTap()) context.push(row.route);
        },
      ),
      const SizedBox(height: AppSpacing.xl),
      DashboardSectionHeader(
        title: 'Coming up',
        actionLabel: 'View all',
        onAction: guardTap(
          () => _openTab(ParentShellTab.homework, AppRoutes.parentHomework),
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      if (model.upcoming.isEmpty)
        const DashboardEmptyCard(
          icon: Icons.event_available_outlined,
          message: 'Nothing due right now.',
        )
      else
        UpcomingListCard(
          items: model.upcoming,
          onOpenItem: (item) {
            if (acceptTap()) context.push(item.route);
          },
        ),
      const SizedBox(height: AppSpacing.xl),
      const DashboardSectionHeader(title: 'Quick actions'),
      const SizedBox(height: AppSpacing.md),
      _QuickActionsRow(
        onAttendance: guardTap(() => context.push(AppRoutes.parentAttendance)),
        onFees: guardTap(() => context.push(AppRoutes.parentFees)),
        onCalendar: guardTap(() => context.push(AppRoutes.parentCalendar)),
      ),
      const SizedBox(height: AppSpacing.xl),
      DashboardSectionHeader(
        title: 'Latest update',
        actionLabel: 'View all',
        onAction: guardTap(
          () => _openTab(ParentShellTab.updates, AppRoutes.parentUpdates),
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      if (model.latestUpdate == null)
        const DashboardEmptyCard(
          icon: Icons.notifications_none_rounded,
          message: 'No updates from school yet.',
        )
      else
        LatestUpdateCard(
          update: model.latestUpdate!,
          onTap: guardTap(() => context.push(model.latestUpdate!.route)),
        ),
    ];
  }

  Future<void> _refresh() => ref.refresh(parentPortalDataProvider.future);

  /// Switches shell tabs when hosted by the shell, and falls back to the
  /// equivalent route otherwise.
  void _openTab(int shellIndex, String fallbackRoute) {
    final onOpenTab = widget.onOpenTab;
    if (onOpenTab != null) {
      onOpenTab(shellIndex);
      return;
    }
    context.push(fallbackRoute);
  }

  Future<void> _selectChild(String childId) async {
    if (!acceptTap()) return;
    if (widget.data.activeChild?.id == childId) return;
    ref.read(parentActiveChildIdProvider.notifier).state = childId;
    await ref.read(appPreferencesServiceProvider).saveSelectedChildId(childId);
  }
}

/// Wider phones and small tablets get a little more breathing room; a 320dp
/// device keeps the full 16dp gutter rather than losing content width.
double _horizontalPadding(BuildContext context) {
  final width = MediaQuery.sizeOf(context).width;
  return width >= 600 ? AppSpacing.xl : AppSpacing.lg;
}

/// School time, not handset time - the same policy the rest of the app uses.
String _timeLabel(DateTime value) => NepaliBsCalendar.formatNepalTime(value);

class _ChildSwitcherRow extends StatelessWidget {
  const _ChildSwitcherRow({
    required this.children,
    required this.activeChildId,
    required this.onSelect,
  });

  final List<ParentPortalChild> children;
  final String activeChildId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final child in children) ...[
            ChildSelectorChip(
              label: firstNameOf(child.name),
              selected: child.id == activeChildId,
              onSelected: () => onSelect(child.id),
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

/// Three shortcuts across the width when they fit, two per row when they do
/// not - which is what a 320dp screen or a 1.5x text scale produces.
class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.onAttendance,
    required this.onFees,
    required this.onCalendar,
  });

  final VoidCallback? onAttendance;
  final VoidCallback? onFees;
  final VoidCallback? onCalendar;

  @override
  Widget build(BuildContext context) {
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;

    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = AppSpacing.md;
        // An icon block, its gap, the tile padding and a legible label. Below
        // this a three-across row squeezes "School calendar" down to two
        // broken syllables, which is worse than a shorter row of wider tiles.
        final minTileWidth = 150.0 * scale;
        final width = constraints.maxWidth;
        final columns = width >= minTileWidth * 3 + spacing * 2
            ? 3
            : width >= minTileWidth * 2 + spacing
            ? 2
            : 1;
        final tileWidth = (width - spacing * (columns - 1)) / columns;
        // Three tiles into two columns leaves a hole; the last one takes the
        // whole row instead so the block still reads as a deliberate grid.
        final lastWidth = columns == 2 ? width : tileWidth;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            SizedBox(
              width: tileWidth,
              child: QuickActionTile(
                icon: Icons.fact_check_outlined,
                label: 'Attendance',
                color: ParentPortalColors.green,
                onTap: onAttendance,
              ),
            ),
            SizedBox(
              width: tileWidth,
              child: QuickActionTile(
                icon: Icons.payments_outlined,
                label: 'Pay fees',
                color: ParentPortalColors.orange,
                onTap: onFees,
              ),
            ),
            SizedBox(
              width: lastWidth,
              child: QuickActionTile(
                icon: Icons.calendar_month_outlined,
                label: 'School calendar',
                color: ParentPortalColors.blue,
                onTap: onCalendar,
              ),
            ),
          ],
        );
      },
    );
  }
}

/// A guardian account with no linked child sees why, not an empty dashboard.
class _NoLinkedChildView extends StatelessWidget {
  const _NoLinkedChildView({required this.guardianName});

  final String? guardianName;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const PageStorageKey('parent-home-no-child'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        ParentDashboardHeader(
          guardianName: guardianName,
          childName: null,
          classSection: null,
          updatedLabel: null,
        ),
        const SizedBox(height: AppSpacing.lgPlus),
        const PortalCard(
          padding: EdgeInsets.all(AppSpacing.xl),
          child: Column(
            children: [
              Icon(
                Icons.family_restroom_outlined,
                size: 44,
                color: ParentPortalColors.muted,
              ),
              SizedBox(height: AppSpacing.md),
              Text(
                'No linked child',
                style: TextStyle(
                  color: ParentPortalColors.navy,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: AppSpacing.sm),
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
}
