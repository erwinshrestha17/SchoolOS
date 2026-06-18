class AppRoutes {
  const AppRoutes._();

  static const splash = '/splash';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const home = '/home';
  static const profile = '/profile';
  static const settings = '/settings';
  static const notifications = '/notifications';
  static const notices = '/notices';

  static const parentHome = '/parent/home';
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
  static const parentTransport = '/parent/more/transport';
  static const parentCanteen = '/parent/more/canteen-wallet';
  static const parentConsents = '/parent/more/consents';
  static const parentLibrary = '/parent/more/library';
  static const parentChat = '/parent/chat';
  static const parentMore = '/parent/more';
  static const studentHome = '/student/home';
  static const studentAttendance = '/student/attendance';
  static const studentHomework = '/student/homework';
  static const studentTimetable = '/student/timetable';
  static const studentLearning = '/student/learning';
  static const teacherHome = '/teacher/home';
  static const teacherClasses = '/teacher/classes';
  static const teacherAttendance = '/teacher/attendance';
  static const driverHome = '/driver/home';
  static const driverRoute = '/driver/route';
  static const driverStudents = '/driver/students';
  static const driverHistory = '/driver/history';
  static const staffHome = '/staff/home';
  static const staffAttendance = '/staff/attendance';
  static const staffLeave = '/staff/leave';
  static const staffPayslips = '/staff/payslips';
  static const adminHome = '/admin/home';

  static String parentChildDetail(String id) => '/parent/child/$id';
  static String parentChildAttendanceDetail(String id) =>
      '/parent/children/$id/attendance';
  static String parentHomeworkDetail(String id) => '/parent/homework/$id';
  static String noticeDetail(String id) => '/notices/$id';
  static String teacherAttendanceFor(String classSectionId) =>
      '/teacher/attendance/${Uri.encodeComponent(classSectionId)}';
}
