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
  static const parentFees = '/parent/fees';
  static const parentMore = '/parent/more';
  static const studentHome = '/student/home';
  static const studentAttendance = '/student/attendance';
  static const teacherHome = '/teacher/home';
  static const teacherAttendance = '/teacher/attendance';
  static const driverHome = '/driver/home';
  static const staffHome = '/staff/home';
  static const adminHome = '/admin/home';

  static String parentChildDetail(String id) => '/parent/child/$id';
  static String noticeDetail(String id) => '/notices/$id';
}
