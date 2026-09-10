import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_semantic_colors.dart';
import '../../../../shared/widgets/school_os_app_shell.dart';
import '../../domain/parent_models.dart' as parent_models;
import 'parent_portal_widgets.dart';

class ParentDetailScaffold extends StatelessWidget {
  const ParentDetailScaffold({
    super.key,
    required this.title,
    required this.selectedIndex,
    required this.body,
    this.onBack,
    this.showGlobalActions = true,
  });

  final String title;

  /// Legacy parent detail screens use the previous six-slot index mapping.
  /// The scaffold normalizes that value into the new five-destination IA so
  /// route behavior can be migrated incrementally without changing domain or
  /// backend contracts.
  final int selectedIndex;
  final Widget body;
  final VoidCallback? onBack;
  final bool showGlobalActions;

  @override
  Widget build(BuildContext context) {
    final semantic = AppSemanticColors.of(context);
    return Scaffold(
      backgroundColor: semantic.background,
      appBar: showGlobalActions
          ? AppTopBar(
              title: title,
              leading: onBack == null
                  ? null
                  : IconButton(
                      tooltip: 'Back',
                      onPressed: onBack,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
            )
          : AppBar(
              leading: onBack == null
                  ? null
                  : IconButton(
                      tooltip: 'Back',
                      onPressed: onBack,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
              title: Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: semantic.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              backgroundColor: semantic.background,
              surfaceTintColor: Colors.transparent,
            ),
      body: SafeArea(top: false, child: body),
      bottomNavigationBar: SchoolOsBottomNavigation(
        selectedIndex: _normalizeLegacyIndex(selectedIndex),
        onSelected: (index) {
          final route = [
            AppRoutes.parentHome,
            AppRoutes.parentChildren,
            AppRoutes.parentHomework,
            AppRoutes.parentUpdates,
            AppRoutes.parentMore,
          ][index];
          context.go(route);
        },
      ),
    );
  }

  static int _normalizeLegacyIndex(int index) {
    return switch (index) {
      0 => 0, // Today
      1 || 2 => 1, // Child / attendance details
      3 => 2, // Homework -> Schoolwork
      4 => 3, // Notices -> Updates
      _ => 4, // More and secondary modules
    };
  }
}

class ParentApiChildSelector extends StatelessWidget {
  const ParentApiChildSelector({
    super.key,
    required this.child,
    required this.children,
    required this.onChanged,
    this.statusLabel,
  });

  final parent_models.GuardianChild child;
  final List<parent_models.GuardianChild> children;
  final ValueChanged<String> onChanged;
  final String? statusLabel;

  @override
  Widget build(BuildContext context) {
    final selectable = children.length > 1;
    return PortalCard(
      onTap: selectable ? () => _showChildPicker(context) : null,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          AvatarInitials(name: child.name, radius: 24),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: ParentPortalColors.navy,
                  ),
                ),
                Text(
                  _compactClassSection(child.classSection),
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          if (statusLabel != null) ...[
            StatusBadge(label: statusLabel!),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (selectable)
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: ParentPortalColors.muted,
            ),
        ],
      ),
    );
  }

  Future<void> _showChildPicker(BuildContext context) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select child',
                style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final item in children)
                ListTile(
                  leading: AvatarInitials(name: item.name, radius: 20),
                  title: Text(
                    item.name,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(_compactClassSection(item.classSection)),
                  trailing: item.id == child.id
                      ? const Icon(
                          Icons.check_rounded,
                          color: ParentPortalColors.green,
                        )
                      : null,
                  onTap: () => Navigator.pop(sheetContext, item.id),
                ),
            ],
          ),
        ),
      ),
    );
    if (selected != null && selected != child.id) onChanged(selected);
  }
}

String _compactClassSection(String value) {
  return value.replaceFirstMapped(
    RegExp(r'\s+-\s+([A-Za-z0-9]+)$'),
    (match) => match.group(1)!,
  );
}

class FeatureIcon extends StatelessWidget {
  const FeatureIcon(
    this.icon, {
    super.key,
    this.color = ParentPortalColors.purple,
    this.size = 46,
  });

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(AppRadius.lg),
    ),
    child: Icon(icon, color: color, size: size * .5),
  );
}

void showFeatureSnack(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

void showUnavailableWorkflowSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
