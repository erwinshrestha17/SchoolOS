import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/notifications/push_notification_controller.dart';
import '../../../shared/utils/date_display_preference.dart';
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
    final pushState = ref.watch(pushNotificationControllerProvider);

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
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('Date display'),
                  subtitle: const Text(
                    'Choose how school dates appear in the app.',
                  ),
                  trailing: DropdownButtonHideUnderline(
                    child: DropdownButton<DateDisplayPreference>(
                      value: ref.watch(dateDisplayPreferenceProvider),
                      items: [
                        for (final preference in DateDisplayPreference.values)
                          DropdownMenuItem(
                            value: preference,
                            child: Text(preference.label),
                          ),
                      ],
                      onChanged: (preference) {
                        if (preference == null) return;
                        ref
                            .read(dateDisplayPreferenceProvider.notifier)
                            .setPreference(preference);
                      },
                    ),
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
                  trailing: Semantics(
                    // The switch is its own tappable node; the ListTile title
                    // beside it is not announced as its label.
                    label: 'Online mode',
                    child: Switch(
                      value: isOnline,
                      activeTrackColor: AppColors.success,
                      onChanged: (value) {
                        ref
                            .read(connectivityProvider.notifier)
                            .setOnline(value);
                      },
                    ),
                  ),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.notifications_active_outlined),
                  title: const Text('Push Notifications'),
                  subtitle: Text(pushState.message),
                  trailing: StatusChip(
                    status: _pushStatus(pushState.availability),
                    label: _pushLabel(pushState.availability),
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
        ],
      ),
    );
  }
}

AppStatusType _pushStatus(PushNotificationAvailability availability) {
  return switch (availability) {
    PushNotificationAvailability.ready => AppStatusType.completed,
    PushNotificationAvailability.initializing => AppStatusType.pending,
    PushNotificationAvailability.inactive => AppStatusType.draft,
    _ => AppStatusType.pending,
  };
}

String _pushLabel(PushNotificationAvailability availability) {
  return switch (availability) {
    PushNotificationAvailability.ready => 'Ready',
    PushNotificationAvailability.initializing => 'Checking',
    PushNotificationAvailability.permissionDenied => 'Off',
    PushNotificationAvailability.providerDisabled => 'Disabled',
    PushNotificationAvailability.providerNotReady => 'Not ready',
    PushNotificationAvailability.unsupportedPersona => 'Unavailable',
    PushNotificationAvailability.unavailable => 'Unavailable',
    PushNotificationAvailability.inactive => 'Inactive',
  };
}
