import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_radius.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/config/env_config.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';

import '../../../core/errors/app_exception.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _tenantController = TextEditingController(text: 'default-school');
  final _emailController = TextEditingController(
    text: 'principal@schoolos.com',
  );
  final _passwordController = TextEditingController(text: 'principal123');

  final List<_DemoLoginAccount> _demoAccounts = const [
    _DemoLoginAccount(
      role: 'PARENT',
      label: 'Parent',
      description: 'Children, fees, homework',
      email: 'guardian@schoolos.com',
      password: 'guardian123',
      icon: Icons.family_restroom_rounded,
      color: AppColors.parentAccent,
    ),
    _DemoLoginAccount(
      role: 'TEACHER',
      label: 'Teacher',
      description: 'Classes and attendance',
      email: 'classteacher@schoolos.com',
      password: 'classteacher123',
      icon: Icons.co_present_rounded,
      color: AppColors.teacherAccent,
    ),
    _DemoLoginAccount(
      role: 'STAFF',
      label: 'Staff',
      description: 'HR, payslips, requests',
      email: 'accountant@schoolos.com',
      password: 'accountant123',
      icon: Icons.badge_rounded,
      color: AppColors.staffAccent,
    ),
    _DemoLoginAccount(
      role: 'ADMIN',
      label: 'Admin',
      description: 'Approvals and snapshot',
      email: 'principal@schoolos.com',
      password: 'principal123',
      icon: Icons.admin_panel_settings_rounded,
      color: AppColors.adminAccent,
    ),
  ];

  _DemoLoginAccount? _selectedDemoAccount;

  @override
  void dispose() {
    _tenantController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      final theme = Theme.of(context);
      try {
        await ref
            .read(authProvider.notifier)
            .login(
              tenantCode: _tenantController.text.trim(),
              usernameOrEmail: _emailController.text.trim(),
              password: _passwordController.text.trim(),
            );
        if (mounted) {
          context.go(AppRoutes.home);
        }
      } catch (e) {
        if (mounted) {
          final message = e is NetworkException || e is TimeoutException
              ? 'Cannot reach the SchoolOS backend at ${EnvConfig.apiBaseUrl}. Start the API server, then try again.'
              : e is AppException
              ? e.message
              : e.toString();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: theme.colorScheme.error,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.xxl,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadius.xxl),
                      ),
                      child: const Icon(
                        Icons.school_rounded,
                        size: 64,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Center(
                    child: Text(
                      'Welcome to SchoolOS',
                      style: theme.textTheme.headlineLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.0,
                        color: isDark ? Colors.white : AppColors.slate900,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Center(
                    child: Text(
                      'Sign in once. SchoolOS opens the right workspace.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: isDark ? AppColors.slate400 : AppColors.slate600,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),

                  Text(
                    'Sign in with your school account',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.slate300 : AppColors.slate700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Use your tenant code, email or username, and password. Your backend role controls which screens open after login.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark ? AppColors.slate400 : AppColors.slate600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    label: 'Tenant code',
                    controller: _tenantController,
                    hintText: 'e.g. holyland',
                    prefixIcon: Icons.business_rounded,
                    textInputAction: TextInputAction.next,
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Tenant is required' : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'Email or username',
                    controller: _emailController,
                    hintText: 'name@school.edu.np',
                    prefixIcon: Icons.person_outline_rounded,
                    textInputAction: TextInputAction.next,
                    validator: (v) => v == null || v.isEmpty
                        ? 'Username/Email is required'
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'Password',
                    controller: _passwordController,
                    obscureText: true,
                    prefixIcon: Icons.lock_outline_rounded,
                    textInputAction: TextInputAction.done,
                    validator: (v) => v == null || v.length < 6
                        ? 'Password must be at least 6 chars'
                        : null,
                  ),

                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.go(AppRoutes.forgotPassword),
                      child: const Text('Forgot password?'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: 'Sign in',
                    icon: Icons.login_rounded,
                    isLoading: authState.status == AuthStatus.loading,
                    onPressed: _handleLogin,
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  Text(
                    'Quick-fill sample accounts',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.slate300 : AppColors.slate700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'These only fill the form. Routing still comes from the backend login response.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark ? AppColors.slate400 : AppColors.slate600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final cardWidth =
                          (constraints.maxWidth - AppSpacing.sm) / 2;

                      return Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          for (final account in _demoAccounts)
                            SizedBox(
                              width: cardWidth,
                              child: _DemoAccountCard(
                                account: account,
                                isSelected:
                                    _selectedDemoAccount?.role == account.role,
                                isDark: isDark,
                                onTap: () => _applyDemoAccount(account),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                  if (_selectedDemoAccount != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _SelectedDemoAccountBanner(
                      account: _selectedDemoAccount!,
                      isDark: isDark,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  Center(
                    child: Text(
                      'Secured by SchoolOS platform architecture',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.slate400,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _applyDemoAccount(_DemoLoginAccount option) {
    setState(() {
      _selectedDemoAccount = option;
      _emailController.text = option.email;
      _passwordController.text = option.password;
    });
  }
}

class _DemoLoginAccount {
  const _DemoLoginAccount({
    required this.role,
    required this.label,
    required this.description,
    required this.email,
    required this.password,
    required this.icon,
    required this.color,
  });

  final String role;
  final String label;
  final String description;
  final String email;
  final String password;
  final IconData icon;
  final Color color;
}

class _DemoAccountCard extends StatelessWidget {
  const _DemoAccountCard({
    required this.account,
    required this.isSelected,
    required this.isDark,
    required this.onTap,
  });

  final _DemoLoginAccount account;
  final bool isSelected;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Semantics(
      button: true,
      selected: isSelected,
      label: 'Fill ${account.label} sample account',
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: isSelected
                ? account.color.withValues(alpha: isDark ? 0.2 : 0.1)
                : (isDark ? AppColors.slate900 : Colors.white),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: isSelected
                  ? account.color
                  : (isDark ? AppColors.slate800 : AppColors.slate200),
              width: isSelected ? 2 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: account.color.withValues(alpha: 0.16),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: account.color.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(account.icon, color: account.color, size: 20),
                  ),
                  const Spacer(),
                  Icon(
                    isSelected
                        ? Icons.check_circle_rounded
                        : Icons.person_add_alt_1_outlined,
                    color: isSelected ? account.color : AppColors.slate300,
                    size: 20,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                account.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : AppColors.slate900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                account.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: isDark ? AppColors.slate400 : AppColors.slate500,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedDemoAccountBanner extends StatelessWidget {
  const _SelectedDemoAccountBanner({
    required this.account,
    required this.isDark,
  });

  final _DemoLoginAccount account;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: account.color.withValues(alpha: isDark ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: account.color.withValues(alpha: 0.32)),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_fix_high_rounded, color: account.color, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Filled ${account.email}. Tap Sign in to continue.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: isDark ? AppColors.slate300 : AppColors.slate700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
