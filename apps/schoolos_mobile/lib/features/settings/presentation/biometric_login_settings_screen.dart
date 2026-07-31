import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/biometric_auth_service.dart';
import '../../../core/auth/biometric_session_store.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/app_text_field.dart';

class BiometricLoginSettingsScreen extends ConsumerStatefulWidget {
  const BiometricLoginSettingsScreen({super.key});

  @override
  ConsumerState<BiometricLoginSettingsScreen> createState() =>
      _BiometricLoginSettingsScreenState();
}

class _BiometricLoginSettingsScreenState
    extends ConsumerState<BiometricLoginSettingsScreen> {
  final _passwordController = TextEditingController();
  bool _loading = true;
  bool _busy = false;
  bool _supported = false;
  BiometricCapability _capability = BiometricCapability.unavailable;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final bio = ref.read(biometricAuthServiceProvider);
    final supported = await bio.isSupported;
    final capability = supported
        ? await bio.resolveCapability()
        : BiometricCapability.unavailable;
    if (!mounted) return;
    setState(() {
      _supported = supported;
      _capability = capability;
      _loading = false;
    });
  }

  Future<void> _enable() async {
    final auth = ref.read(authProvider);
    final user = auth.user;
    if (user == null) return;
    if (!AuthNotifier.supportsBiometricPersona(user.role, roles: user.roles)) {
      setState(() {
        _error =
            'Biometric login is available for Parent, Teacher, and Principal accounts.';
      });
      return;
    }

    final password = _passwordController.text;
    if (password.isEmpty) {
      setState(() => _error = 'Enter your current password to continue.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .verifyPassword(currentPassword: password);
      final enabled = await ref
          .read(authProvider.notifier)
          .enableBiometricLogin();
      if (!mounted) return;
      if (!enabled) {
        setState(() {
          _busy = false;
          _error =
              'Device biometric verification failed. Try again or keep using your password.';
        });
        return;
      }
      _passwordController.clear();
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${ref.read(biometricAuthServiceProvider).biometricName(_capability)} login is enabled on this device only for your account.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e is AppException
            ? e.message
            : 'Could not verify your password. Please try again.';
      });
    }
  }

  Future<void> _disable() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    await ref.read(authProvider.notifier).disableBiometricLogin();
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Biometric login turned off on this device. Password sign-in remains available.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final store = ref.watch(biometricSessionStoreProvider);
    final bio = ref.watch(biometricAuthServiceProvider);
    final enabled =
        user != null && store.isEnabled(user.id, tenantId: user.tenantId);
    final personaAllowed =
        user != null &&
        AuthNotifier.supportsBiometricPersona(user.role, roles: user.roles);

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
        title: const Text('Biometric Login'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Biometric login',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Optional unlock for this device and account only. '
                        'SchoolOS never stores Face ID, Touch ID, or fingerprint data.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.slate600,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Status: ${bio.statusLabel(_capability, enabled: enabled)}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (!personaAllowed)
                  AppCard(
                    child: Text(
                      'Biometric login is available for Parent, Teacher, and Principal accounts.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.slate600,
                      ),
                    ),
                  )
                else if (!_supported)
                  AppCard(
                    child: Text(
                      'This device does not have supported biometrics enrolled. '
                      'You can keep using your school password.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.slate600,
                      ),
                    ),
                  )
                else if (enabled) ...[
                  AppButton(
                    label: 'Turn off biometric login',
                    variant: AppButtonVariant.outlined,
                    onPressed: _busy ? null : _disable,
                    isLoading: _busy,
                  ),
                ] else ...[
                  Text(
                    'Confirm your password, then verify '
                    '${bio.biometricName(_capability)} on this device.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.slate600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    controller: _passwordController,
                    label: 'Current password',
                    obscureText: true,
                    prefixIcon: Icons.lock_outline_rounded,
                    textInputAction: TextInputAction.done,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: bio.enableButtonLabel(_capability),
                    onPressed: _busy ? null : _enable,
                    isLoading: _busy,
                  ),
                ],
              ],
            ),
    );
  }
}
