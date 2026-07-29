import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../core/storage/app_preferences_service.dart';
import '../../../../shared/utils/money_format.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_models.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalChildDetailScreen extends ConsumerWidget {
  const ParentPortalChildDetailScreen({super.key, required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'Child profile',
      selectedIndex: 1,
      body: portal.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (data) {
          if (data.children.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.child_care_rounded,
              title: 'No linked children',
              message:
                  'Ask the school office to link this parent account to a child record.',
            );
          }
          // A deep link naming a child this guardian is not linked to - a
          // stale push payload, or a child since unlinked - must say so.
          // Quietly showing the first linked child instead would present one
          // child's record under another child's route.
          final matches = data.children.where((item) => item.id == childId);
          if (matches.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.child_care_rounded,
              title: 'Child not available',
              message:
                  'This child is not linked to your account, or the link has been removed. Open Children to see who you can view.',
            );
          }
          final portalChild = matches.first;
          final attendance = _attendanceStatus(portalChild);
          final recentActivity =
              data.updates
                  .where(
                    (item) =>
                        item.childId == null || item.childId == portalChild.id,
                  )
                  .toList()
                ..sort((left, right) {
                  final leftAt = left.createdAt;
                  final rightAt = right.createdAt;
                  if (leftAt == null && rightAt == null) return 0;
                  if (leftAt == null) return 1;
                  if (rightAt == null) return -1;
                  return rightAt.compareTo(leftAt);
                });
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 112),
            children: [
              _ChildIdentityCard(
                child: portalChild,
                schoolName: data.schoolName,
                children: data.children,
                onSelectChild: (selectedChildId) =>
                    _selectChild(context, ref, selectedChildId),
              ),
              if (attendance.showAlert) ...[
                const SizedBox(height: 16),
                _AttendanceAlert(
                  status: attendance,
                  onView: portalChild.canViewAttendance
                      ? () => context.push(
                          AppRoutes.parentChildAttendanceDetail(portalChild.id),
                        )
                      : null,
                ),
              ],
              const SizedBox(height: 24),
              const ParentSectionHeader(title: 'Today summary'),
              const SizedBox(height: 12),
              PortalCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _StatusSummaryRow(
                      icon: attendance.icon,
                      title: attendance.title,
                      subtitle: attendance.supportingText,
                      color: attendance.color,
                      onTap: portalChild.canViewAttendance
                          ? () => context.push(
                              AppRoutes.parentChildAttendanceDetail(
                                portalChild.id,
                              ),
                            )
                          : null,
                    ),
                    const Divider(height: 1),
                    _StatusSummaryRow(
                      icon: Icons.assignment_outlined,
                      title: portalChild.homework,
                      subtitle:
                          portalChild.homeworkDetail ??
                          'Open Homework for assignment details',
                      color: portalChild.homeworkPending > 0
                          ? ParentPortalColors.purple
                          : ParentPortalColors.green,
                      onTap:
                          portalChild.homeworkEnabled &&
                              portalChild.canViewAcademics
                          ? () => context.go(
                              Uri(
                                path: AppRoutes.parentHomework,
                                queryParameters: {'child': portalChild.id},
                              ).toString(),
                            )
                          : null,
                    ),
                    if (portalChild.transportAssigned &&
                        portalChild.transportEnabled) ...[
                      const Divider(height: 1),
                      _StatusSummaryRow(
                        icon: Icons.directions_bus_rounded,
                        title: _transportTitle(portalChild),
                        subtitle: _transportSupportingText(portalChild),
                        color: ParentPortalColors.orange,
                        onTap: () => _openChildRoute(
                          context,
                          ref,
                          portalChild.id,
                          AppRoutes.parentTransport,
                        ),
                      ),
                    ],
                    const Divider(height: 1),
                    _StatusSummaryRow(
                      icon: Icons.credit_card_rounded,
                      title: _feeTitle(portalChild),
                      subtitle: _feeSupportingText(portalChild),
                      color: _feeColor(portalChild),
                      onTap: portalChild.feesEnabled && portalChild.canViewFees
                          ? () => _openChildRoute(
                              context,
                              ref,
                              portalChild.id,
                              AppRoutes.parentFees,
                            )
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const ParentSectionHeader(title: 'Child actions'),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  const spacing = 10.0;
                  final itemWidth = (constraints.maxWidth - spacing) / 2;
                  return Wrap(
                    spacing: spacing,
                    runSpacing: spacing,
                    children: [
                      SizedBox(
                        width: itemWidth,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 112),
                          child: ActionTile(
                            icon: Icons.assessment_outlined,
                            label: 'Results',
                            color: ParentPortalColors.purple,
                            onTap: () => _openAvailableRoute(
                              context,
                              ref,
                              child: portalChild,
                              route: AppRoutes.parentReportCards,
                              available: portalChild.canViewAcademics,
                              unavailableMessage:
                                  'Results are not included in your access for this child.',
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: itemWidth,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 112),
                          child: ActionTile(
                            icon: Icons.credit_card_rounded,
                            label: 'Fees',
                            color: ParentPortalColors.green,
                            onTap: () => _openAvailableRoute(
                              context,
                              ref,
                              child: portalChild,
                              route: AppRoutes.parentFees,
                              available:
                                  portalChild.feesEnabled &&
                                  portalChild.canViewFees,
                              unavailableMessage:
                                  'Fee information is not included in your access for this child.',
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: itemWidth,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 112),
                          child: ActionTile(
                            icon: Icons.calendar_month_outlined,
                            label: 'Timetable',
                            color: ParentPortalColors.blue,
                            onTap: () => _openAvailableRoute(
                              context,
                              ref,
                              child: portalChild,
                              route: AppRoutes.parentTimetable,
                              available: portalChild.canViewAcademics,
                              unavailableMessage:
                                  'Timetable is not included in your access for this child.',
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: itemWidth,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 112),
                          child: ActionTile(
                            icon: Icons.support_agent_outlined,
                            label: 'Help & requests',
                            color: ParentPortalColors.orange,
                            onTap: () => _openAvailableRoute(
                              context,
                              ref,
                              child: portalChild,
                              route: AppRoutes.parentServiceRequests,
                              available: portalChild.hasCapability(
                                GuardianCapabilityKey
                                    .complaintOrCorrectionSubmit,
                              ),
                              unavailableMessage:
                                  'School requests are not included in your access for this child.',
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 24),
              const ParentSectionHeader(title: 'School details'),
              const SizedBox(height: 12),
              PortalCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _infoRow(
                      Icons.person_rounded,
                      portalChild.teacher,
                      'Class teacher · ${portalChild.classSection}',
                      ParentPortalColors.purple,
                    ),
                    const Divider(height: 1),
                    _infoRow(
                      Icons.door_front_door_rounded,
                      portalChild.classSection,
                      'Class and section',
                      ParentPortalColors.green,
                    ),
                    if (portalChild.rollNumber.trim().isNotEmpty) ...[
                      const Divider(height: 1),
                      _infoRow(
                        Icons.badge_outlined,
                        'Roll ${portalChild.rollNumber}',
                        'School roll number',
                        ParentPortalColors.blue,
                      ),
                    ],
                    if (portalChild.academicYear.trim().isNotEmpty) ...[
                      const Divider(height: 1),
                      _infoRow(
                        Icons.event_note_outlined,
                        portalChild.academicYear,
                        'Academic year',
                        ParentPortalColors.orange,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ParentSectionHeader(
                title: 'Recent activity',
                trailing: TextButton(
                  onPressed: () => context.push(AppRoutes.parentUpdates),
                  child: const Text('View all'),
                ),
              ),
              Text(
                'Last synced at ${NepaliBsCalendar.formatNepalTime(data.lastUpdated)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
                ),
              ),
              const SizedBox(height: 10),
              _RecentActivitySection(items: recentActivity.take(4).toList()),
              const SizedBox(height: 24),
              const ParentSectionHeader(title: 'Documents'),
              const SizedBox(height: 10),
              _DocumentsSection(childId: portalChild.id),
            ],
          );
        },
      ),
    );
  }

  Future<void> _selectChild(
    BuildContext context,
    WidgetRef ref,
    String selectedChildId,
  ) async {
    if (selectedChildId == childId) return;
    ref.read(parentActiveChildIdProvider.notifier).state = selectedChildId;
    await ref
        .read(appPreferencesServiceProvider)
        .saveSelectedChildId(selectedChildId);
    if (!context.mounted) return;
    context.pushReplacement(AppRoutes.parentChildDetail(selectedChildId));
  }

  Future<void> _openChildRoute(
    BuildContext context,
    WidgetRef ref,
    String selectedChildId,
    String route,
  ) async {
    ref.read(parentActiveChildIdProvider.notifier).state = selectedChildId;
    await ref
        .read(appPreferencesServiceProvider)
        .saveSelectedChildId(selectedChildId);
    if (context.mounted) context.push(route);
  }

  void _openAvailableRoute(
    BuildContext context,
    WidgetRef ref, {
    required ParentPortalChild child,
    required String route,
    required bool available,
    required String unavailableMessage,
  }) {
    if (!available) {
      showUnavailableWorkflowSnack(context, unavailableMessage);
      return;
    }
    _openChildRoute(context, ref, child.id, route);
  }

  Widget _infoRow(IconData icon, String title, String subtitle, Color color) =>
      ListTile(
        leading: FeatureIcon(icon, color: color, size: 42),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
      );
}

class _ChildIdentityCard extends StatelessWidget {
  const _ChildIdentityCard({
    required this.child,
    required this.schoolName,
    required this.children,
    required this.onSelectChild,
  });

  final ParentPortalChild child;
  final String schoolName;
  final List<ParentPortalChild> children;
  final ValueChanged<String> onSelectChild;

  @override
  Widget build(BuildContext context) {
    final details = <String>[
      child.classSection,
      if (child.rollNumber.trim().isNotEmpty) 'Roll ${child.rollNumber}',
    ].where((part) => part.trim().isNotEmpty).join(' · ');
    return PortalCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AvatarInitials(name: child.name, radius: 32),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        child.name,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: ParentPortalColors.navy,
                        ),
                      ),
                    ),
                    if (children.length > 1)
                      PopupMenuButton<String>(
                        tooltip: 'Switch child',
                        icon: const Icon(Icons.keyboard_arrow_down_rounded),
                        onSelected: onSelectChild,
                        itemBuilder: (_) => [
                          for (final item in children)
                            PopupMenuItem(
                              value: item.id,
                              child: Text(
                                '${item.name} · ${item.classSection}',
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
                if (details.isNotEmpty)
                  Text(
                    details,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                if (schoolName.trim().isNotEmpty &&
                    schoolName != 'Your school') ...[
                  const SizedBox(height: 4),
                  Text(
                    schoolName,
                    style: const TextStyle(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (child.academicYear.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Academic Year ${child.academicYear}',
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceStatus {
  const _AttendanceStatus({
    required this.title,
    required this.supportingText,
    required this.icon,
    required this.color,
    this.showAlert = false,
  });

  final String title;
  final String supportingText;
  final IconData icon;
  final Color color;
  final bool showAlert;
}

_AttendanceStatus _attendanceStatus(ParentPortalChild child) {
  final value = child.attendance.trim().toLowerCase();
  if (!child.attendanceEnabled ||
      value.contains('locked') ||
      value.contains('unavailable')) {
    return const _AttendanceStatus(
      title: 'Attendance unavailable',
      supportingText: 'Attendance is not available for this child right now',
      icon: Icons.info_outline_rounded,
      color: ParentPortalColors.muted,
    );
  }
  if (value.contains('not marked') ||
      value.contains('not recorded') ||
      value.contains('no record')) {
    return const _AttendanceStatus(
      title: 'Attendance pending',
      supportingText: 'The school has not recorded attendance yet',
      icon: Icons.schedule_rounded,
      color: ParentPortalColors.blue,
      showAlert: true,
    );
  }
  if (value.contains('absent')) {
    return _AttendanceStatus(
      title: child.attendance,
      supportingText: 'Recorded by the school',
      icon: Icons.event_busy_rounded,
      color: ParentPortalColors.red,
      showAlert: true,
    );
  }
  if (value.contains('late') || value.contains('half day')) {
    return _AttendanceStatus(
      title: child.attendance,
      supportingText: 'Recorded by the school',
      icon: Icons.schedule_rounded,
      color: ParentPortalColors.orange,
      showAlert: true,
    );
  }
  if (value.contains('present')) {
    return _AttendanceStatus(
      title: child.attendance,
      supportingText: 'Recorded by the school',
      icon: Icons.check_rounded,
      color: ParentPortalColors.green,
    );
  }
  return _AttendanceStatus(
    title: child.attendance.trim().isEmpty
        ? 'Attendance not available'
        : child.attendance,
    supportingText: 'Attendance status from the school',
    icon: Icons.info_outline_rounded,
    color: ParentPortalColors.blue,
  );
}

class _AttendanceAlert extends StatelessWidget {
  const _AttendanceAlert({required this.status, this.onView});

  final _AttendanceStatus status;
  final VoidCallback? onView;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      color: status.color.withValues(alpha: .08),
      borderColor: status.color.withValues(alpha: .22),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeatureIcon(status.icon, color: status.color, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  status.supportingText,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: ParentPortalColors.muted,
                  ),
                ),
                if (onView != null) ...[
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: onView,
                    child: const Text('View attendance'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusSummaryRow extends StatelessWidget {
  const _StatusSummaryRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      label: '$title. $subtitle',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 76),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                FeatureIcon(icon, color: color, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: ParentPortalColors.navy,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ParentPortalColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (onTap != null) const ListChevron(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _transportTitle(ParentPortalChild child) {
  if (child.transportHasActiveTrip) {
    if (child.transportLatestLocationAt == null ||
        child.transportLocationConfidence == 'stale' ||
        child.transportLocationConfidence == 'delayed') {
      return 'Live bus tracking unavailable';
    }
    return child.transport;
  }
  return 'Trip has not started';
}

String _transportSupportingText(ParentPortalChild child) {
  final latestLocation = DateTime.tryParse(
    child.transportLatestLocationAt ?? '',
  );
  if (latestLocation != null) {
    return 'Last location received at '
        '${NepaliBsCalendar.formatNepalTime(latestLocation)}';
  }
  if (child.transportHasActiveTrip) {
    return 'The trip is running, but no location has been received';
  }
  return child.transportDetail?.trim().isNotEmpty == true
      ? child.transportDetail!
      : 'No school trip is active right now';
}

String _feeTitle(ParentPortalChild child) {
  if (!child.feesEnabled || !child.canViewFees) {
    return 'Fee status unavailable';
  }
  if (child.hasFeesDue) return '${formatMoney(child.feesDue)} due';
  if (child.hasNoFeeInvoices) return 'No fee invoice issued';
  return 'No fees due';
}

String _feeSupportingText(ParentPortalChild child) {
  if (!child.feesEnabled || !child.canViewFees) {
    return 'Not included in your access for this child';
  }
  final dueAt = DateTime.tryParse(child.nextFeeDueDate ?? '');
  if (child.hasFeesDue && dueAt != null) {
    return 'Due by ${NepaliBsCalendar.formatBsDate(dueAt)} BS';
  }
  if (child.hasFeesDue) return 'Open Fees for payment details';
  if (child.hasNoFeeInvoices) {
    return 'The school has not issued a fee invoice yet';
  }
  return 'All payments are up to date';
}

Color _feeColor(ParentPortalChild child) {
  if (!child.feesEnabled || !child.canViewFees) {
    return ParentPortalColors.muted;
  }
  return child.hasFeesDue
      ? ParentPortalColors.orange
      : child.hasNoFeeInvoices
      ? ParentPortalColors.blue
      : ParentPortalColors.green;
}

class _RecentActivitySection extends StatelessWidget {
  const _RecentActivitySection({required this.items});

  final List<ParentPortalUpdate> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const PortalCard(
        padding: EdgeInsets.all(16),
        child: Text(
          'No recent school activity is available for this child.',
          style: TextStyle(color: ParentPortalColors.muted),
        ),
      );
    }
    return PortalCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) const Divider(height: 1),
            _RecentActivityRow(item: items[index]),
          ],
        ],
      ),
    );
  }
}

class _RecentActivityRow extends StatelessWidget {
  const _RecentActivityRow({required this.item});

  final ParentPortalUpdate item;

  @override
  Widget build(BuildContext context) {
    final style = switch (item.category) {
      ParentUpdateCategory.notice => (
        Icons.campaign_outlined,
        ParentPortalColors.blue,
      ),
      ParentUpdateCategory.message => (
        Icons.mail_outline_rounded,
        ParentPortalColors.purple,
      ),
      ParentUpdateCategory.event => (
        Icons.event_outlined,
        ParentPortalColors.orange,
      ),
      ParentUpdateCategory.gallery => (
        Icons.photo_library_outlined,
        ParentPortalColors.green,
      ),
    };
    final timestamp = item.createdAt == null
        ? null
        : NepaliBsCalendar.formatNepalTime(item.createdAt!);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeatureIcon(style.$1, color: style.$2, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (item.body.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                ],
                if (timestamp != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    timestamp,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ParentPortalColors.muted,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentsSection extends ConsumerWidget {
  const _DocumentsSection({required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(parentChildProfileProvider(childId));

    return profile.when(
      loading: () => const PortalCard(
        padding: EdgeInsets.all(16),
        child: SizedBox(
          height: 32,
          child: Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
      error: (_, _) => const PortalCard(
        padding: EdgeInsets.all(16),
        child: Row(
          children: [
            FeatureIcon(Icons.description_outlined, size: 40),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Student documents are unavailable right now.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
          ],
        ),
      ),
      data: (childProfile) {
        if (childProfile.documents.isEmpty) {
          return const PortalCard(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                FeatureIcon(Icons.description_outlined, size: 40),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Documents · 0 files',
                        style: TextStyle(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Documents issued or verified by the school will appear here.',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }
        return PortalCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < childProfile.documents.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _DocumentRow(
                  childId: childId,
                  document: childProfile.documents[i],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _DocumentRow extends ConsumerStatefulWidget {
  const _DocumentRow({required this.childId, required this.document});
  final String childId;
  final ParentStudentDocument document;

  @override
  ConsumerState<_DocumentRow> createState() => _DocumentRowState();
}

class _DocumentRowState extends ConsumerState<_DocumentRow> {
  bool _downloading = false;

  Future<void> _download() async {
    if (_downloading) return;
    setState(() => _downloading = true);
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadStudentDocument(
            childId: widget.childId,
            document: widget.document,
          );
      if (!mounted) return;
      showFeatureSnack(context, 'Document downloaded: ${file.fileName}');
    } catch (_) {
      if (!mounted) return;
      showFeatureSnack(
        context,
        'This document is not available to download right now.',
      );
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final document = widget.document;
    return ListTile(
      leading: const FeatureIcon(Icons.description_rounded, size: 42),
      title: Text(
        document.title.isNotEmpty ? document.title : document.fileName,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(_documentSubtitle(document)),
      trailing: _downloading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : IconButton(
              tooltip: 'Download',
              icon: const Icon(Icons.download_rounded),
              onPressed: document.hasProtectedDownload ? _download : null,
            ),
    );
  }
}

String _documentSubtitle(ParentStudentDocument document) {
  final parts = <String>[
    document.kind,
    if (document.status.isNotEmpty) document.status,
  ];
  return parts.where((part) => part.isNotEmpty).join(' • ');
}

class ParentPortalHomeworkDetailScreen extends ConsumerStatefulWidget {
  const ParentPortalHomeworkDetailScreen({super.key, required this.homeworkId});
  final String homeworkId;
  @override
  ConsumerState<ParentPortalHomeworkDetailScreen> createState() =>
      _ParentPortalHomeworkDetailScreenState();
}

class _ParentPortalHomeworkDetailScreenState
    extends ConsumerState<ParentPortalHomeworkDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final data = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'Homework detail',
      selectedIndex: 3,
      body: data.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (portal) {
          if (portal.homework.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.assignment_outlined,
              title: 'No homework available',
              message:
                  'Homework details will appear here after the school publishes assignments for linked children.',
            );
          }
          // Homework deep links arrive from push payloads and can outlive the
          // assignment. Falling through to the first item would show a
          // different child's homework as though it were the one tapped.
          final matches = portal.homework.where(
            (entry) => entry.id == widget.homeworkId,
          );
          if (matches.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.assignment_outlined,
              title: 'Homework not available',
              message:
                  'This assignment is no longer published, or it belongs to a child who is not linked to your account.',
            );
          }
          final item = matches.first;
          final homeworkStatus = item.primaryStatusAt(DateTime.now());
          final homeworkStatusColor = _parentHomeworkStatusColor(
            homeworkStatus,
          );
          final attachments = ref.watch(
            parentHomeworkAttachmentsProvider((
              childId: item.childId,
              homeworkId: item.id,
            )),
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                child: Row(
                  children: [
                    AvatarInitials(name: item.childName, radius: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${item.childName} • ${item.classSection}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const FeatureIcon(Icons.menu_book_rounded),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Subject',
                                style: TextStyle(
                                  color: ParentPortalColors.muted,
                                ),
                              ),
                              Text(
                                item.subject,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: ParentPortalColors.navy,
                                ),
                              ),
                            ],
                          ),
                        ),
                        StatusBadge(
                          label: homeworkStatus.label,
                          color: homeworkStatusColor,
                          background: homeworkStatusColor.withValues(
                            alpha: .10,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 28),
                    Text(
                      'Title',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.displayTitle,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: ParentPortalColors.navy,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      homeworkStatus.label,
                      style: TextStyle(
                        color: homeworkStatusColor,
                        fontSize: 16,
                        height: 1.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Divider(height: 28),
                    _homeworkInfo(
                      Icons.event_rounded,
                      'Due',
                      item.dueAt == null
                          ? 'Due date unavailable'
                          : NepaliBsCalendar.formatBsDateTime(item.dueAt!),
                      ParentPortalColors.green,
                    ),
                    if (item.submittedAt != null) ...[
                      const SizedBox(height: 14),
                      _homeworkInfo(
                        Icons.task_alt_rounded,
                        'Submitted',
                        NepaliBsCalendar.formatBsDateTime(item.submittedAt!),
                        ParentPortalColors.blue,
                      ),
                    ],
                    if (item.scoreLabel != null) ...[
                      const SizedBox(height: 14),
                      _homeworkInfo(
                        Icons.grade_outlined,
                        'Score',
                        item.scoreLabel!,
                        ParentPortalColors.purple,
                      ),
                    ],
                    const SizedBox(height: 14),
                    _homeworkInfo(
                      Icons.person_rounded,
                      'Assigned by',
                      item.teacher,
                      ParentPortalColors.green,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Attachment',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 8),
                    _HomeworkAttachmentList(
                      childId: item.childId,
                      homeworkId: item.id,
                      count: item.attachmentCount,
                      attachments: attachments,
                    ),
                    if (item.hasFeedback) ...[
                      const Divider(height: 28),
                      Text(
                        'Teacher feedback',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: ParentPortalColors.navy,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(item.feedback!.trim()),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PortalCard(
                color: homeworkStatusColor.withValues(alpha: .09),
                child: Row(
                  children: [
                    FeatureIcon(
                      Icons.hourglass_bottom_rounded,
                      color: homeworkStatusColor,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Status',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                          Text(
                            homeworkStatus.label,
                            style: TextStyle(
                              color: homeworkStatusColor,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const Text('Status is synced from school records.'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: item.attachmentCount == 0
                      ? null
                      : () => _attachmentListSheet(
                          context,
                          item.childId,
                          item.id,
                          attachments,
                        ),
                  icon: const Icon(Icons.description_rounded),
                  label: const Text('Open attachments'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton.tonalIcon(
                  onPressed: () => showUnavailableWorkflowSnack(
                    context,
                    'Homework reminders need a confirmed mobile reminder workflow.',
                  ),
                  icon: const Icon(Icons.notifications_none_rounded),
                  label: const Text('Add reminder'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _homeworkInfo(
    IconData icon,
    String label,
    String value,
    Color color,
  ) => Row(
    children: [
      FeatureIcon(icon, color: color, size: 42),
      const SizedBox(width: 12),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
        ],
      ),
    ],
  );

  Future<void> _attachmentListSheet(
    BuildContext context,
    String childId,
    String homeworkId,
    AsyncValue<List<ParentHomeworkAttachment>> attachments,
  ) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: attachments.when(
          loading: () => const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Loading attachments...'),
            ],
          ),
          error: (_, _) => const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FeatureIcon(
                Icons.file_download_off_rounded,
                color: ParentPortalColors.orange,
                size: 64,
              ),
              SizedBox(height: 14),
              Text(
                'Attachments could not be loaded',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          data: (items) => _HomeworkAttachmentSheet(
            childId: childId,
            homeworkId: homeworkId,
            attachments: items,
          ),
        ),
      ),
    ),
  );
}

Color _parentHomeworkStatusColor(ParentHomeworkPrimaryStatus status) {
  return switch (status) {
    ParentHomeworkPrimaryStatus.overdue ||
    ParentHomeworkPrimaryStatus.needsCorrection ||
    ParentHomeworkPrimaryStatus.incomplete ||
    ParentHomeworkPrimaryStatus.partiallyCompleted => ParentPortalColors.red,
    ParentHomeworkPrimaryStatus.dueSoon => ParentPortalColors.orange,
    ParentHomeworkPrimaryStatus.submittedLate ||
    ParentHomeworkPrimaryStatus.awaitingReview => ParentPortalColors.blue,
    ParentHomeworkPrimaryStatus.marked => ParentPortalColors.purple,
    ParentHomeworkPrimaryStatus.completedLate ||
    ParentHomeworkPrimaryStatus.completed ||
    ParentHomeworkPrimaryStatus.excused => ParentPortalColors.green,
    _ => ParentPortalColors.muted,
  };
}

class _HomeworkAttachmentList extends ConsumerWidget {
  const _HomeworkAttachmentList({
    required this.childId,
    required this.homeworkId,
    required this.count,
    required this.attachments,
  });

  final String childId;
  final String homeworkId;
  final int count;
  final AsyncValue<List<ParentHomeworkAttachment>> attachments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return attachments.when(
      loading: () => PortalCard(
        padding: const EdgeInsets.all(12),
        child: Text(
          count == 0 ? 'No attachments' : 'Loading $count attachment(s)...',
          style: const TextStyle(color: ParentPortalColors.muted),
        ),
      ),
      error: (_, _) => PortalCard(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const FeatureIcon(
              Icons.file_download_off_rounded,
              color: ParentPortalColors.orange,
              size: 40,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Attachments could not be loaded.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
            IconButton(
              tooltip: 'Retry loading attachments',
              onPressed: () => ref.invalidate(
                parentHomeworkAttachmentsProvider((
                  childId: childId,
                  homeworkId: homeworkId,
                )),
              ),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const PortalCard(
            padding: EdgeInsets.all(12),
            child: Text('No attachments for this homework.'),
          );
        }

        return PortalCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var index = 0; index < items.length; index++) ...[
                ListTile(
                  leading: const FeatureIcon(
                    Icons.description_rounded,
                    color: ParentPortalColors.red,
                    size: 40,
                  ),
                  title: Text(
                    items[index].fileName,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(_fileSize(items[index].sizeBytes)),
                  trailing: const Icon(Icons.download_rounded),
                  onTap: () => _downloadAttachment(
                    context,
                    ref,
                    childId,
                    homeworkId,
                    items[index],
                  ),
                ),
                if (index != items.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HomeworkAttachmentSheet extends ConsumerWidget {
  const _HomeworkAttachmentSheet({
    required this.childId,
    required this.homeworkId,
    required this.attachments,
  });

  final String childId;
  final String homeworkId;
  final List<ParentHomeworkAttachment> attachments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (attachments.isEmpty) {
      return const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FeatureIcon(Icons.description_rounded, size: 64),
          SizedBox(height: 14),
          Text(
            'No attachments',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Homework attachments',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        for (final attachment in attachments)
          ListTile(
            leading: const Icon(
              Icons.description_rounded,
              color: ParentPortalColors.red,
            ),
            title: Text(attachment.fileName),
            subtitle: Text(_fileSize(attachment.sizeBytes)),
            trailing: const Icon(Icons.download_rounded),
            onTap: () => _downloadAttachment(
              context,
              ref,
              childId,
              homeworkId,
              attachment,
            ),
          ),
      ],
    );
  }
}

Future<void> _downloadAttachment(
  BuildContext context,
  WidgetRef ref,
  String childId,
  String homeworkId,
  ParentHomeworkAttachment attachment,
) async {
  try {
    final file = await ref
        .read(parentRepositoryProvider)
        .downloadHomeworkAttachment(
          childId: childId,
          homeworkId: homeworkId,
          attachment: attachment,
        );
    if (!context.mounted) return;
    Navigator.maybePop(context);
    showFeatureSnack(context, 'Attachment downloaded: ${file.fileName}');
  } catch (_) {
    if (!context.mounted) return;
    showFeatureSnack(context, 'Attachment is not available right now.');
  }
}

String _fileSize(int bytes) {
  if (bytes <= 0) return 'File size unavailable';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).ceil()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

class _DetailUnavailable extends StatelessWidget {
  const _DetailUnavailable({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
    children: [
      PortalCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FeatureIcon(icon, color: ParentPortalColors.orange),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}
