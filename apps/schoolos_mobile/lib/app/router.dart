import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_provider.dart';
import '../core/auth/mobile_role.dart';
import '../features/auth/presentation/forgot_password_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/dashboard/presentation/home_redirect_screen.dart';
import '../features/dashboard/presentation/role_dashboards/admin_dashboard.dart';
import '../features/dashboard/presentation/role_dashboards/driver_dashboard.dart';
import '../features/dashboard/presentation/role_dashboards/staff_dashboard.dart';
import '../features/dashboard/presentation/role_dashboards/teacher_dashboard.dart';
import '../features/attendance/presentation/screens/parent_attendance_screen.dart';
import '../features/attendance/presentation/screens/teacher_classes_screen.dart';
import '../features/attendance/presentation/screens/teacher_attendance_screen.dart';
import '../features/teacher/presentation/screens/teacher_class_hub_screen.dart';
import '../features/teacher/presentation/screens/teacher_activity_screen.dart';
import '../features/teacher/presentation/screens/teacher_homework_screen.dart';
import '../features/teacher/presentation/screens/teacher_messages_screen.dart';
import '../features/teacher/presentation/screens/teacher_profile_screen.dart';
import '../features/teacher/presentation/screens/teacher_timetable_screen.dart';
import '../features/learning/presentation/screens/learning_summary_screen.dart';
import '../features/learning/presentation/screens/student_learning_session_screen.dart';
import '../features/notices/presentation/screens/notice_detail_screen.dart';
import '../features/notices/presentation/screens/notice_list_screen.dart';
import '../features/notices/presentation/screens/notification_center_screen.dart';
import '../features/parent/presentation/screens/parent_activity_screen.dart';
import '../features/parent/presentation/screens/parent_calendar_screen.dart';
import '../features/parent/presentation/screens/parent_canteen_screen.dart';
import '../features/parent/presentation/screens/parent_chat_screen.dart';
import '../features/parent/presentation/screens/parent_consents_screen.dart';
import '../features/parent/presentation/screens/parent_fees_screen.dart';
import '../features/parent/presentation/screens/parent_fees_receipts_screen.dart';
import '../features/parent/presentation/screens/parent_library_screen.dart';
import '../features/parent/presentation/screens/parent_portal_detail_screens.dart';
import '../features/parent/presentation/screens/parent_report_cards_screen.dart';
import '../features/parent/presentation/screens/parent_timetable_screen.dart';
import '../features/parent/presentation/screens/parent_transport_screen.dart';
import '../features/principal/presentation/screens/principal_screens.dart';
import '../features/profile/presentation/change_password_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/staff/presentation/screens/staff_attendance_screen.dart';
import '../features/staff/presentation/screens/staff_leave_screen.dart';
import '../features/staff/presentation/screens/staff_payslips_screen.dart';
import '../features/transport/presentation/screens/driver_route_screen.dart';
import '../shared/widgets/app_empty_state.dart';
import '../shared/widgets/app_scaffold.dart';
import '../shared/widgets/school_os_app_shell.dart';
import 'constants/app_routes.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeRedirectScreen(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.changePassword,
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationCenterScreen(),
      ),
      GoRoute(
        path: AppRoutes.notices,
        builder: (context, state) => const NoticeListScreen(),
      ),
      GoRoute(
        path: '${AppRoutes.notices}/:id',
        builder: (context, state) =>
            NoticeDetailScreen(noticeId: state.pathParameters['id'] ?? ''),
      ),

      // Role Dashboards
      GoRoute(
        path: AppRoutes.parentHome,
        builder: (context, state) => const SchoolOsAppShell(),
      ),
      GoRoute(
        path: AppRoutes.parentChildren,
        builder: (context, state) => const SchoolOsAppShell(initialIndex: 1),
      ),
      GoRoute(
        path: AppRoutes.parentChild,
        builder: (context, state) => ParentPortalChildDetailScreen(
          childId: state.pathParameters['id'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.parentAttendance,
        builder: (context, state) => const ParentAttendanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentChildAttendance,
        builder: (context, state) => ParentAttendanceScreen(
          studentId: state.pathParameters['id'] ?? 'aarav',
        ),
      ),
      GoRoute(
        path: AppRoutes.parentFees,
        builder: (context, state) => const ParentFeesScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentHomework,
        builder: (context, state) => SchoolOsAppShell(
          initialIndex: 2,
          initialChildId: state.uri.queryParameters['child'],
        ),
      ),
      GoRoute(
        path: AppRoutes.parentHomeworkItem,
        builder: (context, state) => ParentPortalHomeworkDetailScreen(
          homeworkId: state.pathParameters['id'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.parentUpdates,
        builder: (context, state) => const SchoolOsAppShell(initialIndex: 3),
      ),
      GoRoute(
        path: AppRoutes.parentTimetable,
        builder: (context, state) => const ParentTimetableScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentReportCards,
        builder: (context, state) => const ParentReportCardsScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentCalendar,
        builder: (context, state) => const ParentCalendarScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentFeesReceipts,
        builder: (context, state) => const ParentFeesReceiptsScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentActivity,
        builder: (context, state) => const ParentActivityScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentLearning,
        builder: (context, state) => const LearningSummaryScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentTransport,
        builder: (context, state) => const ParentTransportScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentCanteen,
        builder: (context, state) => const ParentCanteenScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentConsents,
        builder: (context, state) => const ParentConsentsScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentLibrary,
        builder: (context, state) => const ParentLibraryScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentChat,
        builder: (context, state) => const ParentChatScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentMore,
        builder: (context, state) => const SchoolOsAppShell(initialIndex: 4),
      ),
      GoRoute(
        path: AppRoutes.studentSession,
        builder: (context, state) => StudentLearningSessionScreen(
          initialSessionCode: state.uri.queryParameters['code'],
          initialQrToken: state.uri.queryParameters['qrToken'],
        ),
      ),
      GoRoute(
        path: AppRoutes.studentHome,
        redirect: (context, state) => AppRoutes.studentSession,
      ),
      GoRoute(
        path: AppRoutes.studentAttendance,
        redirect: (context, state) => AppRoutes.studentSession,
      ),
      GoRoute(
        path: AppRoutes.studentHomework,
        redirect: (context, state) => AppRoutes.studentSession,
      ),
      GoRoute(
        path: AppRoutes.studentTimetable,
        redirect: (context, state) => AppRoutes.studentSession,
      ),
      GoRoute(
        path: AppRoutes.studentLearning,
        redirect: (context, state) => AppRoutes.studentSession,
      ),
      GoRoute(
        path: AppRoutes.teacherHome,
        builder: (context, state) => const TeacherDashboard(),
      ),
      GoRoute(
        path: AppRoutes.teacherClasses,
        builder: (context, state) => const TeacherClassesScreen(),
      ),
      GoRoute(
        path: AppRoutes.teacherClass,
        builder: (context, state) => TeacherClassHubScreen(
          classSectionId: state.pathParameters['classSectionId'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.teacherAttendance,
        builder: (context, state) => const TeacherAttendanceScreen(),
      ),
      GoRoute(
        path: '${AppRoutes.teacherAttendance}/:classSectionId',
        builder: (context, state) => TeacherAttendanceScreen(
          classSectionId: state.pathParameters['classSectionId'],
        ),
      ),
      GoRoute(
        path: AppRoutes.teacherHomework,
        builder: (context, state) => TeacherHomeworkScreen(
          initialClassId: state.uri.queryParameters['classId'],
          initialSectionId: state.uri.queryParameters['sectionId'],
          initialMode: state.uri.queryParameters['mode'],
        ),
      ),
      GoRoute(
        path: AppRoutes.teacherActivity,
        builder: (context, state) => const TeacherActivityScreen(),
      ),
      GoRoute(
        path: AppRoutes.teacherMessages,
        builder: (context, state) => const TeacherMessagesScreen(),
      ),
      GoRoute(
        path: AppRoutes.teacherMessageThread,
        builder: (context, state) => TeacherMessageThreadScreen(
          threadId: state.pathParameters['threadId'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.teacherTimetable,
        builder: (context, state) => const TeacherTimetableScreen(),
      ),
      GoRoute(
        path: AppRoutes.teacherProfile,
        builder: (context, state) => const TeacherProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.driverHome,
        builder: (context, state) => const DriverDashboard(),
      ),
      GoRoute(
        path: AppRoutes.driverRoute,
        builder: (context, state) => const DriverRouteScreen(),
      ),
      GoRoute(
        path: AppRoutes.driverStudents,
        builder: (context, state) => const DriverStudentsScreen(),
      ),
      GoRoute(
        path: AppRoutes.driverHistory,
        builder: (context, state) => const DriverHistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffHome,
        builder: (context, state) => const StaffDashboard(),
      ),
      GoRoute(
        path: AppRoutes.staffAttendance,
        builder: (context, state) => const StaffAttendanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffLeave,
        builder: (context, state) => const StaffLeaveScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffPayslips,
        builder: (context, state) => const StaffPayslipsScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalToday,
        builder: (context, state) => const PrincipalTodayScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalAttention,
        builder: (context, state) => const PrincipalAttentionScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalApprovals,
        builder: (context, state) => const PrincipalApprovalsScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalNotices,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'notice',
          title: 'Emergency Notice',
          subtitle: 'Review and send urgent school communication',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalMore,
        builder: (context, state) => const PrincipalMoreScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalAdmissions,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'admissions',
          title: 'Admissions Snapshot',
          subtitle: 'Review-only admissions follow-up for school leadership',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalAttendanceRisk,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'attendance',
          title: 'Attendance Risk',
          subtitle: 'Classes and students needing attendance follow-up',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalStaffAbsence,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'staff',
          title: 'Staff Absence',
          subtitle: 'Track teacher absence and substitution coverage',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalFees,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'fees',
          title: 'Fees Snapshot',
          subtitle: 'Read-only school finance overview',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalAcademics,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'academics',
          title: 'Academics Readiness',
          subtitle: 'Assessment and report-card readiness overview',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalTransport,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'transport',
          title: 'Transport Alerts',
          subtitle: 'Live route status and operational alerts',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalEscalations,
        builder: (context, state) => const PrincipalEscalationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalStudents,
        builder: (context, state) => const PrincipalStudentsScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalReports,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'reports',
          title: 'Reports Snapshot',
          subtitle: 'Read-only school performance summary',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalTasks,
        builder: (context, state) => const PrincipalTasksScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalWalkthroughs,
        builder: (context, state) => const PrincipalWalkthroughsScreen(),
      ),
      GoRoute(
        path: AppRoutes.principalCanteen,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'canteen',
          title: 'Canteen Snapshot',
          subtitle: 'Canteen leadership snapshot',
        ),
      ),
      GoRoute(
        path: AppRoutes.principalLibrary,
        builder: (context, state) => const PrincipalSnapshotScreen(
          snapshotKey: 'library',
          title: 'Library Snapshot',
          subtitle: 'Library leadership snapshot',
        ),
      ),
      GoRoute(
        path: AppRoutes.adminHome,
        builder: (context, state) => const AdminDashboard(),
      ),
    ],

    // Auth redirect rules
    redirect: (context, state) {
      final status = auth.status;
      final goingToPublic =
          state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.forgotPassword ||
          state.matchedLocation == AppRoutes.splash;

      if (status == AuthStatus.unauthenticated && !goingToPublic) {
        return AppRoutes.login;
      }

      if (status == AuthStatus.authenticated) {
        if (goingToPublic) {
          return AppRoutes.home;
        }

        // Role-based route guard
        final location = state.matchedLocation;
        if (auth.user?.mustChangePassword == true &&
            location != AppRoutes.changePassword) {
          return AppRoutes.changePassword;
        }

        final role = MobileRole.normalize(
          auth.role,
          roles: auth.user?.roles ?? const [],
        );

        if (role == MobileRole.student &&
            location != AppRoutes.home &&
            location != AppRoutes.studentSession) {
          return AppRoutes.studentSession;
        }
        if (_isParentRoute(location) && role != MobileRole.parent) {
          return AppRoutes.home;
        }
        if (_isStudentRoute(location) && role != MobileRole.student) {
          return AppRoutes.home;
        }
        if (_isTeacherRoute(location) && role != MobileRole.teacher) {
          return AppRoutes.home;
        }
        if (_isDriverRoute(location) && role != MobileRole.driver) {
          return AppRoutes.home;
        }
        if (_isStaffRoute(location) && role != MobileRole.staff) {
          return AppRoutes.home;
        }
        if (_isPrincipalRoute(location) && role != MobileRole.principal) {
          return AppRoutes.home;
        }
        if (location == AppRoutes.adminHome && role != MobileRole.admin) {
          return AppRoutes.home;
        }
      }

      return null;
    },

    // Polished unknown route screen
    errorBuilder: (context, state) {
      return AppScaffold(
        appBar: AppBar(
          title: const Text('Page Not Found'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => context.go(AppRoutes.home),
          ),
        ),
        body: AppEmptyState(
          title: 'Lost in Space?',
          message: 'The page you are looking for does not exist: ${state.uri}',
          icon: Icons.explore_off_rounded,
          actionLabel: 'Go back home',
          onActionPressed: () => context.go(AppRoutes.home),
        ),
      );
    },
  );
});

bool _isStudentRoute(String location) {
  return location == AppRoutes.studentSession ||
      location == AppRoutes.studentHome ||
      location == AppRoutes.studentAttendance ||
      location == AppRoutes.studentHomework ||
      location == AppRoutes.studentTimetable ||
      location == AppRoutes.studentLearning;
}

bool _isStaffRoute(String location) {
  return location == AppRoutes.staffHome ||
      location == AppRoutes.staffAttendance ||
      location == AppRoutes.staffLeave ||
      location == AppRoutes.staffPayslips;
}

bool _isPrincipalRoute(String location) {
  return location == AppRoutes.principalToday ||
      location == AppRoutes.principalAttention ||
      location == AppRoutes.principalApprovals ||
      location == AppRoutes.principalNotices ||
      location == AppRoutes.principalMore ||
      location == AppRoutes.principalAttendanceRisk ||
      location == AppRoutes.principalStaffAbsence ||
      location == AppRoutes.principalFees ||
      location == AppRoutes.principalAcademics ||
      location == AppRoutes.principalTransport ||
      location == AppRoutes.principalEscalations ||
      location == AppRoutes.principalStudents ||
      location == AppRoutes.principalReports ||
      location == AppRoutes.principalTasks ||
      location == AppRoutes.principalWalkthroughs ||
      location == AppRoutes.principalCanteen ||
      location == AppRoutes.principalLibrary;
}

bool _isDriverRoute(String location) {
  return location == AppRoutes.driverHome ||
      location == AppRoutes.driverRoute ||
      location == AppRoutes.driverStudents ||
      location == AppRoutes.driverHistory;
}

bool _isTeacherRoute(String location) {
  return location == AppRoutes.teacherHome ||
      location == AppRoutes.teacherClasses ||
      location.startsWith('/teacher/class/') ||
      location == AppRoutes.teacherAttendance ||
      location.startsWith('${AppRoutes.teacherAttendance}/') ||
      location == AppRoutes.teacherHomework ||
      location == AppRoutes.teacherHomeworkCreate ||
      location == AppRoutes.teacherMessages ||
      location.startsWith('/teacher/messages/') ||
      location == AppRoutes.teacherTimetable ||
      location == AppRoutes.teacherProfile ||
      location == AppRoutes.teacherLeave ||
      location == AppRoutes.teacherPayslips;
}

bool _isParentRoute(String location) {
  return location == AppRoutes.parentHome ||
      location == AppRoutes.parentChildren ||
      location.startsWith('/parent/child/') ||
      location.startsWith('/parent/children/') ||
      location == AppRoutes.parentAttendance ||
      location == AppRoutes.parentFees ||
      location == AppRoutes.parentHomework ||
      location.startsWith('/parent/homework/') ||
      location == AppRoutes.parentUpdates ||
      location == AppRoutes.parentTimetable ||
      location == AppRoutes.parentReportCards ||
      location == AppRoutes.parentCalendar ||
      location == AppRoutes.parentFeesReceipts ||
      location == AppRoutes.parentActivity ||
      location == AppRoutes.parentLearning ||
      location == AppRoutes.parentTransport ||
      location == AppRoutes.parentCanteen ||
      location == AppRoutes.parentConsents ||
      location == AppRoutes.parentLibrary ||
      location == AppRoutes.parentChat ||
      location == AppRoutes.parentMore;
}
