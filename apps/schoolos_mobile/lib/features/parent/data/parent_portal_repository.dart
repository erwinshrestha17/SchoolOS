import '../../notices/data/notices_repository.dart';
import '../../notices/domain/notice_models.dart';
import '../domain/parent_models.dart';
import '../domain/parent_portal_models.dart';
import 'parent_repository.dart';

class ParentPortalRepository {
  const ParentPortalRepository({
    required this.parentRepository,
    required this.noticesRepository,
    required this.parentName,
    required this.schoolName,
  });

  final ParentRepository parentRepository;
  final NoticesRepository noticesRepository;
  final String parentName;
  final String schoolName;

  Future<ParentPortalData> load() async {
    final children = await parentRepository.getGuardianChildren();
    final dashboards = <String, ParentDashboardSummary>{};
    final homework = <ParentPortalHomework>[];

    for (final child in children) {
      final dashboard = await parentRepository
          .getParentDashboardSummaryForChild(child);
      dashboards[child.id] = dashboard;

      if (dashboard.homeworkEnabled) {
        final assignments = await parentRepository.getHomeworkForChild(
          child.id,
          take: 20,
        );
        homework.addAll(
          assignments.map((item) => _homeworkFromApi(child, item)),
        );
      }
    }

    final notifications = await noticesRepository.getNotificationCenter(
      limit: 30,
    );

    return ParentPortalData(
      parentName: parentName,
      schoolName: schoolName,
      lastUpdated: _formatTime(DateTime.now()),
      children: [
        for (final child in children)
          _childFromApi(child, dashboards[child.id]),
      ],
      homework: homework,
      updates: [
        for (final item in notifications.items) _updateFromApi(item, children),
      ],
      totalFeesDue: dashboards.values.fold<num>(
        0,
        (sum, item) => sum + item.feesDue,
      ),
      overdueFeesCount: dashboards.values.fold<int>(
        0,
        (sum, item) => sum + item.overdueFeesCount,
      ),
      unreadUpdates: notifications.unreadCount,
    );
  }

  ParentPortalChild _childFromApi(
    GuardianChild child,
    ParentDashboardSummary? dashboard,
  ) {
    return ParentPortalChild(
      id: child.id,
      name: child.name,
      classSection: child.classSection,
      teacher: 'Class teacher details in timetable',
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
      transportDetail: dashboard?.transportDetail,
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
      status: _submissionLabel(item.submissionStatus),
      attachmentCount: item.attachmentCount,
      teacher: 'Assigned by school',
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
      category: _categoryFromNotification(item.type),
      title: item.title,
      body: item.body,
      metadata: [
        if (child != null) child.name,
        _formatTime(item.createdAt),
      ].join(' - '),
      route: item.route,
      isPinned: !item.isRead && item.type == ParentNotificationType.notice,
      isImportant: !item.isRead,
      unreadCount: item.isRead ? 0 : 1,
    );
  }
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

String _submissionLabel(String value) {
  return switch (value) {
    'SUBMITTED' => 'Submitted',
    'GRADED' => 'Completed',
    'NEEDS_CORRECTION' => 'Needs correction',
    _ => 'Pending',
  };
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

String _formatTime(DateTime value) {
  final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
  final minute = _two(value.minute);
  final suffix = value.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $suffix';
}

String _two(int value) => value.toString().padLeft(2, '0');
