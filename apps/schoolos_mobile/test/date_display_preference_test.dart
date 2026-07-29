import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/shared/utils/date_display_preference.dart';

void main() {
  test(
    'defaults to both date systems and persists the parent preference',
    () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final controller = DateDisplayPreferenceController(preferences);
      addTearDown(controller.dispose);

      expect(controller.state, DateDisplayPreference.both);

      await controller.setPreference(DateDisplayPreference.bikramSambat);

      expect(controller.state, DateDisplayPreference.bikramSambat);
      expect(preferences.getDateDisplayPreference(), 'bikram_sambat');
    },
  );

  test('formats BS first when both date systems are selected', () {
    final date = DateTime.utc(2026, 7, 26);

    expect(
      formatPreferredDate(date, DateDisplayPreference.both),
      'Shrawan 10, 2083',
    );
    expect(
      formatSecondaryDate(date, DateDisplayPreference.both),
      'July 26, 2026',
    );
    expect(
      formatPreferredDate(date, DateDisplayPreference.gregorian),
      'July 26, 2026',
    );
    expect(
      formatSecondaryDate(date, DateDisplayPreference.bikramSambat),
      isNull,
    );
  });
}
