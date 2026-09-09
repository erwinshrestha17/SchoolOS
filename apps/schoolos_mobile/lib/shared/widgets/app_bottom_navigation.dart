import 'package:flutter/material.dart';

import '../../app/design_system/app_radius.dart';
import '../../app/theme/app_semantic_colors.dart';

@immutable
class AppBottomNavigationItem {
  const AppBottomNavigationItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    this.badgeCount,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final int? badgeCount;
}

/// Shared phone-first bottom navigation for SchoolOS personas.
///
/// The component deliberately caps primary destinations at five. Secondary
/// work belongs in contextual screens or a More destination, which keeps the
/// most frequent actions reachable with one hand and prevents mobile from
/// becoming a compressed web sidebar.
class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    this.accentColor,
  }) : assert(items.length >= 2 && items.length <= 5);

  final List<AppBottomNavigationItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final semantic = AppSemanticColors.of(context);
    final safeIndex = selectedIndex.clamp(0, items.length - 1);
    final compact = MediaQuery.sizeOf(context).width < 360;
    final accent = accentColor ?? semantic.primary;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.xxl),
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: semantic.surface,
              indicatorColor: accent.withValues(alpha: .14),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final selected = states.contains(WidgetState.selected);
                return TextStyle(
                  fontSize: compact ? 10 : 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: selected ? accent : semantic.textMuted,
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                final selected = states.contains(WidgetState.selected);
                return IconThemeData(
                  size: 24,
                  color: selected ? accent : semantic.textMuted,
                );
              }),
            ),
            child: NavigationBar(
              selectedIndex: safeIndex,
              height: 68,
              elevation: 0,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              onDestinationSelected: onSelected,
              destinations: [
                for (final item in items)
                  NavigationDestination(
                    tooltip: item.label,
                    icon: _NavigationIcon(
                      icon: item.icon,
                      badgeCount: item.badgeCount,
                      semanticLabel: item.label,
                    ),
                    selectedIcon: _NavigationIcon(
                      icon: item.selectedIcon,
                      badgeCount: item.badgeCount,
                      semanticLabel: item.label,
                    ),
                    label: item.label,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavigationIcon extends StatelessWidget {
  const _NavigationIcon({
    required this.icon,
    required this.semanticLabel,
    this.badgeCount,
  });

  final IconData icon;
  final int? badgeCount;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final count = badgeCount ?? 0;
    final iconWidget = Semantics(
      label: count > 0 ? '$semanticLabel, $count unread' : semanticLabel,
      excludeSemantics: true,
      child: Icon(icon),
    );
    if (count <= 0) return iconWidget;
    return Badge.count(count: count, child: iconWidget);
  }
}
