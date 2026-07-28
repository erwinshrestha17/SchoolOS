import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../application/parent_dashboard_view_model.dart';
import 'parent_dashboard_tokens.dart';
import 'parent_portal_widgets.dart';

/// Card-sized building blocks for the parent Today dashboard.
///
/// As with `parent_dashboard_widgets.dart`, everything here is
/// presentation-only: it renders a value object and reports taps upward.

/// A white card that groups rows without letting the rows' ink splashes bleed
/// past its corners.
class DashboardCardShell extends StatelessWidget {
  const DashboardCardShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.xl)),
        side: BorderSide(color: ParentPortalColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

/// "Aarav's school day" - who the child is, and the three things a parent
/// checks every day.
class StudentDaySummaryCard extends StatelessWidget {
  const StudentDaySummaryCard({
    super.key,
    required this.child,
    required this.onOpenChild,
    required this.onOpenStatus,
  });

  final ParentDashboardChild child;
  final VoidCallback? onOpenChild;

  /// Called with the row the parent tapped, so each status can lead somewhere
  /// different without the card knowing any routes.
  final ValueChanged<ParentStatusRow> onOpenStatus;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      child.classSection,
      child.teacher,
    ].where((part) => part != null && part.trim().isNotEmpty).join(' • ');

    return DashboardCardShell(
      child: Column(
        children: [
          Semantics(
            button: true,
            label: 'Open ${child.name}\'s profile',
            excludeSemantics: true,
            child: InkWell(
              onTap: onOpenChild,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    AvatarInitials(name: child.name, radius: 23),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: ParentPortalColors.navy,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (subtitle.isNotEmpty)
                            Text(
                              subtitle,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: ParentPortalColors.muted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const ListChevron(),
                  ],
                ),
              ),
            ),
          ),
          for (final row in child.statusRows) ...[
            const Divider(height: 1, indent: AppSpacing.lg, endIndent: 0),
            StudentStatusRow(
              row: row,
              onTap: row.canOpen ? () => onOpenStatus(row) : null,
            ),
          ],
        ],
      ),
    );
  }
}

/// One status line - attendance, homework or fees - tappable on its own.
class StudentStatusRow extends StatelessWidget {
  const StudentStatusRow({super.key, required this.row, required this.onTap});

  final ParentStatusRow row;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = ParentDashboardTokens.statusColor(row.kind, row.tone);
    final surface = ParentDashboardTokens.statusSurface(row.kind, row.tone);

    return Semantics(
      button: onTap != null,
      // The label repeats the status in words. A parent using a screen reader,
      // or reading a greyscale screenshot, gets the same meaning as one who
      // can see that the tick is green.
      label: row.semanticLabel,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          // 44dp minimum target even when the row carries a single short line.
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: surface,
                    borderRadius: AppRadius.borderRadiusMD,
                  ),
                  child: Icon(
                    ParentDashboardTokens.statusIcon(row.kind, row.tone),
                    size: 18,
                    color: color,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.title,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      // Money read off a saved copy says so on its own row.
                      // The header chip alone is not enough: a parent who
                      // scrolls to the fee line and stops there would
                      // otherwise read a balance as current.
                      if (row.isStale) ...[
                        const SizedBox(height: AppSpacing.xs),
                        const StatusBadge(
                          label: 'Saved copy',
                          icon: Icons.cloud_off_rounded,
                          color: ParentPortalColors.muted,
                          backgroundColor: ParentPortalColors.surfaceAlt,
                        ),
                      ],
                      if (row.subtitle != null)
                        Text(
                          row.subtitle!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: ParentPortalColors.muted,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onTap != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  const ListChevron(),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One dated item under "Coming up".
class UpcomingItemTile extends StatelessWidget {
  const UpcomingItemTile({super.key, required this.item, required this.onTap});

  final ParentUpcomingItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dueLabel = formatDueLabel(item);
    final dueColor = ParentDashboardTokens.urgencyColor(item.urgency);

    return Semantics(
      button: onTap != null,
      label: '${item.title}, ${item.subtitle}, $dueLabel',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: item.urgency == ParentUpcomingUrgency.overdue
                        ? ParentPortalColors.redSoft
                        : ParentPortalColors.blueSoft,
                    borderRadius: AppRadius.borderRadiusMD,
                  ),
                  child: Icon(
                    item.urgency == ParentUpcomingUrgency.overdue
                        ? Icons.error_outline_rounded
                        : Icons.menu_book_outlined,
                    size: 19,
                    color: dueColor,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        item.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: ParentPortalColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                // The deadline is stated in words, never by colour alone.
                Text(
                  dueLabel,
                  textAlign: TextAlign.end,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: dueColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const ListChevron(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The rounded list that holds the "Coming up" tiles.
class UpcomingListCard extends StatelessWidget {
  const UpcomingListCard({
    super.key,
    required this.items,
    required this.onOpenItem,
  });

  final List<ParentUpcomingItem> items;
  final ValueChanged<ParentUpcomingItem> onOpenItem;

  @override
  Widget build(BuildContext context) {
    return DashboardCardShell(
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0)
              const Divider(height: 1, indent: AppSpacing.lg, endIndent: 0),
            UpcomingItemTile(
              item: items[index],
              onTap: () => onOpenItem(items[index]),
            ),
          ],
        ],
      ),
    );
  }
}

/// The newest thing the school told this parent.
class LatestUpdateCard extends StatelessWidget {
  const LatestUpdateCard({
    super.key,
    required this.update,
    required this.onTap,
  });

  final ParentLatestUpdate update;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Semantics(
      button: onTap != null,
      label: [
        update.title,
        update.body,
        update.metadata,
      ].where((part) => part != null && part.trim().isNotEmpty).join('. '),
      excludeSemantics: true,
      child: DashboardCardShell(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: ParentPortalColors.blueSoft,
                    borderRadius: BorderRadius.all(
                      Radius.circular(AppRadius.md),
                    ),
                  ),
                  child: Icon(
                    ParentDashboardTokens.updateIcon(update.category),
                    color: ParentPortalColors.blue,
                    size: 21,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        update.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (update.body != null)
                        Text(
                          update.body!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: ParentPortalColors.muted,
                          ),
                        ),
                      if (update.metadata != null)
                        Text(
                          update.metadata!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: ParentPortalColors.muted,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const ListChevron(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
