import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'app_preferences_service.dart';

class PrivateDataCleanupService {
  const PrivateDataCleanupService(this._preferences);

  final AppPreferencesService _preferences;

  Future<void> clearPrivateData() async {
    await _preferences.clearPrivateData();
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
