import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/biometric_auth_service.dart';
import '../../../core/auth/biometric_session_store.dart';
import '../../../shared/widgets/app_button.dart';

/// Shows the first-login biometric offer when appropriate.
///
/// Safe to call repeatedly; it no-ops when the user already decided, lacks
/// biometrics, must change password, or is outside Parent/Teacher/Principal.
Future<void> maybeShowBiometricSetupOffer(
  BuildContext context,
  WidgetRef ref,
) async {
  final auth = ref.read(authProvider);
  final user = auth.user;
  if (auth.status != AuthStatus.authenticated || user == null) return;
  if (user.mustChangePassword) return;
  if (!AuthNotifier.supportsBiometricPersona(user.role, roles: user.roles)) {
    return;
  }

  final store = ref.read(biometricSessionStoreProvider);
  if (!store.shouldOfferFirstPrompt(user.id, tenantId: user.tenantId)) {
    return;
  }

  final bio = ref.read(biometricAuthServiceProvider);
  if (!await bio.isSupported) return;
  if (!context.mounted) return;

  final capability = await bio.resolveCapability();
  if (capability == BiometricCapability.unavailable || !context.mounted) {
    return;
  }

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            AppSpacing.sm,
            AppSpacing.xl,
            AppSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Enable biometric login?',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Use ${bio.biometricName(capability)} to unlock SchoolOS on this device. '
                'Your school password remains available as a fallback. '
                'Biometric data never leaves this device.',
                style: const TextStyle(color: AppColors.slate600, height: 1.4),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: bio.enableButtonLabel(capability),
                onPressed: () async {
                  final enabled = await ref
                      .read(authProvider.notifier)
                      .enableBiometricLogin();
                  if (sheetContext.mounted) {
                    Navigator.of(sheetContext).pop();
                  }
                  if (enabled && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          '${bio.biometricName(capability)} login is enabled on this device only.',
                        ),
                      ),
                    );
                  }
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              AppButton(
                label: 'Not Now',
                variant: AppButtonVariant.outlined,
                onPressed: () async {
                  await ref.read(authProvider.notifier).dismissBiometricOffer();
                  if (sheetContext.mounted) {
                    Navigator.of(sheetContext).pop();
                  }
                },
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// Returns true when Profile/Settings may show the soft biometric suggestion.
bool shouldShowBiometricSoftSuggestion({
  required AuthState auth,
  required BiometricSessionStore store,
}) {
  final user = auth.user;
  if (auth.status != AuthStatus.authenticated || user == null) return false;
  if (!AuthNotifier.supportsBiometricPersona(user.role, roles: user.roles)) {
    return false;
  }
  return store.shouldShowSoftSuggestion(user.id, tenantId: user.tenantId);
}
