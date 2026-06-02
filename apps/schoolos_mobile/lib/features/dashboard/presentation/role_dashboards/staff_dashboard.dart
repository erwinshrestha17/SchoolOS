import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../staff/application/staff_providers.dart';
import '../../../staff/domain/staff_models.dart';
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
    final user = ref.watch(authProvider).user;
    final profile = ref.watch(staffProfileProvider).valueOrNull;
    final attendanceState = ref.watch(staffAttendanceProvider);
    final leaveRequestsState = ref.watch(staffLeaveRequestsProvider);
    final payslipsState = ref.watch(staffPayslipsProvider);
    final displayName = profile?.name ?? user?.name ?? 'Staff Member';
    final email = user?.email ?? 'staff@schoolos.com';
    final todayStatus = _attendanceStatus(attendanceState);
    final pendingLeaves = _pendingLeaveStatus(leaveRequestsState);
    final latestPayslip = _latestPayslipStatus(payslipsState);

    return RoleShellScaffold(
      role: 'STAFF',
      selectedIndex: 0,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome, $displayName',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Staff Space • $email',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.slate500,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const RoleBadge(role: 'STAFF'),
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
                        Text(
                          displayName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        const Text(
                          'Staff services and self-service workspace',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        if (profile?.designation != null ||
                            profile?.department != null) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            [
                              profile?.designation,
                              profile?.department,
                            ].whereType<String>().join(' • '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 11,
                            ),
                          ),
                        ],
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
                    name: displayName,
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
              value: _isCheckedIn ? 'Checked In' : todayStatus,
              icon: Icons.check_circle_rounded,
              iconColor: _isCheckedIn ? AppColors.success : AppColors.warning,
              badge: StatusChip(
                status: _isCheckedIn || todayStatus == 'Present'
                    ? AppStatusType.approved
                    : AppStatusType.pending,
                label: _isCheckedIn ? 'Active' : todayStatus,
              ),
              subtitle: _isCheckedIn
                  ? 'Checked in today at $_checkInTime'
                  : 'Latest synced attendance from SchoolOS backend',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Leave Requests',
              value: pendingLeaves,
              icon: Icons.date_range_rounded,
              iconColor: AppColors.staffAccent,
              subtitle: 'Open your staff leave history and review status',
            ),
            const SizedBox(height: AppSpacing.md),

            DashboardCard(
              title: 'Latest Payslip',
              value: latestPayslip,
              icon: Icons.receipt_long_rounded,
              iconColor: AppColors.success,
              subtitle: payslipsState.hasError
                  ? 'Payroll self-service is not available for this account'
                  : 'Payslips are loaded from payroll self-service APIs',
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
                  onTap: () => context.go(AppRoutes.staffPayslips),
                ),
                QuickActionCard(
                  title: 'Leave',
                  icon: Icons.edit_calendar_rounded,
                  color: AppColors.warning,
                  onTap: () => context.go(AppRoutes.staffLeave),
                ),
                QuickActionCard(
                  title: 'Attendance',
                  icon: Icons.fact_check_rounded,
                  color: AppColors.primary,
                  onTap: () => context.go(AppRoutes.staffAttendance),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _label(String value) {
  return value
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
      )
      .join(' ');
}

String _attendanceStatus(
  AsyncValue<List<StaffAttendanceRecord>> attendanceState,
) {
  if (attendanceState.isLoading && !attendanceState.hasValue) {
    return 'Loading';
  }
  if (attendanceState.hasError) {
    return 'Unavailable';
  }
  final attendance = attendanceState.valueOrNull;
  if (attendance == null || attendance.isEmpty) {
    return 'Not Synced';
  }
  return _label(attendance.first.status);
}

String _pendingLeaveStatus(
  AsyncValue<List<StaffLeaveRequest>> leaveRequestsState,
) {
  if (leaveRequestsState.isLoading && !leaveRequestsState.hasValue) {
    return 'Loading';
  }
  if (leaveRequestsState.hasError) {
    return 'Unavailable';
  }
  final leaveRequests = leaveRequestsState.valueOrNull ?? const [];
  final pendingLeaves = leaveRequests
      .where((request) => request.status.toUpperCase() == 'PENDING')
      .length;
  return '$pendingLeaves Pending';
}

String _latestPayslipStatus(AsyncValue<List<StaffPayslip>> payslipsState) {
  if (payslipsState.isLoading && !payslipsState.hasValue) {
    return 'Loading';
  }
  if (payslipsState.hasError) {
    return 'Unavailable';
  }
  final payslips = payslipsState.valueOrNull;
  if (payslips == null || payslips.isEmpty) {
    return 'No payslip yet';
  }
  return payslips.first.periodLabel;
}
