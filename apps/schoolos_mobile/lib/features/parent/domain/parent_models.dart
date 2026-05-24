enum ParentDataStatus {
  loading,
  success,
  empty,
  error,
  offline,
  unauthorized,
  forbidden,
  timeout,
}

class GuardianChild {
  const GuardianChild({
    required this.id,
    required this.name,
    required this.classSection,
    required this.rollNumber,
    required this.academicYear,
    required this.relationship,
  });

  final String id;
  final String name;
  final String classSection;
  final String rollNumber;
  final String academicYear;
  final String relationship;

  factory GuardianChild.fromJson(Map<String, dynamic> json) {
    return GuardianChild(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Student',
      classSection: json['classSection'] as String? ?? '',
      rollNumber: json['rollNumber'] as String? ?? '',
      academicYear: json['academicYear'] as String? ?? '',
      relationship: json['relationship'] as String? ?? 'Child',
    );
  }
}

class ChildProfile {
  const ChildProfile({
    required this.child,
    required this.classTeacher,
    required this.guardianSummary,
    required this.canViewGuardianSummary,
    required this.attendanceSummary,
    required this.homeworkSummary,
    required this.feesSummary,
    required this.qrLabel,
    this.healthWarning,
    this.canViewHealthWarning = false,
  });

  final GuardianChild child;
  final String classTeacher;
  final String guardianSummary;
  final bool canViewGuardianSummary;
  final String attendanceSummary;
  final String homeworkSummary;
  final String feesSummary;
  final String qrLabel;
  final String? healthWarning;
  final bool canViewHealthWarning;
}

class ParentDashboardSummary {
  const ParentDashboardSummary({
    required this.child,
    required this.attendanceToday,
    required this.homeworkPending,
    required this.feesDue,
    required this.unreadNotices,
    required this.transportStatus,
    required this.canteenBalance,
    required this.latestActivity,
    required this.lastUpdated,
  });

  final GuardianChild child;
  final String attendanceToday;
  final int homeworkPending;
  final int feesDue;
  final int unreadNotices;
  final String transportStatus;
  final int canteenBalance;
  final String latestActivity;
  final DateTime lastUpdated;
}
