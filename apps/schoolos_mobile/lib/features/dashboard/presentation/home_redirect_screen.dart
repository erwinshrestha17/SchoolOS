import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/constants/app_routes.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/mobile_role.dart';
import '../../../shared/widgets/app_loading.dart';
import '../../../shared/widgets/app_scaffold.dart';

class HomeRedirectScreen extends ConsumerStatefulWidget {
  const HomeRedirectScreen({super.key});

  @override
  ConsumerState<HomeRedirectScreen> createState() => _HomeRedirectScreenState();
}

class _HomeRedirectScreenState extends ConsumerState<HomeRedirectScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkRedirect();
    });
  }

  void _checkRedirect() {
    if (!mounted) return;

    final auth = ref.read(authProvider);

    if (auth.status == AuthStatus.unauthenticated) {
      context.go(AppRoutes.login);
    } else if (auth.status == AuthStatus.authenticated) {
      final role = MobileRole.normalize(
        auth.role,
        roles: auth.user?.roles ?? const [],
      );
      switch (role) {
        case MobileRole.parent:
          context.go(AppRoutes.parentHome);
          break;
        case MobileRole.student:
          context.go(AppRoutes.studentHome);
          break;
        case MobileRole.teacher:
          context.go(AppRoutes.teacherHome);
          break;
        case MobileRole.driver:
          context.go(AppRoutes.driverHome);
          break;
        case MobileRole.staff:
          context.go(AppRoutes.staffHome);
          break;
        case MobileRole.principal:
          context.go(AppRoutes.principalToday);
          break;
        case MobileRole.admin:
          context.go(AppRoutes.adminHome);
          break;
        default:
          // Fallback to role picker home
          context.go(AppRoutes.home);
          break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen for auth state modifications to trigger redirection
    ref.listen<AuthState>(authProvider, (previous, next) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _checkRedirect();
      });
    });

    return const AppScaffold(
      body: Center(
        child: AppLoading(message: 'Directing you to your dashboard...'),
      ),
    );
  }
}
