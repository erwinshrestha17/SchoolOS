import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';

void main() {
  late _MemorySecureStore storage;
  late DateTime now;

  setUp(() {
    storage = _MemorySecureStore();
    now = DateTime.utc(2026, 7, 16, 8);
  });

  PrivateReadCache parentCache({
    String tenantId = 'tenant-1',
    String userId = 'parent-1',
    int maxRecordBytes = PrivateReadCache.defaultMaxRecordBytes,
    int maxTotalBytes = PrivateReadCache.defaultMaxTotalBytes,
    AppPreferencesService? preferences,
  }) {
    return PrivateReadCache(
      storage,
      scope: PrivateReadCacheScope(
        tenantId: tenantId,
        userId: userId,
        role: MobileRole.parent,
      ),
      preferences: preferences,
      now: () => now,
      maxRecordBytes: maxRecordBytes,
      maxTotalBytes: maxTotalBytes,
    );
  }

  test(
    'stores an allowlisted read through encrypted storage metadata',
    () async {
      final cache = parentCache();

      expect(
        await cache.write('parent_children', {
          'items': [
            {'id': 'child-1'},
          ],
        }),
        isTrue,
      );

      final cached = await cache.read('parent_children');
      expect(cached, isNotNull);
      expect(cached!.data['items'], isA<List<dynamic>>());
      expect(cached.withMetadata()['_mobileFromCache'], isTrue);
      expect(cached.savedAt, now);
      expect(
        storage.values.keys,
        everyElement(startsWith('schoolos.private_read_cache.')),
      );
    },
  );

  test('fails closed when cache scope is missing', () async {
    final cache = PrivateReadCache(storage, scope: null, now: () => now);

    expect(await cache.write('parent_children', {'items': []}), isFalse);
    expect(await cache.read('parent_children'), isNull);
    expect(storage.values, isEmpty);
  });

  test('isolates the same resource across tenants and users', () async {
    final first = parentCache();
    final otherUser = parentCache(userId: 'parent-2');
    final otherTenant = parentCache(tenantId: 'tenant-2');
    await first.write('parent_children', {
      'items': [
        {'id': 'child-1'},
      ],
    });

    expect(await first.read('parent_children'), isNotNull);
    expect(await otherUser.read('parent_children'), isNull);
    expect(await otherTenant.read('parent_children'), isNull);
  });

  test(
    'rejects non-allowlisted principal and sensitive parent records',
    () async {
      final parent = parentCache();
      final principal = PrivateReadCache(
        storage,
        scope: PrivateReadCacheScope(
          tenantId: 'tenant-1',
          userId: 'principal-1',
          role: MobileRole.principal,
        ),
        now: () => now,
      );

      expect(
        await parent.write('parent_profile_child-1', {'id': 'child-1'}),
        isFalse,
      );
      expect(
        await parent.write('parent_report_cards_child-1', {'items': []}),
        isFalse,
      );
      expect(
        await parent.write('parent_dashboard_child-1', {'fees': {}}),
        isFalse,
      );
      expect(
        await principal.write('principal_dashboard', {'total': 1}),
        isFalse,
      );
      expect(storage.values, isEmpty);
    },
  );

  test('expires records using the current allowlist TTL', () async {
    final cache = parentCache();
    await cache.write('parent_children', {'items': []});

    now = now.add(const Duration(hours: 6, seconds: 1));

    expect(await cache.read('parent_children'), isNull);
    expect(storage.values, isEmpty);
  });

  test(
    'enforces per-record quota and rejects protected file references',
    () async {
      final cache = parentCache(maxRecordBytes: 300, maxTotalBytes: 600);

      expect(
        await cache.write('parent_homework_child-1_30', {
          'content': List.filled(600, 'x').join(),
        }),
        isFalse,
      );
      expect(
        await cache.write('parent_homework_child-1_30', {
          'downloadUrl': 'https://private.example/file',
        }),
        isFalse,
      );
      expect(storage.values, isEmpty);
    },
  );

  test('evicts the oldest record before exceeding total quota', () async {
    final cache = parentCache(maxRecordBytes: 650, maxTotalBytes: 800);
    final payload = {'value': List.filled(270, 'x').join()};
    expect(await cache.write('parent_homework_child-1_30', payload), isTrue);
    now = now.add(const Duration(minutes: 1));
    expect(await cache.write('parent_timetable_child-1', payload), isTrue);

    expect(await cache.read('parent_homework_child-1_30'), isNull);
    expect(await cache.read('parent_timetable_child-1'), isNotNull);
    final total = storage.values.values.fold<int>(
      0,
      (sum, value) => sum + value.length,
    );
    expect(total, lessThanOrEqualTo(800));
  });

  test('purges the legacy SharedPreferences private-read cache', () async {
    SharedPreferences.setMockInitialValues({
      'app_private_read_cache_parent_children': '{"data":{}}',
      'app_theme_mode': 'dark',
    });
    final preferences = AppPreferencesService(
      await SharedPreferences.getInstance(),
    );
    final cache = parentCache(preferences: preferences);

    await cache.read('parent_children');

    expect(preferences.getPrivateCache('parent_children'), isNull);
    expect(preferences.getThemeMode(), 'dark');
  });

  test('logout preference cleanup preserves non-private preferences', () async {
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
  });
}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};

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
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}
