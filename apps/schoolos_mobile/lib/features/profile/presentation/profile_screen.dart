import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/storage/app_preferences_service.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/role_badge.dart';
import '../../../shared/widgets/user_avatar.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final auth = ref.watch(authProvider);
    final appPrefs = ref.watch(appPreferencesServiceProvider);
    final userRole = auth.role ?? 'User';
    final userName = auth.user?.name ?? 'Demo $userRole Account';
    final userEmail = auth.user?.email ?? 'demo@school.edu.np';
    final userAvatar = auth.user?.avatarUrl;
    final tenantCode = appPrefs.getTenantCode() ?? 'holyland';

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go(AppRoutes.home),
        ),
        title: const Text('Profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          // User Card
          AppCard(
            child: Column(
              children: [
                UserAvatar(
                  imageUrl: userAvatar,
                  name: userName,
                  radius: 48,
                  borderWidth: 2,
                  borderColor: AppColors.primary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  userName,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  userEmail,
                  style: TextStyle(color: AppColors.slate500, fontSize: 13),
                ),
                const SizedBox(height: AppSpacing.md),
                RoleBadge(role: userRole),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // Detail Section Card
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _buildInfoTile(
                  context,
                  Icons.business_rounded,
                  'School Tenant',
                  tenantCode,
                ),
                const Divider(),
                _buildInfoTile(
                  context,
                  Icons.fingerprint_rounded,
                  'Session Token',
                  auth.token != null && auth.token!.length > 15
                      ? auth.token!.substring(0, 15)
                      : (auth.token ?? 'No active session'),
                ),
                const Divider(),
                _buildInfoTile(
                  context,
                  Icons.info_outline_rounded,
                  'App Version',
                  '1.0.0 (Sprint 1)',
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          // Logout Action
          AppButton(
            label: 'Sign Out',
            icon: Icons.logout_rounded,
            backgroundColor: AppColors.dangerLight.withValues(
              alpha: isDark ? 0.2 : 0.8,
            ),
            foregroundColor: isDark ? AppColors.danger : AppColors.dangerDark,
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                context.go(AppRoutes.login);
              }
            },
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
        vertical: AppSpacing.md + 2,
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.slate400, size: 20),
          const SizedBox(width: AppSpacing.md),
          Text(
            label,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.slate800,
            ),
          ),
        ],
      ),
    );
  }
}
