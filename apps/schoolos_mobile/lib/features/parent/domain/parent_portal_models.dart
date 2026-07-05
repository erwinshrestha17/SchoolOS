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
    this.feesStatus = 'DUE',
    this.feesPaidAmount = 0,
    this.feesTotalAmount = 0,
    this.nextFeeDueDate,
    this.transportDetail,
    this.latestActivity,
    this.latestActivityTitle,
    this.academicYearStartsOn,
    this.academicYearEndsOn,
    this.academicYear = '',
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
  final String feesStatus;
  final num feesPaidAmount;
  final num feesTotalAmount;
  final String? nextFeeDueDate;
  final String? transportDetail;
  final String? latestActivity;
  final String? latestActivityTitle;
  final String? academicYearStartsOn;
  final String? academicYearEndsOn;
  final String academicYear;

  bool get hasFeesDue => feesDue > 0;
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
    this.dueAt,
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
  final DateTime? dueAt;
  final String status;
  final int attachmentCount;
  final String teacher;

  bool get isCompleted => status == 'Completed';
  bool get isDueSoon => dueLabel.contains('tomorrow');
}

class ParentPortalUpdate {
  const ParentPortalUpdate({
    required this.id,
    this.childId,
    required this.category,
    required this.title,
    required this.body,
    required this.metadata,
    this.createdAt,
    this.isPinned = false,
    this.isImportant = false,
    this.unreadCount = 0,
    this.route,
    this.audience = 'Whole school',
  });

  final String id;
  final String? childId;
  final ParentUpdateCategory category;
  final String title;
  final String body;
  final String metadata;
  final DateTime? createdAt;
  final bool isPinned;
  final bool isImportant;
  final int unreadCount;
  final String? route;
  final String audience;
}

class ParentPortalData {
  const ParentPortalData({
    required this.parentName,
    required this.schoolName,
    required this.lastUpdated,
    this.fromCache = false,
    this.activeChildId,
    required this.children,
    required this.homework,
    required this.updates,
    this.totalFeesDue = 0,
    this.overdueFeesCount = 0,
    this.unreadUpdates = 0,
  });

  final String parentName;
  final String schoolName;
  final DateTime lastUpdated;
  final bool fromCache;
  final String? activeChildId;
  final List<ParentPortalChild> children;
  final List<ParentPortalHomework> homework;
  final List<ParentPortalUpdate> updates;
  final num totalFeesDue;
  final int overdueFeesCount;
  final int unreadUpdates;

  ParentPortalChild? get activeChild {
    if (children.isEmpty) return null;
    return children.firstWhere(
      (child) => child.id == activeChildId,
      orElse: () => children.first,
    );
  }
}
