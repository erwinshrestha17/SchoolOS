import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/storage/app_preferences_service.dart';
import 'core/config/env_config.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  EnvConfig.validate();

  final sharedPrefs = await SharedPreferences.getInstance();
  final appPreferences = AppPreferencesService(sharedPrefs);
  await appPreferences.purgeLegacyPrivateReadCache();
  await appPreferences.purgeLegacyTeacherAttendanceDrafts();

  runApp(
    ProviderScope(
      overrides: [
        appPreferencesServiceProvider.overrideWithValue(appPreferences),
      ],
      child: const SchoolOSApp(),
    ),
  );
}
