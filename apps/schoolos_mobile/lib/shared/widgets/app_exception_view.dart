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
    final currentError = error;

    if (currentError is ModuleLockedException) {
      return const ModuleLockedState();
    }
    if (currentError is PermissionException) {
      return const PermissionDeniedState();
    }
    if (currentError is SessionExpiredException ||
        currentError is AuthException) {
      return SessionExpiredState(onSignIn: onSignIn);
    }
    if (currentError is NotFoundAppException) {
      return const AppAccessState(
        title: 'No longer available',
        message: 'This information is no longer available.',
        icon: Icons.search_off_rounded,
      );
    }
    if (currentError is NetworkException || currentError is TimeoutException) {
      final appError = currentError as AppException;
      return AppErrorView(
        title: 'You are offline',
        message: appError.message,
        isOffline: true,
        onRetry: onRetry,
      );
    }
    if (currentError is ConflictAppException) {
      return AppErrorView(
        title: 'Refresh needed',
        message: currentError.message,
        onRetry: onRetry,
      );
    }
    if (currentError is ValidationException) {
      return AppErrorView(
        title: 'Check the details',
        message: currentError.message,
        onRetry: onRetry,
      );
    }
    if (currentError is AppException) {
      return AppErrorView(message: currentError.message, onRetry: onRetry);
    }

    return AppErrorView(
      message: 'SchoolOS could not load this information. Please try again.',
      onRetry: onRetry,
    );
  }
}
