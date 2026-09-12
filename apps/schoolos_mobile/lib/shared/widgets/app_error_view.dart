import 'package:flutter/material.dart';
import '../../app/theme/app_semantic_colors.dart';
import 'app_empty_state.dart';

class AppErrorView extends StatelessWidget {
  const AppErrorView({
    super.key,
    required this.message,
    this.title = 'Could not load this information',
    this.onRetry,
    this.isOffline = false,
  });
  final String message;
  final String title;
  final VoidCallback? onRetry;
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final semantic = AppSemanticColors.of(context);
    return AppEmptyState(
      title: isOffline ? 'No connection' : title,
      message: message,
      icon: isOffline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
      iconColor: isOffline ? semantic.warning : semantic.error,
      actionLabel: onRetry == null ? null : 'Try again',
      onActionPressed: onRetry,
    );
  }
}
