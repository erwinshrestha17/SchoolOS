import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/features/parent/application/parent_portal_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_portal_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';

class _MockParentPortalRepository extends Mock
    implements ParentPortalRepository {}

void main() {
  test(
    'active child change clears portal data and refetches that child',
    () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = AppPreferencesService(
        await SharedPreferences.getInstance(),
      );
      final repository = _MockParentPortalRepository();
      final childBResult = Completer<ParentPortalData>();

      when(
        () => repository.load(activeChildId: null),
      ).thenAnswer((_) async => _portalData('child-a'));
      when(
        () => repository.load(activeChildId: 'child-b'),
      ).thenAnswer((_) => childBResult.future);

      final container = ProviderContainer(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(preferences),
          parentPortalRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      final initial = await container.read(parentPortalDataProvider.future);
      expect(initial.activeChild?.id, 'child-a');

      container.read(parentActiveChildIdProvider.notifier).state = 'child-b';
      expect(container.read(parentPortalDataProvider).isLoading, isTrue);

      childBResult.complete(_portalData('child-b'));
      final switched = await container.read(parentPortalDataProvider.future);

      expect(switched.activeChild?.id, 'child-b');
      verify(() => repository.load(activeChildId: 'child-b')).called(1);
    },
  );
}

ParentPortalData _portalData(String activeChildId) {
  return ParentPortalData(
    parentName: 'Parent',
    schoolName: 'School',
    lastUpdated: DateTime(2024, 1, 1, 9, 30),
    activeChildId: activeChildId,
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Asha Rai',
        classSection: 'Grade 4 - A',
        teacher: 'Class teacher',
        attendance: 'Present today',
        attendanceTime: 'Updated now',
        transport: 'No active trip',
        homework: 'No pending homework',
        updates: 'No unread updates',
      ),
      ParentPortalChild(
        id: 'child-b',
        name: 'Bikash Rai',
        classSection: 'Grade 2 - B',
        teacher: 'Class teacher',
        attendance: 'Present today',
        attendanceTime: 'Updated now',
        transport: 'No active trip',
        homework: 'No pending homework',
        updates: 'No unread updates',
      ),
    ],
    homework: const [],
    updates: const [],
  );
}
