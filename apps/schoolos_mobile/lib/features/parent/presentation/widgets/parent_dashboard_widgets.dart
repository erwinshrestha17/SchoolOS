import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../application/parent_dashboard_view_model.dart';
import 'parent_dashboard_tokens.dart';
import 'parent_portal_widgets.dart';

/// Presentation-only building blocks for the parent Today dashboard.
///
/// Every widget here is `const`-constructible and takes plain values plus
/// callbacks: none of them read a provider, call an API, or decide what a
/// status means. Those decisions live in `parent_dashboard_view_model.dart`.

/// The greeting block under the app bar: who the parent is and the current
/// school-calendar date. Child context lives in the explicit selector below.
class ParentDashboardHeader extends StatelessWidget {
  const ParentDashboardHeader({
    super.key,
    required this.guardianName,
    required this.dateLabel,
    this.savedAtLabel,
    this.isStale = false,
  });

  /// Null when the account carries no usable human name; the greeting then
  /// stands alone rather than printing a login handle.
  final String? guardianName;
  final String dateLabel;

  /// The bare time a cached snapshot was taken, e.g. `09:00 AM NPT`. Only
  /// read when [isStale]; the chip states it in full so a parent is never
  /// left guessing how old "saved data" is.
  final String? savedAtLabel;
  final bool isStale;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final greeting = guardianName == null
        ? 'Namaste'
        : 'Namaste, ${guardianName!}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          greeting,
          style: theme.textTheme.headlineMedium?.copyWith(
            color: ParentPortalColors.navy,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          dateLabel,
          style: theme.textTheme.bodySmall?.copyWith(
            color: ParentPortalColors.muted,
          ),
        ),
        if (isStale) ...[
          const SizedBox(height: AppSpacing.sm),
          _StaleDataChip(savedAtLabel: savedAtLabel),
        ],
      ],
    );
  }
}

/// Always-visible active-child context. On multi-child accounts this is also
/// the explicit switcher; the parent profile avatar remains a profile control.
class ActiveChildContextCard extends StatelessWidget {
  const ActiveChildContextCard({
    super.key,
    required this.child,
    required this.canSwitch,
    this.onTap,
  });

  final ParentDashboardChild child;
  final bool canSwitch;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: canSwitch,
      label: canSwitch
          ? 'Viewing ${child.name}. Double tap to switch child.'
          : 'Viewing ${child.name}.',
      excludeSemantics: true,
      child: PortalCard(
        onTap: canSwitch ? onTap : null,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            AvatarInitials(name: child.name, radius: 20),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Viewing',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: ParentPortalColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    child.name,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '${child.classSection} • ${child.schoolName}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  StatusBadge(
                    label: child.guardianContext,
                    icon: Icons.verified_user_outlined,
                  ),
                ],
              ),
            ),
            if (canSwitch) ...[
              const SizedBox(width: AppSpacing.sm),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                color: ParentPortalColors.green,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Says out loud that the figures below were read from the offline cache, so
/// a parent never mistakes yesterday's attendance for today's.
class _StaleDataChip extends StatelessWidget {
  const _StaleDataChip({required this.savedAtLabel});

  final String? savedAtLabel;

  @override
  Widget build(BuildContext context) {
    final label = savedAtLabel == null || savedAtLabel!.trim().isEmpty
        ? 'Showing saved data'
        : 'Showing saved data • Last updated ${savedAtLabel!}';

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: ParentPortalColors.surfaceAlt,
        borderRadius: AppRadius.borderRadiusMax,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            size: 14,
            color: ParentPortalColors.muted,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: ParentPortalColors.muted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A section title with an optional trailing action ("View all").
class DashboardSectionHeader extends StatelessWidget {
  const DashboardSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final label = actionLabel;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (label != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: ParentPortalColors.green,
              // 44x44 minimum target without letting the label crowd the title.
              minimumSize: const Size(44, 44),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              textStyle: Theme.of(context).textTheme.labelLarge,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label),
                const Icon(Icons.chevron_right_rounded, size: 18),
              ],
            ),
          ),
      ],
    );
  }
}

/// The one thing the parent should deal with first.
///
/// Shown only when something is actually pending; there is no "all clear"
/// variant, because a card that shouts on a quiet day teaches parents to
/// ignore it.
class PriorityAttentionCard extends StatelessWidget {
  const PriorityAttentionCard({
    super.key,
    required this.action,
    required this.onReview,
    this.otherCount = 0,
    this.isBusy = false,
  });

  final ParentPriorityAction action;

  /// Null renders the call to action disabled - used while a route is not yet
  /// resolvable rather than letting the parent tap into nothing.
  final VoidCallback? onReview;

  /// How many further pending items sit behind this one.
  final int otherCount;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // A stacked call to action once the text is scaled up: side by side, the
    // button and the summary each get half a phone width and both wrap badly.
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;

    return Semantics(
      container: true,
      child: PortalCard(
        color: ParentPortalColors.orangeSoft,
        borderColor: ParentPortalColors.orange.withValues(alpha: .35),
        padding: const EdgeInsets.all(AppSpacing.lgPlus),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 17,
                  color: ParentPortalColors.orange,
                ),
                const SizedBox(width: AppSpacing.xs),
                Flexible(
                  child: Text(
                    'NEEDS YOUR ATTENTION',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: ParentPortalColors.orange,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .6,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            // Side by side is the reference layout and the one to keep while
            // it fits. It stops fitting on two counts, and both were seen on
            // a real device: scaled-up text, and a narrow handset - at 320dp
            // the summary is squeezed to about 110dp and "3 homework items
            // due" breaks over three lines next to the button. Measure the
            // room actually available rather than guessing from the screen.
            LayoutBuilder(
              builder: (context, constraints) {
                final stack = scale > 1.3 || constraints.maxWidth < 280;
                if (stack) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _PrioritySummary(action: action),
                      const SizedBox(height: AppSpacing.md),
                      SizedBox(
                        width: double.infinity,
                        child: _ReviewButton(
                          label: _reviewLabel(action.kind),
                          onPressed: onReview,
                          isBusy: isBusy,
                        ),
                      ),
                    ],
                  );
                }
                return Row(
                  children: [
                    Expanded(child: _PrioritySummary(action: action)),
                    const SizedBox(width: AppSpacing.md),
                    _ReviewButton(
                      label: _reviewLabel(action.kind),
                      onPressed: onReview,
                      isBusy: isBusy,
                    ),
                  ],
                );
              },
            ),
            if (otherCount > 0) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                otherCount == 1
                    ? '1 more item needs your attention'
                    : '$otherCount more items need your attention',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _reviewLabel(ParentPriorityKind kind) => switch (kind) {
  ParentPriorityKind.transport => 'Review transport',
  ParentPriorityKind.fees => 'Review fees',
  ParentPriorityKind.homework => 'Review homework',
  ParentPriorityKind.updates => 'Review updates',
};

class _PrioritySummary extends StatelessWidget {
  const _PrioritySummary({required this.action});

  final ParentPriorityAction action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          ParentDashboardTokens.priorityIcon(action.kind),
          size: 20,
          color: ParentPortalColors.orange,
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            action.summary,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _ReviewButton extends StatelessWidget {
  const _ReviewButton({
    required this.label,
    required this.onPressed,
    required this.isBusy,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: isBusy ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: ParentPortalColors.orange,
        foregroundColor: Colors.white,
        disabledBackgroundColor: ParentPortalColors.orange.withValues(
          alpha: .45,
        ),
        disabledForegroundColor: Colors.white,
        minimumSize: const Size(44, 44),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        shape: const StadiumBorder(),
      ),
      child: isBusy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          // Flexible so the label wraps inside the button at a large text
          // scale rather than pushing the chevron off a 320dp screen. The
          // words stay whole - a truncated "Review no…" is worse than two
          // lines.
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(child: Text(label, textAlign: TextAlign.center)),
                const SizedBox(width: AppSpacing.xs),
                const Icon(Icons.chevron_right_rounded, size: 18),
              ],
            ),
    );
  }
}

/// One compact shortcut in the "Quick actions" row.
class QuickActionTile extends StatelessWidget {
  const QuickActionTile({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.isBusy = false,
  });

  final IconData icon;
  final String label;
  final Color color;

  /// Null renders the tile disabled - used when the parent's role does not
  /// carry the permission the destination needs.
  final VoidCallback? onTap;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !isBusy;
    final foreground = enabled ? color : ParentPortalColors.muted;

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: enabled
            ? color.withValues(alpha: .08)
            : ParentPortalColors.surfaceAlt,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderRadiusLG,
          side: BorderSide(
            color: enabled
                ? color.withValues(alpha: .22)
                : ParentPortalColors.border,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.md,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: enabled ? Colors.white : Colors.transparent,
                    borderRadius: AppRadius.borderRadiusMD,
                  ),
                  child: isBusy
                      ? const Padding(
                          padding: EdgeInsets.all(9),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(icon, size: 19, color: foreground),
                ),
                const SizedBox(height: AppSpacing.sm),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: enabled
                          ? ParentPortalColors.navy
                          : ParentPortalColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The dashboard's shape while it loads.
///
/// A skeleton rather than a spinner: the sections land where the parent
/// already expects them, so the screen does not jump when the data arrives.
/// Deliberately unanimated - a repeating shimmer never lets `pumpAndSettle`
/// return, which would cost every widget test on this screen.
class ParentDashboardSkeleton extends StatelessWidget {
  const ParentDashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading your dashboard',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lgPlus,
          AppSpacing.lg,
          AppSpacing.xl,
        ),
        children: const [
          _SkeletonBlock(width: 220, height: 28),
          SizedBox(height: AppSpacing.sm),
          _SkeletonBlock(width: 260, height: 14),
          SizedBox(height: AppSpacing.lgPlus),
          _SkeletonCard(height: 132),
          SizedBox(height: AppSpacing.xl),
          _SkeletonBlock(width: 180, height: 20),
          SizedBox(height: AppSpacing.md),
          _SkeletonCard(height: 220),
          SizedBox(height: AppSpacing.xl),
          _SkeletonBlock(width: 140, height: 20),
          SizedBox(height: AppSpacing.md),
          _SkeletonCard(height: 168),
        ],
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: ParentPortalColors.surfaceAlt,
          borderRadius: AppRadius.borderRadiusSM,
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.borderRadiusXL,
        border: Border.all(color: ParentPortalColors.border),
      ),
    );
  }
}

/// The card a section falls back to when it has nothing to show. States the
/// absence in words rather than leaving a blank gap the parent has to read as
/// either "nothing" or "not loaded".
class DashboardEmptyCard extends StatelessWidget {
  const DashboardEmptyCard({
    super.key,
    required this.icon,
    required this.message,
  });

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.all(AppSpacing.lgPlus),
      child: Row(
        children: [
          Icon(icon, size: 20, color: ParentPortalColors.muted),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              message,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: ParentPortalColors.muted),
            ),
          ),
        ],
      ),
    );
  }
}
