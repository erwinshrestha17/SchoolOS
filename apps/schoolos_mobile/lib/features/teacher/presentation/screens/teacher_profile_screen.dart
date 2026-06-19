import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../../application/teacher_providers.dart';
import '../widgets/teacher_app_widgets.dart';

class TeacherProfileScreen extends ConsumerWidget {
  const TeacherProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final attendance = ref.watch(teacherAttendanceControllerProvider);
    final noticeSummary = ref.watch(teacherNoticeSummaryProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 4,
      title: 'Profile',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Profile',
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            child: Row(
              children: [
                UserAvatar(
                  imageUrl: user?.avatarUrl,
                  name: user?.name ?? 'Teacher',
                  radius: 36,
                  borderColor: AppColors.primary,
                  borderWidth: 2,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'Teacher',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user?.email ?? 'Email unavailable',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.slate500,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      const StatusChip(
                        status: AppStatusType.approved,
                        label: 'Teacher',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: TeacherTaskCard(
                  title: 'Assigned',
                  subtitle: 'Class/subject scopes',
                  icon: Icons.school_rounded,
                  iconColor: AppColors.success,
                  value: '${attendance.classes.length}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: TeacherTaskCard(
                  title: 'Notices',
                  subtitle: 'Unread',
                  icon: Icons.campaign_rounded,
                  iconColor: AppColors.teacherAccent,
                  value: '${noticeSummary.valueOrNull?.unreadCount ?? 0}',
                  onTap: () => context.go(AppRoutes.notices),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _MenuTile(
                  icon: Icons.person_outline_rounded,
                  label: 'My Profile',
                  subtitle: 'Own teacher account only',
                  onTap: null,
                ),
                const Divider(height: 1),
                _MenuTile(
                  icon: Icons.calendar_month_rounded,
                  label: 'My Timetable',
                  subtitle: 'Needs mobile timetable DTO',
                  onTap: () => context.go(AppRoutes.teacherTimetable),
                ),
                const Divider(height: 1),
                _MenuTile(
                  icon: Icons.campaign_outlined,
                  label: 'Notices',
                  subtitle: 'Personal notification center',
                  onTap: () => context.go(AppRoutes.notices),
                ),
                const Divider(height: 1),
                const _MenuTile(
                  icon: Icons.event_busy_outlined,
                  label: 'Leave Requests',
                  subtitle: 'Needs own-staff teacher route confirmation',
                ),
                const Divider(height: 1),
                const _MenuTile(
                  icon: Icons.receipt_long_outlined,
                  label: 'Payslips',
                  subtitle: 'Available when enabled and teacher-safe',
                  locked: true,
                ),
                const Divider(height: 1),
                _MenuTile(
                  icon: Icons.help_outline_rounded,
                  label: 'Help & Support',
                  subtitle: 'Contact your school administrator',
                  onTap: null,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          AppButton(
            label: 'Secure Logout',
            icon: Icons.logout_rounded,
            backgroundColor: AppColors.dangerLight,
            foregroundColor: AppColors.dangerDark,
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go(AppRoutes.login);
            },
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    this.onTap,
    this.locked = false,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback? onTap;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: !locked,
      minVerticalPadding: AppSpacing.md,
      leading: Icon(
        icon,
        color: locked ? AppColors.slate400 : AppColors.primary,
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle),
      trailing: locked
          ? const Icon(Icons.lock_outline_rounded, size: 18)
          : const Icon(Icons.chevron_right_rounded),
      onTap: locked ? null : onTap,
    );
  }
}
