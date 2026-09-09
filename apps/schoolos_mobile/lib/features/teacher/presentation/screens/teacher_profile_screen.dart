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
import '../../../profile/presentation/widgets/sign_out_confirmation_sheet.dart';
import '../../application/teacher_providers.dart';
import '../widgets/teacher_app_widgets.dart';

/// Teacher secondary workspace.
///
/// Frequent classroom actions remain on Today/Attendance/Homework. Less
/// frequent tools are grouped here so the bottom navigation stays small and
/// predictable while still keeping every teacher-owned workflow close.
class TeacherProfileScreen extends ConsumerWidget {
  const TeacherProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final noticeSummary = ref.watch(teacherNoticeSummaryProvider);
    final assignmentScopeCount = ref.watch(teacherAssignmentScopeCountProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 3,
      title: 'More',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'More',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Your classes, academic tools, self-service, and account settings.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            child: Row(
              children: [
                UserAvatar(
                  imageUrl: user?.avatarUrl,
                  name: user?.name ?? 'Teacher',
                  radius: 32,
                  borderColor: AppColors.teacherAccent,
                  borderWidth: 2,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'Teacher',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
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
                IconButton(
                  tooltip: 'Account profile',
                  onPressed: () => context.push(AppRoutes.profile),
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final assignedCard = TeacherTaskCard(
                title: 'Assigned',
                subtitle: assignmentScopeCount.hasError
                    ? 'Scope count unavailable'
                    : 'Class/subject scopes',
                icon: Icons.school_rounded,
                iconColor: AppColors.success,
                value: assignmentScopeCount.when(
                  data: (count) => '$count',
                  loading: () => '—',
                  error: (_, _) => '—',
                ),
                onTap: () => context.go(AppRoutes.teacherClasses),
              );
              final noticesCard = TeacherTaskCard(
                title: 'Notices',
                subtitle: noticeSummary.isLoading
                    ? 'Loading unread count'
                    : noticeSummary.hasError
                    ? 'Unread count unavailable'
                    : 'Unread',
                icon: Icons.campaign_rounded,
                iconColor: AppColors.teacherAccent,
                value: noticeSummary.when(
                  skipLoadingOnRefresh: false,
                  skipLoadingOnReload: false,
                  skipError: false,
                  data: (summary) => '${summary.unreadCount}',
                  loading: () => '—',
                  error: (_, _) => '—',
                ),
                onTap: () => context.go(AppRoutes.notices),
              );
              if (constraints.maxWidth < 360) {
                return Column(
                  children: [
                    assignedCard,
                    const SizedBox(height: AppSpacing.md),
                    noticesCard,
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: assignedCard),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: noticesCard),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          _MenuSection(
            title: 'Teaching tools',
            children: [
              _MenuTile(
                icon: Icons.groups_outlined,
                label: 'Assigned Classes',
                subtitle: 'Open a class hub within your active scope',
                onTap: () => context.go(AppRoutes.teacherClasses),
              ),
              _MenuTile(
                icon: Icons.calendar_month_rounded,
                label: 'My Timetable',
                subtitle: 'Assigned classes and substitutions',
                onTap: () => context.go(AppRoutes.teacherTimetable),
              ),
              _MenuTile(
                icon: Icons.fact_check_outlined,
                label: 'Marks Entry',
                subtitle: 'Assigned assessment components only',
                onTap: () => context.go(AppRoutes.teacherMarks),
              ),
              _MenuTile(
                icon: Icons.photo_camera_outlined,
                label: 'Activities & Milestones',
                subtitle: 'Capture consent-safe class updates',
                onTap: () => context.go(AppRoutes.teacherActivity),
              ),
              _MenuTile(
                icon: Icons.campaign_outlined,
                label: 'Notices',
                subtitle: 'School and staff announcements',
                onTap: () => context.go(AppRoutes.notices),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _MenuSection(
            title: 'My work',
            children: [
              _MenuTile(
                icon: Icons.event_busy_outlined,
                label: 'Leave Requests',
                subtitle: 'Own leave requests only',
                onTap: () => context.go(AppRoutes.teacherLeave),
              ),
              _MenuTile(
                icon: Icons.receipt_long_outlined,
                label: 'Payslips',
                subtitle: 'Own protected payslips when issued',
                onTap: () => context.go(AppRoutes.teacherPayslips),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _MenuSection(
            title: 'Account',
            children: [
              _MenuTile(
                icon: Icons.person_outline_rounded,
                label: 'Profile & Security',
                subtitle: 'Account, password, devices, and security',
                onTap: () => context.push(AppRoutes.profile),
              ),
              _MenuTile(
                icon: Icons.settings_outlined,
                label: 'Settings',
                subtitle: 'Appearance, language, biometrics, notifications',
                onTap: () => context.push(AppRoutes.settings),
              ),
              _MenuTile(
                icon: Icons.help_outline_rounded,
                label: 'Help & Support',
                subtitle: 'Contact your school administrator',
                onTap: null,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          AppButton(
            label: 'Sign Out',
            icon: Icons.logout_rounded,
            backgroundColor: AppColors.dangerLight,
            foregroundColor: AppColors.dangerDark,
            onPressed: () async {
              final confirmed = await showSignOutConfirmationSheet(
                context,
                isParent: false,
              );
              if (confirmed != true || !context.mounted) return;
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go(AppRoutes.login);
            },
          ),
        ],
      ),
    );
  }
}

class _MenuSection extends StatelessWidget {
  const _MenuSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var index = 0; index < children.length; index++) ...[
                children[index],
                if (index != children.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: onTap != null,
      minVerticalPadding: AppSpacing.md,
      leading: Icon(
        icon,
        color: onTap == null ? AppColors.slate400 : AppColors.primary,
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle),
      trailing: onTap == null ? null : const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}
