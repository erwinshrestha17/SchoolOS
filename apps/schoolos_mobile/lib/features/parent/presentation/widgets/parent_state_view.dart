import 'package:flutter/material.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/app_access_state.dart';
import '../../domain/parent_models.dart';

class ParentStateView extends StatelessWidget {
  const ParentStateView({
    super.key,
    required this.status,
    required this.onRetry,
    required this.child,
    this.message,
  });

  final ParentDataStatus status;
  final VoidCallback onRetry;
  final Widget child;
  final String? message;

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case ParentDataStatus.loading:
        return const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              AppSkeleton(width: double.infinity, height: 140),
              SizedBox(height: AppSpacing.md),
              AppSkeleton(width: double.infinity, height: 92),
              SizedBox(height: AppSpacing.md),
              AppSkeleton(width: double.infinity, height: 92),
            ],
          ),
        );
      case ParentDataStatus.empty:
        return AppEmptyState(
          title: 'No children linked',
          message:
              message ??
              'Ask the school office to link your guardian account to a student profile.',
          icon: Icons.family_restroom_rounded,
        );
      case ParentDataStatus.error:
      case ParentDataStatus.timeout:
        return AppErrorView(
          title: 'Could not load parent data',
          message: message ?? 'Please try again in a moment.',
          onRetry: onRetry,
        );
      case ParentDataStatus.unauthorized:
      case ParentDataStatus.sessionExpired:
        return const SessionExpiredState();
      case ParentDataStatus.forbidden:
        return const PermissionDeniedState();
      case ParentDataStatus.moduleLocked:
        return const ModuleLockedState();
      case ParentDataStatus.offline:
        return message == null
            ? child
            : AppErrorView(
                message: message!,
                isOffline: true,
                onRetry: onRetry,
              );
      case ParentDataStatus.success:
        return child;
    }
  }
}
