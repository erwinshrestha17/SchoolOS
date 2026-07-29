/// Mirrors the backend `AttendanceStatus` enum.
///
/// Every backend value must map to something here. The parser used to fall
/// through to [present], so a child recorded HALF_DAY or ON_LEAVE was shown to
/// their parent as present for the whole day - the one reading a parent is
/// most likely to act on, and the one it is worst to get wrong.
enum AttendanceStatus {
  present,
  absent,
  late,
  halfDay,
  leave,
  festival,
  holiday,
  unknown,
}

enum AttendanceSyncStatus {
  draft,
  queued,
  syncing,
  serverChecking,
  synced,
  failed,
  conflict,
}

enum AttendanceServerSyncStatus {
  accepted,
  synced,
  conflicted,
  rejected,
  processing,
  unknown,
}

enum AttendanceDraftReceiptState {
  local,
  processing,
  unknown,
  transportAmbiguous,
  rejected,
}

extension AttendanceDraftReceiptStatePolicy on AttendanceDraftReceiptState {
  bool get locksContent =>
      this == AttendanceDraftReceiptState.processing ||
      this == AttendanceDraftReceiptState.unknown ||
      this == AttendanceDraftReceiptState.transportAmbiguous;

  AttendanceSyncStatus get syncStatus => switch (this) {
    AttendanceDraftReceiptState.local => AttendanceSyncStatus.queued,
    AttendanceDraftReceiptState.processing ||
    AttendanceDraftReceiptState.unknown ||
    AttendanceDraftReceiptState.transportAmbiguous =>
      AttendanceSyncStatus.serverChecking,
    AttendanceDraftReceiptState.rejected => AttendanceSyncStatus.failed,
  };
}

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
    required this.totalMarked,
    required this.attendancePercentage,
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
  final int totalMarked;
  final double? attendancePercentage;
  final DateTime lastUpdated;
}

class AttendanceDay {
  const AttendanceDay({
    required this.date,
    required this.status,
    this.label,
    this.remark,
  });

  final DateTime date;
  final AttendanceStatus status;
  final String? label;
  final String? remark;
}

class AttendanceSnapshot {
  const AttendanceSnapshot({
    required this.summary,
    required this.days,
    this.fromCache = false,
  });

  final AttendanceSummary summary;
  final List<AttendanceDay> days;
  final bool fromCache;
}

class ParentAttendanceCorrection {
  const ParentAttendanceCorrection({
    required this.id,
    required this.attendanceDate,
    required this.previousStatus,
    required this.requestedStatus,
    required this.reason,
    required this.status,
    required this.requestedAt,
    this.reviewedAt,
    this.reviewReason,
    this.canCancel = false,
    this.canResubmit = false,
  });

  final String id;
  final DateTime attendanceDate;
  final AttendanceStatus previousStatus;
  final AttendanceStatus requestedStatus;
  final String reason;
  final String status;
  final DateTime requestedAt;
  final DateTime? reviewedAt;
  final String? reviewReason;
  final bool canCancel;
  final bool canResubmit;

  factory ParentAttendanceCorrection.fromJson(Map<String, dynamic> json) {
    return ParentAttendanceCorrection(
      id: json['id'] as String? ?? '',
      attendanceDate:
          DateTime.tryParse(json['attendanceDate'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      previousStatus: attendanceStatusFromApi(
        json['previousStatus'] as String?,
      ),
      requestedStatus: attendanceStatusFromApi(
        json['requestedStatus'] as String?,
      ),
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      requestedAt:
          DateTime.tryParse(json['requestedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      reviewedAt: DateTime.tryParse(json['reviewedAt'] as String? ?? ''),
      reviewReason: json['reviewReason'] as String?,
      canCancel: json['canCancel'] as bool? ?? false,
      canResubmit: json['canResubmit'] as bool? ?? false,
    );
  }
}

class TeacherClassSection {
  const TeacherClassSection({
    required this.id,
    required this.academicYearId,
    required this.classId,
    this.sectionId,
    required this.name,
    required this.subject,
    this.attendance,
  });

  final String id;
  final String academicYearId;
  final String classId;
  final String? sectionId;
  final String name;
  final String subject;
  final TeacherAttendanceMeta? attendance;

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
      attendance: json['attendance'] is Map<String, dynamic>
          ? TeacherAttendanceMeta.fromJson(
              json['attendance'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'academicYearId': academicYearId,
    'classId': classId,
    'sectionId': sectionId,
    'name': name,
    'subject': subject,
    if (attendance != null) 'attendance': attendance!.toJson(),
  };
}

class TeacherAttendanceMeta {
  const TeacherAttendanceMeta({
    this.submittedAt,
    this.lockAt,
    required this.isSubmitted,
    required this.isLocked,
    required this.conflictStatus,
  });

  final DateTime? submittedAt;
  final DateTime? lockAt;
  final bool isSubmitted;
  final bool isLocked;
  final String conflictStatus;

  bool get hasConflict => conflictStatus != 'NONE';

  factory TeacherAttendanceMeta.fromJson(Map<String, dynamic> json) {
    return TeacherAttendanceMeta(
      submittedAt: DateTime.tryParse(json['submittedAt'] as String? ?? ''),
      lockAt: DateTime.tryParse(json['lockAt'] as String? ?? ''),
      isSubmitted: json['isSubmitted'] as bool? ?? false,
      isLocked: json['isLocked'] as bool? ?? false,
      conflictStatus: json['conflictStatus'] as String? ?? 'NONE',
    );
  }

  Map<String, dynamic> toJson() => {
    'submittedAt': submittedAt?.toIso8601String(),
    'lockAt': lockAt?.toIso8601String(),
    'isSubmitted': isSubmitted,
    'isLocked': isLocked,
    'conflictStatus': conflictStatus,
  };
}

class TeacherRosterSnapshot {
  const TeacherRosterSnapshot({
    required this.entries,
    required this.attendance,
    required this.isWorkingDay,
    this.fromCache = false,
    required this.lastUpdated,
  });

  final List<AttendanceStudentEntry> entries;
  final TeacherAttendanceMeta attendance;
  final bool isWorkingDay;
  final bool fromCache;
  final DateTime lastUpdated;
}

class TeacherAttendanceDraft {
  const TeacherAttendanceDraft({
    required this.clientSubmissionId,
    required this.savedAt,
    required this.entries,
    this.receiptState = AttendanceDraftReceiptState.local,
  });

  final String clientSubmissionId;
  final DateTime savedAt;
  final List<AttendanceStudentEntry> entries;
  final AttendanceDraftReceiptState receiptState;
}

class TeacherAttendanceSubmitResult {
  const TeacherAttendanceSubmitResult({
    required this.serverStatus,
    required this.replayed,
    this.deviceReceiptPersisted = true,
  });

  final AttendanceServerSyncStatus serverStatus;
  final bool replayed;
  final bool deviceReceiptPersisted;

  AttendanceSyncStatus get status => switch (serverStatus) {
    AttendanceServerSyncStatus.accepted ||
    AttendanceServerSyncStatus.synced => AttendanceSyncStatus.synced,
    AttendanceServerSyncStatus.conflicted => AttendanceSyncStatus.conflict,
    AttendanceServerSyncStatus.rejected => AttendanceSyncStatus.failed,
    AttendanceServerSyncStatus.processing ||
    AttendanceServerSyncStatus.unknown => AttendanceSyncStatus.serverChecking,
  };

  bool get canClearDeviceDraft =>
      serverStatus == AttendanceServerSyncStatus.accepted ||
      serverStatus == AttendanceServerSyncStatus.synced ||
      serverStatus == AttendanceServerSyncStatus.conflicted;

  AttendanceDraftReceiptState get draftReceiptState => switch (serverStatus) {
    AttendanceServerSyncStatus.rejected => AttendanceDraftReceiptState.rejected,
    AttendanceServerSyncStatus.processing =>
      AttendanceDraftReceiptState.processing,
    AttendanceServerSyncStatus.unknown => AttendanceDraftReceiptState.unknown,
    AttendanceServerSyncStatus.accepted ||
    AttendanceServerSyncStatus.synced ||
    AttendanceServerSyncStatus.conflicted => AttendanceDraftReceiptState.local,
  };
}

class TeacherTodayPeriod {
  const TeacherTodayPeriod({
    required this.id,
    required this.classSectionId,
    required this.className,
    required this.subjectName,
    required this.startsAt,
    required this.endsAt,
  });

  final String id;
  final String classSectionId;
  final String className;
  final String subjectName;
  final String startsAt;
  final String endsAt;

  factory TeacherTodayPeriod.fromJson(Map<String, dynamic> json) {
    final academicYearId = json['academicYearId'] as String? ?? '';
    final classId = json['classId'] as String? ?? '';
    final sectionId = json['sectionId'] as String?;
    return TeacherTodayPeriod(
      id: json['id'] as String? ?? '',
      classSectionId: '$academicYearId:$classId:${sectionId ?? 'none'}',
      className: json['className'] as String? ?? 'Assigned class',
      subjectName: json['subjectName'] as String? ?? 'Class period',
      startsAt: json['startsAt'] as String? ?? '',
      endsAt: json['endsAt'] as String? ?? '',
    );
  }
}

class TeacherTodaySnapshot {
  const TeacherTodaySnapshot({
    required this.date,
    required this.periods,
    required this.classes,
    required this.pendingAttendanceCount,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final DateTime date;
  final List<TeacherTodayPeriod> periods;
  final List<TeacherClassSection> classes;
  final int pendingAttendanceCount;
  final DateTime lastUpdated;
  final bool fromCache;
}

class TeacherClassesSnapshot {
  const TeacherClassesSnapshot({
    required this.classes,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final List<TeacherClassSection> classes;
  final DateTime lastUpdated;
  final bool fromCache;
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

  Map<String, dynamic> toJson() => {
    'studentId': studentId,
    'studentName': studentName,
    'rollNumber': rollNumber,
    'status': attendanceStatusToApi(status),
  };
}

class TeacherStudentSummary {
  const TeacherStudentSummary({
    required this.student,
    required this.attendance,
  });

  final TeacherStudentIdentity student;
  final TeacherStudentAttendance attendance;

  factory TeacherStudentSummary.fromJson(Map<String, dynamic> json) {
    final student = json['student'] is Map<String, dynamic>
        ? json['student'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final attendance = json['attendance'] is Map<String, dynamic>
        ? json['attendance'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherStudentSummary(
      student: TeacherStudentIdentity.fromJson(student),
      attendance: TeacherStudentAttendance.fromJson(attendance),
    );
  }
}

class TeacherStudentIdentity {
  const TeacherStudentIdentity({
    required this.id,
    required this.name,
    this.studentSystemId,
    this.rollNumber,
    required this.lifecycleStatus,
    required this.className,
    this.sectionName,
  });

  final String id;
  final String name;
  final String? studentSystemId;
  final int? rollNumber;
  final String lifecycleStatus;
  final String className;
  final String? sectionName;

  factory TeacherStudentIdentity.fromJson(Map<String, dynamic> json) {
    return TeacherStudentIdentity(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Student',
      studentSystemId: json['studentSystemId'] as String?,
      rollNumber: _asNullableInt(json['rollNumber']),
      lifecycleStatus: json['lifecycleStatus'] as String? ?? 'ACTIVE',
      className: json['className'] as String? ?? 'Class',
      sectionName: json['sectionName'] as String?,
    );
  }
}

class TeacherStudentAttendance {
  const TeacherStudentAttendance({
    required this.recentWindow,
    required this.present,
    required this.absent,
    required this.late,
    required this.leave,
    this.lastStatus,
    this.lastRemark,
    this.lastRecordedAt,
  });

  final int recentWindow;
  final int present;
  final int absent;
  final int late;
  final int leave;
  final String? lastStatus;
  final String? lastRemark;
  final String? lastRecordedAt;

  factory TeacherStudentAttendance.fromJson(Map<String, dynamic> json) {
    return TeacherStudentAttendance(
      recentWindow: _asInt(json['recentWindow']),
      present: _asInt(json['present']),
      absent: _asInt(json['absent']),
      late: _asInt(json['late']),
      leave: _asInt(json['leave']),
      lastStatus: json['lastStatus'] as String?,
      lastRemark: json['lastRemark'] as String?,
      lastRecordedAt: json['lastRecordedAt'] as String?,
    );
  }
}

String attendanceStatusToApi(AttendanceStatus status) {
  return switch (status) {
    AttendanceStatus.present => 'PRESENT',
    AttendanceStatus.absent => 'ABSENT',
    AttendanceStatus.late => 'LATE',
    AttendanceStatus.halfDay => 'HALF_DAY',
    AttendanceStatus.leave => 'EXCUSED_LEAVE',
    AttendanceStatus.festival => 'HOLIDAY',
    AttendanceStatus.holiday => 'HOLIDAY',
    // Never turn an unreadable server value into a deliberate write.
    AttendanceStatus.unknown => throw StateError(
      'Unknown attendance status cannot be submitted.',
    ),
  };
}

AttendanceStatus attendanceStatusFromApi(String? status) {
  switch (status) {
    case 'PRESENT':
      return AttendanceStatus.present;
    case 'ABSENT':
      return AttendanceStatus.absent;
    case 'LATE':
      return AttendanceStatus.late;
    case 'HALF_DAY':
      return AttendanceStatus.halfDay;
    case 'LEAVE':
    case 'ON_LEAVE':
    case 'SICK_LEAVE':
    case 'EXCUSED_LEAVE':
    case 'UNEXCUSED_LEAVE':
      return AttendanceStatus.leave;
    case 'HOLIDAY':
      return AttendanceStatus.holiday;
    default:
      // Deliberately not `present`. A value this build does not recognise -
      // a newly added backend status, or a corrupted payload - must read as
      // unknown rather than quietly telling a parent their child attended.
      return AttendanceStatus.unknown;
  }
}

int _asInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return 0;
}

int? _asNullableInt(Object? value) {
  if (value == null) {
    return null;
  }
  return _asInt(value);
}
