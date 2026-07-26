import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/app/router.dart';

void main() {
  group('every declared persona route is claimed by its guard', () {
    // The guards in router.dart are hand-maintained allowlists, and a route
    // that is registered but left out of its allowlist is silently unguarded:
    // redirect() never fires, so another role can deep-link straight into the
    // screen. Rather than restate the list here (which would drift the same
    // way), read the declared route constants and assert each one is covered.
    final routes = _declaredRoutes();

    test('app_routes.dart was readable and non-empty', () {
      expect(routes, isNotEmpty);
    });

    for (final entry in routes.entries) {
      final name = entry.key;
      final path = entry.value;

      if (path.startsWith('/principal/')) {
        test('$name is guarded as principal-only', () {
          expect(isPrincipalRoute(path), isTrue);
        });
      } else if (path.startsWith('/teacher/')) {
        test('$name is guarded as teacher-only', () {
          expect(isTeacherRoute(path), isTrue);
        });
      } else if (path.startsWith('/parent/')) {
        test('$name is guarded as parent-only', () {
          expect(isParentRoute(path), isTrue);
        });
      }
    }
  });

  group('persona route guards', () {
    test('principal admissions route is guarded as principal-only', () {
      // Regression: isPrincipalRoute omitted AppRoutes.principalAdmissions
      // even though the router registers it and the More menu links to it, so
      // a parent or teacher deep-linking to /principal/admissions rendered the
      // leadership admissions screen instead of being sent home.
      expect(isPrincipalRoute(AppRoutes.principalAdmissions), isTrue);
      expect(isParentRoute(AppRoutes.principalAdmissions), isFalse);
      expect(isTeacherRoute(AppRoutes.principalAdmissions), isFalse);
    });

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

    test('parent action centre remains guarded as a parent-only route', () {
      expect(isParentRoute(AppRoutes.parentActionCentre), isTrue);
      expect(isPrincipalRoute(AppRoutes.parentActionCentre), isFalse);
      expect(isTeacherRoute(AppRoutes.parentActionCentre), isFalse);
    });

    test('parent weekly progress remains guarded as a parent-only route', () {
      expect(isParentRoute(AppRoutes.parentWeeklyProgress), isTrue);
      expect(isPrincipalRoute(AppRoutes.parentWeeklyProgress), isFalse);
      expect(isTeacherRoute(AppRoutes.parentWeeklyProgress), isFalse);
    });

    test('learning-support routes remain isolated by persona', () {
      expect(isParentRoute(AppRoutes.parentLearningSupport), isTrue);
      expect(isTeacherRoute(AppRoutes.parentLearningSupport), isFalse);
      expect(isPrincipalRoute(AppRoutes.parentLearningSupport), isFalse);

      expect(isTeacherRoute(AppRoutes.teacherStudentLearningSupport), isTrue);
      expect(isParentRoute(AppRoutes.teacherStudentLearningSupport), isFalse);
      expect(
        isPrincipalRoute(AppRoutes.teacherStudentLearningSupport),
        isFalse,
      );

      expect(isPrincipalRoute(AppRoutes.principalLearningSupport), isTrue);
      expect(isParentRoute(AppRoutes.principalLearningSupport), isFalse);
      expect(isTeacherRoute(AppRoutes.principalLearningSupport), isFalse);
    });
  });
}

/// Reads the `static const <name> = '<path>';` declarations out of
/// `app_routes.dart` so this test covers routes added after it was written.
Map<String, String> _declaredRoutes() {
  final source = File('lib/app/constants/app_routes.dart').readAsStringSync();
  final pattern = RegExp(
    r"static const (\w+)\s*=\s*'([^']+)';",
    multiLine: true,
  );
  return {
    for (final match in pattern.allMatches(source))
      match.group(1)!: match.group(2)!,
  };
}
