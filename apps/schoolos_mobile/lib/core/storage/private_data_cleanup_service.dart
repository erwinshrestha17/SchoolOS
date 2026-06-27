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
    ]);
  }

  Future<void> _deleteSchoolOsDirectory(
    Future<Directory> Function() resolveDirectory,
  ) async {
    try {
      final baseDirectory = await resolveDirectory();
      final schoolOsDirectory = Directory('${baseDirectory.path}/schoolos');
      if (schoolOsDirectory.existsSync()) {
        await schoolOsDirectory.delete(recursive: true);
      }
    } catch (_) {
      // Filesystem cleanup must not block logout or session expiry.
    }
  }
}
