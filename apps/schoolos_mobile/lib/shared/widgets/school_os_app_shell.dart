import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/constants/app_routes.dart';
import '../../app/theme/app_colors.dart';
import '../../app/theme/app_semantic_colors.dart';
import '../../features/parent/application/parent_dashboard_view_model.dart';
import '../../features/parent/application/parent_portal_providers.dart';
import '../../features/parent/presentation/screens/parent_portal_children_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_home_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_homework_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_more_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_updates_tab.dart';
import '../../features/parent/presentation/widgets/parent_dashboard_widgets.dart';
import '../../features/parent/presentation/widgets/parent_portal_widgets.dart';
import 'app_bottom_navigation.dart';
import 'app_exception_view.dart';

class SchoolOsAppShell extends ConsumerStatefulWidget {
  const SchoolOsAppShell({
    super.key,
    this.initialIndex = 0,
    this.initialChildId,
  });

  final int initialIndex;
  final String? initialChildId;

  @override
  ConsumerState<SchoolOsAppShell> createState() => _SchoolOsAppShellState();
}

class _SchoolOsAppShellState extends ConsumerState<SchoolOsAppShell> {
  late int selectedIndex = widget.initialIndex.clamp(0, 4);

  static const titles = ['Today', 'Child', 'Schoolwork', 'Updates', 'More'];

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(parentPortalDataProvider);
    final semantic = AppSemanticColors.of(context);
    return PopScope(
      canPop: selectedIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && selectedIndex != 0) {
          setState(() => selectedIndex = 0);
        }
      },
      child: Scaffold(
        backgroundColor: semantic.background,
        appBar: AppTopBar(title: titles[selectedIndex]),
        body: SafeArea(
          top: false,
          child: data.when(
            skipLoadingOnReload: false,
            skipLoadingOnRefresh: false,
            loading: () => selectedIndex == 0
                ? const ParentDashboardSkeleton()
                : const PortalLoadingState(),
            error: (error, _) => AppExceptionView(
              error: error,
              onRetry: () => ref.invalidate(parentPortalDataProvider),
              onSignIn: () => context.go(AppRoutes.login),
            ),
            data: (portal) => IndexedStack(
              index: selectedIndex,
              children: [
                ParentPortalHomeTab(
                  data: portal,
                  onOpenTab: (index) => setState(() => selectedIndex = index),
                ),
                ParentPortalChildrenTab(data: portal),
                ParentPortalHomeworkTab(
                  data: portal,
                  initialChildId: widget.initialChildId,
                ),
                ParentPortalUpdatesTab(data: portal),
                ParentPortalMoreTab(data: portal),
              ],
            ),
          ),
        ),
        bottomNavigationBar: SchoolOsBottomNavigation(
          selectedIndex: selectedIndex,
          onSelected: (index) => setState(() => selectedIndex = index),
        ),
      ),
    );
  }
}

class AppTopBar extends ConsumerWidget implements PreferredSizeWidget {
  const AppTopBar({super.key, required this.title, this.leading});

  final String title;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider).valueOrNull;
    final parentName = portal == null
        ? 'Parent'
        : guardianDisplayName(portal.parentName) ?? 'Parent';
    final unread = portal?.unreadUpdates ?? 0;
    final semantic = AppSemanticColors.of(context);
    return AppBar(
      leading: leading,
      title: Text(
        title,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: semantic.textPrimary,
          fontWeight: FontWeight.w800,
        ),
      ),
      backgroundColor: semantic.background,
      surfaceTintColor: Colors.transparent,
      actions: [
        IconButton(
          tooltip: unread > 0
              ? 'Notifications, $unread unread'
              : 'Notifications',
          onPressed: () => context.push(AppRoutes.notifications),
          icon: Badge.count(
            count: unread,
            isLabelVisible: unread > 0,
            backgroundColor: AppColors.parentAccent,
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 10),
          child: Semantics(
            button: true,
            label: 'Profile',
            excludeSemantics: true,
            child: InkWell(
              onTap: () => context.push(AppRoutes.profile),
              borderRadius: BorderRadius.circular(999),
              child: SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: AvatarInitials(
                    name: parentName,
                    radius: 18,
                    color: AppColors.parentAccent,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Parent navigation intentionally exposes five task groups, never individual
/// modules. Attendance, fees, calendar, results and other features are opened
/// contextually from Today/Child/Schoolwork/More instead of competing for a
/// permanent bottom-bar slot.
class SchoolOsBottomNavigation extends StatelessWidget {
  const SchoolOsBottomNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const items = [
    AppBottomNavigationItem(
      label: 'Today',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    AppBottomNavigationItem(
      label: 'Child',
      icon: Icons.family_restroom_outlined,
      selectedIcon: Icons.family_restroom_rounded,
    ),
    AppBottomNavigationItem(
      label: 'Schoolwork',
      icon: Icons.menu_book_outlined,
      selectedIcon: Icons.menu_book_rounded,
    ),
    AppBottomNavigationItem(
      label: 'Updates',
      icon: Icons.notifications_none_rounded,
      selectedIcon: Icons.notifications_rounded,
    ),
    AppBottomNavigationItem(
      label: 'More',
      icon: Icons.grid_view_outlined,
      selectedIcon: Icons.grid_view_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) => AppBottomNavigation(
    items: items,
    selectedIndex: selectedIndex,
    accentColor: AppColors.parentAccent,
    onSelected: onSelected,
  );
}
