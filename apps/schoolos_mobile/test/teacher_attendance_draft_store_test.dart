import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/storage/teacher_attendance_draft_store.dart';

void main() {
  late _MemorySecureStore storage;
  late DateTime now;

  setUp(() {
    storage = _MemorySecureStore();
    now = DateTime.utc(2026, 7, 16, 8);
  });

  TeacherAttendanceDraftStore store({
    String tenantId = 'tenant-1',
    String userId = 'teacher-1',
    String role = MobileRole.teacher,
    AppPreferencesService? preferences,
    int maxRecordBytes = TeacherAttendanceDraftStore.defaultMaxRecordBytes,
    int maxTotalBytes = TeacherAttendanceDraftStore.defaultMaxTotalBytes,
  }) {
    return TeacherAttendanceDraftStore(
      storage,
      scope: TeacherAttendanceDraftScope(
        tenantId: tenantId,
        userId: userId,
        role: role,
      ),
      preferences: preferences,
      now: () => now,
      maxRecordBytes: maxRecordBytes,
      maxTotalBytes: maxTotalBytes,
    );
  }

  test(
    'keeps a stable submission payload in teacher-scoped secure storage',
    () async {
      final drafts = store();
      const payload = {
        'clientSubmissionId': 'mobile-attendance-stable-1',
        'savedAt': '2026-07-16T08:00:00.000Z',
        'entries': [
          {'studentId': 'student-1', 'status': 'ABSENT'},
        ],
      };

      expect(
        await drafts.write(
          classSectionId: 'year-1:class-1:section-1',
          date: '2026-07-16',
          payload: payload,
        ),
        isTrue,
      );

      final loaded = await drafts.read(
        classSectionId: 'year-1:class-1:section-1',
        date: '2026-07-16',
      );
      expect(loaded?['clientSubmissionId'], 'mobile-attendance-stable-1');
      expect(
        storage.values.keys,
        everyElement(startsWith('schoolos.teacher_attendance_draft.secure.')),
      );
    },
  );

  test('isolates drafts across tenant and teacher scope', () async {
    final first = store();
    await first.write(
      classSectionId: 'class-1',
      date: '2026-07-16',
      payload: const {'clientSubmissionId': 'submission-1'},
    );

    expect(
      await store(
        userId: 'teacher-2',
      ).read(classSectionId: 'class-1', date: '2026-07-16'),
      isNull,
    );
    expect(
      await store(
        tenantId: 'tenant-2',
      ).read(classSectionId: 'class-1', date: '2026-07-16'),
      isNull,
    );
    expect(
      await store(role: MobileRole.parent).write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: const {'clientSubmissionId': 'submission-parent'},
      ),
      isFalse,
    );
  });

  test('expires and deletes drafts after 48 hours', () async {
    final drafts = store();
    await drafts.write(
      classSectionId: 'class-1',
      date: '2026-07-16',
      payload: const {'clientSubmissionId': 'submission-1'},
    );

    now = now.add(const Duration(hours: 48, seconds: 1));

    expect(
      await drafts.read(classSectionId: 'class-1', date: '2026-07-16'),
      isNull,
    );
    expect(storage.values, isEmpty);
  });

  test('rejects a draft that exceeds the per-record quota', () async {
    final drafts = store(maxRecordBytes: 300, maxTotalBytes: 600);

    expect(
      await drafts.write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: {'entries': List.filled(600, 'x').join()},
      ),
      isFalse,
    );
    expect(storage.values, isEmpty);
  });

  test('quota rejection preserves every valid pending draft', () async {
    final drafts = store(maxRecordBytes: 700, maxTotalBytes: 800);
    final payload = {
      'clientSubmissionId': 'submission-1',
      'entries': List.filled(220, 'x').join(),
    };

    expect(
      await drafts.write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: payload,
      ),
      isTrue,
    );
    expect(
      await drafts.write(
        classSectionId: 'class-2',
        date: '2026-07-16',
        payload: {...payload, 'clientSubmissionId': 'submission-2'},
      ),
      isFalse,
    );

    expect(
      await drafts.read(classSectionId: 'class-1', date: '2026-07-16'),
      containsPair('clientSubmissionId', 'submission-1'),
    );
    expect(
      await drafts.read(classSectionId: 'class-2', date: '2026-07-16'),
      isNull,
    );
  });

  test('oversized replacement leaves the prior valid draft intact', () async {
    final drafts = store(maxRecordBytes: 500, maxTotalBytes: 1000);
    expect(
      await drafts.write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: const {'clientSubmissionId': 'submission-stable'},
      ),
      isTrue,
    );

    expect(
      await drafts.write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: {'entries': List.filled(800, 'x').join()},
      ),
      isFalse,
    );

    expect(
      await drafts.read(classSectionId: 'class-1', date: '2026-07-16'),
      containsPair('clientSubmissionId', 'submission-stable'),
    );
  });

  test('corrupt records are removed before quota is evaluated', () async {
    storage.values['schoolos.teacher_attendance_draft.secure.1.corrupt'] =
        'not-json';
    final drafts = store(maxRecordBytes: 700, maxTotalBytes: 700);

    expect(
      await drafts.write(
        classSectionId: 'class-1',
        date: '2026-07-16',
        payload: const {'clientSubmissionId': 'submission-1'},
      ),
      isTrue,
    );

    expect(
      storage.values.containsKey(
        'schoolos.teacher_attendance_draft.secure.1.corrupt',
      ),
      isFalse,
    );
  });

  test('purges legacy unscoped SharedPreferences drafts', () async {
    SharedPreferences.setMockInitialValues({
      'schoolos.teacher_attendance_draft.class-1.2026-07-16': '{}',
      'app_theme_mode': 'dark',
    });
    final sharedPreferences = await SharedPreferences.getInstance();
    final preferences = AppPreferencesService(sharedPreferences);
    final drafts = store(preferences: preferences);

    await drafts.read(classSectionId: 'class-1', date: '2026-07-16');

    expect(
      sharedPreferences.getString(
        'schoolos.teacher_attendance_draft.class-1.2026-07-16',
      ),
      isNull,
    );
    expect(preferences.getThemeMode(), 'dark');
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
