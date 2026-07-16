import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';

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
      final secureStorage = _MemorySecureStore()
        ..values['schoolos.private_read_cache.1.record'] = 'encrypted-record'
        ..values['schoolos.teacher_attendance_draft.secure.1.record'] =
            'encrypted-draft'
        ..values['school_os_access_token'] = 'token';
      final cleanup = PrivateDataCleanupService(preferences, secureStorage);

      await cleanup.clearPrivateData();

      expect(preferences.getSelectedChildId(), isNull);
      expect(preferences.getCachedUser(), isNull);
      expect(preferences.getPrivateCache('payslips'), isNull);
      expect(preferences.getThemeMode(), 'dark');
      expect(
        secureStorage.values.containsKey(
          'schoolos.private_read_cache.1.record',
        ),
        isFalse,
      );
      expect(
        secureStorage.values.containsKey(
          'schoolos.teacher_attendance_draft.secure.1.record',
        ),
        isFalse,
      );
      expect(secureStorage.values['school_os_access_token'], 'token');
      expect(temporaryProtectedDir.existsSync(), isFalse);
      expect(documentsProtectedDir.existsSync(), isFalse);
      expect(legacyPayslipDir.existsSync(), isFalse);
    },
  );

  test(
    'falls back to clearing secure storage when prefix deletion fails',
    () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final secureStorage = _MemorySecureStore()
        ..failPrefixDelete = true
        ..values['schoolos.private_read_cache.1.record'] = 'encrypted-record'
        ..values['school_os_access_token'] = 'stale-token';

      await PrivateDataCleanupService(
        preferences,
        secureStorage,
      ).clearPrivateData();

      expect(secureStorage.clearAllCalled, isTrue);
      expect(secureStorage.values, isEmpty);
    },
  );
}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  bool failPrefixDelete = false;
  bool clearAllCalled = false;

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }

  @override
  Future<void> clearAll() async {
    clearAllCalled = true;
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    if (failPrefixDelete) throw StateError('prefix delete failed');
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}
