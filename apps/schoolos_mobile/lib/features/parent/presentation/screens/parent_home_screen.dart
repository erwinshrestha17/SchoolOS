import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
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
                _TodayOverviewCard(
                  summary: state.dashboard!,
                  isOffline: state.isOffline,
                  onOpenAttendance: () =>
                      context.go(AppRoutes.parentAttendance),
                  onOpenFees: () => context.go(AppRoutes.parentFees),
                ),
                const SizedBox(height: AppSpacing.xl),
                SectionHeader(
                  title: 'Daily follow-ups',
                  actionLabel: 'More',
                  onActionPressed: () => context.go(AppRoutes.parentMore),
                ),
                const SizedBox(height: AppSpacing.sm),
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
                      : _dueLabel(state.dashboard!.nextHomeworkDueAt),
                  onTap: () => context.go(AppRoutes.parentHomework),
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
                      state.dashboard!.transportDetail ??
                      'Open route and trip details.',
                  onTap: () => context.go(AppRoutes.parentTransport),
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardCard(
                  title: 'Canteen balance',
                  value: _formatMoney(state.dashboard!.canteenBalance),
                  icon: Icons.restaurant_rounded,
                  iconColor: state.dashboard!.canteenIsLowBalance
                      ? AppColors.warning
                      : AppColors.success,
                  subtitle: state.dashboard!.canteenIsLowBalance
                      ? 'Low balance. Top-up flow will connect after payments.'
                      : 'Meal wallet summary for quick parent awareness.',
                  onTap: () => context.go(AppRoutes.parentCanteen),
                ),
                const SizedBox(height: AppSpacing.xl),
                AppCard(
                  onTap: () => context.go(AppRoutes.parentActivity),
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
                              state.dashboard!.latestActivityTitle ??
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

class _TodayOverviewCard extends StatelessWidget {
  const _TodayOverviewCard({
    required this.summary,
    required this.isOffline,
    required this.onOpenAttendance,
    required this.onOpenFees,
  });

  final ParentDashboardSummary summary;
  final bool isOffline;
  final VoidCallback onOpenAttendance;
  final VoidCallback onOpenFees;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final feesValue = summary.feesDue == 0
        ? 'No dues'
        : _formatMoney(summary.feesDue);
    final homeworkValue = summary.homeworkPending == 0
        ? 'Done'
        : '${summary.homeworkPending} pending';

    return AppCard(
      color: isDark ? AppColors.slate900 : Colors.white,
      border: Border.all(
        color: isDark
            ? AppColors.slate800
            : AppColors.parentAccent.withValues(alpha: 0.14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.parentAccent.withValues(
                    alpha: isDark ? 0.16 : 0.10,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: const Icon(
                  Icons.wb_sunny_outlined,
                  color: AppColors.parentAccent,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Today at a glance',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Fast checks for ${summary.child.name}.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: isDark ? AppColors.slate400 : AppColors.slate600,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: isOffline
                    ? AppStatusType.draft
                    : AppStatusType.completed,
                label: isOffline ? 'Offline' : 'Synced',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _OverviewTile(
                  label: 'Attendance',
                  value: summary.attendanceToday,
                  icon: Icons.fact_check_rounded,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _OverviewTile(
                  label: 'Homework',
                  value: homeworkValue,
                  icon: Icons.menu_book_rounded,
                  color: summary.homeworkPending == 0
                      ? AppColors.success
                      : AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _OverviewTile(
                  label: 'Fees',
                  value: feesValue,
                  icon: Icons.account_balance_wallet_rounded,
                  color: summary.feesDue == 0
                      ? AppColors.success
                      : AppColors.warning,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _OverviewTile(
                  label: 'Notices',
                  value: '${summary.unreadNotices} unread',
                  icon: Icons.campaign_rounded,
                  color: summary.unreadNotices == 0
                      ? AppColors.success
                      : AppColors.info,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenAttendance,
                  icon: const Icon(Icons.calendar_month_rounded, size: 18),
                  label: const Text('Attendance'),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenFees,
                  icon: const Icon(Icons.receipt_long_rounded, size: 18),
                  label: const Text('Fees'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OverviewTile extends StatelessWidget {
  const _OverviewTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.14 : 0.08),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: color.withValues(alpha: isDark ? 0.24 : 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: AppSpacing.md),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: isDark ? AppColors.slate400 : AppColors.slate600,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.slate900,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
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

String _formatMoney(num value) {
  final amount = value % 1 == 0
      ? value.toInt().toString()
      : value.toStringAsFixed(2);
  return 'NPR $amount';
}

String _dueLabel(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) {
    return 'Homework details are synced from school.';
  }

  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return 'Next homework due date is available.';
  }

  return 'Next due ${parsed.month}/${parsed.day}/${parsed.year}.';
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
