import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/app_preferences_service.dart';
import 'nepali_bs_calendar.dart';

enum DateDisplayPreference {
  bikramSambat,
  gregorian,
  both;

  String get storageValue => switch (this) {
    DateDisplayPreference.bikramSambat => 'bikram_sambat',
    DateDisplayPreference.gregorian => 'gregorian',
    DateDisplayPreference.both => 'both',
  };

  String get label => switch (this) {
    DateDisplayPreference.bikramSambat => 'Bikram Sambat',
    DateDisplayPreference.gregorian => 'Gregorian',
    DateDisplayPreference.both => 'Show both',
  };

  static DateDisplayPreference fromStorage(String? value) {
    return DateDisplayPreference.values.firstWhere(
      (item) => item.storageValue == value,
      orElse: () => DateDisplayPreference.both,
    );
  }
}

final dateDisplayPreferenceProvider =
    StateNotifierProvider<
      DateDisplayPreferenceController,
      DateDisplayPreference
    >((ref) {
      final preferences = ref.watch(appPreferencesServiceProvider);
      return DateDisplayPreferenceController(preferences);
    });

class DateDisplayPreferenceController
    extends StateNotifier<DateDisplayPreference> {
  DateDisplayPreferenceController(this._preferences)
    : super(
        DateDisplayPreference.fromStorage(
          _preferences.getDateDisplayPreference(),
        ),
      );

  final AppPreferencesService _preferences;

  Future<void> setPreference(DateDisplayPreference preference) async {
    if (state == preference) return;
    state = preference;
    await _preferences.saveDateDisplayPreference(preference.storageValue);
  }
}

String formatPreferredDate(
  DateTime value,
  DateDisplayPreference preference, {
  bool long = false,
}) {
  return switch (preference) {
    DateDisplayPreference.gregorian => formatGregorianDate(value, long: long),
    DateDisplayPreference.bikramSambat || DateDisplayPreference.both =>
      NepaliBsCalendar.formatBsDate(value, long: long),
  };
}

String? formatSecondaryDate(DateTime value, DateDisplayPreference preference) {
  if (preference != DateDisplayPreference.both) return null;
  return formatGregorianDate(value);
}

String formatGregorianDate(DateTime value, {bool long = false}) {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const weekdayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  final standard = '${monthNames[value.month - 1]} ${value.day}, ${value.year}';
  return long ? '${weekdayNames[value.weekday - 1]}, $standard' : standard;
}
