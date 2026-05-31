import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_radius.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
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
  final _emailController = TextEditingController(text: 'admin@schoolos.com');
  final _passwordController = TextEditingController(text: 'admin123');

  String _selectedRole = 'ADMIN';

  final List<Map<String, dynamic>> _rolesList = [
    {
      'name': 'PARENT',
      'label': 'Parent',
      'icon': Icons.family_restroom_rounded,
      'color': AppColors.parentAccent,
    },
    {
      'name': 'STUDENT',
      'label': 'Student',
      'icon': Icons.person_rounded,
      'color': AppColors.studentAccent,
    },
    {
      'name': 'TEACHER',
      'label': 'Teacher',
      'icon': Icons.co_present_rounded,
      'color': AppColors.teacherAccent,
    },
    {
      'name': 'DRIVER',
      'label': 'Driver',
      'icon': Icons.directions_bus_rounded,
      'color': AppColors.driverAccent,
    },
    {
      'name': 'STAFF',
      'label': 'Staff',
      'icon': Icons.badge_rounded,
      'color': AppColors.staffAccent,
    },
    {
      'name': 'ADMIN',
      'label': 'Admin',
      'icon': Icons.admin_panel_settings_rounded,
      'color': AppColors.adminAccent,
    },
  ];

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
        // Fallback to mock login if it's a network exception and using demo email
        if ((e is NetworkException || e is TimeoutException) &&
            _emailController.text.trim() == 'demo@school.edu.np') {
          await ref.read(authProvider.notifier).loginMock(_selectedRole);
          if (mounted) {
            context.go(AppRoutes.home);
          }
          return;
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e is AppException ? e.message : e.toString()),
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
                      'Smarter school operations companion',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: isDark ? AppColors.slate400 : AppColors.slate600,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),

                  // Role Selector Section
                  Text(
                    'Select Role for Demo Sign In',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.slate300 : AppColors.slate700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    height: 90,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _rolesList.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(width: AppSpacing.sm),
                      itemBuilder: (context, index) {
                        final item = _rolesList[index];
                        final isSelected = _selectedRole == item['name'];
                        final itemColor = item['color'] as Color;

                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedRole = item['name'] as String;
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 84,
                            padding: const EdgeInsets.symmetric(
                              vertical: AppSpacing.md,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? itemColor.withValues(
                                      alpha: isDark ? 0.2 : 0.08,
                                    )
                                  : (isDark
                                        ? AppColors.slate900
                                        : Colors.white),
                              borderRadius: BorderRadius.circular(AppRadius.xl),
                              border: Border.all(
                                color: isSelected
                                    ? itemColor
                                    : (isDark
                                          ? AppColors.slate800
                                          : AppColors.slate200),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  item['icon'] as IconData,
                                  color: isSelected
                                      ? itemColor
                                      : AppColors.slate400,
                                  size: 24,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  item['label'] as String,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: isSelected
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: isSelected
                                        ? (isDark
                                              ? Colors.white
                                              : AppColors.slate800)
                                        : AppColors.slate500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: AppSpacing.xl),
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
                    label: 'Sign in as $_selectedRole',
                    icon: Icons.login_rounded,
                    isLoading: authState.status == AuthStatus.loading,
                    onPressed: _handleLogin,
                  ),
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
}
