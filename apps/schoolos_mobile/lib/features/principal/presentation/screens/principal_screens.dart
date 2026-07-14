import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../shared/widgets/app_access_state.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/offline_banner.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/principal_providers.dart';

class PrincipalTodayScreen extends ConsumerWidget {
  const PrincipalTodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(principalDashboardProvider);
    return PrincipalShell(
      selectedIndex: 0,
      title: 'Principal Today',
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(principalDashboardProvider),
        ),
        data: (data) => _DashboardBody(data: data),
      ),
    );
  }
}

class PrincipalAttentionScreen extends ConsumerStatefulWidget {
  const PrincipalAttentionScreen({super.key});

  @override
  ConsumerState<PrincipalAttentionScreen> createState() =>
      _PrincipalAttentionScreenState();
}

class _PrincipalAttentionScreenState
    extends ConsumerState<PrincipalAttentionScreen> {
  String filter = 'all';

  @override
  Widget build(BuildContext context) {
    final provider = principalAttentionProvider(filter);
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 1,
      title: 'Attention Center',
      subtitle: 'Prioritized issues across school operations',
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CacheBanner(data: data),
            _SegmentedFilters(
              values: const ['all', 'critical', 'today', 'assigned'],
              active: filter,
              labels: const {
                'all': 'All',
                'critical': 'Critical',
                'today': 'Today',
                'assigned': 'Assigned',
              },
              onChanged: (value) => setState(() => filter = value),
            ),
            const SizedBox(height: AppSpacing.md),
            _SummaryCards(
              values: [
                _SummaryValue(
                  'Critical',
                  _num(data, 'summary.critical'),
                  AppColors.danger,
                  Icons.error_rounded,
                ),
                _SummaryValue(
                  'High',
                  _num(data, 'summary.high'),
                  AppColors.warning,
                  Icons.arrow_upward_rounded,
                ),
                _SummaryValue(
                  'Medium',
                  _num(data, 'summary.medium'),
                  AppColors.info,
                  Icons.remove_rounded,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _ActionRow(
              icon: Icons.person_rounded,
              title: 'Assigned to me',
              trailing: '${_num(data, 'summary.assignedToMe')}',
              onTap: () => setState(() => filter = 'assigned'),
            ),
            const SizedBox(height: AppSpacing.md),
            _ItemList(items: _list(data['items'])),
            const SizedBox(height: AppSpacing.md),
            _ActionRow(
              icon: Icons.checklist_rounded,
              title: 'View my tasks',
              subtitle: 'See all tasks assigned to you',
              onTap: () => context.go(AppRoutes.principalTasks),
            ),
          ],
        ),
      ),
    );
  }
}

class PrincipalApprovalsScreen extends ConsumerStatefulWidget {
  const PrincipalApprovalsScreen({super.key});

  @override
  ConsumerState<PrincipalApprovalsScreen> createState() =>
      _PrincipalApprovalsScreenState();
}

class _PrincipalApprovalsScreenState
    extends ConsumerState<PrincipalApprovalsScreen> {
  String tab = 'pending';

  @override
  Widget build(BuildContext context) {
    final provider = principalApprovalsProvider(tab);
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 2,
      title: 'Approvals',
      subtitle: 'Review pending requests that need your decision',
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CacheBanner(data: data),
            _SegmentedFilters(
              values: const ['pending', 'approved', 'rejected'],
              active: tab,
              labels: const {
                'pending': 'Pending',
                'approved': 'Approved',
                'rejected': 'Rejected',
              },
              onChanged: (value) => setState(() => tab = value),
            ),
            const SizedBox(height: AppSpacing.md),
            _SummaryCards(
              values: [
                _SummaryValue(
                  'Pending',
                  _num(data, 'summary.pending'),
                  AppColors.info,
                  Icons.description_rounded,
                ),
                _SummaryValue(
                  'Urgent',
                  _num(data, 'summary.urgent'),
                  AppColors.danger,
                  Icons.warning_rounded,
                ),
                _SummaryValue(
                  'Today',
                  _num(data, 'summary.today'),
                  AppColors.warning,
                  Icons.today_rounded,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            _ItemList(
              items: _list(data['items']),
              actionBuilder: (item) => SizedBox(
                width: 136,
                child: OutlinedButton.icon(
                  onPressed: () => _showReviewSheet(context, ref, item, tab),
                  icon: const Icon(Icons.visibility_rounded, size: 18),
                  label: const Text('Review'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PrincipalEscalationsScreen extends ConsumerStatefulWidget {
  const PrincipalEscalationsScreen({super.key});

  @override
  ConsumerState<PrincipalEscalationsScreen> createState() =>
      _PrincipalEscalationsScreenState();
}

class _PrincipalEscalationsScreenState
    extends ConsumerState<PrincipalEscalationsScreen> {
  String status = 'open';

  @override
  Widget build(BuildContext context) {
    final provider = principalEscalationsProvider(status);
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'Escalations',
      subtitle: 'Parent concerns and school issues needing follow-up',
      showBack: true,
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CacheBanner(data: data),
            _SegmentedFilters(
              values: const ['open', 'assigned', 'resolved', 'reopened'],
              active: status,
              labels: const {
                'open': 'Open',
                'assigned': 'Mine',
                'resolved': 'Resolved',
                'reopened': 'Reopened',
              },
              onChanged: (value) => setState(() => status = value),
            ),
            const SizedBox(height: AppSpacing.md),
            _SummaryCards(
              values: [
                _SummaryValue(
                  'Critical',
                  _num(data, 'metrics.critical'),
                  AppColors.danger,
                  Icons.warning_rounded,
                ),
                _SummaryValue(
                  'Due Today',
                  _num(data, 'metrics.dueToday'),
                  AppColors.warning,
                  Icons.today_rounded,
                ),
                _SummaryValue(
                  'Pending',
                  _num(data, 'metrics.pendingResponse'),
                  AppColors.info,
                  Icons.mark_chat_unread_rounded,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            _ItemList(
              items: _list(data['items']),
              actionBuilder: (item) => SizedBox(
                width: 128,
                child: OutlinedButton.icon(
                  onPressed: () =>
                      _showEscalationSheet(context, ref, item, status),
                  icon: const Icon(Icons.edit_note_rounded, size: 18),
                  label: const Text('Manage'),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const _Callout(
              icon: Icons.verified_user_rounded,
              title: 'Actions are audited',
              message:
                  'Assign, note, resolve, and reopen actions use principal-scoped backend contracts and audit history.',
              color: AppColors.info,
            ),
          ],
        ),
      ),
    );
  }
}

class PrincipalStudentsScreen extends ConsumerStatefulWidget {
  const PrincipalStudentsScreen({super.key});

  @override
  ConsumerState<PrincipalStudentsScreen> createState() =>
      _PrincipalStudentsScreenState();
}

class _PrincipalStudentsScreenState
    extends ConsumerState<PrincipalStudentsScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => query = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = principalStudentSearchProvider(query);
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'Student Lookup',
      subtitle: 'Permission-safe student summaries',
      showBack: true,
      child: asyncData.when(
        loading: () => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StudentSearchField(
              controller: _controller,
              onChanged: _onSearchChanged,
            ),
            const SizedBox(height: AppSpacing.lg),
            const _PrincipalLoading(),
          ],
        ),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => _StudentSearchBody(
          data: data,
          controller: _controller,
          onChanged: _onSearchChanged,
        ),
      ),
    );
  }
}

class PrincipalTasksScreen extends ConsumerWidget {
  const PrincipalTasksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = principalSnapshotProvider('tasks');
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'Tasks',
      subtitle: 'Assigned follow-ups, owners, and due dates',
      showBack: true,
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => _TasksBody(data: data),
      ),
    );
  }
}

class PrincipalWalkthroughsScreen extends ConsumerWidget {
  const PrincipalWalkthroughsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = principalSnapshotProvider('walkthroughs');
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'Classroom Walkthroughs',
      subtitle: 'Observation follow-ups and classroom visit status',
      showBack: true,
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => _WalkthroughsBody(data: data),
      ),
    );
  }
}

class PrincipalMoreScreen extends ConsumerWidget {
  const PrincipalMoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(principalDashboardProvider);
    return PrincipalShell(
      selectedIndex: 4,
      title: 'More',
      subtitle: 'Tools, snapshots, and school operations',
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(principalDashboardProvider),
        ),
        data: (data) => _MoreBody(data: data),
      ),
    );
  }
}

class PrincipalSnapshotScreen extends ConsumerWidget {
  const PrincipalSnapshotScreen({
    super.key,
    required this.snapshotKey,
    required this.title,
    required this.subtitle,
  });

  final String snapshotKey;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = principalSnapshotProvider(snapshotKey);
    final asyncData = ref.watch(provider);
    return PrincipalShell(
      selectedIndex: snapshotKey == 'notice' ? 3 : 4,
      title: title,
      subtitle: subtitle,
      showBack: true,
      child: asyncData.when(
        loading: () => const _PrincipalLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (data) => _SnapshotBody(snapshotKey: snapshotKey, data: data),
      ),
    );
  }
}

class PrincipalShell extends ConsumerWidget {
  const PrincipalShell({
    super.key,
    required this.selectedIndex,
    required this.title,
    required this.child,
    this.subtitle,
    this.showBack = false,
  });

  final int selectedIndex;
  final String title;
  final String? subtitle;
  final Widget child;
  final bool showBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      backgroundColor: AppColors.slate50,
      bottomNavigationBar: _PrincipalBottomNav(selectedIndex: selectedIndex),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _PrincipalHeader(
              schoolName: user?.tenantSlug ?? 'SchoolOS',
              showBack: showBack,
              onBack: () => context.go(AppRoutes.principalMore),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 96),
                children: [
                  Row(
                    children: [
                      if (showBack) ...[
                        _BackButton(
                          onTap: () => context.go(AppRoutes.principalMore),
                        ),
                        const SizedBox(width: AppSpacing.md),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(
                                    color: AppColors.slate950,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                subtitle!,
                                style: Theme.of(context).textTheme.bodyLarge
                                    ?.copyWith(
                                      color: AppColors.slate500,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  child,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        AppCard(
          onTap: () => context.go(AppRoutes.principalAttention),
          child: Row(
            children: [
              const _IconBubble(
                icon: Icons.priority_high_rounded,
                color: AppColors.warning,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${data['attentionCount'] ?? 0} items need attention',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.slate900,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Text(
                      'Review today\'s highest-priority school issues',
                      style: TextStyle(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w600,
                      ),
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
        const SizedBox(height: AppSpacing.lg),
        LayoutBuilder(
          builder: (context, constraints) {
            final compactPhone = constraints.maxWidth < 360;
            return GridView.count(
              crossAxisCount: compactPhone ? 1 : 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: compactPhone ? 2.0 : 1.05,
              crossAxisSpacing: AppSpacing.md,
              mainAxisSpacing: AppSpacing.md,
              children: [
                for (final card in _list(data['cards']))
                  _MetricCard(
                    title: _string(card['label']),
                    value: _string(card['value']),
                    detail: _string(card['detail']),
                    icon: _iconFor(_string(card['key'])),
                    color: _tone(_string(card['tone'])),
                    locked: card['locked'] == true,
                    onTap: () => _go(context, _string(card['route'])),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: AppSpacing.xl),
        SectionHeader(
          title: 'Alerts / Priority',
          actionLabel: 'View all',
          onActionPressed: () => context.go(AppRoutes.principalAttention),
        ),
        const SizedBox(height: AppSpacing.sm),
        _ItemList(items: _list(data['alerts']), compact: true),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Quick Actions'),
        const SizedBox(height: AppSpacing.sm),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.8,
          crossAxisSpacing: AppSpacing.md,
          mainAxisSpacing: AppSpacing.md,
          children: [
            for (final action in _list(data['quickActions']))
              _QuickAction(
                title: _string(action['label']),
                icon: _iconFor(_string(action['icon'])),
                enabled: action['enabled'] != false,
                onTap: () => _go(context, _string(action['route'])),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Recent Updates'),
        const SizedBox(height: AppSpacing.sm),
        _ItemList(items: _list(data['recentUpdates']), compact: true),
      ],
    );
  }
}

class _MoreBody extends StatelessWidget {
  const _MoreBody({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final modules = data['modules'] is Map<String, dynamic>
        ? data['modules'] as Map<String, dynamic>
        : <String, dynamic>{};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _ContextCard(data: data),
        const SizedBox(height: AppSpacing.lg),
        _MenuGroup(
          title: '1. School Overview',
          items: [
            _MenuItem(
              'Students',
              Icons.groups_rounded,
              AppColors.warning,
              AppRoutes.principalStudents,
              enabled: modules['students'] == true,
            ),
            _MenuItem(
              'Admissions Snapshot',
              Icons.person_add_alt_1_rounded,
              AppColors.info,
              AppRoutes.principalAdmissions,
              enabled: modules['students'] == true,
            ),
            _MenuItem(
              'Academics',
              Icons.menu_book_rounded,
              AppColors.info,
              AppRoutes.principalAcademics,
              enabled: modules['exams'] == true,
            ),
            _MenuItem(
              'Fees Snapshot',
              Icons.account_balance_wallet_rounded,
              AppColors.success,
              AppRoutes.principalFees,
              enabled: modules['fees'] == true,
            ),
          ],
        ),
        _MenuGroup(
          title: '2. Operations',
          items: [
            _MenuItem(
              'Transport',
              Icons.directions_bus_rounded,
              AppColors.primary,
              AppRoutes.principalTransport,
              enabled: modules['transport'] == true,
            ),
            _MenuItem(
              'Canteen Snapshot',
              Icons.restaurant_rounded,
              AppColors.warning,
              AppRoutes.principalCanteen,
              enabled: modules['canteen'] == true,
            ),
            _MenuItem(
              'Library Snapshot',
              Icons.local_library_rounded,
              AppColors.info,
              AppRoutes.principalLibrary,
              enabled: modules['library'] == true,
            ),
          ],
        ),
        _MenuGroup(
          title: '3. Leadership',
          items: [
            _MenuItem(
              'Tasks',
              Icons.assignment_turned_in_rounded,
              AppColors.success,
              AppRoutes.principalTasks,
              enabled: modules['tasks'] == true,
            ),
            _MenuItem(
              'Classroom Walkthroughs',
              Icons.directions_walk_rounded,
              AppColors.warning,
              AppRoutes.principalWalkthroughs,
              enabled: modules['classroomWalkthroughs'] == true,
            ),
            _MenuItem(
              'Reports Snapshot',
              Icons.bar_chart_rounded,
              AppColors.info,
              AppRoutes.principalReports,
              enabled: modules['reports'] == true,
            ),
          ],
        ),
        _MenuGroup(
          title: '4. Notices and alerts',
          items: [
            _MenuItem(
              'Escalations',
              Icons.warning_rounded,
              AppColors.danger,
              AppRoutes.principalEscalations,
            ),
            _MenuItem(
              'Notice Archive',
              Icons.inventory_2_rounded,
              AppColors.info,
              AppRoutes.notices,
            ),
          ],
        ),
        _MenuGroup(
          title: '5. Account',
          items: [
            _MenuItem(
              'Profile',
              Icons.person_rounded,
              AppColors.primary,
              AppRoutes.profile,
            ),
            _MenuItem(
              'Settings',
              Icons.settings_rounded,
              AppColors.slate500,
              AppRoutes.settings,
            ),
          ],
        ),
      ],
    );
  }
}

class _SnapshotBody extends ConsumerWidget {
  const _SnapshotBody({required this.snapshotKey, required this.data});

  final String snapshotKey;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (snapshotKey == 'canteen' || snapshotKey == 'library') {
      return const ModuleLockedState();
    }
    if (snapshotKey == 'notice') {
      return _EmergencyNoticeBody(data: data, ref: ref);
    }
    if (snapshotKey == 'reports') return _ReportsBody(data: data);
    if (snapshotKey == 'tasks') return _TasksBody(data: data);
    if (snapshotKey == 'walkthroughs') return _WalkthroughsBody(data: data);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _MetricSection(data: data),
        const SizedBox(height: AppSpacing.lg),
        for (final entry in _snapshotSections(snapshotKey, data)) ...[
          SectionHeader(title: entry.title),
          const SizedBox(height: AppSpacing.sm),
          _ItemList(items: entry.items),
          const SizedBox(height: AppSpacing.lg),
        ],
      ],
    );
  }
}

class _EmergencyNoticeBody extends StatelessWidget {
  const _EmergencyNoticeBody({required this.data, required this.ref});

  final Map<String, dynamic> data;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    if (data['status'] == 'empty') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppAccessState(
            title: 'No urgent notice pending',
            message: _string(
              data['message'],
              fallback:
                  'There is no high-impact notice awaiting principal review.',
            ),
            icon: Icons.campaign_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
          _ActionRow(
            icon: Icons.campaign_rounded,
            title: 'Compose emergency notice',
            subtitle:
                'Preview recipients first, then submit through the backend approval/delivery contract.',
            onTap: () => _showEmergencyNoticeSheet(context, ref),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _Callout(
          icon: Icons.warning_rounded,
          title: 'Draft awaiting approval',
          message: 'This notice has not been sent.',
          color: AppColors.warning,
        ),
        const SizedBox(height: AppSpacing.md),
        _SummaryCards(
          values: [
            _SummaryValue(
              'Notice Type',
              _string(data['noticeType']),
              AppColors.danger,
              Icons.campaign_rounded,
            ),
            _SummaryValue(
              'Audience',
              _string(data['audience']),
              AppColors.info,
              Icons.groups_rounded,
            ),
            _SummaryValue(
              'Priority',
              _string(data['priority']),
              AppColors.danger,
              Icons.flag_rounded,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _PlainCard(title: 'Subject', body: _string(data['subject'])),
        const SizedBox(height: AppSpacing.md),
        _PlainCard(
          title: 'Message preview',
          body: _string(data['messagePreview']),
        ),
        const SizedBox(height: AppSpacing.md),
        _PlainCard(
          title: 'Recipients',
          body:
              'Total ${_num(data, 'recipients.total')} recipients. Counts are from backend preview/delivery data.',
        ),
        const SizedBox(height: AppSpacing.md),
        _ActionRow(
          icon: Icons.campaign_rounded,
          title: 'Compose another emergency notice',
          subtitle:
              'Preview recipients before submitting a new urgent or emergency notice.',
          onTap: () => _showEmergencyNoticeSheet(context, ref),
        ),
        const SizedBox(height: AppSpacing.md),
        _Callout(
          icon: Icons.verified_user_rounded,
          title: 'Sending uses backend contracts',
          message: _string(
            data['actions'] is Map ? (data['actions'] as Map)['message'] : null,
            fallback:
                'High-impact sends are submitted through the backend preview, approval, and delivery workflow.',
          ),
          color: AppColors.info,
        ),
      ],
    );
  }
}

class _StudentSearchBody extends StatelessWidget {
  const _StudentSearchBody({
    required this.data,
    required this.controller,
    required this.onChanged,
  });

  final Map<String, dynamic> data;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final items = _list(data['items']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _StudentSearchField(controller: controller, onChanged: onChanged),
        const SizedBox(height: AppSpacing.md),
        const _Callout(
          icon: Icons.filter_alt_off_rounded,
          title: 'Class and section filters unavailable',
          message:
              'Student lookup is using the confirmed mobile search endpoint. Class and section filter controls need a safe mobile options contract before they appear here.',
          color: AppColors.info,
        ),
        const SizedBox(height: AppSpacing.lg),
        SectionHeader(title: 'Results (${items.length})'),
        const SizedBox(height: AppSpacing.sm),
        if (items.isEmpty)
          const AppAccessState(
            title: 'No students found',
            message:
                'Try a student name, admission number, or guardian search term.',
            icon: Icons.search_off_rounded,
          )
        else
          for (final item in items) ...[
            _StudentResultCard(item: item),
            const SizedBox(height: AppSpacing.md),
          ],
        _ActionRow(
          icon: Icons.person_add_alt_1_rounded,
          title: 'Recent admissions',
          subtitle:
              '${data['recentAdmissions'] ?? 0} new students in the last 7 days',
        ),
      ],
    );
  }
}

class _StudentSearchField extends StatelessWidget {
  const _StudentSearchField({
    required this.controller,
    required this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search_rounded),
        hintText: 'Search name, admission no., guardian phone',
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class _StudentResultCard extends StatelessWidget {
  const _StudentResultCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final guardianName = _string(item['guardianName'], fallback: 'Guardian');
    final phone = _maskPhone(_string(item['guardianPhone']));
    return AppCard(
      onTap: () => _showStudentSummary(context, item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _IconBubble(
                icon: Icons.face_rounded,
                color: AppColors.info,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _string(item['name'], fallback: 'Student'),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      _string(
                        item['classLabel'],
                        fallback: 'Class unavailable',
                      ),
                      style: const TextStyle(color: AppColors.slate500),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: _statusType(_string(item['feeRisk'])),
                label: 'Fee ${_string(item['feeRisk'], fallback: 'Unknown')}',
              ),
            ],
          ),
          const Divider(height: AppSpacing.xl),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            children: [
              _InlineMeta(
                icon: Icons.fact_check_rounded,
                label:
                    'Attendance ${_string(item['attendanceSummary'], fallback: 'Unavailable')}',
              ),
              _InlineMeta(
                icon: Icons.contact_phone_rounded,
                label: phone.isEmpty ? guardianName : '$guardianName $phone',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InlineMeta extends StatelessWidget {
  const _InlineMeta({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.slate500),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

void _showStudentSummary(BuildContext context, Map<String, dynamic> item) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _string(item['name'], fallback: 'Student'),
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            _string(item['classLabel'], fallback: 'Class unavailable'),
            style: const TextStyle(color: AppColors.slate600),
          ),
          const SizedBox(height: AppSpacing.lg),
          _PlainCard(
            title: 'Attendance risk',
            body: _string(item['attendanceSummary'], fallback: 'Unavailable'),
          ),
          const SizedBox(height: AppSpacing.md),
          _PlainCard(
            title: 'Fee risk',
            body: _string(item['feeRisk'], fallback: 'Unavailable'),
          ),
          const SizedBox(height: AppSpacing.md),
          _PlainCard(
            title: 'Guardian contact',
            body: [
              _string(item['guardianName'], fallback: 'Guardian unavailable'),
              _maskPhone(_string(item['guardianPhone'])),
            ].where((value) => value.isNotEmpty).join(' '),
          ),
          const SizedBox(height: AppSpacing.md),
          const _Callout(
            icon: Icons.lock_rounded,
            title: 'Documents unavailable',
            message:
                'Student document browsing is hidden until File Registry authorization for this mobile route is confirmed.',
            color: AppColors.info,
          ),
        ],
      ),
    ),
  );
}

class _ReportsBody extends StatelessWidget {
  const _ReportsBody({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _SummaryCards(
          values: [
            for (final metric in _list(data['metrics']))
              _SummaryValue(
                _string(metric['label']),
                _string(metric['value']),
                _toneForIndex(_list(data['metrics']).indexOf(metric)),
                Icons.bar_chart_rounded,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const SectionHeader(title: 'Core Reports'),
        const SizedBox(height: AppSpacing.sm),
        _ItemList(items: _list(data['coreReports'])),
        const SizedBox(height: AppSpacing.lg),
        const SectionHeader(title: 'Protected exports'),
        const SizedBox(height: AppSpacing.sm),
        _ItemList(
          items: _list(data['protectedExports'])
              .map(
                (item) => {
                  ...item,
                  'status': item['downloadSupported'] == true
                      ? 'Available'
                      : 'Preparing',
                },
              )
              .toList(),
        ),
        const SizedBox(height: AppSpacing.md),
        _Callout(
          icon: Icons.lock_rounded,
          title: 'View protected reports',
          message:
              'Protected exports open only through authenticated report helpers when the backend marks them available.',
          color: AppColors.info,
        ),
      ],
    );
  }
}

class _TasksBody extends StatelessWidget {
  const _TasksBody({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _SummaryCards(
          values: [
            _SummaryValue(
              'Due Today',
              _num(data, 'metrics.dueToday'),
              AppColors.warning,
              Icons.today_rounded,
            ),
            _SummaryValue(
              'Overdue',
              _num(data, 'metrics.overdue'),
              AppColors.danger,
              Icons.error_rounded,
            ),
            _SummaryValue(
              'Completed',
              _num(data, 'metrics.completed'),
              AppColors.success,
              Icons.check_circle_rounded,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        _ItemList(
          items: _list(data['items'])
              .map(
                (item) => {
                  'id': item['id'],
                  'title': item['title'],
                  'subtitle': item['owner'],
                  'detail': item['dueLabel'],
                  'severity': item['priority'],
                  'status': item['status'],
                },
              )
              .toList(),
        ),
        const SizedBox(height: AppSpacing.md),
        _Callout(
          icon: Icons.add_rounded,
          title: 'Create follow-up task',
          message: _unsupportedActionMessage(
            data['createTask'],
            fallback:
                'Follow-up task creation is not enabled in the principal app yet. Use the school operations workspace for now.',
          ),
          color: AppColors.info,
        ),
      ],
    );
  }
}

class _WalkthroughsBody extends StatelessWidget {
  const _WalkthroughsBody({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CacheBanner(data: data),
        _SummaryCards(
          values: [
            _SummaryValue(
              'Scheduled',
              _num(data, 'metrics.scheduled'),
              AppColors.info,
              Icons.assignment_rounded,
            ),
            _SummaryValue(
              'Completed',
              _num(data, 'metrics.completed'),
              AppColors.success,
              Icons.check_circle_rounded,
            ),
            _SummaryValue(
              'Follow-up',
              _num(data, 'metrics.followUp'),
              AppColors.warning,
              Icons.schedule_rounded,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const SectionHeader(title: "Today's Walkthroughs"),
        const SizedBox(height: AppSpacing.sm),
        _ItemList(items: _list(data['todaysWalkthroughs'])),
        if (_list(data['recentObservations']).isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          const SectionHeader(title: 'Recent Observations'),
          const SizedBox(height: AppSpacing.sm),
          _ItemList(items: _list(data['recentObservations'])),
        ],
        const SizedBox(height: AppSpacing.md),
        _Callout(
          icon: Icons.add_rounded,
          title: 'New observation',
          message: _unsupportedActionMessage(
            data['newObservation'],
            fallback:
                'Walkthrough observation capture is not enabled in the principal app yet. Scheduled visits are shown read-only.',
          ),
          color: AppColors.info,
        ),
        const SizedBox(height: AppSpacing.md),
        _Callout(
          icon: Icons.assignment_late_rounded,
          title: 'Walkthrough follow-up',
          message: _unsupportedActionMessage(
            data['followUpCapture'],
            fallback:
                'Walkthrough follow-up capture is not enabled in the principal app yet. Follow-up status remains read-only here.',
          ),
          color: AppColors.warning,
        ),
      ],
    );
  }
}

class _MetricSection extends StatelessWidget {
  const _MetricSection({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final metrics = data['metrics'] is Map<String, dynamic>
        ? data['metrics'] as Map<String, dynamic>
        : <String, dynamic>{};
    final entries = metrics.entries.take(4).toList();
    return _SummaryCards(
      values: [
        for (final entry in entries)
          _SummaryValue(
            _label(entry.key),
            entry.value,
            _toneForIndex(entries.indexOf(entry)),
            _iconFor(entry.key),
          ),
      ],
    );
  }
}

List<_SnapshotSection> _snapshotSections(
  String key,
  Map<String, dynamic> data,
) {
  return switch (key) {
    'attendance' => [
      _SnapshotSection('Class Risk', _list(data['classRisk'])),
      _SnapshotSection('Student Follow-up', _list(data['studentFollowUps'])),
    ],
    'staff' => [
      _SnapshotSection('Staff Absence', _list(data['absenceItems'])),
      _SnapshotSection('Coverage', _list(data['coverageItems'])),
    ],
    'fees' => [
      _SnapshotSection('Watchlist', _list(data['watchlist'])),
      _SnapshotSection(
        'Collection Trend',
        _list(data['collectionTrend'])
            .map(
              (item) => {
                'id': item['label'],
                'title': item['label'],
                'detail': item['amount'].toString(),
              },
            )
            .toList(),
      ),
    ],
    'academics' => [
      _SnapshotSection(
        'Marks Entry Status',
        _list(data['marksEntryStatus'])
            .map(
              (item) => {
                'id': item['id'],
                'title': item['title'],
                'detail': '${item['percent']}%',
                'status': item['status'],
              },
            )
            .toList(),
      ),
      _SnapshotSection(
        'Report Card Readiness',
        _list(data['reportCardReadiness']),
      ),
    ],
    'transport' => [
      _SnapshotSection('Route Status', _list(data['routes'])),
      _SnapshotSection('Driver Contacts', _list(data['driverContacts'])),
    ],
    'escalations' => [_SnapshotSection('Open Cases', _list(data['items']))],
    _ => [_SnapshotSection('Items', _list(data['items']))],
  };
}

class _SnapshotSection {
  const _SnapshotSection(this.title, this.items);
  final String title;
  final List<Map<String, dynamic>> items;
}

class _PrincipalHeader extends StatelessWidget {
  const _PrincipalHeader({
    required this.schoolName,
    required this.showBack,
    required this.onBack,
  });

  final String schoolName;
  final bool showBack;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 18, 20, 20),
      decoration: const BoxDecoration(
        color: AppColors.infoDark,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: Colors.white.withValues(alpha: 0.16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
            ),
            child: const Icon(
              Icons.account_balance_rounded,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  schoolName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'Principal',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Notifications',
            color: Colors.white,
            onPressed: () => context.go(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded, size: 30),
          ),
          IconButton(
            color: Colors.white,
            onPressed: () => context.go(AppRoutes.profile),
            icon: const Icon(Icons.account_circle_rounded, size: 34),
          ),
        ],
      ),
    );
  }
}

class _PrincipalBottomNav extends StatelessWidget {
  const _PrincipalBottomNav({required this.selectedIndex});
  final int selectedIndex;

  @override
  Widget build(BuildContext context) {
    const destinations = [
      (
        Icons.home_outlined,
        Icons.home_rounded,
        'Today',
        AppRoutes.principalToday,
      ),
      (
        Icons.warning_amber_rounded,
        Icons.warning_rounded,
        'Attention',
        AppRoutes.principalAttention,
      ),
      (
        Icons.assignment_outlined,
        Icons.assignment_rounded,
        'Approvals',
        AppRoutes.principalApprovals,
      ),
      (
        Icons.campaign_outlined,
        Icons.campaign_rounded,
        'Notices',
        AppRoutes.principalNotices,
      ),
      (
        Icons.grid_view_outlined,
        Icons.grid_view_rounded,
        'More',
        AppRoutes.principalMore,
      ),
    ];
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          boxShadow: [
            BoxShadow(
              color: AppColors.slate300.withValues(alpha: 0.45),
              blurRadius: 18,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: NavigationBarTheme(
          data: const NavigationBarThemeData(
            labelTextStyle: WidgetStatePropertyAll(
              TextStyle(
                fontSize: 10,
                letterSpacing: -0.35,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          child: NavigationBar(
            height: 70,
            elevation: 0,
            selectedIndex: selectedIndex,
            backgroundColor: Colors.transparent,
            indicatorColor: AppColors.infoLight,
            onDestinationSelected: (index) =>
                context.go(destinations[index].$4),
            destinations: [
              for (var index = 0; index < destinations.length; index += 1)
                NavigationDestination(
                  icon: Icon(destinations[index].$1),
                  selectedIcon: Icon(
                    destinations[index].$2,
                    color: AppColors.infoDark,
                  ),
                  label: destinations[index].$3,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.detail,
    required this.icon,
    required this.color,
    this.locked = false,
    this.onTap,
  });

  final String title;
  final String value;
  final String detail;
  final IconData icon;
  final Color color;
  final bool locked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: locked ? null : onTap,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final horizontal = constraints.maxWidth > 240;
          final details = Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: horizontal
                ? CrossAxisAlignment.start
                : CrossAxisAlignment.center,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: horizontal ? TextAlign.left : TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                locked ? 'Locked' : value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: horizontal ? TextAlign.left : TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: locked ? AppColors.slate500 : color,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                locked ? 'Module not enabled' : detail,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: horizontal ? TextAlign.left : TextAlign.center,
                style: const TextStyle(
                  color: AppColors.slate500,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          );
          final iconBubble = _IconBubble(
            icon: icon,
            color: locked ? AppColors.slate400 : color,
          );
          if (horizontal) {
            return Row(
              children: [
                iconBubble,
                const SizedBox(width: AppSpacing.md),
                Expanded(child: details),
                if (!locked)
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.slate400,
                  ),
              ],
            );
          }
          return Column(
            children: [
              Align(alignment: Alignment.centerLeft, child: iconBubble),
              const Spacer(),
              details,
            ],
          );
        },
      ),
    );
  }
}

class _SummaryCards extends StatelessWidget {
  const _SummaryCards({required this.values});
  final List<_SummaryValue> values;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth < 340
            ? 1
            : constraints.maxWidth < 720
            ? 2
            : values.length.clamp(1, 3);
        const spacing = AppSpacing.md;
        final itemWidth =
            (constraints.maxWidth - spacing * (crossAxisCount - 1)) /
            crossAxisCount;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: values
              .map(
                (value) => SizedBox(
                  width: itemWidth,
                  child: AppCard(
                    child: Row(
                      children: [
                        _IconBubble(icon: value.icon, color: value.color),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                value.label,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.slate700,
                                ),
                              ),
                              Text(
                                '${value.value}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.headlineSmall
                                    ?.copyWith(
                                      color: value.color,
                                      fontWeight: FontWeight.w900,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _ItemList extends StatelessWidget {
  const _ItemList({
    required this.items,
    this.compact = false,
    this.actionBuilder,
  });

  final List<Map<String, dynamic>> items;
  final bool compact;
  final Widget Function(Map<String, dynamic> item)? actionBuilder;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppAccessState(
        title: 'Nothing needs action here',
        message: 'There are no items to review right now.',
        icon: Icons.check_circle_outline_rounded,
      );
    }
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final item in items)
            Column(
              children: [
                ListTile(
                  minVerticalPadding: compact ? 10 : 16,
                  leading: _IconBubble(
                    icon: _iconFor(
                      _string(item['type'], fallback: _string(item['id'])),
                    ),
                    color: _severityColor(
                      _string(
                        item['severity'],
                        fallback: _string(item['status']),
                      ),
                    ),
                  ),
                  title: Text(
                    _string(item['title'], fallback: _string(item['label'])),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate950,
                    ),
                  ),
                  subtitle: _itemSubtitle(item).isEmpty
                      ? null
                      : Text(_itemSubtitle(item)),
                  trailing:
                      actionBuilder?.call(item) ??
                      (_string(item['status']).isNotEmpty
                          ? StatusChip(
                              status: _statusType(_string(item['status'])),
                              label: _string(item['status']),
                            )
                          : null),
                ),
                if (item != items.last) const Divider(height: 1),
              ],
            ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          _IconBubble(icon: icon, color: AppColors.info),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate950,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(color: AppColors.slate500),
                  ),
              ],
            ),
          ),
          if (trailing != null)
            StatusChip(status: AppStatusType.pending, label: trailing),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.title, required this.items});
  final String title;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    final visible = items.where((item) => item.enabled).toList();
    if (visible.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final item in visible)
                  Column(
                    children: [
                      Material(
                        color: Colors.transparent,
                        child: ListTile(
                          leading: _IconBubble(
                            icon: item.icon,
                            color: item.color,
                          ),
                          title: Text(
                            item.title,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => context.go(item.route),
                        ),
                      ),
                      if (item != visible.last) const Divider(height: 1),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem(
    this.title,
    this.icon,
    this.color,
    this.route, {
    this.enabled = true,
  });
  final String title;
  final IconData icon;
  final Color color;
  final String route;
  final bool enabled;
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.title,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: enabled ? onTap : null,
      child: Row(
        children: [
          _IconBubble(
            icon: icon,
            color: enabled ? AppColors.info : AppColors.slate400,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          Icon(
            Icons.arrow_forward_rounded,
            color: enabled ? AppColors.info : AppColors.slate400,
          ),
        ],
      ),
    );
  }
}

class _IconBubble extends StatelessWidget {
  const _IconBubble({required this.icon, required this.color});
  final IconData icon;
  final Color color;
  static const double size = 50;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color),
    );
  }
}

class _SegmentedFilters extends StatelessWidget {
  const _SegmentedFilters({
    required this.values,
    required this.active,
    required this.labels,
    required this.onChanged,
  });
  final List<String> values;
  final String active;
  final Map<String, String> labels;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          for (final value in values)
            Expanded(
              child: InkWell(
                onTap: () => onChanged(value),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(
                    color: active == value
                        ? AppColors.info
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: Text(
                    labels[value] ?? value,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: active == value
                          ? Colors.white
                          : AppColors.slate700,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Callout extends StatelessWidget {
  const _Callout({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });
  final IconData icon;
  final String title;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: color.withValues(alpha: 0.06),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: const TextStyle(color: AppColors.slate600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlainCard extends StatelessWidget {
  const _PlainCard({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _ContextCard extends StatelessWidget {
  const _ContextCard({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final school = data['school'] is Map<String, dynamic>
        ? data['school'] as Map<String, dynamic>
        : <String, dynamic>{};
    return AppCard(
      child: Row(
        children: [
          _IconBubble(
            icon: Icons.account_balance_rounded,
            color: AppColors.info,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Principal',
                  style: TextStyle(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  _string(school['name'], fallback: 'Current school'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const StatusChip(
                  status: AppStatusType.published,
                  label: 'Current context',
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.slate200),
        ),
        child: const Icon(Icons.arrow_back_rounded),
      ),
    );
  }
}

class _CacheBanner extends StatelessWidget {
  const _CacheBanner({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    if (data['_mobileFromCache'] != true) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: const OfflineBanner(visible: true),
    );
  }
}

class _PrincipalLoading extends StatelessWidget {
  const _PrincipalLoading();

  @override
  Widget build(BuildContext context) {
    return const AppLoading(message: 'Loading principal snapshot...');
  }
}

class _SummaryValue {
  const _SummaryValue(this.label, this.value, this.color, this.icon);
  final String label;
  final Object? value;
  final Color color;
  final IconData icon;
}

void _showReviewSheet(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
  String activeTab,
) {
  final parentContext = context;
  final approvalRequestId = _approvalRequestIdFromItem(item);
  final canDecide = activeTab == 'pending' && approvalRequestId.isNotEmpty;
  final reasonController = TextEditingController();
  var saving = false;
  String? validationMessage;

  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (context, setSheetState) {
        Future<void> submit(String decision) async {
          final reason = reasonController.text.trim();
          if (decision == 'REJECT' && reason.isEmpty) {
            setSheetState(
              () => validationMessage = 'A rejection reason is required.',
            );
            return;
          }
          if (decision == 'APPROVE' &&
              _string(item['severity']).toLowerCase() == 'critical' &&
              reason.isEmpty) {
            setSheetState(
              () => validationMessage =
                  'A reason is required for high-impact approvals.',
            );
            return;
          }

          setSheetState(() {
            saving = true;
            validationMessage = null;
          });
          try {
            await ref
                .read(principalRepositoryProvider)
                .decideApproval(
                  approvalRequestId: approvalRequestId,
                  decision: decision,
                  reason: reason.isEmpty ? null : reason,
                  idempotencyKey: _newUuidV4(),
                );
            ref.invalidate(principalApprovalsProvider(activeTab));
            ref.invalidate(principalApprovalsProvider('pending'));
            ref.invalidate(principalDashboardProvider);
            ref.invalidate(principalAttentionProvider('all'));
            if (sheetContext.mounted) Navigator.pop(sheetContext);
            if (!parentContext.mounted) return;
            _showPrincipalSnack(
              parentContext,
              decision == 'APPROVE'
                  ? 'Approval decision submitted.'
                  : 'Rejection submitted.',
            );
          } catch (_) {
            if (!sheetContext.mounted) return;
            setSheetState(() => saving = false);
            if (!parentContext.mounted) return;
            _showPrincipalSnack(
              parentContext,
              'Approval decision could not be submitted. Please retry.',
            );
          }
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _string(item['title']),
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _itemSubtitle(item),
                  style: const TextStyle(color: AppColors.slate600),
                ),
                if (_string(item['detail']).isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  _PlainCard(title: 'Context', body: _string(item['detail'])),
                ],
                const SizedBox(height: AppSpacing.lg),
                if (!canDecide)
                  const _Callout(
                    icon: Icons.lock_rounded,
                    title: 'Decision unavailable here',
                    message:
                        'This item is read-only on mobile because it is not backed by the principal approval-decision contract.',
                    color: AppColors.info,
                  )
                else ...[
                  TextField(
                    controller: reasonController,
                    minLines: 2,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: 'Decision reason',
                      helperText:
                          'Required for rejections and high-impact approvals.',
                      errorText: validationMessage,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      OutlinedButton.icon(
                        onPressed: saving ? null : () => submit('REJECT'),
                        icon: const Icon(Icons.close_rounded),
                        label: const Text('Reject'),
                      ),
                      FilledButton.icon(
                        onPressed: saving ? null : () => submit('APPROVE'),
                        icon: saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.check_rounded),
                        label: Text(saving ? 'Submitting...' : 'Approve'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        );
      },
    ),
  ).whenComplete(reasonController.dispose);
}

void _showEscalationSheet(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
  String activeStatus,
) {
  final parentContext = context;
  final escalationId = _string(item['id']);
  final status = _string(item['status']).toUpperCase();
  final isResolved = status == 'RESOLVED' || activeStatus == 'resolved';
  final noteController = TextEditingController();
  var saving = false;
  String? validationMessage;

  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (context, setSheetState) {
        Future<void> runAction(String action) async {
          final note = noteController.text.trim();
          if (action != 'assign' && note.isEmpty) {
            setSheetState(
              () => validationMessage = action == 'reopen'
                  ? 'A reopen reason is required.'
                  : action == 'resolve'
                  ? 'A resolution reason is required.'
                  : 'A note is required.',
            );
            return;
          }
          setSheetState(() {
            saving = true;
            validationMessage = null;
          });
          try {
            final repository = ref.read(principalRepositoryProvider);
            if (action == 'assign') {
              await repository.assignEscalationToSelf(escalationId);
            } else if (action == 'note') {
              await repository.addEscalationNote(
                escalationId: escalationId,
                note: note,
              );
            } else if (action == 'resolve') {
              await repository.resolveEscalation(
                escalationId: escalationId,
                resolutionReason: note,
              );
            } else {
              await repository.reopenEscalation(
                escalationId: escalationId,
                reason: note,
              );
            }
            for (final tab in const [
              'open',
              'assigned',
              'resolved',
              'reopened',
            ]) {
              ref.invalidate(principalEscalationsProvider(tab));
            }
            ref.invalidate(principalDashboardProvider);
            ref.invalidate(principalAttentionProvider('all'));
            ref.invalidate(principalSnapshotProvider('escalations'));
            if (sheetContext.mounted) Navigator.pop(sheetContext);
            if (!parentContext.mounted) return;
            _showPrincipalSnack(parentContext, 'Escalation action saved.');
          } catch (_) {
            if (!sheetContext.mounted) return;
            setSheetState(() => saving = false);
            if (!parentContext.mounted) return;
            _showPrincipalSnack(
              parentContext,
              'Escalation action could not be saved. Please retry.',
            );
          }
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _string(item['title'], fallback: 'Escalation'),
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _itemSubtitle(item),
                  style: const TextStyle(color: AppColors.slate600),
                ),
                const SizedBox(height: AppSpacing.md),
                _PlainCard(
                  title: 'Reason',
                  body: _string(
                    item['detail'],
                    fallback: 'No context provided.',
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: noteController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: isResolved ? 'Reopen reason' : 'Note or reason',
                    helperText: isResolved
                        ? 'Required to reopen a resolved escalation.'
                        : 'Required for notes and resolution.',
                    errorText: validationMessage,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    if (!isResolved) ...[
                      OutlinedButton.icon(
                        onPressed: saving ? null : () => runAction('assign'),
                        icon: const Icon(Icons.person_pin_circle_rounded),
                        label: const Text('Assign to me'),
                      ),
                      OutlinedButton.icon(
                        onPressed: saving ? null : () => runAction('note'),
                        icon: const Icon(Icons.edit_note_rounded),
                        label: const Text('Add note'),
                      ),
                      FilledButton.icon(
                        onPressed: saving ? null : () => runAction('resolve'),
                        icon: const Icon(Icons.check_circle_rounded),
                        label: const Text('Resolve'),
                      ),
                    ] else
                      FilledButton.icon(
                        onPressed: saving ? null : () => runAction('reopen'),
                        icon: const Icon(Icons.replay_rounded),
                        label: const Text('Reopen'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    ),
  ).whenComplete(noteController.dispose);
}

void _showEmergencyNoticeSheet(BuildContext context, WidgetRef ref) {
  final parentContext = context;
  final formKey = GlobalKey<FormState>();
  final titleController = TextEditingController();
  final bodyController = TextEditingController();
  final reasonController = TextEditingController();
  var priority = 'EMERGENCY';
  var previewing = false;
  var submitting = false;
  Map<String, dynamic>? preview;
  String? formMessage;

  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (context, setSheetState) {
        Future<bool> previewRecipients() async {
          if (formKey.currentState?.validate() != true) return false;
          setSheetState(() {
            previewing = true;
            formMessage = null;
          });
          try {
            final result = await ref
                .read(principalRepositoryProvider)
                .previewEmergencyNoticeRecipients(
                  title: titleController.text,
                  body: bodyController.text,
                  priority: priority,
                  audienceType: 'ALL',
                );
            setSheetState(() {
              preview = result;
              previewing = false;
            });
            return true;
          } catch (_) {
            setSheetState(() {
              previewing = false;
              formMessage = 'Recipient preview failed. Please retry.';
            });
            return false;
          }
        }

        Future<void> submitNotice() async {
          final reason = reasonController.text.trim();
          if (priority == 'EMERGENCY' && reason.isEmpty) {
            setSheetState(
              () => formMessage = 'A reason is required for emergency notices.',
            );
            return;
          }
          final previewReady = preview != null || await previewRecipients();
          if (!previewReady) return;
          final canSubmit = preview?['canSubmit'] != false;
          if (!canSubmit) {
            setSheetState(
              () => formMessage =
                  'Backend preview says this notice cannot be submitted yet.',
            );
            return;
          }
          setSheetState(() {
            submitting = true;
            formMessage = null;
          });
          try {
            final result = await ref
                .read(principalRepositoryProvider)
                .submitEmergencyNotice(
                  title: titleController.text,
                  body: bodyController.text,
                  priority: priority,
                  audienceType: 'ALL',
                  sendMode: 'SEND_NOW',
                  idempotencyKey: _newUuidV4(),
                  reason: reason.isEmpty ? null : reason,
                );
            ref.invalidate(principalSnapshotProvider('notice'));
            ref.invalidate(principalApprovalsProvider('pending'));
            ref.invalidate(principalDashboardProvider);
            ref.invalidate(principalAttentionProvider('all'));
            if (sheetContext.mounted) Navigator.pop(sheetContext);
            if (!parentContext.mounted) return;
            _showPrincipalSnack(
              parentContext,
              'Emergency notice submitted (${_string(result['state'], fallback: 'queued')}).',
            );
          } catch (_) {
            setSheetState(() {
              submitting = false;
              formMessage =
                  'Emergency notice could not be submitted. Please retry.';
            });
          }
        }

        final previewData = preview;
        return Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Compose emergency notice',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Audience is school-wide on mobile until class/section recipient pickers are backend-confirmed.',
                    style: TextStyle(color: AppColors.slate600),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  DropdownButtonFormField<String>(
                    initialValue: priority,
                    decoration: InputDecoration(
                      labelText: 'Priority',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
                      DropdownMenuItem(
                        value: 'EMERGENCY',
                        child: Text('Emergency'),
                      ),
                    ],
                    onChanged: submitting || previewing
                        ? null
                        : (value) {
                            if (value == null) return;
                            setSheetState(() {
                              priority = value;
                              preview = null;
                            });
                          },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: titleController,
                    maxLength: 120,
                    decoration: InputDecoration(
                      labelText: 'Title',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Title is required.'
                        : null,
                    onChanged: (_) => preview = null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: bodyController,
                    minLines: 3,
                    maxLines: 5,
                    maxLength: 500,
                    decoration: InputDecoration(
                      labelText: 'Message',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Message is required.'
                        : null,
                    onChanged: (_) => preview = null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: reasonController,
                    minLines: 2,
                    maxLines: 3,
                    maxLength: 500,
                    decoration: InputDecoration(
                      labelText: 'Emergency reason',
                      helperText: 'Required when priority is Emergency.',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                  ),
                  if (formMessage != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      formMessage!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (previewData != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    _PlainCard(
                      title: 'Recipient preview',
                      body:
                          '${_num(previewData, 'recipients.eligible')} eligible of ${_num(previewData, 'recipients.total')} recipients. Estimated deliveries: ${_num(previewData, 'recipients.estimatedDeliveries')}.',
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      OutlinedButton.icon(
                        onPressed: previewing || submitting
                            ? null
                            : () => previewRecipients(),
                        icon: const Icon(Icons.groups_rounded),
                        label: Text(previewing ? 'Previewing...' : 'Preview'),
                      ),
                      FilledButton.icon(
                        onPressed: submitting || previewing
                            ? null
                            : () => submitNotice(),
                        icon: submitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.send_rounded),
                        label: Text(submitting ? 'Submitting...' : 'Submit'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  ).whenComplete(() {
    titleController.dispose();
    bodyController.dispose();
    reasonController.dispose();
  });
}

String _approvalRequestIdFromItem(Map<String, dynamic> item) {
  final route = _string(item['route']);
  if (!route.startsWith('/principal/approvals/')) return '';
  return _string(item['id']);
}

void _showPrincipalSnack(BuildContext context, String message) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

String _newUuidV4() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((value) => value.toRadixString(16).padLeft(2, '0'))
      .join();
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20),
  ].join('-');
}

void _go(BuildContext context, String route) {
  if (route.isEmpty) return;
  context.go(route);
}

List<Map<String, dynamic>> _list(Object? value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((item) => item.map((key, value) => MapEntry('$key', value)))
        .toList();
  }
  return const [];
}

String _string(Object? value, {String fallback = ''}) {
  if (value == null) return fallback;
  final string = '$value';
  return string.isEmpty ? fallback : string;
}

String _unsupportedActionMessage(Object? value, {required String fallback}) {
  if (value is Map && value['supported'] == false) return fallback;
  if (value is Map) return _string(value['message'], fallback: fallback);
  return fallback;
}

String _maskPhone(String value) {
  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 4) return '';
  final suffix = digits.substring(digits.length - 4);
  return '••••••$suffix';
}

int _num(Map<String, dynamic> data, String path) {
  Object? value = data;
  for (final part in path.split('.')) {
    if (value is Map<String, dynamic>) {
      value = value[part];
    }
  }
  if (value is int) return value;
  if (value is num) return value.toInt();
  return 0;
}

String _label(String key) {
  final spaced = key.replaceAllMapped(
    RegExp(r'([A-Z])'),
    (match) => ' ${match.group(1)}',
  );
  return spaced.substring(0, 1).toUpperCase() + spaced.substring(1);
}

String _itemSubtitle(Map<String, dynamic> item) {
  return [
    _string(item['subtitle']),
    _string(item['detail']),
    _string(item['nextAction']),
  ].where((value) => value.isNotEmpty).join('\n');
}

Color _tone(String tone) {
  return switch (tone) {
    'green' => AppColors.success,
    'orange' => AppColors.warning,
    'red' => AppColors.danger,
    'purple' => Colors.purple,
    'slate' => AppColors.slate500,
    _ => AppColors.info,
  };
}

Color _toneForIndex(int index) {
  return [
    AppColors.success,
    AppColors.warning,
    AppColors.info,
    Colors.purple,
  ][index % 4];
}

Color _severityColor(String value) {
  final clean = value.toLowerCase();
  if (clean.contains('critical') ||
      clean.contains('urgent') ||
      clean.contains('high') ||
      clean.contains('absent')) {
    return AppColors.danger;
  }
  if (clean.contains('medium') ||
      clean.contains('pending') ||
      clean.contains('late')) {
    return AppColors.warning;
  }
  if (clean.contains('complete') ||
      clean.contains('ready') ||
      clean.contains('clear')) {
    return AppColors.success;
  }
  return AppColors.info;
}

AppStatusType _statusType(String value) {
  final clean = value.toLowerCase();
  if (clean.contains('reject') ||
      clean.contains('critical') ||
      clean.contains('high') ||
      clean.contains('failed')) {
    return AppStatusType.rejected;
  }
  if (clean.contains('approved') ||
      clean.contains('ready') ||
      clean.contains('complete') ||
      clean.contains('clear')) {
    return AppStatusType.approved;
  }
  if (clean.contains('draft')) return AppStatusType.draft;
  return AppStatusType.pending;
}

IconData _iconFor(String key) {
  final clean = key.toLowerCase();
  if (clean.contains('attendance')) return Icons.groups_rounded;
  if (clean.contains('staff') || clean.contains('leave')) {
    return Icons.person_off_rounded;
  }
  if (clean.contains('approval')) return Icons.assignment_turned_in_rounded;
  if (clean.contains('fee') ||
      clean.contains('finance') ||
      clean.contains('collection')) {
    return Icons.account_balance_wallet_rounded;
  }
  if (clean.contains('transport') ||
      clean.contains('bus') ||
      clean.contains('route')) {
    return Icons.directions_bus_rounded;
  }
  if (clean.contains('notice') || clean.contains('emergency')) {
    return Icons.campaign_rounded;
  }
  if (clean.contains('academic') ||
      clean.contains('mark') ||
      clean.contains('report')) {
    return Icons.menu_book_rounded;
  }
  if (clean.contains('task')) return Icons.checklist_rounded;
  if (clean.contains('student')) return Icons.face_rounded;
  if (clean.contains('escalation')) return Icons.warning_rounded;
  if (clean.contains('walkthrough')) return Icons.directions_walk_rounded;
  return Icons.info_rounded;
}
