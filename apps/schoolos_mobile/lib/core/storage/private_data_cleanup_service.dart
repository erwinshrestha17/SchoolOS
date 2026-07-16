import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'app_preferences_service.dart';
import 'private_storage_keys.dart';
import 'secure_storage_service.dart';

class PrivateDataCleanupService {
  const PrivateDataCleanupService(this._preferences, [this._secureStorage]);

  final AppPreferencesService _preferences;
  final SecureKeyValueStore? _secureStorage;

  Future<void> clearPrivateData() async {
    await _preferences.clearPrivateData();
    try {
      await _secureStorage?.deleteByPrefix(privateReadCacheStoragePrefix);
      await _secureStorage?.deleteByPrefix(teacherAttendanceDraftStoragePrefix);
    } catch (_) {
      try {
        // If selective deletion fails, remove every secure record rather than
        // leave private cache behind. Session and installation keys are safe to
        // regenerate after logout.
        await _secureStorage?.clearAll();
      } catch (_) {
        // Secure-storage failure must not block logout or session expiry.
      }
    }
    await Future.wait([
      _deleteSchoolOsDirectory(getTemporaryDirectory),
      _deleteSchoolOsDirectory(getApplicationDocumentsDirectory),
      _deleteLegacyPayslipDirectory(),
    ]);
  }

  Future<void> _deleteSchoolOsDirectory(
    Future<Directory> Function() resolveDirectory,
  ) async {
    try {
      final baseDirectory = await resolveDirectory();
      final schoolOsDirectory = Directory('${baseDirectory.path}/schoolos');
      await _deleteDirectory(schoolOsDirectory);
    } catch (_) {
      // Filesystem cleanup must not block logout or session expiry.
    }
  }

  Future<void> _deleteLegacyPayslipDirectory() async {
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      await _deleteDirectory(Directory('${documentsDirectory.path}/payslips'));
    } catch (_) {
      // Filesystem cleanup must not block logout or session expiry.
    }
  }

  Future<void> _deleteDirectory(Directory directory) async {
    if (directory.existsSync()) {
      await directory.delete(recursive: true);
    }
  }
}
