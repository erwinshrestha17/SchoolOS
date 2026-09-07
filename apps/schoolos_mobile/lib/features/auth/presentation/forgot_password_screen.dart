import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/password_validation.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_text_field.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    this.initialTenantSlug = '',
    this.initialEmail = '',
  });

  final String initialTenantSlug;
  final String initialEmail;

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _identityForm = GlobalKey<FormState>();
  final _resetForm = GlobalKey<FormState>();
  late final TextEditingController _tenantController;
  late final TextEditingController _emailController;
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  CancelToken? _cancellation;
  bool _requested = false;
  bool _completed = false;
  bool _busy = false;
  String? _error;
  String? _requestNotice;

  @override
  void initState() {
    super.initState();
    _tenantController = TextEditingController(text: widget.initialTenantSlug);
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _cancellation?.cancel();
    _tenantController.dispose();
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    if (_busy) return;
    if (!_requested && !_identityForm.currentState!.validate()) {
      setState(() => _error = 'Check the highlighted fields.');
      return;
    }
    if (!ref.read(connectivityProvider)) {
      setState(
        () => _error = 'You are offline. Connect to request a recovery code.',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _requestNotice = null;
    });
    _cancellation = CancelToken();
    try {
      await ref
          .read(authRepositoryProvider)
          .requestPasswordRecovery(
            tenantSlug: _tenantController.text.trim(),
            email: _emailController.text.trim(),
            cancelToken: _cancellation,
          );
      if (!mounted) return;
      _codeController.clear();
      setState(() {
        _requested = true;
        _requestNotice =
            'If these details match an eligible account, a recovery code will be sent to its email address. Check your inbox and spam folder.';
      });
    } catch (error) {
      if (mounted) {
        setState(() => _error = _recoveryError(error, confirming: false));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_busy) return;
    if (!_resetForm.currentState!.validate()) {
      setState(() => _error = 'Check the highlighted fields.');
      return;
    }
    if (!ref.read(connectivityProvider)) {
      setState(
        () => _error = 'You are offline. Connect to reset your password.',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    final auth = ref.read(authProvider);
    setState(() {
      _busy = true;
      _error = null;
    });
    _cancellation = CancelToken();
    try {
      await ref
          .read(authRepositoryProvider)
          .confirmPasswordRecovery(
            tenantSlug: _tenantController.text.trim(),
            email: _emailController.text.trim(),
            code: _codeController.text.trim(),
            newPassword: _passwordController.text,
            confirmNewPassword: _confirmController.text,
            cancelToken: _cancellation,
          );
      if (!mounted) return;
      // Do not offer an unconfirmed password to the password manager.
      TextInput.finishAutofillContext(shouldSave: true);
      _codeController.clear();
      _passwordController.clear();
      _confirmController.clear();
      // The server reset revoked the account's sessions. Clear the locally
      // locked session too, but never sign out a different, newer session.
      if (auth.status == AuthStatus.biometricLocked &&
          identical(ref.read(authProvider), auth)) {
        try {
          await ref.read(authProvider.notifier).logout();
        } catch (_) {
          if (mounted) {
            setState(
              () => _error =
                  'Your password changed, but local sign-out could not finish. Close the app and sign in again.',
            );
          }
        }
      }
      if (mounted) setState(() => _completed = true);
    } catch (error) {
      if (mounted) {
        setState(() => _error = _recoveryError(error, confirming: true));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _changeAccount() {
    if (_busy) return;
    _codeController.clear();
    _passwordController.clear();
    _confirmController.clear();
    setState(() {
      _requested = false;
      _error = null;
      _requestNotice = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(connectivityProvider);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back to sign in',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go(AppRoutes.login),
        ),
        title: const Text('Reset password'),
      ),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Text(
                  _completed
                      ? 'Password changed'
                      : _requested
                      ? 'Enter your recovery code'
                      : 'Recover your account',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _completed
                      ? 'Your password was changed by SchoolOS. Sign in again with your new password.'
                      : _requested
                      ? 'School: ${_tenantController.text.trim()}\nEmail: ${_emailController.text.trim()}'
                      : 'Enter your school code and account email. If you do not know them or cannot access your email, contact your school office.',
                ),
                if (!online && !_completed) ...[
                  const SizedBox(height: AppSpacing.md),
                  const _RecoveryNotice(
                    message:
                        'You are offline. Recovery needs an internet connection. Nothing will be queued.',
                  ),
                ],
                if (_requestNotice != null && !_completed) ...[
                  const SizedBox(height: AppSpacing.md),
                  _RecoveryNotice(message: _requestNotice!),
                ],
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _RecoveryNotice(message: _error!, isError: true),
                ],
                const SizedBox(height: AppSpacing.lg),
                if (_completed)
                  AppButton(
                    label: 'Back to sign in',
                    onPressed: () => context.go(AppRoutes.login),
                  )
                else if (_requested)
                  _resetFields(online)
                else
                  _identityFields(online),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _identityFields(bool online) => Form(
    key: _identityForm,
    child: AutofillGroup(
      child: Column(
        children: [
          AppTextField(
            label: 'School code',
            controller: _tenantController,
            enabled: !_busy,
            hintText: 'Your school code',
            textInputAction: TextInputAction.next,
            validator: (value) =>
                (value ?? '').trim().isEmpty ? 'Enter your school code.' : null,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Account email',
            controller: _emailController,
            enabled: !_busy,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.done,
            validator: (value) =>
                RegExp(
                  r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                ).hasMatch((value ?? '').trim())
                ? null
                : 'Enter a valid account email.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Request recovery code',
            onPressed: online ? _requestCode : null,
            isLoading: _busy,
          ),
        ],
      ),
    ),
  );

  Widget _resetFields(bool online) => Form(
    key: _resetForm,
    child: AutofillGroup(
      onDisposeAction: AutofillContextAction.cancel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTextField(
            label: 'Recovery code',
            controller: _codeController,
            enabled: !_busy,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            textInputAction: TextInputAction.next,
            validator: (value) =>
                RegExp(r'^[0-9]+$').hasMatch((value ?? '').trim())
                ? null
                : 'Enter the numeric code from your email.',
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'New password',
            controller: _passwordController,
            obscureText: true,
            enabled: !_busy,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.next,
            validator: (value) => passwordValidationMessage(
              value ?? '',
              _emailController.text.trim(),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol. Avoid your name, email, and previous password.',
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Confirm new password',
            controller: _confirmController,
            obscureText: true,
            enabled: !_busy,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.done,
            validator: (value) =>
                value == null ||
                    value.isEmpty ||
                    value != _passwordController.text
                ? 'Confirm password must match new password.'
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Resetting your password signs out existing sessions. Review the school and email above before continuing.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Reset password',
            onPressed: online ? _resetPassword : null,
            isLoading: _busy,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Request a new code',
            onPressed: _busy || !online ? null : _requestCode,
            variant: AppButtonVariant.outlined,
          ),
          TextButton(
            onPressed: _busy ? null : _changeAccount,
            child: const Text('Use a different account'),
          ),
        ],
      ),
    ),
  );
}

class _RecoveryNotice extends StatelessWidget {
  const _RecoveryNotice({required this.message, this.isError = false});
  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isError ? Icons.error_outline_rounded : Icons.info_outline_rounded,
            color: isError
                ? Theme.of(context).colorScheme.error
                : Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message)),
        ],
      ),
    ),
  );
}

String _recoveryError(Object error, {required bool confirming}) {
  if (error is NetworkException || error is TimeoutException) {
    return confirming
        ? 'Could not confirm the password change. Try signing in with your new password, or reconnect and request a new code.'
        : 'Could not confirm the recovery request. Check your email before retrying when connected.';
  }
  if (error is ServerException && error.statusCode == 429) {
    return 'Too many recovery attempts. Wait before trying again, or contact your school office.';
  }
  return confirming
      ? 'Password could not be reset. Check your school, email, code and password requirements, or request a new code.'
      : 'Recovery is unavailable right now. Check your school code and email, then try again or contact your school office.';
}
