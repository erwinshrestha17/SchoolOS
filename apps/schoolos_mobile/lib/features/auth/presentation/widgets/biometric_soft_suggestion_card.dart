import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../core/auth/biometric_session_store.dart';
import '../biometric_setup_sheet.dart';

/// Soft non-modal suggestion shown once after the user dismissed the first offer.
class BiometricSoftSuggestionCard extends ConsumerStatefulWidget {
  const BiometricSoftSuggestionCard({super.key});

  @override
  ConsumerState<BiometricSoftSuggestionCard> createState() =>
      _BiometricSoftSuggestionCardState();
}

class _BiometricSoftSuggestionCardState
    extends ConsumerState<BiometricSoftSuggestionCard> {
  bool _marked = false;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final store = ref.watch(biometricSessionStoreProvider);

    if (!shouldShowBiometricSoftSuggestion(auth: auth, store: store)) {
      return const SizedBox.shrink();
    }

    if (!_marked) {
      _marked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(authProvider.notifier).markBiometricSoftSuggested();
      });
    }

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: ListTile(
        leading: const Icon(
          Icons.fingerprint_rounded,
          color: AppColors.primary,
        ),
        title: const Text('Turn on biometric login'),
        subtitle: const Text(
          'Unlock SchoolOS faster on this device from Settings → Security.',
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => context.push(AppRoutes.biometricLogin),
      ),
    );
  }
}
