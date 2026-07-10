import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/app/router.dart';

void main() {
  group('persona route guards', () {
    test('teacher activity route is guarded as a teacher-only route', () {
      // Regression: isTeacherRoute previously omitted AppRoutes.teacherActivity,
      // so the redirect() guard in router.dart never fired for that path and a
      // non-teacher role could navigate to /teacher/activity unguarded.
      expect(isTeacherRoute(AppRoutes.teacherActivity), isTrue);
    });

    test('teacher activity route is not treated as another persona route', () {
      expect(isParentRoute(AppRoutes.teacherActivity), isFalse);
      expect(isPrincipalRoute(AppRoutes.teacherActivity), isFalse);
      expect(isStudentRoute(AppRoutes.teacherActivity), isFalse);
      expect(isStaffRoute(AppRoutes.teacherActivity), isFalse);
      expect(isDriverRoute(AppRoutes.teacherActivity), isFalse);
    });

    test('parent activity route remains guarded as a parent-only route', () {
      expect(isParentRoute(AppRoutes.parentActivity), isTrue);
    });
  });
}
