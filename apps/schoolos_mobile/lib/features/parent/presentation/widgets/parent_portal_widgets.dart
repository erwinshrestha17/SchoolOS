import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../domain/parent_portal_models.dart';

class ParentPortalColors {
  const ParentPortalColors._();

  static const green = Color(0xFF168C69);
  static const greenSoft = Color(0xFFE9F7F1);
  static const navy = Color(0xFF172033);
  static const muted = Color(0xFF718096);
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
    required this.onTap,
    this.compact = false,
  });

  final ParentPortalChild child;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
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
                      '${child.classSection} • ${child.teacher}',
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
          const SizedBox(height: 14),
          _InfoLine(
            icon: Icons.check_circle_outline_rounded,
            color: ParentPortalColors.green,
            title: child.attendance,
            subtitle: child.attendanceTime,
          ),
          if (!compact) ...[
            const SizedBox(height: 12),
            _InfoLine(
              icon: Icons.directions_bus_outlined,
              color: ParentPortalColors.orange,
              title: child.transport,
            ),
          ],
          const SizedBox(height: 12),
          _InfoLine(
            icon: Icons.menu_book_outlined,
            color: ParentPortalColors.purple,
            title: child.homework,
            subtitle: child.updates,
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
  const HomeworkCard({super.key, required this.item, required this.onOpen});

  final ParentPortalHomework item;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final completed = item.isCompleted;
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AvatarInitials(name: item.childName, radius: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${item.childName} • ${item.classSection}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              StatusBadge(
                label: item.subject,
                color: ParentPortalColors.purple,
                backgroundColor: ParentPortalColors.purpleSoft,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            item.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            item.dueLabel,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: completed
                  ? ParentPortalColors.green
                  : ParentPortalColors.orange,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge(
                label: item.status,
                color: completed
                    ? ParentPortalColors.green
                    : ParentPortalColors.orange,
                backgroundColor: completed
                    ? ParentPortalColors.greenSoft
                    : ParentPortalColors.orangeSoft,
              ),
              StatusBadge(
                label:
                    '${item.attachmentCount} attachment${item.attachmentCount == 1 ? '' : 's'}',
                color: ParentPortalColors.blue,
                backgroundColor: ParentPortalColors.blueSoft,
                icon: Icons.attach_file_rounded,
              ),
            ],
          ),
          const Divider(height: 28),
          Row(
            children: [
              Expanded(
                child: Text(
                  item.teacher,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                  ),
                ),
              ),
              FilledButton.tonal(
                onPressed: onOpen,
                style: FilledButton.styleFrom(
                  foregroundColor: ParentPortalColors.green,
                  backgroundColor: ParentPortalColors.greenSoft,
                ),
                child: const Text('Open'),
              ),
            ],
          ),
        ],
      ),
    );
  }
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
