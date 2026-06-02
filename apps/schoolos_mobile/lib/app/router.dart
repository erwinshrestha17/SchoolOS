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
import '../features/dashboard/presentation/role_dashboards/student_dashboard.dart';
import '../features/dashboard/presentation/role_dashboards/teacher_dashboard.dart';
import '../features/attendance/presentation/screens/parent_attendance_screen.dart';
import '../features/attendance/presentation/screens/teacher_attendance_screen.dart';
import '../features/notices/presentation/screens/notice_detail_screen.dart';
import '../features/notices/presentation/screens/notice_list_screen.dart';
import '../features/notices/presentation/screens/notification_center_screen.dart';
import '../features/parent/presentation/screens/parent_activity_screen.dart';
import '../features/parent/presentation/screens/parent_canteen_screen.dart';
import '../features/parent/presentation/screens/parent_chat_screen.dart';
import '../features/parent/presentation/screens/child_profile_screen.dart';
import '../features/parent/presentation/screens/parent_children_screen.dart';
import '../features/parent/presentation/screens/parent_fees_screen.dart';
import '../features/parent/presentation/screens/parent_homework_screen.dart';
import '../features/parent/presentation/screens/parent_home_screen.dart';
import '../features/parent/presentation/screens/parent_more_screen.dart';
import '../features/parent/presentation/screens/parent_report_cards_screen.dart';
import '../features/parent/presentation/screens/parent_timetable_screen.dart';
import '../features/parent/presentation/screens/parent_transport_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/staff/presentation/screens/staff_attendance_screen.dart';
import '../features/staff/presentation/screens/staff_leave_screen.dart';
import '../features/staff/presentation/screens/staff_payslips_screen.dart';
import '../shared/widgets/app_empty_state.dart';
import '../shared/widgets/app_scaffold.dart';
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
        builder: (context, state) => const ParentHomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentChildren,
        builder: (context, state) => const ParentChildrenScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentChild,
        builder: (context, state) =>
            ChildProfileScreen(childId: state.pathParameters['id']),
      ),
      GoRoute(
        path: AppRoutes.parentAttendance,
        builder: (context, state) =>
            const ParentAttendanceScreen(studentId: 'selected-child'),
      ),
      GoRoute(
        path: AppRoutes.parentFees,
        builder: (context, state) => const ParentFeesScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentHomework,
        builder: (context, state) => const ParentHomeworkScreen(),
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
        path: AppRoutes.parentActivity,
        builder: (context, state) => const ParentActivityScreen(),
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
        path: AppRoutes.parentChat,
        builder: (context, state) => const ParentChatScreen(),
      ),
      GoRoute(
        path: AppRoutes.parentMore,
        builder: (context, state) => const ParentMoreScreen(),
      ),
      GoRoute(
        path: AppRoutes.studentHome,
        builder: (context, state) => const StudentDashboard(),
      ),
      GoRoute(
        path: AppRoutes.studentAttendance,
        builder: (context, state) => const StudentAttendanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.teacherHome,
        builder: (context, state) => const TeacherDashboard(),
      ),
      GoRoute(
        path: AppRoutes.teacherAttendance,
        builder: (context, state) => const TeacherAttendanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.driverHome,
        builder: (context, state) => const DriverDashboard(),
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
        final role = MobileRole.normalize(
          auth.role,
          roles: auth.user?.roles ?? const [],
        );

        if (_isParentRoute(location) && role != MobileRole.parent) {
          return AppRoutes.home;
        }
        if ((location == AppRoutes.studentHome ||
                location == AppRoutes.studentAttendance) &&
            role != MobileRole.student) {
          return AppRoutes.home;
        }
        if ((location == AppRoutes.teacherHome ||
                location == AppRoutes.teacherAttendance) &&
            role != MobileRole.teacher) {
          return AppRoutes.home;
        }
        if (location == AppRoutes.driverHome && role != MobileRole.driver) {
          return AppRoutes.home;
        }
        if (_isStaffRoute(location) && role != MobileRole.staff) {
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

bool _isStaffRoute(String location) {
  return location == AppRoutes.staffHome ||
      location == AppRoutes.staffAttendance ||
      location == AppRoutes.staffLeave ||
      location == AppRoutes.staffPayslips;
}

bool _isParentRoute(String location) {
  return location == AppRoutes.parentHome ||
      location == AppRoutes.parentChildren ||
      location == AppRoutes.parentChild ||
      location == AppRoutes.parentAttendance ||
      location == AppRoutes.parentFees ||
      location == AppRoutes.parentHomework ||
      location == AppRoutes.parentTimetable ||
      location == AppRoutes.parentReportCards ||
      location == AppRoutes.parentActivity ||
      location == AppRoutes.parentTransport ||
      location == AppRoutes.parentCanteen ||
      location == AppRoutes.parentChat ||
      location == AppRoutes.parentMore;
}
