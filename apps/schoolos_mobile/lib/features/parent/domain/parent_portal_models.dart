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
}

class ParentPortalHomework {
  const ParentPortalHomework({
    required this.id,
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
  });

  final String id;
  final ParentUpdateCategory category;
  final String title;
  final String body;
  final String metadata;
  final bool isPinned;
  final bool isImportant;
  final int unreadCount;
}

class ParentPortalData {
  const ParentPortalData({
    required this.parentName,
    required this.schoolName,
    required this.lastUpdated,
    required this.children,
    required this.homework,
    required this.updates,
  });

  final String parentName;
  final String schoolName;
  final String lastUpdated;
  final List<ParentPortalChild> children;
  final List<ParentPortalHomework> homework;
  final List<ParentPortalUpdate> updates;
}
