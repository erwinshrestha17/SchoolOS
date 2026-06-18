import 'package:flutter/material.dart';

import '../../core/errors/app_exception.dart';
import 'app_access_state.dart';
import 'app_error_view.dart';

class AppExceptionView extends StatelessWidget {
  const AppExceptionView({
    super.key,
    required this.error,
    this.onRetry,
    this.onSignIn,
  });

  final Object error;
  final VoidCallback? onRetry;
  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    if (error is ModuleLockedException) {
      return const ModuleLockedState();
    }
    if (error is PermissionException) {
      return const PermissionDeniedState();
    }
    if (error is SessionExpiredException || error is AuthException) {
      return SessionExpiredState(onSignIn: onSignIn);
    }
    if (error is NotFoundAppException) {
      return const AppAccessState(
        title: 'No longer available',
        message: 'This information is no longer available.',
        icon: Icons.search_off_rounded,
      );
    }
    if (error is NetworkException || error is TimeoutException) {
      return AppErrorView(
        title: 'You are offline',
        message: 'Reconnect to the internet and try again.',
        isOffline: true,
        onRetry: onRetry,
      );
    }

    return AppErrorView(
      message: 'SchoolOS could not load this information. Please try again.',
      onRetry: onRetry,
    );
  }
}
