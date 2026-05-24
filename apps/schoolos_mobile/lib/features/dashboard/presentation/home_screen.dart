import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../shared/widgets/app_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const _roles = [
    _RoleTile(
      'Parent',
      'Child updates, fees, homework, transport, and notices.',
      Icons.family_restroom_rounded,
      AppRoutes.parentHome,
    ),
    _RoleTile(
      'Student',
      'Homework, timetable, attendance, notices, and results.',
      Icons.person_rounded,
      AppRoutes.studentHome,
    ),
    _RoleTile(
      'Teacher',
      'Classes, attendance, homework, timetable, and parent messages.',
      Icons.co_present_rounded,
      AppRoutes.teacherHome,
    ),
    _RoleTile(
      'Driver',
      'Trips, routes, boarding, drops, and live location.',
      Icons.directions_bus_rounded,
      AppRoutes.driverHome,
    ),
    _RoleTile(
      'Staff',
      'Profile, leave, payslips, and notices.',
      Icons.badge_rounded,
      AppRoutes.staffHome,
    ),
    _RoleTile(
      'Admin',
      'Approvals, alerts, summaries, and communication.',
      Icons.admin_panel_settings_rounded,
      AppRoutes.adminHome,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SchoolOS Mobile'),
        actions: [
          IconButton(
            onPressed: () => context.go(AppRoutes.profile),
            icon: const Icon(Icons.account_circle_rounded),
          ),
          IconButton(
            onPressed: () => context.go(AppRoutes.settings),
            icon: const Icon(Icons.settings_rounded),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _roles.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final role = _roles[index];
          return AppCard(
            onTap: () => context.go(role.route),
            child: Row(
              children: [
                CircleAvatar(child: Icon(role.icon)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        role.title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        role.subtitle,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          );
        },
      ),
    );
  }
}

class RoleDashboardPlaceholder extends StatelessWidget {
  const RoleDashboardPlaceholder({
    super.key,
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: AppCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(description),
              const SizedBox(height: 16),
              Text(
                'Sprint 1 will replace this placeholder with authenticated role routing.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleTile {
  const _RoleTile(this.title, this.subtitle, this.icon, this.route);

  final String title;
  final String subtitle;
  final IconData icon;
  final String route;
}
