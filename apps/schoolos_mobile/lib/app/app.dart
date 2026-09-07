import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme/app_theme.dart';
import '../core/auth/auth_provider.dart';
import '../core/notifications/push_notification_navigation.dart';
import '../core/notifications/push_notification_controller.dart';
import '../core/theme/theme_mode_provider.dart';
import '../features/auth/presentation/biometric_setup_sheet.dart';
import '../features/parent/application/parent_providers.dart';

class SchoolOSApp extends ConsumerStatefulWidget {
  const SchoolOSApp({super.key});

  @override
  ConsumerState<SchoolOSApp> createState() => _SchoolOSAppState();
}

class _SchoolOSAppState extends ConsumerState<SchoolOSApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual<AuthState>(authProvider, _handleAuthChanged);
    // Restored auth may already exist when the shell mounts. Defer this first
    // notification-state update until after build, as Riverpod prohibits
    // mutating a different provider during widget initialization.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _handleAuthChanged(null, ref.read(authProvider));
    });
  }

  void _handleAuthChanged(AuthState? previous, AuthState next) {
    _synchronizePush(next);
    if (next.status == AuthStatus.authenticated) {
      final becameAuthenticated = previous?.status != AuthStatus.authenticated;
      final passwordGateCleared =
          previous?.user?.mustChangePassword == true &&
          next.user?.mustChangePassword != true;
      if ((becameAuthenticated || passwordGateCleared) &&
          next.user?.mustChangePassword != true) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final navContext = rootNavigatorKey.currentContext;
          if (navContext != null && navContext.mounted) {
            unawaited(maybeShowBiometricSetupOffer(navContext, ref));
          }
        });
      }
    }
  }

  void _synchronizePush(AuthState auth, {bool refresh = false}) {
    unawaited(
      ref
          .read(pushNotificationControllerProvider.notifier)
          .synchronizeSession(
            auth: auth,
            refresh: refresh,
            onOpen: (payload) => _openPushNotification(ref, auth, payload),
          ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Recheck after returning from device permission settings or a transient
      // provider/network failure. The controller coalesces in-flight setup.
      _synchronizePush(ref.read(authProvider), refresh: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'SchoolOS Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}

Future<void> _openPushNotification(
  WidgetRef ref,
  AuthState auth,
  Map<String, dynamic> payload,
) => openPushNotificationForSession(
  auth: auth,
  readAuth: () => ref.read(authProvider),
  payload: payload,
  // Guardian scope is owned by the parent repository, which already applies
  // the linked-children contract and its offline cache. Calling the
  // endpoint inline here duplicated that rule in the widget layer.
  canAccessChild: (childId) async {
    final children = await ref
        .read(parentRepositoryProvider)
        .getGuardianChildren();
    return children.any((child) => child.id == childId);
  },
  navigate: (route) => ref.read(appRouterProvider).go(route),
);
