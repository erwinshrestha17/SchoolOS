import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/constants/app_routes.dart';
import '../../app/design_system/app_radius.dart';
import '../../app/theme/app_colors.dart';
import '../../features/operational_summary/domain/operational_summary_models.dart';
import '../../features/operational_summary/presentation/operational_summary_card.dart';
import 'app_scaffold.dart';

class RoleShellScaffold extends StatelessWidget {
  const RoleShellScaffold({
    super.key,
    required this.role,
    required this.selectedIndex,
    required this.body,
    this.title = 'SchoolOS Mobile',
    this.floatingActionButton,
  });

  final String role;
  final int selectedIndex;
  final Widget body;
  final String title;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final items = _itemsForRole(role);
    final safeIndex = selectedIndex.clamp(0, items.length - 1);
    final summaryPersona = selectedIndex == 0
        ? _summaryPersonaForRole(role)
        : null;
    final isStudent = role.toUpperCase() == 'STUDENT';

    return AppScaffold(
      appBar: AppBar(
        title: Text(title),
        actions: isStudent
            ? const []
            : [
                IconButton(
                  tooltip: 'Notifications',
                  onPressed: () => context.go(AppRoutes.notifications),
                  icon: const Icon(Icons.notifications_none_rounded),
                ),
                IconButton(
                  tooltip: 'Profile',
                  onPressed: () => context.go(
                    role.toUpperCase() == 'TEACHER'
                        ? AppRoutes.teacherProfile
                        : AppRoutes.profile,
                  ),
                  icon: const Icon(Icons.account_circle_rounded),
                ),
                IconButton(
                  tooltip: 'Settings',
                  onPressed: () => context.go(AppRoutes.settings),
                  icon: const Icon(Icons.settings_rounded),
                ),
              ],
      ),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: items.length < 2
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.xxl),
                  child: NavigationBar(
                    selectedIndex: safeIndex,
                    height: 68,
                    backgroundColor:
                        Theme.of(context).brightness == Brightness.dark
                        ? AppColors.overlayDark
                        : Colors.white,
                    indicatorColor: _roleColor(role).withValues(alpha: 0.14),
                    labelBehavior:
                        NavigationDestinationLabelBehavior.alwaysShow,
                    onDestinationSelected: (index) {
                      final item = items[index];
                      if (item.route != null) {
                        context.go(item.route!);
                        return;
                      }
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            '${item.label} is not available in this mobile workspace yet.',
                          ),
                        ),
                      );
                    },
                    destinations: [
                      for (final item in items)
                        NavigationDestination(
                          icon: Icon(item.icon),
                          selectedIcon: Icon(item.selectedIcon),
                          label: item.label,
                        ),
                    ],
                  ),
                ),
              ),
            ),
      body: summaryPersona == null
          ? body
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: OperationalSummaryCard(persona: summaryPersona),
                ),
                Expanded(child: body),
              ],
            ),
    );
  }

  static OperationalMobilePersona? _summaryPersonaForRole(String role) {
    return switch (role.toUpperCase()) {
      'TEACHER' => OperationalMobilePersona.teacher,
      'DRIVER' => OperationalMobilePersona.driver,
      'STAFF' => OperationalMobilePersona.staff,
      'ADMIN' || 'PRINCIPAL' => OperationalMobilePersona.principal,
      _ => null,
    };
  }

  static Color _roleColor(String role) {
    switch (role.toUpperCase()) {
      case 'PARENT':
        return AppColors.parentAccent;
      case 'STUDENT':
        return AppColors.studentAccent;
      case 'TEACHER':
        return AppColors.teacherAccent;
      case 'DRIVER':
        return AppColors.driverAccent;
      case 'STAFF':
        return AppColors.staffAccent;
      case 'ADMIN':
      case 'PRINCIPAL':
        return AppColors.adminAccent;
      default:
        return AppColors.primary;
    }
  }

  static List<_RoleNavItem> _itemsForRole(String role) {
    switch (role.toUpperCase()) {
      case 'PARENT':
        return const [
          _RoleNavItem(
            label: 'Home',
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            route: AppRoutes.parentHome,
          ),
          _RoleNavItem(
            label: 'Children',
            icon: Icons.face_outlined,
            selectedIcon: Icons.face_rounded,
            route: AppRoutes.parentChildren,
          ),
          _RoleNavItem(
            label: 'Attendance',
            icon: Icons.fact_check_outlined,
            selectedIcon: Icons.fact_check_rounded,
            route: AppRoutes.parentAttendance,
          ),
          _RoleNavItem(
            label: 'Homework',
            icon: Icons.assignment_outlined,
            selectedIcon: Icons.assignment_rounded,
            route: AppRoutes.parentHomework,
          ),
          _RoleNavItem(
            label: 'Notices',
            icon: Icons.campaign_outlined,
            selectedIcon: Icons.campaign_rounded,
            route: AppRoutes.notices,
          ),
          _RoleNavItem(
            label: 'More',
            icon: Icons.grid_view_outlined,
            selectedIcon: Icons.grid_view_rounded,
            route: AppRoutes.parentMore,
          ),
        ];
      case 'TEACHER':
        return const [
          _RoleNavItem(
            label: 'Today',
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            route: AppRoutes.teacherHome,
          ),
          _RoleNavItem(
            label: 'Attendance',
            icon: Icons.calendar_today_outlined,
            selectedIcon: Icons.calendar_today_rounded,
            route: AppRoutes.teacherAttendance,
          ),
          _RoleNavItem(
            label: 'Homework',
            icon: Icons.assignment_outlined,
            selectedIcon: Icons.assignment_rounded,
            route: AppRoutes.teacherHomework,
          ),
          _RoleNavItem(
            label: 'Messages',
            icon: Icons.chat_bubble_outline_rounded,
            selectedIcon: Icons.chat_bubble_rounded,
            route: AppRoutes.teacherMessages,
          ),
          _RoleNavItem(
            label: 'Profile',
            icon: Icons.account_circle_outlined,
            selectedIcon: Icons.account_circle_rounded,
            route: AppRoutes.teacherProfile,
          ),
        ];
      case 'STUDENT':
        return const [
          _RoleNavItem(
            label: 'Session',
            icon: Icons.school_outlined,
            selectedIcon: Icons.school_rounded,
            route: AppRoutes.studentSession,
          ),
        ];
      case 'DRIVER':
        return const [
          _RoleNavItem(
            label: 'Trip',
            icon: Icons.route_outlined,
            selectedIcon: Icons.route_rounded,
            route: AppRoutes.driverHome,
          ),
          _RoleNavItem(
            label: 'Route',
            icon: Icons.map_outlined,
            selectedIcon: Icons.map_rounded,
            route: AppRoutes.driverRoute,
          ),
          _RoleNavItem(
            label: 'Students',
            icon: Icons.groups_outlined,
            selectedIcon: Icons.groups_rounded,
            route: AppRoutes.driverStudents,
          ),
          _RoleNavItem(
            label: 'History',
            icon: Icons.history_outlined,
            selectedIcon: Icons.history_rounded,
            route: AppRoutes.driverHistory,
          ),
          _RoleNavItem(
            label: 'More',
            icon: Icons.grid_view_outlined,
            selectedIcon: Icons.grid_view_rounded,
          ),
        ];
      case 'STAFF':
        return const [
          _RoleNavItem(
            label: 'Home',
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            route: AppRoutes.staffHome,
          ),
          _RoleNavItem(
            label: 'Attend',
            icon: Icons.fact_check_outlined,
            selectedIcon: Icons.fact_check_rounded,
            route: AppRoutes.staffAttendance,
          ),
          _RoleNavItem(
            label: 'Leave',
            icon: Icons.edit_calendar_outlined,
            selectedIcon: Icons.edit_calendar_rounded,
            route: AppRoutes.staffLeave,
          ),
          _RoleNavItem(
            label: 'Payslip',
            icon: Icons.receipt_long_outlined,
            selectedIcon: Icons.receipt_long_rounded,
            route: AppRoutes.staffPayslips,
          ),
          _RoleNavItem(
            label: 'Notices',
            icon: Icons.campaign_outlined,
            selectedIcon: Icons.campaign_rounded,
            route: AppRoutes.notices,
          ),
        ];
      default:
        return const [
          _RoleNavItem(
            label: 'Home',
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            route: AppRoutes.adminHome,
          ),
          _RoleNavItem(
            label: 'Approvals',
            icon: Icons.task_alt_outlined,
            selectedIcon: Icons.task_alt_rounded,
          ),
          _RoleNavItem(
            label: 'Alerts',
            icon: Icons.warning_amber_outlined,
            selectedIcon: Icons.warning_amber_rounded,
            route: AppRoutes.notifications,
          ),
          _RoleNavItem(
            label: 'Notices',
            icon: Icons.campaign_outlined,
            selectedIcon: Icons.campaign_rounded,
            route: AppRoutes.notices,
          ),
          _RoleNavItem(
            label: 'More',
            icon: Icons.grid_view_outlined,
            selectedIcon: Icons.grid_view_rounded,
            route: AppRoutes.settings,
          ),
        ];
    }
  }
}

class _RoleNavItem {
  const _RoleNavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    this.route,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String? route;
}
