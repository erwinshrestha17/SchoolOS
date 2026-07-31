import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/mobile_role.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/role_badge.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../auth/presentation/widgets/biometric_soft_suggestion_card.dart';
import 'widgets/sign_out_confirmation_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final userRole = auth.role ?? user?.role ?? 'User';
    final isParent = MobileRole.isParent(userRole);
    final userName = _displayValue(user?.name, fallback: 'SchoolOS User');
    final userEmail = _displayValue(user?.email, fallback: 'Email unavailable');
    final schoolName = _displayValue(
      user?.tenantName,
      fallback: 'School unavailable',
    );
    final roleLabel = RoleBadge.displayLabel(userRole);

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(isParent ? AppRoutes.parentMore : AppRoutes.home);
            }
          },
        ),
        title: const Text('Profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppCard(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md + 2,
            ),
            child: Column(
              children: [
                UserAvatar(
                  imageUrl: user?.avatarUrl,
                  name: userName,
                  radius: 36,
                  borderWidth: 2,
                  borderColor: AppColors.primary,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  userName,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  userEmail,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.slate500,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                RoleBadge(role: userRole),
                if (schoolName != 'School unavailable') ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    schoolName,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          Text(
            'Account',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _buildInfoTile(
                  context,
                  Icons.school_outlined,
                  'School',
                  schoolName,
                ),
                const Divider(height: 1),
                _buildInfoTile(
                  context,
                  Icons.badge_outlined,
                  'Role',
                  roleLabel,
                ),
                const Divider(height: 1),
                _buildInfoTile(
                  context,
                  Icons.mail_outline_rounded,
                  'Email',
                  userEmail,
                ),
                const Divider(height: 1),
                _buildInfoTile(
                  context,
                  Icons.verified_user_outlined,
                  'Account status',
                  auth.status == AuthStatus.authenticated
                      ? 'Active'
                      : 'Signed out',
                ),
              ],
            ),
          ),
          if (isParent) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Family',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: 4,
                ),
                leading: const Icon(Icons.family_restroom_rounded),
                title: const Text('Linked children'),
                subtitle: const Text(
                  'Children connected to this guardian account',
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push(AppRoutes.parentChildren),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),

          const BiometricSoftSuggestionCard(),
          Text(
            'Account & security',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.lock_reset_rounded),
                  title: const Text('Change password'),
                  subtitle: const Text('Update your SchoolOS password'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.changePassword),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.fingerprint_rounded),
                  title: const Text('Biometric Login'),
                  subtitle: const Text(
                    'Enable Face ID or fingerprint on this device',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.biometricLogin),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.devices_rounded),
                  title: const Text('Logged-in devices'),
                  subtitle: const Text('Review and revoke active sessions'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.loggedInDevices),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.notifications_outlined),
                  title: const Text('Notification preferences'),
                  subtitle: const Text('Attendance, fees, notices, and alerts'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.notificationPreferences),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          Text(
            'App',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.tune_rounded),
                  title: const Text('Preferences'),
                  subtitle: const Text('Appearance, language, and date format'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.settings),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.info_outline_rounded),
                  title: const Text('About SchoolOS'),
                  subtitle: const Text('App version and product information'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRoutes.about),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          OutlinedButton.icon(
            onPressed: () async {
              final confirmed = await showSignOutConfirmationSheet(
                context,
                isParent: isParent,
              );
              if (confirmed != true || !context.mounted) return;
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                context.go(AppRoutes.login);
              }
            },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.dangerDark,
              side: BorderSide(color: AppColors.danger.withValues(alpha: 0.55)),
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.slate400, size: 20),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : AppColors.slate800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _displayValue(String? value, {required String fallback}) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? fallback : trimmed;
}
