import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/teacher/presentation/widgets/teacher_app_widgets.dart';

/// Two staff-facing regressions found by opening the app on a device.
///
/// The notification bell used `context.go`, which replaces the navigation
/// stack. The notification centre has no bottom nav of its own, so a teacher
/// who tapped the bell had no back arrow and the hardware back button left the
/// app entirely. The parent shell already used `context.push`; the staff
/// surfaces did not.
///
/// The teacher header greeted everyone with "Good morning" whatever the clock
/// said - wrong for most of the school day, and plainly wrong at 9pm.
void main() {
  group('the notification bell keeps the caller on the stack', () {
    const callers = [
      'lib/features/dashboard/presentation/role_dashboards/teacher_dashboard.dart',
      'lib/features/dashboard/presentation/role_dashboards/admin_dashboard.dart',
      'lib/features/principal/presentation/screens/principal_screens.dart',
      'lib/shared/widgets/role_shell_scaffold.dart',
      'lib/shared/widgets/school_os_app_shell.dart',
    ];

    for (final path in callers) {
      test(path.split('/').last, () {
        final source = File(path).readAsStringSync();
        expect(
          source.contains('context.go(AppRoutes.notifications)'),
          isFalse,
          reason:
              'go() replaces the stack, so the notification centre becomes a '
              'dead end with no back arrow; use push()',
        );
      });
    }
  });

  group('the teacher greeting follows the clock', () {
    test('morning', () {
      expect(teacherGreeting(DateTime(2026, 7, 25, 7, 30)), 'Good morning');
      expect(teacherGreeting(DateTime(2026, 7, 25, 11, 59)), 'Good morning');
    });

    test('afternoon', () {
      expect(teacherGreeting(DateTime(2026, 7, 25, 12)), 'Good afternoon');
      expect(teacherGreeting(DateTime(2026, 7, 25, 16, 59)), 'Good afternoon');
    });

    test('evening', () {
      expect(teacherGreeting(DateTime(2026, 7, 25, 17)), 'Good evening');
      // The reading that exposed this: a teacher opening the app at 9:50pm.
      expect(teacherGreeting(DateTime(2026, 7, 25, 21, 50)), 'Good evening');
      expect(teacherGreeting(DateTime(2026, 7, 25, 23, 59)), 'Good evening');
    });

    test('covers every hour of the day', () {
      for (var hour = 0; hour < 24; hour++) {
        expect(
          teacherGreeting(DateTime(2026, 7, 25, hour)),
          isNotEmpty,
          reason: 'hour $hour must produce a greeting',
        );
      }
    });
  });
}
