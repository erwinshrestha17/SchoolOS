import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../attendance/application/attendance_providers.dart';
import '../../../attendance/domain/attendance_models.dart';
import '../../../teacher/application/teacher_providers.dart';
import '../../../teacher/presentation/widgets/teacher_app_widgets.dart';

class TeacherDashboard extends ConsumerWidget {
  const TeacherDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final state = ref.watch(teacherAttendanceControllerProvider);
    final controller = ref.read(teacherAttendanceControllerProvider.notifier);
    final noticeSummary = ref.watch(teacherNoticeSummaryProvider);
    final messages = ref.watch(teacherMessagesProvider);
    final teacherName = _firstName(user?.name ?? 'Teacher');
    final roleLabel = _roleLabel(user?.roles ?? const [], user?.role);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Today',
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            controller.load(),
            ref.refresh(teacherMessagesProvider.future),
            ref.refresh(teacherNoticeSummaryProvider.future),
          ]);
        },
        child: TeacherScreenFrame(
          title: 'Today',
          header: TeacherPersonaHeader(
            schoolName: _schoolName(user?.tenantSlug),
            teacherName: teacherName,
            roleLabel: roleLabel,
            unreadCount: noticeSummary.valueOrNull?.unreadCount,
            onNotifications: () => context.go(AppRoutes.notifications),
          ),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (state.isLoading)
                    const _TeacherTodayLoading()
                  else if (state.error != null)
                    AppExceptionView(
                      error: state.error!,
                      onRetry: controller.load,
                    )
                  else if (state.classes.isEmpty)
                    AppEmptyState(
                      title: 'No classes are assigned',
                      message:
                          'No classes are assigned to you yet. Your school administrator can update your teaching assignments.',
                      icon: Icons.school_outlined,
                      actionLabel: 'Retry',
                      onActionPressed: controller.load,
                    )
                  else ...[
                    _CurrentPeriodCard(
                      periods: state.todayPeriods,
                      onOpenAttendance: () {
                        final current = _currentOrNextPeriod(
                          state.todayPeriods,
                        );
                        if (current == null) {
                          context.go(AppRoutes.teacherAttendance);
                        } else {
                          context.go(
                            AppRoutes.teacherAttendanceFor(
                              current.classSectionId,
                            ),
                          );
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (state.pendingAttendanceCount > 0) ...[
                      TeacherTaskCard(
                        title: 'Attendance pending',
                        subtitle:
                            '${state.pendingAttendanceCount} assigned class(es) still need attendance.',
                        icon: Icons.groups_rounded,
                        iconColor: AppColors.primary,
                        status: const StatusChip(
                          status: AppStatusType.pending,
                          label: 'To mark',
                        ),
                        onTap: () => context.go(AppRoutes.teacherAttendance),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: TeacherTaskCard(
                            title: 'Homework',
                            subtitle:
                                'Create/review is waiting for mobile DTO confirmation.',
                            icon: Icons.menu_book_rounded,
                            iconColor: AppColors.teacherAccent,
                            onTap: () => context.go(AppRoutes.teacherHomework),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: TeacherTaskCard(
                            title: 'Messages',
                            subtitle: messages.when(
                              data: (value) =>
                                  '${value.threads.length} parent thread(s)',
                              error: (_, _) => 'Unavailable',
                              loading: () => 'Loading',
                            ),
                            icon: Icons.chat_bubble_rounded,
                            iconColor: AppColors.info,
                            onTap: () => context.go(AppRoutes.teacherMessages),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TeacherTaskCard(
                      title: 'Assigned classes',
                      subtitle:
                          '${state.classes.length} active class/subject assignment(s)',
                      icon: Icons.school_rounded,
                      iconColor: AppColors.success,
                      onTap: () => context.go(AppRoutes.teacherClasses),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Today\'s timetable',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _TodayTimetableCard(periods: state.todayPeriods),
                    if (state.lastUpdated != null)
                      TeacherLastUpdatedLabel(
                        value: state.lastUpdated!,
                        cached: state.isOffline,
                      ),
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurrentPeriodCard extends StatelessWidget {
  const _CurrentPeriodCard({
    required this.periods,
    required this.onOpenAttendance,
  });

  final List<TeacherTodayPeriod> periods;
  final VoidCallback onOpenAttendance;

  @override
  Widget build(BuildContext context) {
    final current = _currentOrNextPeriod(periods);
    final next = _nextPeriod(periods, current);

    if (current == null) {
      return AppCard(
        child: Row(
          children: [
            const Icon(Icons.event_available_rounded, color: AppColors.success),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                'No assigned class period is scheduled for today.',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
    }

    return AppCard(
      onTap: onOpenAttendance,
      child: Column(
        children: [
          _PeriodRow(
            period: current,
            label: _periodStatus(current),
            highlighted: true,
          ),
          if (next != null) ...[
            const Divider(height: 28),
            _PeriodRow(period: next, label: 'Next', highlighted: false),
          ],
        ],
      ),
    );
  }
}

class _TodayTimetableCard extends StatelessWidget {
  const _TodayTimetableCard({required this.periods});

  final List<TeacherTodayPeriod> periods;

  @override
  Widget build(BuildContext context) {
    if (periods.isEmpty) {
      return const AppCard(
        child: Text('No timetable periods are published for today.'),
      );
    }

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final period in periods) ...[
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: _PeriodRow(
                period: period,
                label: _periodStatus(period),
                highlighted: _periodStatus(period) == 'Current',
              ),
            ),
            if (period != periods.last) const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _PeriodRow extends StatelessWidget {
  const _PeriodRow({
    required this.period,
    required this.label,
    required this.highlighted,
  });

  final TeacherTodayPeriod period;
  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: highlighted ? AppColors.primary : AppColors.slate100,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(
            highlighted
                ? Icons.calendar_month_rounded
                : Icons.event_note_rounded,
            color: highlighted ? Colors.white : AppColors.slate600,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                period.className,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              Text(
                '${period.startsAt} - ${period.endsAt} • ${period.subjectName}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        StatusChip(
          status: highlighted ? AppStatusType.present : AppStatusType.pending,
          label: label,
        ),
      ],
    );
  }
}

class _TeacherTodayLoading extends StatelessWidget {
  const _TeacherTodayLoading();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        AppSkeleton(width: double.infinity, height: 116),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 88),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 180),
      ],
    );
  }
}

TeacherTodayPeriod? _currentOrNextPeriod(List<TeacherTodayPeriod> periods) {
  if (periods.isEmpty) return null;
  final now = TimeOfDay.now();
  final nowMinutes = now.hour * 60 + now.minute;
  for (final period in periods) {
    final end = _minutes(period.endsAt);
    if (end != null && end >= nowMinutes) return period;
  }
  return periods.last;
}

TeacherTodayPeriod? _nextPeriod(
  List<TeacherTodayPeriod> periods,
  TeacherTodayPeriod? current,
) {
  if (current == null) return null;
  final index = periods.indexWhere((period) => period.id == current.id);
  if (index < 0 || index + 1 >= periods.length) return null;
  return periods[index + 1];
}

String _periodStatus(TeacherTodayPeriod period) {
  final now = TimeOfDay.now();
  final nowMinutes = now.hour * 60 + now.minute;
  final start = _minutes(period.startsAt);
  final end = _minutes(period.endsAt);
  if (start == null || end == null) return 'Upcoming';
  if (nowMinutes >= start && nowMinutes <= end) return 'Current';
  if (nowMinutes < start) return 'Upcoming';
  return 'Done';
}

int? _minutes(String value) {
  final parts = value.split(':');
  if (parts.length < 2) return null;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return null;
  return hour * 60 + minute;
}

String _firstName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return 'Teacher';
  return trimmed.split(RegExp(r'\s+')).first;
}

String _roleLabel(List<String> roles, String? role) {
  final joined = roles.isEmpty ? role : roles.join(', ');
  final normalized = (joined ?? 'Teacher').replaceAll('_', ' ').toLowerCase();
  return normalized
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _schoolName(String? tenantSlug) {
  final slug = tenantSlug?.trim();
  if (slug == null || slug.isEmpty) return 'SchoolOS';
  return slug
      .split(RegExp(r'[-_]'))
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
