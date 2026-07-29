import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_homework_tab.dart';

void main() {
  testWidgets('homework filter sheet stays polished on a compact phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final now = DateTime.utc(2026, 7, 29, 6);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: Scaffold(
          body: ParentPortalHomeworkTab(
            now: now,
            data: _filterPreviewData(now),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Filter'));
    await tester.pumpAndSettle();

    expect(find.text('Filter homework'), findsOneWidget);
    expect(find.text('Clear all'), findsOneWidget);
    expect(find.text('Apply filters'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await expectLater(
      find.byType(Overlay),
      matchesGoldenFile('goldens/parent_homework_filter_sheet.png'),
    );
  });
}

ParentPortalData _filterPreviewData(DateTime now) {
  return ParentPortalData(
    parentName: 'Sita Adhikari',
    schoolName: 'Everest School',
    lastUpdated: now,
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        teacher: 'Raj Sharma',
        attendance: 'Present today',
        attendanceTime: 'Updated',
        transport: 'No active trip',
        homework: '3 homework tasks pending',
        updates: 'No unread updates',
        capabilities: {'ACADEMICS_VIEW'},
      ),
    ],
    homework: [
      ParentPortalHomework(
        id: 'maths',
        childId: 'child-a',
        childName: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        subject: 'Mathematics',
        title: 'Mathematics practice',
        dueLabel: 'Overdue',
        dueAt: now.subtract(const Duration(days: 1)),
        rawStatus: 'NOT_SUBMITTED',
        attachmentCount: 0,
        teacher: 'Raj Sharma',
      ),
      ParentPortalHomework(
        id: 'nepali',
        childId: 'child-a',
        childName: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        subject: 'Nepali',
        title: 'Nepali reading',
        dueLabel: 'Due soon',
        dueAt: now.add(const Duration(days: 1)),
        rawStatus: 'NOT_SUBMITTED',
        attachmentCount: 0,
        teacher: 'Sita Sharma',
      ),
    ],
    updates: const [],
  );
}
