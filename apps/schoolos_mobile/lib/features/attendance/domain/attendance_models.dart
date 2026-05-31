enum AttendanceStatus { present, absent, late, leave, festival, holiday }

enum AttendanceSyncStatus { pending, synced, failed }

class AttendanceSummary {
  const AttendanceSummary({
    required this.studentId,
    required this.studentName,
    required this.todayStatus,
    this.todayLabel,
    required this.presentCount,
    required this.absentCount,
    required this.lateCount,
    required this.leaveCount,
    required this.lastUpdated,
  });

  final String studentId;
  final String studentName;
  final AttendanceStatus todayStatus;
  final String? todayLabel;
  final int presentCount;
  final int absentCount;
  final int lateCount;
  final int leaveCount;
  final DateTime lastUpdated;
}

class AttendanceDay {
  const AttendanceDay({required this.date, required this.status});

  final DateTime date;
  final AttendanceStatus status;
}

class AttendanceSnapshot {
  const AttendanceSnapshot({required this.summary, required this.days});

  final AttendanceSummary summary;
  final List<AttendanceDay> days;
}

class TeacherClassSection {
  const TeacherClassSection({
    required this.id,
    required this.name,
    required this.subject,
  });

  final String id;
  final String name;
  final String subject;
}

class AttendanceStudentEntry {
  const AttendanceStudentEntry({
    required this.studentId,
    required this.studentName,
    required this.rollNumber,
    required this.status,
  });

  final String studentId;
  final String studentName;
  final String rollNumber;
  final AttendanceStatus status;

  AttendanceStudentEntry copyWith({AttendanceStatus? status}) {
    return AttendanceStudentEntry(
      studentId: studentId,
      studentName: studentName,
      rollNumber: rollNumber,
      status: status ?? this.status,
    );
  }
}
