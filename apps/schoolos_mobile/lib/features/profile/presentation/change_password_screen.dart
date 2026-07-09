import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/app_text_field.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _logoutOtherDevices = true;
  bool _submitting = false;
  String? _notice;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final forceChange = user?.mustChangePassword ?? false;
    final theme = Theme.of(context);

    return AppScaffold(
      appBar: AppBar(
        leading: forceChange
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go(AppRoutes.profile);
                  }
                },
              ),
        title: const Text('Change Password'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.security_rounded,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Account & Security',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    forceChange
                        ? 'This account is using a temporary password. Change it before opening SchoolOS workspaces.'
                        : 'Change your SchoolOS password using your active authenticated session.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.slate600,
                    ),
                  ),
                ],
              ),
            ),
            if (_notice != null) ...[
              const SizedBox(height: AppSpacing.md),
              _Notice(message: _notice!),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              child: Column(
                children: [
                  AppTextField(
                    label: 'Current password',
                    controller: _currentPasswordController,
                    obscureText: true,
                    prefixIcon: Icons.lock_outline_rounded,
                    textInputAction: TextInputAction.next,
                    validator: (value) => value == null || value.isEmpty
                        ? 'Enter your current password.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'New password',
                    controller: _newPasswordController,
                    obscureText: true,
                    prefixIcon: Icons.key_rounded,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => setState(() => _notice = null),
                    validator: (value) =>
                        _passwordValidationMessage(value ?? '', user?.email),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'Confirm new password',
                    controller: _confirmPasswordController,
                    obscureText: true,
                    prefixIcon: Icons.verified_user_outlined,
                    textInputAction: TextInputAction.done,
                    validator: (value) => value != _newPasswordController.text
                        ? 'Confirm password must match new password.'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  SwitchListTile.adaptive(
                    value: _logoutOtherDevices,
                    onChanged: _submitting
                        ? null
                        : (value) =>
                              setState(() => _logoutOtherDevices = value),
                    contentPadding: EdgeInsets.zero,
                    secondary: const Icon(Icons.devices_other_rounded),
                    title: const Text('Logout from other devices'),
                    subtitle: const Text(
                      'Recommended. Mobile will ask you to sign in again after a successful change.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: _submitting ? 'Changing password...' : 'Change Password',
              icon: Icons.lock_reset_rounded,
              isLoading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _notice = null);

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _submitting = true);
    try {
      final message = await ref
          .read(authProvider.notifier)
          .changePasswordAndLogout(
            currentPassword: _currentPasswordController.text,
            newPassword: _newPasswordController.text,
            confirmNewPassword: _confirmPasswordController.text,
            logoutOtherDevices: _logoutOtherDevices,
          );

      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$message Please sign in again.')));
      context.go(AppRoutes.login);
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _notice = _friendlyError(error);
        _submitting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _notice = 'Network error. Please retry when your connection is stable.';
        _submitting = false;
      });
    }
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.dangerLight.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.danger),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.dangerDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String? _passwordValidationMessage(String password, String? email) {
  final normalized = password.toLowerCase();
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!RegExp('[A-Z]').hasMatch(password)) {
    return 'Password needs an uppercase letter.';
  }
  if (!RegExp('[a-z]').hasMatch(password)) {
    return 'Password needs a lowercase letter.';
  }
  if (!RegExp(r'\d').hasMatch(password)) {
    return 'Password needs a number.';
  }
  if (!RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
    return 'Password needs a symbol.';
  }
  if (const {'admin123', 'password123', 'school123'}.contains(normalized)) {
    return 'Password must not use a common school password.';
  }
  final emailParts =
      email
          ?.toLowerCase()
          .split(RegExp('[^a-z0-9]+'))
          .where((part) => part.length >= 3) ??
      const Iterable<String>.empty();
  if (emailParts.any(normalized.contains)) {
    return 'Password must not include your email.';
  }
  return null;
}

String _friendlyError(AppException error) {
  if (error is SessionExpiredException) {
    return 'Your session expired. Sign in again before changing your password.';
  }
  if (error is PermissionException || error is ModuleLockedException) {
    return 'This account is not allowed to change password right now.';
  }
  if (error is NetworkException || error is TimeoutException) {
    return error.message;
  }
  return error.message;
}
