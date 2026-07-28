import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('principal institutional improvement contract', () {
    final repository = File(
      'lib/features/principal/data/principal_repository.dart',
    ).readAsStringSync();
    final screens = File(
      'lib/features/principal/presentation/screens/principal_screens.dart',
    ).readAsStringSync();
    final routes = File('lib/app/constants/app_routes.dart').readAsStringSync();

    test('uses purpose-limited Stage 4 mobile endpoints', () {
      for (final endpoint in [
        '/mobile/principal/classroom-walkthroughs',
        '/mobile/principal/school-improvement-plans',
        '/mobile/principal/school-improvement-actions/',
        '/mobile/principal/board-exam-readiness/',
      ]) {
        expect(repository, contains(endpoint));
      }
      expect(repository, contains('clientRequestId'));
      expect(repository, contains('expectedVersion'));
      expect(repository, contains("'reason': reason.trim()"));
    });

    test('renders real observation, plan, and readiness actions', () {
      expect(screens, contains('Record classroom observation'));
      expect(screens, contains('Save follow-up'));
      expect(screens, contains('Improvement action updated.'));
      expect(screens, contains('Operational checks only'));
      expect(screens, contains('do not predict student results'));
      expect(screens, contains('Count unavailable'));
      expect(screens, contains('showSchoolBsDatePicker'));
      expect(
        screens,
        isNot(contains('Walkthrough observation capture is not enabled')),
      );
      expect(
        screens,
        isNot(contains('Walkthrough follow-up capture is not enabled')),
      );
    });

    test('keeps the combined screen on a principal-only route', () {
      expect(
        routes,
        contains(
          "principalInstitutionalImprovement =\n"
          "      '/principal/institutional-improvement'",
        ),
      );
    });
  });
}
