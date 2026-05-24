import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';

class DriverDashboard extends ConsumerStatefulWidget {
  const DriverDashboard({super.key});

  @override
  ConsumerState<DriverDashboard> createState() => _DriverDashboardState();
}

class _DriverDashboardState extends ConsumerState<DriverDashboard> {
  bool _isTripActive = false;

  void _toggleTrip() {
    setState(() {
      _isTripActive = !_isTripActive;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isTripActive
              ? 'Trip started! Sharing live GPS tracking with parents.'
              : 'Trip completed safely.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RoleShellScaffold(
      role: 'DRIVER',
      selectedIndex: 0,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, Driver Ram',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Vehicle: Bus No. 3 (BA 2 PA 4005)',
                      style: TextStyle(color: AppColors.slate500, fontSize: 13),
                    ),
                  ],
                ),
                RoleBadge(role: 'DRIVER'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // Route details gradient card
            AppGradientCard(
              gradient: const LinearGradient(
                colors: AppColors.driverGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Route 12: Kapan - Chabahil',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        const Text(
                          'Total Students: 24 on route',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        ElevatedButton.icon(
                          onPressed: _toggleTrip,
                          icon: Icon(
                            _isTripActive
                                ? Icons.stop_rounded
                                : Icons.play_arrow_rounded,
                            color: _isTripActive
                                ? AppColors.danger
                                : AppColors.success,
                          ),
                          label: Text(
                            _isTripActive ? 'End Trip' : 'Start Trip Now',
                            style: TextStyle(
                              color: _isTripActive
                                  ? AppColors.danger
                                  : AppColors.successDark,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            minimumSize: const Size(140, 40),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  UserAvatar(
                    name: 'Ram Bahadur',
                    radius: 36,
                    borderColor: Colors.white,
                    borderWidth: 2,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Trip stats
            const SectionHeader(title: "Today's Route Progress"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'GPS Tracking Status',
              value: _isTripActive ? 'ACTIVE (Broadcasting)' : 'INACTIVE',
              icon: Icons.gps_fixed_rounded,
              iconColor: _isTripActive ? AppColors.success : AppColors.slate400,
              badge: StatusChip(
                status: _isTripActive
                    ? AppStatusType.onRoute
                    : AppStatusType.draft,
                label: _isTripActive ? 'Live Sharing' : 'Offline',
              ),
              subtitle: _isTripActive
                  ? 'Broadcasting coordinates to SchoolOS servers'
                  : 'GPS will broadcast once trip starts',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Student Status',
              value: '16 Boarded / 8 Pending',
              icon: Icons.people_rounded,
              iconColor: AppColors.primary,
              subtitle: 'Mark students boarded/dropped at each bus stop',
            ),
            const SizedBox(height: AppSpacing.xl),

            // STOP List
            const SectionHeader(title: "Route Stop Points"),
            const SizedBox(height: AppSpacing.sm),

            AppCard(
              child: Column(
                children: [
                  _buildStopRow(
                    context,
                    'Kapan Chowk',
                    '07:45 AM',
                    '6 Students',
                    isCompleted: true,
                  ),
                  const Divider(),
                  _buildStopRow(
                    context,
                    'Baniyatar',
                    '08:00 AM',
                    '4 Students',
                    isCompleted: true,
                  ),
                  const Divider(),
                  _buildStopRow(
                    context,
                    'Sukedhara',
                    '08:15 AM',
                    '8 Students',
                    isCurrent: true,
                  ),
                  const Divider(),
                  _buildStopRow(
                    context,
                    'Chabahil Chowk',
                    '08:30 AM',
                    '6 Students',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStopRow(
    BuildContext context,
    String stopName,
    String time,
    String studentCount, {
    bool isCompleted = false,
    bool isCurrent = false,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Icon(
            isCompleted
                ? Icons.check_circle_rounded
                : (isCurrent
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded),
            color: isCompleted
                ? AppColors.success
                : (isCurrent ? AppColors.driverAccent : AppColors.slate300),
            size: 20,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stopName,
                  style: TextStyle(
                    fontWeight: (isCurrent || isCompleted)
                        ? FontWeight.bold
                        : FontWeight.normal,
                    color: isDark ? Colors.white : AppColors.slate800,
                  ),
                ),
                Text(
                  studentCount,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            time,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
              color: isCurrent ? AppColors.driverAccent : AppColors.slate500,
            ),
          ),
        ],
      ),
    );
  }
}
