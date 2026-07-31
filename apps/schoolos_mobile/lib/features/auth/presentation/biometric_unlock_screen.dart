import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_radius.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/biometric_auth_service.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/user_avatar.dart';

class BiometricUnlockScreen extends ConsumerStatefulWidget {
  const BiometricUnlockScreen({super.key});

  @override
  ConsumerState<BiometricUnlockScreen> createState() =>
      _BiometricUnlockScreenState();
}

class _BiometricUnlockScreenState extends ConsumerState<BiometricUnlockScreen> {
  bool _busy = false;
  String? _error;
  BiometricCapability _capability = BiometricCapability.generic;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _prepareAndUnlock();
    });
  }

  Future<void> _prepareAndUnlock() async {
    final bio = ref.read(biometricAuthServiceProvider);
    final capability = await bio.resolveCapability();
    if (!mounted) return;
    setState(() => _capability = capability);
    await _unlock();
  }

  Future<void> _unlock() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final bio = ref.read(biometricAuthServiceProvider);
    final ok = await ref.read(authProvider.notifier).unlockWithBiometrics();
    if (!mounted) return;
    if (ok) {
      setState(() => _busy = false);
      return;
    }
    setState(() {
      _busy = false;
      _error =
          'Could not verify ${bio.biometricName(_capability)}. Try again or sign in with your password.';
    });
  }

  Future<void> _usePassword() async {
    setState(() => _busy = true);
    await ref.read(authProvider.notifier).usePasswordInsteadOfBiometrics();
    if (!mounted) return;
    context.go(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final bio = ref.watch(biometricAuthServiceProvider);
    final user = auth.user;
    final name = user?.name.trim().isNotEmpty == true
        ? user!.name
        : 'SchoolOS User';

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary, AppColors.primaryDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              children: [
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: Column(
                    children: [
                      UserAvatar(name: name, radius: 36),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Welcome back',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.slate500),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Unlock with ${bio.biometricName(_capability)} to continue.',
                        textAlign: TextAlign.center,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      AppButton(
                        label: bio.unlockButtonLabel(_capability),
                        onPressed: _busy ? null : _unlock,
                        isLoading: _busy,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextButton(
                        onPressed: _busy ? null : _usePassword,
                        child: const Text('Use password instead'),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
