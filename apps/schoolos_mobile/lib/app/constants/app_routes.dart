class AppRoutes {
  const AppRoutes._();

  static const splash = '/splash';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const home = '/home';
  static const profile = '/profile';
  static const changePassword = '/profile/security/change-password';
  static const settings = '/settings';
  static const notifications = '/notifications';
  static const notices = '/notices';

  static const parentHome = '/parent/home';
  static const parentActionCentre = '/parent/actions';
  static const parentWeeklyProgress = '/parent/more/weekly-progress';
  static const parentChildren = '/parent/children';
  static const parentChild = '/parent/child/:id';
  static const parentAttendance = '/parent/attendance';
  static const parentChildAttendance = '/parent/children/:id/attendance';
  static const parentFees = '/parent/fees';
  static const parentHomework = '/parent/homework';
  static const parentHomeworkItem = '/parent/homework/:id';
  static const parentUpdates = '/parent/updates';
  static const parentTimetable = '/parent/timetable';
  static const parentReportCards = '/parent/more/report-cards';
  static const parentCalendar = '/parent/more/calendar';
  static const parentFeesReceipts = '/parent/more/fees-receipts';
  static const parentActivity = '/parent/activity';
  static const parentLearning = '/parent/more/learning-summary';
  static const parentLearningSupport = '/parent/more/learning-support';
  static const parentTransport = '/parent/more/transport';
  static const parentCanteen = '/parent/more/canteen-wallet';
  static const parentConsents = '/parent/more/consents';
  static const parentLibrary = '/parent/more/library';
  static const parentServiceRequests = '/parent/more/help-requests';
  static const parentMore = '/parent/more';
  static const studentSession = '/student/session';
  static const studentHome = '/student/home';
  static const studentAttendance = '/student/attendance';
  static const studentHomework = '/student/homework';
  static const studentTimetable = '/student/timetable';
  static const studentLearning = '/student/learning';
  static const teacherHome = '/teacher/home';
  static const teacherClasses = '/teacher/classes';
  static const teacherClass = '/teacher/class/:classSectionId';
  static const teacherStudentLearningSupport =
      '/teacher/students/:studentId/learning-support';
  static const teacherAttendance = '/teacher/attendance';
  static const teacherActivity = '/teacher/activity';
  static const teacherHomework = '/teacher/homework';
  static const teacherHomeworkCreate = '/teacher/homework/create';
  static const teacherTimetable = '/teacher/timetable';
  static const teacherProfile = '/teacher/profile';
  static const teacherLeave = '/teacher/leave';
  static const teacherPayslips = '/teacher/payslips';
  static const teacherMarks = '/teacher/marks';
  static const teacherMarksEntry = '/teacher/marks/:componentId';
  static const driverHome = '/driver/home';
  static const driverRoute = '/driver/route';
  static const driverStudents = '/driver/students';
  static const driverHistory = '/driver/history';
  static const staffHome = '/staff/home';
  static const staffAttendance = '/staff/attendance';
  static const staffLeave = '/staff/leave';
  static const staffPayslips = '/staff/payslips';
  static const principalToday = '/principal/today';
  static const principalAttention = '/principal/attention';
  static const principalApprovals = '/principal/approvals';
  static const principalServiceRequests = '/principal/service-requests';
  static const principalServiceRequest =
      '/principal/service-requests/:requestId';
  static const principalAdmissions = '/principal/admissions';
  static const principalNotices = '/principal/notices';
  static const principalMore = '/principal/more';
  static const principalAttendanceRisk = '/principal/attendance-risk';
  static const principalStaffAbsence = '/principal/staff-absence';
  static const principalFees = '/principal/fees-snapshot';
  static const principalAcademics = '/principal/academics-readiness';
  static const principalLearningSupport = '/principal/learning-support';
  static const principalTransport = '/principal/transport-alerts';
  static const principalStudents = '/principal/students';
  static const principalReports = '/principal/reports-snapshot';
  static const principalTasks = '/principal/tasks';
  static const principalWalkthroughs = '/principal/classroom-walkthroughs';
  static const principalInstitutionalImprovement =
      '/principal/institutional-improvement';
  static const principalCanteen = '/principal/canteen-snapshot';
  static const principalLibrary = '/principal/library-snapshot';
  static const adminHome = '/admin/home';

  static String parentChildDetail(String id) => '/parent/child/$id';
  static String parentChildAttendanceDetail(String id) =>
      '/parent/children/$id/attendance';
  static String parentHomeworkDetail(String id) => '/parent/homework/$id';
  static String noticeDetail(String id) => '/notices/$id';
  static String teacherClassDetail(String classSectionId) =>
      '/teacher/class/${Uri.encodeComponent(classSectionId)}';
  static String teacherStudentLearningSupportDetail({
    required String studentId,
    required String academicYearId,
    required String classId,
    String? sectionId,
  }) {
    return Uri(
      path:
          '/teacher/students/${Uri.encodeComponent(studentId)}/learning-support',
      queryParameters: {
        'academicYearId': academicYearId,
        'classId': classId,
        if (sectionId != null && sectionId.trim().isNotEmpty)
          'sectionId': sectionId,
      },
    ).toString();
  }

  static String principalServiceRequestDetail(String requestId) =>
      '/principal/service-requests/${Uri.encodeComponent(requestId)}';
  static String teacherAttendanceFor(String classSectionId) =>
      '/teacher/attendance/${Uri.encodeComponent(classSectionId)}';
  static String teacherHomeworkForClass({
    required String classId,
    String? sectionId,
    String? mode,
  }) {
    final query = {
      'classId': classId,
      if (sectionId != null && sectionId.trim().isNotEmpty)
        'sectionId': sectionId,
      if (mode != null && mode.trim().isNotEmpty) 'mode': mode,
    };
    return Uri(path: teacherHomework, queryParameters: query).toString();
  }
}
