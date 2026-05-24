import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/child_switcher.dart';
import '../widgets/last_updated_label.dart';
import '../widgets/parent_state_view.dart';

class ParentHomeScreen extends ConsumerWidget {
  const ParentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 0,
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              _Greeting(
                lastUpdated: state.lastUpdated,
                isOffline: state.isOffline,
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Your children'),
              const SizedBox(height: AppSpacing.sm),
              ChildSwitcher(
                children: state.children,
                selectedChildId: state.selectedChildId,
                onSelected: controller.selectChild,
              ),
              const SizedBox(height: AppSpacing.xl),
              if (state.dashboard != null) ...[
                _SelectedChildCard(
                  summary: state.dashboard!,
                  onOpenProfile: () => context.go(
                    AppRoutes.parentChildDetail(state.dashboard!.child.id),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                const SectionHeader(title: "Today's child summary"),
                const SizedBox(height: AppSpacing.sm),
                DashboardCard(
                  title: 'Attendance today',
                  value: state.dashboard!.attendanceToday,
                  icon: Icons.check_circle_outline_rounded,
                  iconColor: AppColors.success,
                  badge: const StatusChip(status: AppStatusType.present),
                  subtitle: 'Tap to view monthly attendance.',
                  onTap: () => context.go(AppRoutes.parentAttendance),
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Homework pending',
                  value: '${state.dashboard!.homeworkPending} tasks',
                  icon: Icons.menu_book_rounded,
                  iconColor: AppColors.primary,
                  badge: StatusChip(
                    status: state.dashboard!.homeworkPending == 0
                        ? AppStatusType.completed
                        : AppStatusType.pending,
                  ),
                  subtitle: state.dashboard!.homeworkPending == 0
                      ? 'No homework due today.'
                      : 'Open More for homework preview.',
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Fees due',
                  value: state.dashboard!.feesDue == 0
                      ? 'No dues'
                      : 'NPR ${state.dashboard!.feesDue}',
                  icon: Icons.account_balance_wallet_rounded,
                  iconColor: state.dashboard!.feesDue == 0
                      ? AppColors.success
                      : AppColors.warning,
                  badge: StatusChip(
                    status: state.dashboard!.feesDue == 0
                        ? AppStatusType.paid
                        : AppStatusType.due,
                  ),
                  subtitle: 'Financial actions stay permission protected.',
                  onTap: () => context.go(AppRoutes.parentFees),
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Unread notices',
                  value: '${state.dashboard!.unreadNotices} updates',
                  icon: Icons.campaign_rounded,
                  iconColor: AppColors.info,
                  badge: const StatusChip(status: AppStatusType.published),
                  subtitle: 'Important school updates are ready to read.',
                  onTap: () => context.go(AppRoutes.notices),
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Transport status',
                  value: state.dashboard!.transportStatus,
                  icon: Icons.directions_bus_rounded,
                  iconColor: AppColors.driverAccent,
                  badge: const StatusChip(status: AppStatusType.onRoute),
                  subtitle:
                      'Live tracking will connect in the transport sprint.',
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Canteen balance',
                  value: 'NPR ${state.dashboard!.canteenBalance}',
                  icon: Icons.restaurant_rounded,
                  iconColor: AppColors.success,
                  subtitle: 'Meal wallet summary for quick parent awareness.',
                ),
                const SizedBox(height: AppSpacing.xl),
                AppCard(
                  onTap: () => context.go(AppRoutes.notices),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.auto_awesome_rounded,
                        color: AppColors.parentAccent,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Latest activity',
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(state.dashboard!.latestActivity),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.lastUpdated, required this.isOffline});

  final DateTime? lastUpdated;
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Namaste, Parent',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              LastUpdatedLabel(lastUpdated: lastUpdated, isOffline: isOffline),
            ],
          ),
        ),
        const RoleBadge(role: 'PARENT'),
      ],
    );
  }
}

class _SelectedChildCard extends StatelessWidget {
  const _SelectedChildCard({
    required this.summary,
    required this.onOpenProfile,
  });

  final ParentDashboardSummary summary;
  final VoidCallback onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final child = summary.child;
    return AppGradientCard(
      gradient: const LinearGradient(
        colors: AppColors.parentGradient,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      onTap: onOpenProfile,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${child.classSection} • Roll ${child.rollNumber}',
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: AppSpacing.md),
                const StatusChip(
                  status: AppStatusType.onRoute,
                  label: 'Open child profile',
                ),
              ],
            ),
          ),
          UserAvatar(
            name: child.name,
            radius: 36,
            borderColor: Colors.white,
            borderWidth: 2,
          ),
        ],
      ),
    );
  }
}
