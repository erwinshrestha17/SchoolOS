import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/quick_action_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';

class StaffDashboard extends ConsumerStatefulWidget {
  const StaffDashboard({super.key});

  @override
  ConsumerState<StaffDashboard> createState() => _StaffDashboardState();
}

class _StaffDashboardState extends ConsumerState<StaffDashboard> {
  bool _isCheckedIn = false;
  String _checkInTime = '--:--';

  void _toggleCheckIn() {
    setState(() {
      _isCheckedIn = !_isCheckedIn;
      if (_isCheckedIn) {
        final now = DateTime.now();
        _checkInTime =
            '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
      } else {
        _checkInTime = '--:--';
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isCheckedIn
              ? 'Checked in successfully at $_checkInTime'
              : 'Checked out successfully.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RoleShellScaffold(
      role: 'STAFF',
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
                      'Welcome, Hari',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Staff Space • Account Section',
                      style: TextStyle(color: AppColors.slate500, fontSize: 13),
                    ),
                  ],
                ),
                RoleBadge(role: 'STAFF'),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),

            // Profile info gradient card
            AppGradientCard(
              gradient: const LinearGradient(
                colors: AppColors.staffGradient,
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
                          'Hari Prasad Devkota',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        const Text(
                          'Senior Accountant • School Office',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        ElevatedButton.icon(
                          onPressed: _toggleCheckIn,
                          icon: Icon(
                            _isCheckedIn
                                ? Icons.logout_rounded
                                : Icons.login_rounded,
                            color: _isCheckedIn
                                ? AppColors.danger
                                : AppColors.staffAccent,
                          ),
                          label: Text(
                            _isCheckedIn ? 'Check Out' : 'Check In Now',
                            style: TextStyle(
                              color: _isCheckedIn
                                  ? AppColors.danger
                                  : AppColors.staffAccent,
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
                    name: 'Hari Prasad Devkota',
                    radius: 36,
                    borderColor: Colors.white,
                    borderWidth: 2,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Attendance and Leave
            const SectionHeader(title: "My Work Summary"),
            const SizedBox(height: AppSpacing.sm),

            DashboardCard(
              title: 'Today Check-In',
              value: _isCheckedIn ? 'Checked In' : 'Not Checked In',
              icon: Icons.check_circle_rounded,
              iconColor: _isCheckedIn ? AppColors.success : AppColors.danger,
              badge: StatusChip(
                status: _isCheckedIn
                    ? AppStatusType.approved
                    : AppStatusType.pending,
                label: _isCheckedIn ? 'Active' : 'Due',
              ),
              subtitle: _isCheckedIn
                  ? 'Checked in today at $_checkInTime'
                  : 'Please check in when you arrive at school',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Available Leave',
              value: '12 Days Remaining',
              icon: Icons.date_range_rounded,
              iconColor: AppColors.staffAccent,
              subtitle: 'Used 6/18 days of annual casual leave',
            ),
            const SizedBox(height: AppSpacing.xl),

            // Actions Grid
            const SectionHeader(title: "HR Services"),
            const SizedBox(height: AppSpacing.sm),

            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: AppSpacing.md,
              mainAxisSpacing: AppSpacing.md,
              childAspectRatio: 1.0,
              children: [
                QuickActionCard(
                  title: 'Payslips',
                  icon: Icons.receipt_long_rounded,
                  color: AppColors.success,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'Apply Leave',
                  icon: Icons.edit_calendar_rounded,
                  color: AppColors.warning,
                  onTap: () {},
                ),
                QuickActionCard(
                  title: 'Approvals',
                  icon: Icons.rate_review_rounded,
                  color: AppColors.primary,
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
