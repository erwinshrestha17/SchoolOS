import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory temporaryDir;
  late Directory documentsDir;

  setUp(() {
    temporaryDir = Directory.systemTemp.createTempSync(
      'schoolos_cleanup_temp_',
    );
    documentsDir = Directory.systemTemp.createTempSync(
      'schoolos_cleanup_docs_',
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (call) async {
            if (call.method == 'getTemporaryDirectory') {
              return temporaryDir.path;
            }
            if (call.method == 'getApplicationDocumentsDirectory') {
              return documentsDir.path;
            }
            return null;
          },
        );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          null,
        );
    if (temporaryDir.existsSync()) {
      temporaryDir.deleteSync(recursive: true);
    }
    if (documentsDir.existsSync()) {
      documentsDir.deleteSync(recursive: true);
    }
  });

  test(
    'clears preferences plus current and legacy private file directories',
    () async {
      SharedPreferences.setMockInitialValues({
        'app_selected_child_id': 'child-1',
        'app_cached_user': '{"id":"staff-user"}',
        'app_private_read_cache_payslips': '{"items":[]}',
        'schoolos.teacher_attendance_draft.class-1.2026-06-18': '{}',
        'app_theme_mode': 'dark',
      });

      final temporaryProtectedDir = Directory('${temporaryDir.path}/schoolos');
      final documentsProtectedDir = Directory('${documentsDir.path}/schoolos');
      final legacyPayslipDir = Directory('${documentsDir.path}/payslips');
      temporaryProtectedDir.createSync(recursive: true);
      documentsProtectedDir.createSync(recursive: true);
      legacyPayslipDir.createSync(recursive: true);
      File(
        '${temporaryProtectedDir.path}/payslip.pdf',
      ).writeAsStringSync('pdf');
      File(
        '${documentsProtectedDir.path}/receipt.pdf',
      ).writeAsStringSync('pdf');
      File('${legacyPayslipDir.path}/old-payslip.pdf').writeAsStringSync('pdf');

      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final cleanup = PrivateDataCleanupService(preferences);

      await cleanup.clearPrivateData();

      expect(preferences.getSelectedChildId(), isNull);
      expect(preferences.getCachedUser(), isNull);
      expect(preferences.getPrivateCache('payslips'), isNull);
      expect(preferences.getThemeMode(), 'dark');
      expect(temporaryProtectedDir.existsSync(), isFalse);
      expect(documentsProtectedDir.existsSync(), isFalse);
      expect(legacyPayslipDir.existsSync(), isFalse);
    },
  );
}
