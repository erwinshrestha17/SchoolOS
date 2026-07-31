import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/notifications/notification_preferences_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';

final _notificationPreferencesProvider =
    FutureProvider.autoDispose<NotificationPreferenceSummary>((ref) {
      return ref.watch(notificationPreferencesRepositoryProvider).getOwn();
    });

class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends ConsumerState<NotificationPreferencesScreen> {
  final Set<NotificationPreferenceCategory> _pending = {};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final preferences = ref.watch(_notificationPreferencesProvider);

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.settings);
            }
          },
        ),
        title: const Text('Notifications'),
      ),
      body: preferences.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_friendlyError(error), textAlign: TextAlign.center),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(_notificationPreferencesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (summary) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                'Choose which school alerts this device may receive. Safety and security alerts stay on.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.slate500,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final category
                        in NotificationPreferenceCategory.values) ...[
                      if (category !=
                          NotificationPreferenceCategory.values.first)
                        const Divider(height: 1),
                      SwitchListTile.adaptive(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                          vertical: AppSpacing.xs,
                        ),
                        secondary: Icon(
                          category.isMandatory
                              ? Icons.priority_high_rounded
                              : Icons.notifications_outlined,
                        ),
                        title: Text(
                          category.label,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(category.description),
                        value: summary.isPushEnabled(category),
                        onChanged:
                            category.isMandatory || _pending.contains(category)
                            ? null
                            : (enabled) => _toggle(category, enabled),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _toggle(
    NotificationPreferenceCategory category,
    bool enabled,
  ) async {
    setState(() => _pending.add(category));
    try {
      await ref
          .read(notificationPreferencesRepositoryProvider)
          .updatePushPreference(category: category, enabled: enabled);
      ref.invalidate(_notificationPreferencesProvider);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
    } finally {
      if (mounted) setState(() => _pending.remove(category));
    }
  }
}

String _friendlyError(Object error) {
  if (error is AppException) return error.message;
  return 'Notification preferences could not be updated.';
}
