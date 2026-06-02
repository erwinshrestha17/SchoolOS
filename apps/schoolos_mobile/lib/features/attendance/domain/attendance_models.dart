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
    required this.academicYearId,
    required this.classId,
    this.sectionId,
    required this.name,
    required this.subject,
  });

  final String id;
  final String academicYearId;
  final String classId;
  final String? sectionId;
  final String name;
  final String subject;

  factory TeacherClassSection.fromJson(Map<String, dynamic> json) {
    final academicYearId = json['academicYearId'] as String? ?? '';
    final classId = json['classId'] as String? ?? '';
    final sectionId = json['sectionId'] as String?;
    return TeacherClassSection(
      id:
          json['id'] as String? ??
          '$academicYearId:$classId:${sectionId ?? 'none'}',
      academicYearId: academicYearId,
      classId: classId,
      sectionId: sectionId,
      name: json['name'] as String? ?? 'Class section',
      subject: json['subject'] as String? ?? 'Attendance',
    );
  }
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

  factory AttendanceStudentEntry.fromJson(Map<String, dynamic> json) {
    final rollNumber = json['rollNumber'];
    return AttendanceStudentEntry(
      studentId: json['studentId'] as String? ?? json['id'] as String? ?? '',
      studentName:
          json['studentName'] as String? ??
          json['fullNameEn'] as String? ??
          'Student',
      rollNumber: rollNumber == null ? '-' : '$rollNumber',
      status: attendanceStatusFromApi(json['status'] as String?),
    );
  }

  AttendanceStudentEntry copyWith({AttendanceStatus? status}) {
    return AttendanceStudentEntry(
      studentId: studentId,
      studentName: studentName,
      rollNumber: rollNumber,
      status: status ?? this.status,
    );
  }
}

AttendanceStatus attendanceStatusFromApi(String? status) {
  switch (status) {
    case 'ABSENT':
      return AttendanceStatus.absent;
    case 'LATE':
      return AttendanceStatus.late;
    case 'LEAVE':
    case 'SICK_LEAVE':
    case 'EXCUSED_LEAVE':
    case 'UNEXCUSED_LEAVE':
      return AttendanceStatus.leave;
    case 'HOLIDAY':
      return AttendanceStatus.holiday;
    case 'PRESENT':
    default:
      return AttendanceStatus.present;
  }
}
