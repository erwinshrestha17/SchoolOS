import 'package:flutter/material.dart';

import '../../../../shared/utils/money_format.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../application/parent_dashboard_view_model.dart';
import '../../domain/parent_portal_models.dart';
import 'parent_dashboard_tokens.dart';

class ParentPortalColors {
  const ParentPortalColors._();

  // `green` and `muted` carry text - the selected and unselected bottom-nav
  // labels, and most secondary copy in the portal. At their previous values
  // (#168C69 and #718096) they measured 4.21:1 and 4.02:1 against white, both
  // short of the 4.5:1 WCAG AA needs for normal text, and lower again on the
  // #F6F8FB page background. Darkened to clear AA on both surfaces; see
  // `accessibility_audit_test.dart`, which pins the ratios.
  static const green = Color(0xFF0F7355);
  static const greenSoft = Color(0xFFE9F7F1);
  static const navy = Color(0xFF172033);
  static const muted = Color(0xFF5C6B7A);
  static const purple = Color(0xFF7656D6);
  static const purpleSoft = Color(0xFFF2EDFF);
  static const blue = Color(0xFF377DDF);
  static const blueSoft = Color(0xFFEDF5FF);
  static const orange = Color(0xFFF28A3A);
  static const orangeSoft = Color(0xFFFFF2E8);
  static const red = Color(0xFFD64545);
  static const redSoft = Color(0xFFFFEEEE);
  static const surfaceAlt = Color(0xFFF1F4F8);
  static const page = Color(0xFFF6F8FB);
  static const border = Color(0xFFE6EBF1);
}

class PortalCard extends StatelessWidget {
  const PortalCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.onTap,
    this.color = Colors.white,
    this.borderColor = ParentPortalColors.border,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color color;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.borderRadiusXL,
        side: BorderSide(color: borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class AvatarInitials extends StatelessWidget {
  const AvatarInitials({
    super.key,
    required this.name,
    this.radius = 24,
    this.backgroundColor = ParentPortalColors.greenSoft,
    this.foregroundColor = ParentPortalColors.green,
    this.color,
  });

  final String name;
  final double radius;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    return CircleAvatar(
      radius: radius,
      backgroundColor: color?.withValues(alpha: .10) ?? backgroundColor,
      child: Text(
        initials,
        style: TextStyle(
          color: color ?? foregroundColor,
          fontWeight: FontWeight.w800,
          fontSize: radius * .62,
        ),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.color = ParentPortalColors.green,
    this.backgroundColor = ParentPortalColors.greenSoft,
    this.background,
    this.icon,
  });

  final String label;
  final Color color;
  final Color backgroundColor;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background ?? backgroundColor,
        borderRadius: AppRadius.borderRadiusMax,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
          ],
          // Flexible so a long status at a large text scale wraps inside the
          // badge rather than pushing the row past the card edge.
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ParentSectionHeader extends StatelessWidget {
  const ParentSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
    this.trailing,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
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
        ...?trailing == null ? null : [trailing!],
        if (trailing == null && actionLabel != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class ActionTile extends StatelessWidget {
  const ActionTile({
    super.key,
    required this.icon,
    this.title,
    this.label,
    required this.color,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String? title;
  final String? label;
  final String? subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .11),
              borderRadius: AppRadius.borderRadiusMD,
            ),
            child: Icon(icon, color: color, size: 21),
          ),
          const SizedBox(height: 12),
          Text(
            title ?? label ?? '',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 3),
            Text(
              subtitle!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
            ),
          ],
        ],
      ),
    );
  }
}

class SummaryMetric extends StatelessWidget {
  const SummaryMetric({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .11),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ChildSelectorChip extends StatelessWidget {
  const ChildSelectorChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      selectedColor: ParentPortalColors.green,
      backgroundColor: Colors.white,
      side: BorderSide(
        color: selected ? ParentPortalColors.green : ParentPortalColors.border,
      ),
      labelStyle: TextStyle(
        color: selected ? Colors.white : ParentPortalColors.navy,
        fontWeight: FontWeight.w700,
      ),
      shape: const StadiumBorder(),
      showCheckmark: false,
    );
  }
}

class ListChevron extends StatelessWidget {
  const ListChevron({super.key});

  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.chevron_right_rounded, color: AppColors.slate400);
  }
}

class ParentChildCard extends StatelessWidget {
  const ParentChildCard({
    super.key,
    required this.child,
    required this.schoolName,
    required this.onTap,
    this.compact = false,
    this.actionCount = 0,
    this.overdueHomeworkCount = 0,
    this.nextHomeworkDueAt,
    this.now,
  });

  final ParentPortalChild child;
  final String schoolName;
  final VoidCallback onTap;
  final bool compact;
  final int actionCount;
  final int overdueHomeworkCount;
  final DateTime? nextHomeworkDueAt;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final attendance = attendanceRowFor(child);
    final attendanceColor = switch (attendance.tone) {
      ParentStatusTone.positive => ParentPortalColors.green,
      ParentStatusTone.attention => ParentPortalColors.orange,
      ParentStatusTone.critical => ParentPortalColors.red,
      ParentStatusTone.informational => ParentPortalColors.blue,
      _ => ParentPortalColors.muted,
    };
    return PortalCard(
      onTap: onTap,
      child: Column(
        children: [
          Row(
            children: [
              AvatarInitials(name: child.name, radius: compact ? 23 : 27),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '${child.classSection} • $schoolName',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                    if (child.teacher.trim().isNotEmpty &&
                        !child.teacher.toLowerCase().contains('not assigned'))
                      Text(
                        'Class teacher: ${child.teacher}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ParentPortalColors.muted,
                        ),
                      ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusBadge(
                          label: child.guardianContext,
                          icon: Icons.verified_user_outlined,
                        ),
                        if (actionCount > 0)
                          StatusBadge(
                            label:
                                '$actionCount ${actionCount == 1 ? 'action needs' : 'actions need'} review',
                            icon: Icons.priority_high_rounded,
                            color: ParentPortalColors.orange,
                            backgroundColor: ParentPortalColors.orangeSoft,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const ListChevron(),
            ],
          ),
          const SizedBox(height: 14),
          _InfoLine(
            icon: ParentDashboardTokens.statusIcon(
              ParentStatusKind.attendance,
              attendance.tone,
            ),
            color: attendanceColor,
            title: attendance.title,
            subtitle: attendance.subtitle,
          ),
          if (!compact && child.showTransport) ...[
            const SizedBox(height: 12),
            _InfoLine(
              icon: Icons.directions_bus_outlined,
              color: child.transportNeedsAttention
                  ? ParentPortalColors.orange
                  : ParentPortalColors.blue,
              title: child.transport,
              subtitle: child.transportDetail,
            ),
          ],
          const SizedBox(height: 12),
          _InfoLine(
            icon: Icons.menu_book_outlined,
            color: ParentPortalColors.purple,
            title: child.homework.toLowerCase().contains('locked')
                ? 'Homework not available'
                : child.homeworkPending == 1
                ? '1 homework task pending'
                : '${child.homeworkPending} homework tasks pending',
            subtitle: child.homework.toLowerCase().contains('locked')
                ? null
                : homeworkStatusSubtitle(
                    child,
                    overdueCount: overdueHomeworkCount,
                    nextDueAt: nextHomeworkDueAt,
                    now: now,
                  ),
          ),
          const SizedBox(height: 12),
          _InfoLine(
            icon: child.hasFeesDue
                ? Icons.account_balance_wallet_outlined
                : child.hasNoFeeInvoices
                ? Icons.receipt_long_outlined
                : Icons.verified_rounded,
            color: child.hasFeesDue
                ? ParentPortalColors.orange
                : child.hasNoFeeInvoices
                ? ParentPortalColors.muted
                : ParentPortalColors.green,
            title: child.hasFeesDue
                ? 'Fees due ${formatMoney(child.feesDue)}'
                : child.hasNoFeeInvoices
                ? 'No fee invoice issued'
                : 'Fees paid',
            subtitle: child.nextFeeDueDate == null
                ? child.hasFeesDue
                      ? 'Open fees for payment details'
                      : child.hasNoFeeInvoices
                      ? 'Nothing to pay yet'
                      : 'No outstanding balance'
                : 'Next due ${_shortDate(child.nextFeeDueDate)}',
          ),
          if (!compact) ...[
            const Divider(height: 28),
            Row(
              children: [
                Text(
                  'View child',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: ParentPortalColors.green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                const ListChevron(),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class HomeworkCard extends StatelessWidget {
  const HomeworkCard({
    super.key,
    required this.item,
    required this.onOpen,
    this.showChildIdentity = true,
    this.now,
  });

  final ParentPortalHomework item;
  final VoidCallback onOpen;
  final bool showChildIdentity;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final effectiveNow = now ?? DateTime.now();
    final status = item.primaryStatusAt(effectiveNow);
    final metadata = <Widget>[
      if (item.scoreLabel != null)
        _HomeworkMetadata(
          icon: Icons.grade_outlined,
          label: item.scoreLabel!,
          emphasized: true,
        ),
      if (item.hasFeedback)
        const _HomeworkMetadata(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Teacher feedback available',
        ),
      if (item.attachmentCount > 0)
        _HomeworkMetadata(
          icon: Icons.attach_file_rounded,
          label:
              '${item.attachmentCount} attachment${item.attachmentCount == 1 ? '' : 's'}',
        ),
      if (item.submittedAt == null && item.state.needsAttention)
        const _HomeworkMetadata(
          icon: Icons.remove_circle_outline_rounded,
          label: 'No submission',
        ),
    ];

    return PortalCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showChildIdentity)
            Row(
              children: [
                AvatarInitials(name: item.childName, radius: 18),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    '${item.childName} • ${item.classSection}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _HomeworkSubjectBadge(label: item.subject),
              ],
            )
          else
            Align(
              alignment: Alignment.centerRight,
              child: _HomeworkSubjectBadge(label: item.subject),
            ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.displayTitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            [
              status.label,
              _homeworkDueContext(item, effectiveNow),
            ].where((value) => value.isNotEmpty).join(' · '),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _homeworkStatusColor(status),
              fontWeight: FontWeight.w800,
            ),
          ),
          if (metadata.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.xs,
              children: metadata,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 44,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    item.teacher == 'Assigned by school'
                        ? item.teacher
                        : 'Assigned by ${item.teacher}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  item.actionLabel,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: ParentPortalColors.green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: ParentPortalColors.green,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeworkSubjectBadge extends StatelessWidget {
  const _HomeworkSubjectBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return StatusBadge(
      label: label,
      color: ParentPortalColors.purple,
      backgroundColor: ParentPortalColors.purpleSoft,
    );
  }
}

class _HomeworkMetadata extends StatelessWidget {
  const _HomeworkMetadata({
    required this.icon,
    required this.label,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 15,
          color: emphasized
              ? ParentPortalColors.purple
              : ParentPortalColors.muted,
        ),
        const SizedBox(width: AppSpacing.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: emphasized
                ? ParentPortalColors.navy
                : ParentPortalColors.muted,
            fontWeight: emphasized ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

Color _homeworkStatusColor(ParentHomeworkPrimaryStatus status) {
  return switch (status) {
    ParentHomeworkPrimaryStatus.overdue ||
    ParentHomeworkPrimaryStatus.needsCorrection ||
    ParentHomeworkPrimaryStatus.incomplete ||
    ParentHomeworkPrimaryStatus.partiallyCompleted => ParentPortalColors.red,
    ParentHomeworkPrimaryStatus.dueSoon => ParentPortalColors.orange,
    ParentHomeworkPrimaryStatus.submittedLate ||
    ParentHomeworkPrimaryStatus.awaitingReview => ParentPortalColors.blue,
    ParentHomeworkPrimaryStatus.marked => ParentPortalColors.purple,
    ParentHomeworkPrimaryStatus.completedLate ||
    ParentHomeworkPrimaryStatus.completed ||
    ParentHomeworkPrimaryStatus.excused => ParentPortalColors.green,
    _ => ParentPortalColors.muted,
  };
}

String _homeworkDueContext(ParentPortalHomework item, DateTime now) {
  final due = item.dueAt;
  if (item.submittedAt != null &&
      (item.isCompleted || item.state == ParentHomeworkState.late)) {
    final submitted = _shortBsDate(item.submittedAt!);
    return due == null
        ? 'Submitted $submitted'
        : 'Submitted $submitted · Due ${_shortBsDate(due)}';
  }
  if (due == null) return 'Due date unavailable';
  if (item.isOverdueAt(now)) {
    final dueDay = NepaliBsCalendar.startOfNepalSchoolDayUtc(due);
    final today = NepaliBsCalendar.startOfNepalSchoolDayUtc(now);
    final days = today.difference(dueDay).inDays;
    return 'Due ${_shortBsDate(due)} · '
        '${days <= 0 ? 'overdue today' : '$days day${days == 1 ? '' : 's'} overdue'}';
  }
  final dueDay = NepaliBsCalendar.startOfNepalSchoolDayUtc(due);
  final today = NepaliBsCalendar.startOfNepalSchoolDayUtc(now);
  final days = dueDay.difference(today).inDays;
  if (days == 0) {
    return 'Due today, ${NepaliBsCalendar.formatNepalTime(due)}';
  }
  if (days == 1) {
    return 'Due tomorrow, ${NepaliBsCalendar.formatNepalTime(due)}';
  }
  return 'Due ${_shortBsDate(due)}';
}

String _shortBsDate(DateTime value) {
  final bs = NepaliBsCalendar.fromAd(value);
  return '${bs.monthName} ${bs.day} BS';
}

class SettingsMenuItem extends StatelessWidget {
  const SettingsMenuItem({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.color = ParentPortalColors.green,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.borderRadiusLG,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .1),
                borderRadius: AppRadius.borderRadiusMD,
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: color == ParentPortalColors.red
                          ? color
                          : ParentPortalColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    subtitle,
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
    );
  }
}

class PortalLoadingState extends StatelessWidget {
  const PortalLoadingState({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

class PortalErrorState extends StatelessWidget {
  const PortalErrorState({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 42),
            const SizedBox(height: 12),
            const Text('Parent portal data could not be loaded.'),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 19, color: color),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

String _shortDate(String? value) {
  final date = DateTime.tryParse(value ?? '');
  if (date == null) {
    return 'date unavailable';
  }
  return NepaliBsCalendar.formatBsDate(date);
}
