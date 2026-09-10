import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/theme/app_semantic_colors.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/shared/widgets/role_shell_scaffold.dart';
import 'package:schoolos_mobile/shared/widgets/school_os_app_shell.dart';

void main() {
  testWidgets('parent bottom navigation exposes five task groups', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          bottomNavigationBar: SchoolOsBottomNavigation(
            selectedIndex: 0,
            onSelected: (_) {},
          ),
        ),
      ),
    );

    for (final label in ['Today', 'Child', 'Schoolwork', 'Updates', 'More']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('Attendance'), findsNothing);
    expect(find.text('Notices'), findsNothing);
  });

  testWidgets('teacher bottom navigation keeps frequent work primary', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const RoleShellScaffold(
          role: 'TEACHER',
          selectedIndex: 0,
          body: SizedBox.shrink(),
        ),
      ),
    );

    for (final label in ['Today', 'Attendance', 'Homework', 'More']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('Profile'), findsNothing);
  });

  testWidgets('semantic colors switch with theme brightness', (tester) async {
    Color? lightBackground;
    Color? darkBackground;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Builder(
          builder: (context) {
            lightBackground = AppSemanticColors.of(context).background;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: Builder(
          builder: (context) {
            darkBackground = AppSemanticColors.of(context).background;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(lightBackground, isNotNull);
    expect(darkBackground, isNotNull);
    expect(lightBackground, isNot(darkBackground));
  });
}
