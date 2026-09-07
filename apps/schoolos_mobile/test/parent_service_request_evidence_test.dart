import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/core/network/connectivity_provider.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/private_data_cleanup_service.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_service_request_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_service_requests_screen.dart';

class _MockPicker extends Mock implements ImagePicker {}

class _UnreadableImage extends Fake implements XFile {
  @override
  String get name => 'unreadable.jpg';

  @override
  Future<Uint8List> readAsBytes() async =>
      throw StateError('private file path');
}

class _MockConnectivity extends Mock implements Connectivity {}

class _MockRepository extends Mock implements ParentRepository {}

class _MockPreferences extends Mock implements AppPreferencesService {}

class _MockCleanup extends Mock implements PrivateDataCleanupService {}

class _MockCache extends Mock implements PrivateReadCache {}

const _child = GuardianChild(
  id: 'child-1',
  name: 'Test Child',
  classSection: 'Grade 4 - A',
  rollNumber: '7',
  academicYear: '2083',
  relationship: 'Child',
);

class _StaticParentController extends ParentController {
  _StaticParentController()
    : super(
        repository: _MockRepository(),
        preferences: _MockPreferences(),
        privateDataCleanup: _MockCleanup(),
        privateReadCache: _MockCache(),
        isOnline: true,
      ) {
    state = const ParentState(
      status: ParentDataStatus.success,
      children: [_child],
      selectedChildId: 'child-1',
    );
  }
  @override
  Future<void> load({String? childId}) async {}
}

void main() {
  late _MockPicker picker;
  late Future<XFile?> Function() pick;

  setUp(() {
    picker = _MockPicker();
    pick = () async => null;
    when(
      () => picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
        requestFullMetadata: false,
      ),
    ).thenAnswer((_) => pick());
  });

  Future<void> pump(WidgetTester tester, {bool existing = false}) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final connectivity = _MockConnectivity();
    when(
      () => connectivity.onConnectivityChanged,
    ).thenAnswer((_) => const Stream.empty());
    when(
      () => connectivity.checkConnectivity(),
    ).thenAnswer((_) async => [ConnectivityResult.wifi]);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          parentEvidencePickerProvider.overrideWithValue(picker),
          connectivityProvider.overrideWith(
            (ref) => ConnectivityNotifier(connectivity)..setOnline(true),
          ),
          parentControllerProvider.overrideWith(
            (ref) => _StaticParentController(),
          ),
          parentDashboardSummaryProvider.overrideWith(
            (ref, childId) async => throw StateError('Unavailable'),
          ),
          parentServiceRequestsProvider.overrideWith(
            (ref, childId) async => ParentServiceRequestList.fromJson({
              'items': existing
                  ? [
                      {
                        'id': 'request-1',
                        'subject': 'Existing request',
                        'student': {'id': 'child-1', 'name': 'Test Child'},
                        'actions': {'addEvidence': true},
                      },
                    ]
                  : [],
            }),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ParentServiceRequestsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openComposer(WidgetTester tester) async {
    await pump(tester);
    await tester.tap(find.text('New request'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).first,
      'Keep this subject',
    );
    await tester.enterText(
      find.byType(TextFormField).last,
      'Keep the request description.',
    );
  }

  testWidgets('permission denial preserves the request and allows retry', (
    tester,
  ) async {
    await openComposer(tester);
    pick = () async => throw PlatformException(
      code: 'photo_access_denied',
      message: 'private native detail',
    );
    await tester.ensureVisible(find.text('Add photo evidence (optional)'));
    await tester.tap(find.text('Add photo evidence (optional)'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Check photo access in device settings'),
      findsOneWidget,
    );
    expect(find.text('Keep this subject'), findsOneWidget);
    expect(find.text('Keep the request description.'), findsOneWidget);
    expect(find.textContaining('private native detail'), findsNothing);
    expect(tester.takeException(), isNull);

    pick = () async =>
        XFile.fromData(Uint8List.fromList([1, 2, 3]), path: 'evidence.jpg');
    await tester.tap(find.text('Add photo evidence (optional)'));
    await tester.pumpAndSettle();
    expect(find.text('Photo: evidence.jpg'), findsOneWidget);
    expect(
      find.textContaining('Check photo access in device settings'),
      findsNothing,
    );
  });

  testWidgets(
    'picker cancellation and read failure preserve previous evidence',
    (tester) async {
      await openComposer(tester);
      pick = () async =>
          XFile.fromData(Uint8List.fromList([1]), path: 'first.jpg');
      await tester.ensureVisible(find.text('Add photo evidence (optional)'));
      await tester.tap(find.text('Add photo evidence (optional)'));
      await tester.pumpAndSettle();
      pick = () async => null;
      await tester.tap(find.text('Photo: first.jpg'));
      await tester.pumpAndSettle();
      expect(find.text('Photo: first.jpg'), findsOneWidget);
      pick = () async => _UnreadableImage();
      await tester.tap(find.text('Photo: first.jpg'));
      await tester.pumpAndSettle();
      expect(
        find.text('Photo could not be opened. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('Photo: first.jpg'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'cannot send while picker is pending and safely handles sheet dismissal',
    (tester) async {
      await openComposer(tester);
      final pending = Completer<XFile?>();
      pick = () => pending.future;
      await tester.ensureVisible(find.text('Add photo evidence (optional)'));
      await tester.tap(find.text('Add photo evidence (optional)'));
      await tester.pump();
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Send request'),
      );
      expect(button.onPressed, isNull);
      Navigator.of(tester.element(find.text('Send request'))).pop();
      await tester.pumpAndSettle();
      pending.completeError(PlatformException(code: 'photo_access_denied'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'existing request evidence reports picker failures without losing the request',
    (tester) async {
      await pump(tester, existing: true);
      await tester.tap(find.text('Existing request'));
      await tester.pumpAndSettle();
      pick = () async => throw PlatformException(
        code: 'already_active',
        message: 'private native detail',
      );
      await tester.ensureVisible(find.text('Add evidence'));
      await tester.tap(find.text('Add evidence'));
      await tester.pumpAndSettle();
      expect(
        find.text('Photo could not be opened. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('Existing request'), findsOneWidget);
      expect(find.textContaining('private native detail'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
