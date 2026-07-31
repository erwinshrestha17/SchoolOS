import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/app_preferences_service.dart';

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) {
    final preferences = ref.watch(appPreferencesServiceProvider);
    return ThemeModeController(preferences);
  },
);

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(this._preferences)
    : super(_parseThemeMode(_preferences.getThemeMode()));

  final AppPreferencesService _preferences;

  Future<void> setThemeMode(ThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    await _preferences.saveThemeMode(_storageValue(mode));
  }

  static ThemeMode _parseThemeMode(String? value) {
    return switch (value) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  static String _storageValue(ThemeMode mode) {
    return switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
  }
}

String themeModeLabel(ThemeMode mode) {
  return switch (mode) {
    ThemeMode.system => 'System default',
    ThemeMode.light => 'Light',
    ThemeMode.dark => 'Dark',
  };
}
