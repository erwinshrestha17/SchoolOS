import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/constants/app_routes.dart';
import '../../features/parent/application/parent_portal_providers.dart';
import '../../features/parent/presentation/screens/parent_portal_children_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_home_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_homework_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_more_tab.dart';
import '../../features/parent/presentation/screens/parent_portal_updates_tab.dart';
import '../../features/parent/presentation/widgets/parent_portal_widgets.dart';
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

  static const titles = ['Today', 'Children', 'Homework', 'Notices', 'More'];

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(parentPortalDataProvider);
    return Scaffold(
      backgroundColor: ParentPortalColors.page,
      appBar: AppTopBar(title: titles[selectedIndex]),
      body: SafeArea(
        top: false,
        child: data.when(
          skipLoadingOnReload: false,
          skipLoadingOnRefresh: false,
          loading: () => const PortalLoadingState(),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(parentPortalDataProvider),
            onSignIn: () => context.go(AppRoutes.login),
          ),
          data: (portal) => IndexedStack(
            index: selectedIndex,
            children: [
              ParentPortalHomeTab(data: portal),
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
        selectedIndex: _navIndexForShellIndex(selectedIndex),
        onSelected: _handleNavigationSelection,
      ),
    );
  }

  int _navIndexForShellIndex(int index) {
    return switch (index) {
      0 => 0,
      1 => 1,
      2 => 3,
      3 => 4,
      _ => 5,
    };
  }

  void _handleNavigationSelection(int index) {
    switch (index) {
      case 0:
        setState(() => selectedIndex = 0);
        return;
      case 1:
        setState(() => selectedIndex = 1);
        return;
      case 2:
        context.go(AppRoutes.parentAttendance);
        return;
      case 3:
        setState(() => selectedIndex = 2);
        return;
      case 4:
        setState(() => selectedIndex = 3);
        return;
      case 5:
        setState(() => selectedIndex = 4);
        return;
    }
  }
}

class AppTopBar extends ConsumerWidget implements PreferredSizeWidget {
  const AppTopBar({super.key, required this.title});

  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider).valueOrNull;
    final parentName = portal?.parentName ?? 'Parent';
    return AppBar(
      title: Text(
        title,
        style: const TextStyle(
          color: ParentPortalColors.navy,
          fontWeight: FontWeight.w900,
        ),
      ),
      backgroundColor: ParentPortalColors.page,
      surfaceTintColor: Colors.transparent,
      actions: [
        IconButton(
          tooltip: 'Notifications',
          onPressed: () => context.push(AppRoutes.notifications),
          icon: const Icon(Icons.notifications_none_rounded),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 10),
          child: InkWell(
            onTap: () => context.push(AppRoutes.profile),
            borderRadius: BorderRadius.circular(999),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: AvatarInitials(name: parentName, radius: 18),
            ),
          ),
        ),
      ],
    );
  }
}

class SchoolOsBottomNavigation extends StatelessWidget {
  const SchoolOsBottomNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const items = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.family_restroom_outlined, Icons.family_restroom_rounded, 'Children'),
    (Icons.fact_check_outlined, Icons.fact_check_rounded, 'Attendance'),
    (Icons.menu_book_outlined, Icons.menu_book_rounded, 'Homework'),
    (Icons.notifications_none_rounded, Icons.notifications_rounded, 'Notices'),
    (Icons.grid_view_outlined, Icons.grid_view_rounded, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: ParentPortalColors.border)),
        ),
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
        child: Row(
          children: [
            for (var index = 0; index < items.length; index++)
              Expanded(
                child: InkWell(
                  onTap: () => onSelected(index),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 2,
                      vertical: 3,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 13,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: selectedIndex == index
                                ? ParentPortalColors.greenSoft
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Icon(
                            selectedIndex == index
                                ? items[index].$2
                                : items[index].$1,
                            size: 22,
                            color: selectedIndex == index
                                ? ParentPortalColors.green
                                : ParentPortalColors.muted,
                          ),
                        ),
                        const SizedBox(height: 2),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            items[index].$3,
                            maxLines: 1,
                            style: TextStyle(
                              fontSize: 11,
                              color: selectedIndex == index
                                  ? ParentPortalColors.green
                                  : ParentPortalColors.muted,
                              fontWeight: selectedIndex == index
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
