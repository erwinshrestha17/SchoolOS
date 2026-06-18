enum ParentUpdateCategory { notice, message, event, gallery }

class ParentPortalChild {
  const ParentPortalChild({
    required this.id,
    required this.name,
    required this.classSection,
    required this.teacher,
    required this.attendance,
    required this.attendanceTime,
    required this.transport,
    required this.homework,
    required this.updates,
    this.homeworkPending = 0,
    this.unreadUpdates = 0,
    this.feesDue = 0,
    this.transportDetail,
  });

  final String id;
  final String name;
  final String classSection;
  final String teacher;
  final String attendance;
  final String attendanceTime;
  final String transport;
  final String homework;
  final String updates;
  final int homeworkPending;
  final int unreadUpdates;
  final num feesDue;
  final String? transportDetail;
}

class ParentPortalHomework {
  const ParentPortalHomework({
    required this.id,
    required this.childId,
    required this.childName,
    required this.classSection,
    required this.subject,
    required this.title,
    required this.dueLabel,
    required this.status,
    required this.attachmentCount,
    required this.teacher,
  });

  final String id;
  final String childId;
  final String childName;
  final String classSection;
  final String subject;
  final String title;
  final String dueLabel;
  final String status;
  final int attachmentCount;
  final String teacher;

  bool get isCompleted => status == 'Completed';
  bool get isDueSoon => dueLabel.contains('tomorrow');
}

class ParentPortalUpdate {
  const ParentPortalUpdate({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.metadata,
    this.isPinned = false,
    this.isImportant = false,
    this.unreadCount = 0,
    this.route,
  });

  final String id;
  final ParentUpdateCategory category;
  final String title;
  final String body;
  final String metadata;
  final bool isPinned;
  final bool isImportant;
  final int unreadCount;
  final String? route;
}

class ParentPortalData {
  const ParentPortalData({
    required this.parentName,
    required this.schoolName,
    required this.lastUpdated,
    required this.children,
    required this.homework,
    required this.updates,
    this.totalFeesDue = 0,
    this.overdueFeesCount = 0,
    this.unreadUpdates = 0,
  });

  final String parentName;
  final String schoolName;
  final String lastUpdated;
  final List<ParentPortalChild> children;
  final List<ParentPortalHomework> homework;
  final List<ParentPortalUpdate> updates;
  final num totalFeesDue;
  final int overdueFeesCount;
  final int unreadUpdates;

  int get presentTodayCount {
    return children.where((child) {
      return child.attendance.toLowerCase().contains('present');
    }).length;
  }

  int get pendingHomeworkCount {
    return homework.where((item) => !item.isCompleted).length;
  }
}
