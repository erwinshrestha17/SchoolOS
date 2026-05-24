import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/parent_providers.dart';
import '../widgets/parent_state_view.dart';

class ParentChildrenScreen extends ConsumerWidget {
  const ParentChildrenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 1,
      title: 'Children',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            const SectionHeader(title: 'Linked children'),
            const SizedBox(height: AppSpacing.sm),
            for (final child in state.children) ...[
              AppCard(
                onTap: () async {
                  await controller.selectChild(child.id);
                  if (context.mounted) {
                    context.go(AppRoutes.parentChildDetail(child.id));
                  }
                },
                child: Row(
                  children: [
                    UserAvatar(
                      name: child.name,
                      radius: 28,
                      borderColor: child.id == state.selectedChildId
                          ? AppColors.parentAccent
                          : null,
                      borderWidth: child.id == state.selectedChildId ? 2 : 0,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            '${child.classSection} • Roll ${child.rollNumber}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.slate500),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.slate400,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ],
        ),
      ),
    );
  }
}
