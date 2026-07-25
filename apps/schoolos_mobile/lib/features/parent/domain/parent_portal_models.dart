enum ParentUpdateCategory { notice, message, event, gallery }

/// Where a piece of homework stands, from the parent's point of view.
///
/// The backend `HomeworkSubmissionStatus` has ten values. The app previously
/// mapped three of them - one of which (`GRADED`) does not exist in the enum
/// at all - and let everything else fall through to "Pending". A parent
/// therefore saw "Pending" for work that had been handed in, marked, excused
/// or completed, and would chase a child who had already done it.
enum ParentHomeworkState {
  notSubmitted,
  submitted,
  late,
  reviewed,
  needsCorrection,
  excused,
  completed,
  incomplete,
  partiallyCompleted,
  absent,
  unknown;

  static ParentHomeworkState fromApi(String value) {
    return switch (value.toUpperCase()) {
      'NOT_SUBMITTED' => ParentHomeworkState.notSubmitted,
      'SUBMITTED' => ParentHomeworkState.submitted,
      'LATE' => ParentHomeworkState.late,
      'REVIEWED' => ParentHomeworkState.reviewed,
      'NEEDS_CORRECTION' => ParentHomeworkState.needsCorrection,
      'EXCUSED' => ParentHomeworkState.excused,
      'COMPLETED' => ParentHomeworkState.completed,
      'INCOMPLETE' => ParentHomeworkState.incomplete,
      'PARTIALLY_COMPLETED' => ParentHomeworkState.partiallyCompleted,
      'ABSENT' => ParentHomeworkState.absent,
      _ => ParentHomeworkState.unknown,
    };
  }

  String get label => switch (this) {
    ParentHomeworkState.notSubmitted => 'Not done yet',
    ParentHomeworkState.submitted => 'Handed in',
    ParentHomeworkState.late => 'Handed in late',
    ParentHomeworkState.reviewed => 'Marked',
    ParentHomeworkState.needsCorrection => 'Needs correction',
    ParentHomeworkState.excused => 'Excused',
    ParentHomeworkState.completed => 'Completed',
    ParentHomeworkState.incomplete => 'Incomplete',
    ParentHomeworkState.partiallyCompleted => 'Partly done',
    ParentHomeworkState.absent => 'Absent',
    ParentHomeworkState.unknown => 'Status unavailable',
  };

  /// Whether the child has nothing left to do. Drives the completed counter
  /// and filter, so it must not count work that still needs action.
  bool get isSettled => switch (this) {
    ParentHomeworkState.submitted ||
    ParentHomeworkState.late ||
    ParentHomeworkState.reviewed ||
    ParentHomeworkState.excused ||
    ParentHomeworkState.completed => true,
    _ => false,
  };

  /// Whether the parent should chase it.
  bool get needsAttention => switch (this) {
    ParentHomeworkState.notSubmitted ||
    ParentHomeworkState.needsCorrection ||
    ParentHomeworkState.incomplete ||
    ParentHomeworkState.partiallyCompleted => true,
    _ => false,
  };
}

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
    required this.rawStatus,
    required this.attachmentCount,
    required this.teacher,
    this.submittedAt,
    this.score,
    this.feedback,
  });

  final String id;
  final String childId;
  final String childName;
  final String classSection;
  final String subject;
  final String title;
  final String dueLabel;
  final DateTime? dueAt;

  /// The raw backend `HomeworkSubmissionStatus`. Read [state] or
  /// [statusLabel] rather than comparing this string.
  final String rawStatus;
  final int attachmentCount;
  final String teacher;

  /// What the child actually did, and what the school said about it.
  ///
  /// A parent cannot submit homework - that is the student's action. What
  /// they need is oversight: whether it was handed in, when, and how it was
  /// marked. The API returns all three; they were parsed and then dropped.
  final DateTime? submittedAt;
  final num? score;
  final String? feedback;

  bool get hasResult => score != null || (feedback ?? '').trim().isNotEmpty;

  ParentHomeworkState get state => ParentHomeworkState.fromApi(rawStatus);

  String get statusLabel => state.label;

  bool get isCompleted => state.isSettled;

  /// A score only means something once work has actually been handed in.
  /// The API sends `score: 0` for never-submitted homework, which reads as a
  /// failing mark to a parent.
  bool get hasMark => submittedAt != null && score != null;
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
