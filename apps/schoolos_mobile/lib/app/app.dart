import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme/app_theme.dart';
import '../core/auth/auth_provider.dart';
import '../core/notifications/push_deep_link_resolver.dart';
import '../core/notifications/push_notification_controller.dart';
import '../features/parent/application/parent_providers.dart';

class SchoolOSApp extends ConsumerWidget {
  const SchoolOSApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    ref.listen<AuthState>(authProvider, (previous, next) {
      final pushController = ref.read(
        pushNotificationControllerProvider.notifier,
      );
      if (next.status == AuthStatus.authenticated) {
        unawaited(
          pushController.activate(
            auth: next,
            onOpen: (payload) => _openPushNotification(ref, payload),
          ),
        );
      } else if (previous?.status == AuthStatus.authenticated &&
          next.status == AuthStatus.unauthenticated) {
        unawaited(pushController.deactivate());
      }
    });

    return MaterialApp.router(
      title: 'SchoolOS Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}

Future<void> _openPushNotification(
  WidgetRef ref,
  Map<String, dynamic> payload,
) async {
  final auth = ref.read(authProvider);
  final user = auth.user;
  if (auth.status != AuthStatus.authenticated ||
      user == null ||
      user.tenantId == null) {
    return;
  }

  try {
    final route = await PushDeepLinkResolver.resolve(
      payload: payload,
      role: user.role,
      tenantId: user.tenantId!,
      // Guardian scope is owned by the parent repository, which already applies
      // the linked-children contract and its offline cache. Calling the
      // endpoint inline here duplicated that rule in the widget layer.
      canAccessChild: (childId) async {
        final children = await ref
            .read(parentRepositoryProvider)
            .getGuardianChildren();
        return children.any((child) => child.id == childId);
      },
    );
    if (route != null) {
      ref.read(appRouterProvider).go(route);
    }
  } catch (_) {
    // Stay on the current safe screen without rendering push preview data.
  }
}
