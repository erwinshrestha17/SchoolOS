import 'parent_models.dart';

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

enum ParentHomeworkPrimaryStatus {
  overdue,
  dueSoon,
  assigned,
  submittedLate,
  awaitingReview,
  marked,
  completedLate,
  completed,
  needsCorrection,
  excused,
  incomplete,
  partiallyCompleted,
  absent,
  unavailable;

  String get label => switch (this) {
    ParentHomeworkPrimaryStatus.overdue => 'Overdue',
    ParentHomeworkPrimaryStatus.dueSoon => 'Due soon',
    ParentHomeworkPrimaryStatus.assigned => 'Assigned',
    ParentHomeworkPrimaryStatus.submittedLate => 'Submitted late',
    ParentHomeworkPrimaryStatus.awaitingReview => 'Awaiting review',
    ParentHomeworkPrimaryStatus.marked => 'Marked',
    ParentHomeworkPrimaryStatus.completedLate => 'Completed late',
    ParentHomeworkPrimaryStatus.completed => 'Completed',
    ParentHomeworkPrimaryStatus.needsCorrection => 'Needs correction',
    ParentHomeworkPrimaryStatus.excused => 'Excused',
    ParentHomeworkPrimaryStatus.incomplete => 'Incomplete',
    ParentHomeworkPrimaryStatus.partiallyCompleted => 'Partly completed',
    ParentHomeworkPrimaryStatus.absent => 'Absent',
    ParentHomeworkPrimaryStatus.unavailable => 'Status unavailable',
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
    this.rollNumber = '',
    this.homeworkPending = 0,
    this.homeworkDetail,
    this.unreadUpdates = 0,
    this.feesDue = 0,
    this.feesStatus = 'DUE',
    this.feesPaidAmount = 0,
    this.feesTotalAmount = 0,
    this.nextFeeDueDate,
    this.nextHomeworkDueAt,
    this.transportDetail,
    this.transportAssigned = false,
    this.transportHasActiveTrip = false,
    this.transportLatestLocationAt,
    this.transportLocationConfidence = 'missing',
    this.guardianRelationship = 'Guardian',
    this.isPrimaryGuardian = false,
    this.latestActivity,
    this.latestActivityTitle,
    this.academicYearStartsOn,
    this.academicYearEndsOn,
    this.academicYear = '',
    this.attendanceEnabled = true,
    this.homeworkEnabled = true,
    this.feesEnabled = true,
    this.transportEnabled = true,
    this.capabilities = const <String>{},
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
  final String rollNumber;
  final int homeworkPending;
  final String? homeworkDetail;
  final int unreadUpdates;
  final num feesDue;
  final String feesStatus;
  final num feesPaidAmount;
  final num feesTotalAmount;
  final String? nextFeeDueDate;
  final String? nextHomeworkDueAt;
  final String? transportDetail;
  final bool transportAssigned;
  final bool transportHasActiveTrip;
  final String? transportLatestLocationAt;
  final String transportLocationConfidence;
  final String guardianRelationship;
  final bool isPrimaryGuardian;
  final String? latestActivity;
  final String? latestActivityTitle;
  final String? academicYearStartsOn;
  final String? academicYearEndsOn;
  final String academicYear;
  final bool attendanceEnabled;
  final bool homeworkEnabled;
  final bool feesEnabled;
  final bool transportEnabled;
  final Set<String> capabilities;

  bool get hasFeesDue => feesDue > 0;
  bool hasCapability(String capability) => capabilities.contains(capability);
  bool get canViewAcademics =>
      hasCapability(GuardianCapabilityKey.academicsView);
  bool get canViewAttendance =>
      hasCapability(GuardianCapabilityKey.attendanceView);
  bool get canViewFees => hasCapability(GuardianCapabilityKey.feesView);
  bool get canPayFees => hasCapability(GuardianCapabilityKey.feesPay);

  /// The backend reports nothing outstanding both for a settled account and
  /// for a child the school has never invoiced. Only the first is "paid".
  bool get hasNoFeeInvoices => !hasFeesDue && feesTotalAmount <= 0;

  bool get showTransport {
    final status = transport.trim().toLowerCase();
    return status.isNotEmpty &&
        !status.contains('module locked') &&
        !status.contains('not assigned') &&
        status != 'no active trip';
  }

  bool get transportNeedsAttention {
    final status = transport.trim().toLowerCase();
    return status.contains('delayed') ||
        status.contains('temporarily unavailable') ||
        status.contains('stale');
  }

  String get guardianContext {
    final relationship = guardianRelationship.trim().isEmpty
        ? 'Guardian'
        : guardianRelationship.trim();
    return isPrimaryGuardian
        ? '$relationship • Primary guardian'
        : relationship;
  }
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
    this.assignedAt,
    required this.rawStatus,
    required this.attachmentCount,
    required this.teacher,
    this.submittedAt,
    this.score,
    this.maxScore,
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
  final DateTime? assignedAt;

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
  final num? maxScore;
  final String? feedback;

  bool get hasResult => score != null || (feedback ?? '').trim().isNotEmpty;

  ParentHomeworkState get state => ParentHomeworkState.fromApi(rawStatus);

  String get statusLabel => state.label;

  bool get isCompleted => state.isSettled;

  /// A score only means something once work has actually been handed in.
  /// The API sends `score: 0` for never-submitted homework, which reads as a
  /// failing mark to a parent.
  bool get hasMark => submittedAt != null && score != null;
  bool get hasFeedback => (feedback ?? '').trim().isNotEmpty;

  bool get wasSubmittedLate =>
      submittedAt != null && dueAt != null && submittedAt!.isAfter(dueAt!);

  bool isOverdueAt(DateTime now) {
    if (dueAt == null || !dueAt!.isBefore(now)) return false;
    return switch (state) {
      ParentHomeworkState.notSubmitted ||
      ParentHomeworkState.incomplete ||
      ParentHomeworkState.partiallyCompleted => true,
      _ => false,
    };
  }

  bool isDueSoonAt(DateTime now, {Duration window = const Duration(days: 3)}) {
    final due = dueAt;
    if (due == null || due.isBefore(now) || due.isAfter(now.add(window))) {
      return false;
    }
    return state.needsAttention;
  }

  bool get isDueSoon => isDueSoonAt(DateTime.now());

  ParentHomeworkPrimaryStatus primaryStatusAt(DateTime now) {
    return switch (state) {
      ParentHomeworkState.reviewed =>
        wasSubmittedLate
            ? ParentHomeworkPrimaryStatus.completedLate
            : ParentHomeworkPrimaryStatus.marked,
      ParentHomeworkState.completed =>
        wasSubmittedLate
            ? ParentHomeworkPrimaryStatus.completedLate
            : ParentHomeworkPrimaryStatus.completed,
      ParentHomeworkState.late => ParentHomeworkPrimaryStatus.submittedLate,
      ParentHomeworkState.submitted =>
        ParentHomeworkPrimaryStatus.awaitingReview,
      ParentHomeworkState.notSubmitted when isOverdueAt(now) =>
        ParentHomeworkPrimaryStatus.overdue,
      ParentHomeworkState.notSubmitted when isDueSoonAt(now) =>
        ParentHomeworkPrimaryStatus.dueSoon,
      ParentHomeworkState.notSubmitted => ParentHomeworkPrimaryStatus.assigned,
      ParentHomeworkState.needsCorrection =>
        ParentHomeworkPrimaryStatus.needsCorrection,
      ParentHomeworkState.excused => ParentHomeworkPrimaryStatus.excused,
      ParentHomeworkState.incomplete when isOverdueAt(now) =>
        ParentHomeworkPrimaryStatus.overdue,
      ParentHomeworkState.incomplete => ParentHomeworkPrimaryStatus.incomplete,
      ParentHomeworkState.partiallyCompleted when isOverdueAt(now) =>
        ParentHomeworkPrimaryStatus.overdue,
      ParentHomeworkState.partiallyCompleted =>
        ParentHomeworkPrimaryStatus.partiallyCompleted,
      ParentHomeworkState.absent => ParentHomeworkPrimaryStatus.absent,
      ParentHomeworkState.unknown => ParentHomeworkPrimaryStatus.unavailable,
    };
  }

  String get displayTitle {
    var value = title.trim();
    final section = classSection.trim();
    if (section.isEmpty) return value;
    final variants = <String>{
      section,
      section.replaceAll(RegExp(r'\s*-\s*'), '-'),
      section.replaceAll(RegExp(r'\s*-\s*'), ' - '),
    };
    for (final prefix in variants) {
      if (value.toLowerCase().startsWith('${prefix.toLowerCase()} ')) {
        value = value.substring(prefix.length).trimLeft();
        break;
      }
    }
    return value;
  }

  String? get scoreLabel {
    if (!hasMark) return null;
    final value = _formatHomeworkNumber(score!);
    if (maxScore == null) {
      return 'Score $value · maximum not set';
    }
    return '$value/${_formatHomeworkNumber(maxScore!)}';
  }

  String get actionLabel => switch (state) {
    ParentHomeworkState.reviewed || ParentHomeworkState.completed
        when hasFeedback || hasMark =>
      'View feedback',
    ParentHomeworkState.reviewed ||
    ParentHomeworkState.completed ||
    ParentHomeworkState.excused => 'View details',
    ParentHomeworkState.submitted ||
    ParentHomeworkState.late => 'View submission',
    _ => 'View homework',
  };
}

String _formatHomeworkNumber(num value) {
  return value == value.roundToDouble()
      ? value.round().toString()
      : value.toString();
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
    this.childName,
    this.classSection,
    this.isPinned = false,
    this.isImportant = false,
    this.isEmergency = false,
    this.requiresAcknowledgement = false,
    this.hasAttachment = false,
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
  final String? childName;
  final String? classSection;
  final bool isPinned;
  final bool isImportant;
  final bool isEmergency;
  final bool requiresAcknowledgement;
  final bool hasAttachment;
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
