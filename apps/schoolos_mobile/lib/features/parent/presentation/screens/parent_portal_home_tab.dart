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
  const ParentPortalHomeTab({
    super.key,
    required this.data,
    this.onOpenTab,
    this.now,
  });

  final ParentPortalData data;
  final DateTime? now;

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
      now: widget.now ?? DateTime.now(),
    );
    final child = model.child;

    if (child == null) {
      return _NoLinkedChildView(
        guardianName: model.guardianName,
        dateLabel: model.dateLabel,
      );
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
        dateLabel: model.dateLabel,
        savedAtLabel: _timeLabel(model.lastUpdated),
        isStale: model.isStale,
      ),
      const SizedBox(height: AppSpacing.lg),
      ActiveChildContextCard(
        child: child,
        canSwitch: model.linkedChildCount > 1,
        onTap: model.linkedChildCount > 1 ? _showChildPicker : null,
      ),
      const SizedBox(height: AppSpacing.lg),
      if (priority != null) ...[
        PriorityAttentionCard(
          action: priority,
          otherCount: model.otherPriorityCount,
          onReview: guardTap(() => context.push(priority.route)),
        ),
        const SizedBox(height: AppSpacing.lgPlus),
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
        onOpenChild: child.canOpenProfile
            ? guardTap(() => context.push(child.route))
            : null,
        onOpenStatus: (row) {
          if (acceptTap()) context.push(row.route);
        },
      ),
      const SizedBox(height: AppSpacing.lgPlus),
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
          message: 'No upcoming deadlines.',
        )
      else
        UpcomingListCard(
          items: model.upcoming,
          onOpenItem: (item) {
            if (acceptTap()) context.push(item.route);
          },
        ),
      const SizedBox(height: AppSpacing.lgPlus),
      const DashboardSectionHeader(title: 'Quick actions'),
      const SizedBox(height: AppSpacing.md),
      _QuickActionsRow(
        onAttendance: child.canViewAttendance
            ? guardTap(() => context.push(AppRoutes.parentAttendance))
            : null,
        onFees: child.canViewFees
            ? guardTap(() => context.push(AppRoutes.parentFees))
            : null,
        onCalendar: child.canViewAcademics
            ? guardTap(() => context.push(AppRoutes.parentCalendar))
            : null,
      ),
      const SizedBox(height: AppSpacing.lgPlus),
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

  Future<void> _showChildPicker() async {
    if (!acceptTap()) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                'Choose a child',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            for (final child in widget.data.children)
              ListTile(
                onTap: () => Navigator.of(context).pop(child.id),
                leading: AvatarInitials(name: child.name, radius: 18),
                title: Text(child.name),
                subtitle: Text(child.classSection),
                trailing: child.id == widget.data.activeChild?.id
                    ? const Icon(
                        Icons.check_circle_rounded,
                        color: ParentPortalColors.green,
                      )
                    : null,
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
    if (selected != null && mounted) {
      await _selectChild(selected);
    }
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

/// Three equal shortcuts at ordinary text sizes. At large text they stack so
/// labels remain readable without truncation or undersized targets.
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
    final tiles = [
      QuickActionTile(
        icon: Icons.fact_check_outlined,
        label: 'Attendance',
        color: ParentPortalColors.green,
        onTap: onAttendance,
      ),
      QuickActionTile(
        icon: Icons.payments_outlined,
        label: 'Fees',
        color: ParentPortalColors.orange,
        onTap: onFees,
      ),
      QuickActionTile(
        icon: Icons.calendar_month_outlined,
        label: 'Calendar',
        color: ParentPortalColors.blue,
        onTap: onCalendar,
      ),
    ];
    if (scale > 1.3) {
      return Column(
        children: [
          for (var index = 0; index < tiles.length; index++) ...[
            SizedBox(width: double.infinity, child: tiles[index]),
            if (index < tiles.length - 1) const SizedBox(height: AppSpacing.sm),
          ],
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < tiles.length; index++) ...[
          Expanded(child: tiles[index]),
          if (index < tiles.length - 1) const SizedBox(width: AppSpacing.sm),
        ],
      ],
    );
  }
}

/// A guardian account with no linked child sees why, not an empty dashboard.
class _NoLinkedChildView extends StatelessWidget {
  const _NoLinkedChildView({
    required this.guardianName,
    required this.dateLabel,
  });

  final String? guardianName;
  final String dateLabel;

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
        ParentDashboardHeader(guardianName: guardianName, dateLabel: dateLabel),
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
