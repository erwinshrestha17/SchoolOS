import '../domain/attendance_models.dart';

class AttendanceRepository {
  const AttendanceRepository();

  Future<AttendanceSummary> getAttendanceSummary(
    String studentId,
    DateTimeRangeValue range,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    return AttendanceSummary(
      studentId: studentId,
      studentName: studentId == 'child-anika' ? 'Anika S.' : 'Aarav S.',
      todayStatus: AttendanceStatus.present,
      presentCount: 21,
      absentCount: 1,
      lateCount: 2,
      leaveCount: 1,
      lastUpdated: DateTime.now().subtract(const Duration(minutes: 11)),
    );
  }

  Future<List<AttendanceDay>> getMonthlyAttendance(
    String studentId,
    DateTime month,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    final first = DateTime(month.year, month.month);
    return List.generate(30, (index) {
      final date = first.add(Duration(days: index));
      final status = switch (index) {
        5 => AttendanceStatus.absent,
        9 || 17 => AttendanceStatus.late,
        12 => AttendanceStatus.leave,
        19 => AttendanceStatus.festival,
        20 => AttendanceStatus.holiday,
        _ => AttendanceStatus.present,
      };
      return AttendanceDay(date: date, status: status);
    });
  }

  Future<List<TeacherClassSection>> getTeacherAssignedClasses() async {
    await Future<void>.delayed(const Duration(milliseconds: 220));
    return const [
      TeacherClassSection(
        id: 'grade-4-lotus',
        name: 'Grade 4 - Lotus',
        subject: 'Mathematics',
      ),
      TeacherClassSection(
        id: 'grade-5-rose',
        name: 'Grade 5 - Rose',
        subject: 'Mathematics',
      ),
    ];
  }

  Future<List<AttendanceStudentEntry>> getClassAttendanceSheet(
    String classSectionId,
    DateTime date,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 260));
    return const [
      AttendanceStudentEntry(
        studentId: 's-1',
        studentName: 'Aarav S.',
        rollNumber: '12',
        status: AttendanceStatus.present,
      ),
      AttendanceStudentEntry(
        studentId: 's-2',
        studentName: 'Riya K.',
        rollNumber: '13',
        status: AttendanceStatus.present,
      ),
      AttendanceStudentEntry(
        studentId: 's-3',
        studentName: 'Samir T.',
        rollNumber: '14',
        status: AttendanceStatus.present,
      ),
      AttendanceStudentEntry(
        studentId: 's-4',
        studentName: 'Nisha L.',
        rollNumber: '15',
        status: AttendanceStatus.present,
      ),
    ];
  }

  Future<AttendanceSyncStatus> submitAttendance(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return AttendanceSyncStatus.synced;
  }

  Future<void> saveDraftAttendanceLocally(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
  }

  Future<List<AttendanceStudentEntry>> loadDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return const [];
  }
}

class DateTimeRangeValue {
  const DateTimeRangeValue({required this.start, required this.end});

  final DateTime start;
  final DateTime end;
}
