import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/notifications/push_notification_controller.dart';
import '../../../core/permissions/permission_service.dart';
import '../../../core/theme/theme_mode_provider.dart';
import '../../../shared/utils/date_display_preference.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isOnline = ref.watch(connectivityProvider);
    final themeMode = ref.watch(themeModeProvider);
    final datePreference = ref.watch(dateDisplayPreferenceProvider);
    final pushState = ref.watch(pushNotificationControllerProvider);
    final showNotificationsRow = _shouldShowNotificationsRow(pushState);

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
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
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.palette_outlined),
                  title: const Text('Appearance'),
                  subtitle: Text(_appearanceSubtitle(themeMode, theme)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _showAppearanceSheet(context, ref, themeMode),
                ),
                const Divider(height: 1),
                const ListTile(
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: Icon(Icons.language_rounded),
                  title: Text('Language'),
                  subtitle: Text('English'),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('Date format'),
                  subtitle: Text(
                    '${datePreference.shortLabel}\n'
                    '${formatDateDisplayPreview(DateTime.now(), datePreference)}',
                  ),
                  isThreeLine: true,
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () =>
                      _showDateFormatSheet(context, ref, datePreference),
                ),
                if (showNotificationsRow) ...[
                  const Divider(height: 1),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: 4,
                    ),
                    leading: const Icon(Icons.notifications_outlined),
                    title: const Text('Notifications'),
                    subtitle: Text(_notificationsSubtitle(pushState)),
                    trailing:
                        pushState.availability ==
                            PushNotificationAvailability.permissionDenied
                        ? TextButton(
                            onPressed: () => ref
                                .read(permissionServiceProvider)
                                .openAppSettings(),
                            child: const Text('Open settings'),
                          )
                        : const Icon(Icons.chevron_right_rounded),
                    onTap:
                        pushState.availability ==
                            PushNotificationAvailability.permissionDenied
                        ? () => ref
                              .read(permissionServiceProvider)
                              .openAppSettings()
                        : () => context.push(AppRoutes.notificationPreferences),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'Connection',
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
              leading: Icon(
                isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                color: isOnline ? AppColors.success : AppColors.danger,
              ),
              title: Text(isOnline ? 'Online' : 'Offline'),
              subtitle: Text(
                isOnline ? 'Connected' : 'Some information may be outdated',
              ),
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
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: 4,
                  ),
                  leading: const Icon(Icons.fingerprint_rounded),
                  title: const Text('Biometric Login'),
                  subtitle: const Text(
                    'Face ID, Touch ID, or fingerprint on this device',
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

bool _shouldShowNotificationsRow(PushNotificationState pushState) {
  return switch (pushState.availability) {
    PushNotificationAvailability.unavailable ||
    PushNotificationAvailability.providerNotReady ||
    PushNotificationAvailability.providerDisabled ||
    PushNotificationAvailability.unsupportedPersona ||
    PushNotificationAvailability.inactive ||
    PushNotificationAvailability.initializing => kDebugMode,
    PushNotificationAvailability.ready ||
    PushNotificationAvailability.permissionDenied => true,
  };
}

String _appearanceSubtitle(ThemeMode mode, ThemeData theme) {
  if (mode == ThemeMode.system) {
    final current = theme.brightness == Brightness.dark ? 'Dark' : 'Light';
    return 'System default · Currently using $current';
  }
  return themeModeLabel(mode);
}

String _notificationsSubtitle(PushNotificationState pushState) {
  return switch (pushState.availability) {
    PushNotificationAvailability.ready =>
      'On · Attendance, notices and school alerts',
    PushNotificationAvailability.permissionDenied =>
      'Off · Enable in device settings',
    PushNotificationAvailability.initializing => 'Checking notification status',
    PushNotificationAvailability.inactive => 'Not active for this account',
    PushNotificationAvailability.unsupportedPersona =>
      'Not available for this account type',
    PushNotificationAvailability.providerDisabled ||
    PushNotificationAvailability.providerNotReady ||
    PushNotificationAvailability.unavailable => 'Not available in this build',
  };
}

Future<void> _showAppearanceSheet(
  BuildContext context,
  WidgetRef ref,
  ThemeMode current,
) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final mode in const [
              ThemeMode.system,
              ThemeMode.light,
              ThemeMode.dark,
            ])
              ListTile(
                title: Text(themeModeLabel(mode)),
                trailing: mode == current
                    ? Icon(
                        Icons.check_rounded,
                        color: Theme.of(sheetContext).colorScheme.primary,
                      )
                    : null,
                onTap: () async {
                  await ref.read(themeModeProvider.notifier).setThemeMode(mode);
                  if (sheetContext.mounted) Navigator.pop(sheetContext);
                },
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      );
    },
  );
}

Future<void> _showDateFormatSheet(
  BuildContext context,
  WidgetRef ref,
  DateDisplayPreference current,
) {
  final previewNow = DateTime.now();
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                'Date format',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            for (final preference in DateDisplayPreference.values)
              ListTile(
                title: Text(preference.label),
                subtitle: Text(
                  formatDateDisplayPreview(previewNow, preference),
                ),
                trailing: preference == current
                    ? Icon(
                        Icons.check_rounded,
                        color: Theme.of(sheetContext).colorScheme.primary,
                      )
                    : null,
                onTap: () async {
                  await ref
                      .read(dateDisplayPreferenceProvider.notifier)
                      .setPreference(preference);
                  if (sheetContext.mounted) Navigator.pop(sheetContext);
                },
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      );
    },
  );
}
