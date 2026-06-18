import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';

void main() {
  test('stores safe read data with a last-updated timestamp', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    final cache = PrivateReadCache(preferences);

    await cache.write('parent_children', {
      'items': [
        {'id': 'child-1'},
      ],
    });

    final cached = cache.read('parent_children');
    expect(cached, isNotNull);
    expect(cached!.data['items'], isA<List<dynamic>>());
    expect(cached.withMetadata()['_mobileFromCache'], isTrue);
    expect(cached.savedAt.millisecondsSinceEpoch, greaterThan(0));
  });

  test(
    'logout cleanup removes private data but preserves preferences',
    () async {
      SharedPreferences.setMockInitialValues({
        'app_theme_mode': 'dark',
        'app_tenant_code': 'default-school',
        'app_selected_child_id': 'child-1',
        'app_cached_user': '{"id":"user-1"}',
        'app_private_read_cache_parent_children': '{"data":{}}',
        'schoolos.teacher_attendance_draft.class-1.2026-06-18': '{}',
      });
      final sharedPreferences = await SharedPreferences.getInstance();
      final preferences = AppPreferencesService(sharedPreferences);

      await preferences.clearPrivateData();

      expect(preferences.getThemeMode(), 'dark');
      expect(preferences.getTenantCode(), 'default-school');
      expect(preferences.getSelectedChildId(), isNull);
      expect(preferences.getCachedUser(), isNull);
      expect(preferences.getPrivateCache('parent_children'), isNull);
      expect(
        sharedPreferences.getString(
          'schoolos.teacher_attendance_draft.class-1.2026-06-18',
        ),
        isNull,
      );
    },
  );
}
