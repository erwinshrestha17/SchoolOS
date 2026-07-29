import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_homework_tab.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_portal_widgets.dart';

void main() {
  final now = DateTime.utc(2026, 7, 29, 6);

  testWidgets(
    'homework summary is actionable and marked late work has one truthful status',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ParentPortalHomeworkTab(data: _data(now), now: now),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('3 Overdue'), findsOneWidget);
      expect(find.text('0 Due soon'), findsOneWidget);
      expect(find.text('1 Completed'), findsOneWidget);
      expect(find.text('All assignments · 4'), findsOneWidget);

      await tester.tap(find.text('1 Completed'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Completed late'), findsOneWidget);
      expect(find.text('9/10'), findsOneWidget);
      expect(find.text('Teacher feedback available'), findsOneWidget);
      expect(find.text('View feedback'), findsOneWidget);
      expect(find.text('Reviewed in class.'), findsNothing);
      expect(find.textContaining('0 attachment'), findsNothing);
      expect(find.text('Class 1-A Mathematics Review 3'), findsNothing);
      expect(find.text('Mathematics Review 3'), findsOneWidget);
      expect(find.text('Completed assignments · 1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('overdue summary filters to unfinished work', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ParentPortalHomeworkTab(data: _data(now), now: now),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('3 Overdue'));
    await tester.pumpAndSettle();

    expect(find.text('Overdue assignments · 3'), findsOneWidget);
    expect(find.text('Nepali Practice 1'), findsOneWidget);
    expect(find.text('English Practice 2'), findsOneWidget);
    expect(find.text('No submission'), findsWidgets);
    expect(find.text('View homework'), findsWidgets);
    expect(find.textContaining('Completed late'), findsNothing);
    expect(
      tester.getSize(find.byType(HomeworkCard).first).height,
      lessThanOrEqualTo(220),
      reason: 'two to three compact cards should fit in a phone viewport',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('filter sheet exposes only backed homework controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ParentPortalHomeworkTab(data: _data(now), now: now),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Filter'));
    await tester.pumpAndSettle();

    expect(find.text('Sort and filter'), findsOneWidget);
    expect(find.text('Sort by'), findsOneWidget);
    expect(find.text('Subject'), findsOneWidget);
    expect(find.text('Teacher'), findsOneWidget);
    expect(find.text('Due date range'), findsOneWidget);
    expect(find.text('Apply filters'), findsOneWidget);
    expect(find.text('School or branch'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

ParentPortalData _data(DateTime now) {
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
        id: 'marked',
        childId: 'child-a',
        childName: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        subject: 'Mathematics',
        title: 'Class 1-A Mathematics Review 3',
        dueLabel: 'Due',
        dueAt: now.subtract(const Duration(days: 11)),
        rawStatus: 'REVIEWED',
        attachmentCount: 0,
        teacher: 'Raj Sharma',
        submittedAt: now.subtract(const Duration(days: 10)),
        score: 9,
        maxScore: 10,
        feedback: 'Reviewed in class.',
      ),
      _overdue(
        id: 'nepali',
        title: 'Class 1-A Nepali Practice 1',
        subject: 'Nepali',
        dueAt: now.subtract(const Duration(days: 3)),
      ),
      _overdue(
        id: 'english',
        title: 'Class 1-A English Practice 2',
        subject: 'English',
        dueAt: now.subtract(const Duration(days: 2)),
      ),
      _overdue(
        id: 'science',
        title: 'Class 1-A Science Practice',
        subject: 'Science',
        dueAt: now.subtract(const Duration(days: 1)),
      ),
    ],
    updates: const [],
  );
}

ParentPortalHomework _overdue({
  required String id,
  required String title,
  required String subject,
  required DateTime dueAt,
}) {
  return ParentPortalHomework(
    id: id,
    childId: 'child-a',
    childName: 'Aarav Adhikari',
    classSection: 'Class 1 - A',
    subject: subject,
    title: title,
    dueLabel: 'Overdue',
    dueAt: dueAt,
    rawStatus: 'NOT_SUBMITTED',
    attachmentCount: 0,
    teacher: 'Sita Sharma',
  );
}
