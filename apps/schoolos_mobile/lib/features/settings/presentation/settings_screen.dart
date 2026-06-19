import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/status_chip.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final isOnline = ref.watch(connectivityProvider);

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.parentMore);
            }
          },
        ),
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Preferences',
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
                  leading: const Icon(Icons.palette_outlined),
                  title: const Text('Appearance'),
                  subtitle: const Text(
                    'Theme follows the device system setting.',
                  ),
                  trailing: StatusChip(
                    status: isDark
                        ? AppStatusType.onRoute
                        : AppStatusType.completed,
                    label: isDark ? 'Dark' : 'Light',
                  ),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.language_rounded),
                  title: const Text('App Language'),
                  subtitle: const Text('English is active for this build.'),
                  trailing: const StatusChip(
                    status: AppStatusType.draft,
                    label: 'Managed',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          Text(
            'Connectivity',
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
                  leading: Icon(
                    isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    color: isOnline ? AppColors.success : AppColors.danger,
                  ),
                  title: const Text('Network State'),
                  subtitle: Text(
                    isOnline
                        ? 'The app is using online API requests.'
                        : 'Offline preview is active for draft-capable flows.',
                  ),
                  trailing: Switch(
                    value: isOnline,
                    activeTrackColor: AppColors.success,
                    onChanged: (value) {
                      ref.read(connectivityProvider.notifier).setOnline(value);
                    },
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          Text(
            'Security',
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
                  leading: const Icon(Icons.fingerprint_rounded),
                  title: const Text('Biometric Unlock'),
                  subtitle: const Text(
                    'Requires a device security integration before release.',
                  ),
                  trailing: const StatusChip(
                    status: AppStatusType.pending,
                    label: 'Planned',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

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
            child: ListTile(
              leading: Icon(
                Icons.logout_rounded,
                color: isDark ? AppColors.danger : AppColors.dangerDark,
              ),
              title: const Text('Log out'),
              subtitle: const Text('End this session and return to sign in'),
              trailing: const Icon(Icons.chevron_right_rounded),
              textColor: isDark ? AppColors.danger : AppColors.dangerDark,
              iconColor: isDark ? AppColors.danger : AppColors.dangerDark,
              onTap: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) {
                  context.go(AppRoutes.login);
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
