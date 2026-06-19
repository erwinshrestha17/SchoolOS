import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
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
                  onOpenHomework: () => context.go(AppRoutes.parentHomework),
                  onOpenNotices: () => context.go(AppRoutes.notices),
                  onOpenTransport: () => context.go(AppRoutes.parentTransport),
                  onOpenTeacherUpdate: () => context.go(AppRoutes.parentChat),
                ),
                const SizedBox(height: AppSpacing.xl),
                SectionHeader(
                  title: 'More for today',
                  actionLabel: 'More',
                  onActionPressed: () => context.go(AppRoutes.parentMore),
                ),
                const SizedBox(height: AppSpacing.sm),
                _MoreForTodayLinks(summary: state.dashboard!),
                const SizedBox(height: AppSpacing.xl),
                AppCard(
                  onTap: state.dashboard!.activityEnabled
                      ? () => context.go(AppRoutes.parentActivity)
                      : null,
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
                              !state.dashboard!.activityEnabled
                                  ? 'Activity not enabled'
                                  : state.dashboard!.latestActivityTitle ??
                                        'Latest activity',
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              state.dashboard!.activityEnabled
                                  ? state.dashboard!.latestActivity
                                  : 'This module is not enabled for your school.',
                            ),
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
    required this.onOpenHomework,
    required this.onOpenNotices,
    required this.onOpenTransport,
    required this.onOpenTeacherUpdate,
  });

  final ParentDashboardSummary summary;
  final bool isOffline;
  final VoidCallback onOpenAttendance;
  final VoidCallback onOpenFees;
  final VoidCallback onOpenHomework;
  final VoidCallback onOpenNotices;
  final VoidCallback onOpenTransport;
  final VoidCallback onOpenTeacherUpdate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final items = _buildTodayItems();

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
                      'Today for ${summary.child.name}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      items.first.priorityLabel,
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
          for (var index = 0; index < items.length; index++) ...[
            _TodayPriorityRow(item: items[index], isTopPriority: index == 0),
            if (index != items.length - 1)
              const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  List<_TodayPriorityItem> _buildTodayItems() {
    final items = <_TodayPriorityItem>[
      _TodayPriorityItem(
        rank: _attendanceRank(),
        title: 'Attendance',
        value: summary.attendanceEnabled
            ? summary.attendanceToday
            : 'Attendance module locked',
        detail: summary.attendanceEnabled
            ? 'Latest school attendance for this child.'
            : 'This school has not enabled attendance on mobile.',
        icon: Icons.fact_check_rounded,
        color: summary.attendanceEnabled
            ? AppColors.success
            : AppColors.slate500,
        onOpen: summary.attendanceEnabled ? onOpenAttendance : null,
      ),
      _TodayPriorityItem(
        rank: _feesRank(),
        title: 'Fees due',
        value: !summary.feesEnabled
            ? 'Fees module locked'
            : summary.feesDue == 0
            ? 'No dues'
            : _formatMoney(summary.feesDue),
        detail: !summary.feesEnabled
            ? 'This school has not enabled fee views on mobile.'
            : summary.feesDue == 0
            ? 'No outstanding school fee balance from the backend.'
            : _feesDetail(),
        icon: Icons.receipt_long_rounded,
        color: summary.feesDue > 0 ? AppColors.warning : AppColors.success,
        onOpen: summary.feesEnabled ? onOpenFees : null,
      ),
      _TodayPriorityItem(
        rank: _homeworkRank(),
        title: 'Next homework',
        value: !summary.homeworkEnabled
            ? 'Homework module locked'
            : summary.homeworkPending == 0
            ? 'Nothing pending'
            : '${summary.homeworkPending} pending',
        detail: !summary.homeworkEnabled
            ? 'This school has not enabled homework on mobile.'
            : summary.homeworkPending == 0
            ? 'No pending homework for this child.'
            : _dueLabel(summary.nextHomeworkDueAt),
        icon: Icons.menu_book_rounded,
        color: summary.homeworkPending > 0
            ? AppColors.warning
            : AppColors.success,
        onOpen: summary.homeworkEnabled ? onOpenHomework : null,
      ),
      _TodayPriorityItem(
        rank: _noticeRank(),
        title: 'Unread notices',
        value: summary.unreadNotices == 0
            ? 'All read'
            : '${summary.unreadNotices} unread',
        detail: summary.unreadNotices == 0
            ? 'No unread school notices.'
            : 'Important school updates are ready to read.',
        icon: Icons.campaign_rounded,
        color: summary.unreadNotices > 0 ? AppColors.info : AppColors.success,
        onOpen: onOpenNotices,
      ),
      _TodayPriorityItem(
        rank: _transportRank(),
        title: 'Transport',
        value: summary.transportEnabled
            ? summary.transportStatus
            : 'Transport module locked',
        detail: summary.transportEnabled
            ? summary.transportDetail ?? 'Open route and trip details.'
            : 'This school has not enabled transport on mobile.',
        icon: Icons.directions_bus_rounded,
        color: summary.transportEnabled
            ? AppColors.driverAccent
            : AppColors.slate500,
        onOpen: summary.transportEnabled ? onOpenTransport : null,
      ),
      _TodayPriorityItem(
        rank: _teacherUpdateRank(),
        title: 'Latest teacher update',
        value: summary.latestActivityTitle ?? 'School update',
        detail: summary.latestActivity,
        icon: Icons.chat_bubble_outline_rounded,
        color: AppColors.parentAccent,
        onOpen: onOpenTeacherUpdate,
      ),
    ];
    items.sort((a, b) => a.rank.compareTo(b.rank));
    return items;
  }

  int _attendanceRank() {
    if (!summary.attendanceEnabled) return 80;
    final value = summary.attendanceToday.toLowerCase();
    if (value.contains('absent')) return 1;
    if (value.contains('late')) return 2;
    if (value.contains('not marked') || value.contains('not submitted')) {
      return 20;
    }
    return 50;
  }

  int _feesRank() {
    if (!summary.feesEnabled) return 81;
    if (summary.overdueFeesCount > 0) return 3;
    if (summary.feesDue > 0) return 6;
    return 55;
  }

  int _homeworkRank() {
    if (!summary.homeworkEnabled) return 82;
    if (summary.homeworkPending > 0) return 8;
    return 58;
  }

  int _noticeRank() => summary.unreadNotices > 0 ? 10 : 60;

  int _transportRank() {
    if (!summary.transportEnabled) return 83;
    final value = '${summary.transportStatus} ${summary.transportDetail ?? ''}'
        .toLowerCase();
    if (value.contains('delay') || value.contains('late')) return 4;
    if (value.contains('boarded') || value.contains('dropped')) return 12;
    return 62;
  }

  int _teacherUpdateRank() {
    if (!summary.activityEnabled) return 84;
    if (summary.latestActivityTitle != null) return 14;
    return 65;
  }

  String _feesDetail() {
    final due = summary.nextFeeDueDate == null
        ? 'No upcoming due date from school.'
        : 'Next due ${_shortDate(summary.nextFeeDueDate)}.';
    if (summary.overdueFeesCount > 0) {
      return '${summary.overdueFeesCount} overdue item${summary.overdueFeesCount == 1 ? '' : 's'}. $due';
    }
    return due;
  }
}

class _TodayPriorityItem {
  const _TodayPriorityItem({
    required this.rank,
    required this.title,
    required this.value,
    required this.detail,
    required this.icon,
    required this.color,
    required this.onOpen,
  });

  final int rank;
  final String title;
  final String value;
  final String detail;
  final IconData icon;
  final Color color;
  final VoidCallback? onOpen;

  String get priorityLabel {
    if (rank <= 4) return 'Needs attention now.';
    if (rank <= 14) return 'Review today when you have time.';
    return 'Everything urgent is clear.';
  }
}

class _TodayPriorityRow extends StatelessWidget {
  const _TodayPriorityRow({required this.item, required this.isTopPriority});

  final _TodayPriorityItem item;
  final bool isTopPriority;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return InkWell(
      onTap: item.onOpen,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: item.color.withValues(alpha: isDark ? 0.14 : 0.08),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: item.color.withValues(alpha: isTopPriority ? 0.36 : 0.14),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: item.color.withValues(alpha: isDark ? 0.18 : 0.12),
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Icon(item.icon, color: item.color, size: 22),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? AppColors.slate400
                                : AppColors.slate600,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if (isTopPriority)
                        const StatusChip(
                          status: AppStatusType.pending,
                          label: 'Top',
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    item.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: isDark ? Colors.white : AppColors.slate900,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.detail,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark ? AppColors.slate400 : AppColors.slate600,
                    ),
                  ),
                ],
              ),
            ),
            if (item.onOpen != null) ...[
              const SizedBox(width: AppSpacing.sm),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.slate500,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MoreForTodayLinks extends StatelessWidget {
  const _MoreForTodayLinks({required this.summary});

  final ParentDashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _QuickTodayLink(
          icon: Icons.school_rounded,
          color: AppColors.studentAccent,
          title: 'Learning summary',
          subtitle: 'Child-scoped classroom activity progress.',
          onTap: () => context.go(AppRoutes.parentLearning),
        ),
        const SizedBox(height: AppSpacing.sm),
        _QuickTodayLink(
          icon: Icons.restaurant_rounded,
          color: summary.canteenIsLowBalance
              ? AppColors.warning
              : AppColors.success,
          title: 'Canteen wallet',
          subtitle: !summary.canteenEnabled
              ? 'This module is not enabled for your school.'
              : summary.canteenIsLowBalance
              ? '${_formatMoney(summary.canteenBalance)} balance. Top-up stays unavailable until payment reconciliation is approved.'
              : '${_formatMoney(summary.canteenBalance)} balance. View-only on mobile.',
          onTap: summary.canteenEnabled
              ? () => context.go(AppRoutes.parentCanteen)
              : null,
        ),
        const SizedBox(height: AppSpacing.sm),
        _QuickTodayLink(
          icon: Icons.photo_library_rounded,
          color: AppColors.parentAccent,
          title: 'Activity feed',
          subtitle: summary.activityEnabled
              ? summary.latestActivity
              : 'This module is not enabled for your school.',
          onTap: summary.activityEnabled
              ? () => context.go(AppRoutes.parentActivity)
              : null,
        ),
      ],
    );
  }
}

class _QuickTodayLink extends StatelessWidget {
  const _QuickTodayLink({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: isDark ? 0.16 : 0.10),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: isDark ? AppColors.slate400 : AppColors.slate600,
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null)
            const Icon(Icons.chevron_right_rounded, color: AppColors.slate500),
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

String _shortDate(String? isoDate) {
  final parsed = DateTime.tryParse(isoDate ?? '');
  if (parsed == null) {
    return 'date unavailable';
  }
  return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
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
