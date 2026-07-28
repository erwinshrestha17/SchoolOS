import 'dart:async';

import '../../../core/errors/app_exception.dart';
import '../../../shared/utils/nepali_bs_calendar.dart';
import '../../notices/data/notices_repository.dart';
import '../../notices/domain/notice_models.dart';
import '../domain/parent_models.dart';
import '../domain/parent_portal_models.dart';
import 'parent_dashboard_snapshot_store.dart';
import 'parent_repository.dart';

class ParentPortalRepository {
  ParentPortalRepository({
    required this.parentRepository,
    required this.noticesRepository,
    required this.parentName,
    required this.schoolName,
    this.snapshots,
  });

  final ParentRepository parentRepository;
  final NoticesRepository noticesRepository;
  final String parentName;
  final String schoolName;

  /// Offline store for the Today dashboard. Null when the guardian is not
  /// signed in far enough to have a private cache scope, in which case the
  /// repository behaves exactly as it did before caching existed.
  final ParentDashboardSnapshotStore? snapshots;

  /// In-flight loads, keyed by the child they were asked for.
  ///
  /// A pull-to-refresh that lands while the first load is still running used
  /// to issue a second full fan-out - up to ten more requests on a
  /// three-child account. Callers now share the first future. Keyed by child
  /// rather than global so switching child never waits on, or receives, the
  /// previous child's in-flight result.
  final Map<String, Future<ParentPortalData>> _inFlight = {};

  /// Network first; the offline snapshot only when the network genuinely
  /// cannot answer.
  Future<ParentPortalData> load({String? activeChildId}) {
    final key = activeChildId ?? '';
    final existing = _inFlight[key];
    if (existing != null) return existing;

    // The *wrapped* future is what gets shared, so a second caller receives
    // the identical object rather than a sibling that merely resolves to the
    // same value - otherwise the entry is cleared before it is ever reused.
    late final Future<ParentPortalData> request;
    request = _load(activeChildId: activeChildId).whenComplete(() {
      // Only clear our own entry: a newer request for the same child may
      // already have replaced it.
      if (identical(_inFlight[key], request)) {
        _inFlight.remove(key);
      }
    });
    _inFlight[key] = request;
    return request;
  }

  Future<ParentPortalData> _load({String? activeChildId}) async {
    final List<GuardianChild> children;
    try {
      children = await parentRepository.getGuardianChildren();
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      // The linked-children list has its own six-hour cache, shorter than the
      // twelve-hour snapshot window, so it can lapse while a usable snapshot
      // survives. A snapshot is only reachable by child id, and the only id
      // that can be trusted here is one the caller named explicitly - the
      // child the guardian last selected. Nothing is guessed: with no
      // explicit id there is no fallback, because "probably the first child"
      // is exactly the assumption that shows a sibling's dashboard.
      final snapshot = activeChildId == null
          ? null
          : await snapshots?.load(childId: activeChildId);
      if (snapshot == null) rethrow;
      return snapshot.data;
    }
    final resolvedActiveChildId =
        children.any((child) => child.id == activeChildId)
        ? activeChildId
        : children.isEmpty
        ? null
        : children.first.id;

    // The authoritative list of who this guardian may see. Anything cached
    // for a child no longer on it is dropped now rather than left to expire.
    await snapshots?.pruneUnlinked(children.map((child) => child.id));
    // Each child needs a dashboard, a profile and (when homework is unlocked)
    // an assignment list. Running those per child in sequence made a guardian
    // with three children wait on ten round trips before Today painted, which
    // is painful on the low-bandwidth connections this app targets. Fetch the
    // independent calls together instead and keep the school-wide notification
    // fetch in flight alongside them. Results are still assembled in the
    // original child order, and the first failure still fails the whole load.
    // `Future.wait` is left in its default non-eager mode throughout so every
    // branch keeps an error handler attached: an early failure in one call
    // must not turn a sibling's failure into an unhandled async error.
    final List<Object> results;
    try {
      results = await Future.wait<Object>([
        Future.wait(children.map(_loadChildBundle)),
        noticesRepository.getNotificationCenter(limit: 30),
      ]);
    } on AppException catch (error) {
      // Only a connectivity failure is worth answering from disk. A 401, a
      // 403 or a locked module is a real answer from the server and must not
      // be papered over with yesterday's dashboard.
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final snapshot = resolvedActiveChildId == null
          ? null
          : await snapshots?.load(childId: resolvedActiveChildId);
      if (snapshot == null) rethrow;
      return snapshot.data;
    }
    final childBundles = results[0] as List<_ParentChildBundle>;
    final notifications = results[1] as ParentNotificationPage;

    final dashboards = <String, ParentDashboardSummary>{
      for (final bundle in childBundles) bundle.child.id: bundle.dashboard,
    };
    final profiles = <String, ChildProfile?>{
      for (final bundle in childBundles) bundle.child.id: bundle.profile,
    };
    final homework = <ParentPortalHomework>[
      for (final bundle in childBundles)
        for (final item in bundle.homework)
          _homeworkFromApi(bundle.child, item),
    ];

    final dashboardValues = dashboards.values;
    final fromCache = dashboardValues.any((dashboard) => dashboard.fromCache);
    final lastUpdated = dashboardValues.isEmpty
        ? DateTime.now()
        : dashboardValues
              .map((dashboard) => dashboard.lastUpdated)
              .reduce((a, b) => a.isBefore(b) ? a : b);

    final data = ParentPortalData(
      parentName: parentName,
      schoolName: schoolName,
      lastUpdated: lastUpdated,
      fromCache: fromCache,
      activeChildId: resolvedActiveChildId,
      children: [
        for (final child in children)
          _childFromApi(child, dashboards[child.id], profiles[child.id]),
      ],
      homework: homework,
      updates: [
        for (final item in notifications.items) _updateFromApi(item, children),
      ],
      unreadUpdates: notifications.unreadCount,
    );

    // Persist only what the network actually served. Re-saving a snapshot
    // that was itself read from cache would keep refreshing its own timestamp
    // and let a stale dashboard live for ever.
    if (!fromCache) {
      await snapshots?.save(data);
    }

    return data;
  }

  Future<_ParentChildBundle> _loadChildBundle(GuardianChild child) async {
    final results = await Future.wait<Object?>([
      parentRepository.getParentDashboardSummaryForChild(child),
      child.hasCapability(GuardianCapabilityKey.academicsView)
          ? parentRepository.getChildProfileForChild(child)
          : Future<ChildProfile?>.value(),
    ]);
    final dashboard = results[0] as ParentDashboardSummary;
    final profile = results[1] as ChildProfile?;

    return _ParentChildBundle(
      child: child,
      dashboard: dashboard,
      profile: profile,
      homework: dashboard.homeworkEnabled
          ? await parentRepository.getHomeworkForChild(child.id, take: 20)
          : const <ParentHomeworkItem>[],
    );
  }

  ParentPortalChild _childFromApi(
    GuardianChild child,
    ParentDashboardSummary? dashboard,
    ChildProfile? profile,
  ) {
    return ParentPortalChild(
      id: child.id,
      name: child.name,
      classSection: child.classSection,
      teacher: profile?.classTeacher ?? 'Class teacher not assigned',
      attendance: dashboard?.attendanceEnabled == false
          ? 'Attendance module locked'
          : dashboard?.attendanceToday ?? 'No attendance summary yet',
      attendanceTime: dashboard == null
          ? 'Open attendance after school records are synced'
          : 'Updated ${_formatTime(dashboard.lastUpdated)}',
      transport: dashboard?.transportEnabled == false
          ? 'Transport module locked'
          : dashboard?.transportStatus ?? 'No transport route assigned',
      homework: dashboard?.homeworkEnabled == false
          ? 'Homework module locked'
          : _homeworkSummary(dashboard?.homeworkPending ?? 0),
      updates: _updatesSummary(dashboard?.unreadNotices ?? 0),
      homeworkPending: dashboard?.homeworkPending ?? 0,
      unreadUpdates: dashboard?.unreadNotices ?? 0,
      feesDue: dashboard?.feesDue ?? 0,
      feesStatus: dashboard?.feesStatus ?? 'DUE',
      feesPaidAmount: dashboard?.feesPaidAmount ?? 0,
      feesTotalAmount: dashboard?.feesTotalAmount ?? 0,
      nextFeeDueDate: dashboard?.nextFeeDueDate,
      transportDetail: dashboard?.transportDetail,
      latestActivity: dashboard?.latestActivity,
      latestActivityTitle: dashboard?.latestActivityTitle,
      academicYearStartsOn: child.academicYearStartsOn,
      academicYearEndsOn: child.academicYearEndsOn,
      academicYear: child.academicYear,
      capabilities: child.capabilities,
    );
  }

  ParentPortalHomework _homeworkFromApi(
    GuardianChild child,
    ParentHomeworkItem item,
  ) {
    return ParentPortalHomework(
      id: item.id,
      childId: child.id,
      childName: child.name,
      classSection: child.classSection,
      subject: item.subjectName,
      title: item.title,
      dueLabel: _dueLabel(item),
      dueAt: DateTime.tryParse(item.dueAt ?? item.dueDate ?? ''),
      rawStatus: item.submissionStatus,
      attachmentCount: item.attachmentCount,
      teacher: 'Assigned by school',
      submittedAt: DateTime.tryParse(item.submittedAt ?? ''),
      score: item.score,
      feedback: item.feedback,
    );
  }

  ParentPortalUpdate _updateFromApi(
    ParentNotification item,
    List<GuardianChild> children,
  ) {
    final child = item.childId == null
        ? null
        : children.cast<GuardianChild?>().firstWhere(
            (child) => child?.id == item.childId,
            orElse: () => null,
          );
    return ParentPortalUpdate(
      id: item.id,
      childId: item.childId,
      category: _categoryFromNotification(item.type),
      title: item.title,
      body: item.body,
      metadata: [
        item.audience.label,
        if (child != null && item.audience.childName == null) child.name,
        _formatTime(item.createdAt),
      ].join(' - '),
      audience: item.audience.label,
      createdAt: item.createdAt,
      route: item.route,
      isPinned: !item.isRead && item.type == ParentNotificationType.notice,
      isImportant: !item.isRead,
      unreadCount: item.isRead ? 0 : 1,
    );
  }
}

class _ParentChildBundle {
  const _ParentChildBundle({
    required this.child,
    required this.dashboard,
    required this.profile,
    required this.homework,
  });

  final GuardianChild child;
  final ParentDashboardSummary dashboard;
  final ChildProfile? profile;
  final List<ParentHomeworkItem> homework;
}

String _homeworkSummary(int pending) {
  if (pending <= 0) {
    return 'No pending homework';
  }
  return '$pending homework pending';
}

String _updatesSummary(int unread) {
  if (unread <= 0) {
    return 'No unread updates';
  }
  return '$unread unread update${unread == 1 ? '' : 's'}';
}

String _dueLabel(ParentHomeworkItem item) {
  final due = DateTime.tryParse(item.dueAt ?? item.dueDate ?? '');
  if (due == null) {
    return 'Due date unavailable';
  }
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final date = DateTime(due.year, due.month, due.day);
  final delta = date.difference(today).inDays;
  if (delta < 0) {
    return 'Overdue';
  }
  if (delta == 0) {
    return 'Due today';
  }
  if (delta == 1) {
    return 'Due tomorrow';
  }
  return 'Due ${due.year}-${_two(due.month)}-${_two(due.day)}';
}

ParentUpdateCategory _categoryFromNotification(ParentNotificationType type) {
  return switch (type) {
    ParentNotificationType.message => ParentUpdateCategory.message,
    ParentNotificationType.event => ParentUpdateCategory.event,
    ParentNotificationType.gallery => ParentUpdateCategory.gallery,
    _ => ParentUpdateCategory.notice,
  };
}

/// School time, in the school's timezone.
///
/// This read `value.hour` straight off the `DateTime`, which is the handset's
/// wall clock: a guardian in Doha saw their own 05:32 printed as the school's
/// sync time, and the Today header - which already went through
/// [NepaliBsCalendar] - disagreed with the attendance row directly beneath it
/// on the same screen. The repo-wide date guard in
/// `nepali_bs_calendar_test.dart` did not catch this: it scans for the `intl`
/// formatters and for local-time conversions, not for raw `.hour` arithmetic
/// on a timestamp.
String _formatTime(DateTime value) => NepaliBsCalendar.formatNepalTime(value);

String _two(int value) => value.toString().padLeft(2, '0');
