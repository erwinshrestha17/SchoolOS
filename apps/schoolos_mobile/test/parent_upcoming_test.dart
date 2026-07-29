import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_home_tab.dart';

/// "Coming up" is the dashboard's dated-deadline surface. It must show the
/// selected child's future pending work only. Overdue work belongs in the
/// attention card, where it is stated in words rather than through colour.
void main() {
  Future<void> pump(WidgetTester tester, ParentPortalData data) async {
    tester.view.physicalSize = const Size(420, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ParentPortalHomeTab(data: data)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows only the selected child\'s pending work', (tester) async {
    await pump(tester, _data());

    expect(find.text('Coming up'), findsOneWidget);
    expect(find.text('Nepali Practice'), findsOneWidget);
    expect(
      find.text('Sibling homework'),
      findsNothing,
      reason: 'the other child\'s work must not appear under this child',
    );
    expect(
      find.text('Finished work'),
      findsNothing,
      reason: 'completed homework is not coming up',
    );
  });

  testWidgets('moves overdue work into the attention summary', (tester) async {
    await pump(tester, _data());

    expect(find.text('Overdue maths'), findsNothing);
    expect(find.text('1 homework item is overdue'), findsOneWidget);
  });

  testWidgets('future work leads Coming up', (tester) async {
    await pump(tester, _data());

    final titles = tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data)
        .where((value) => value == 'Nepali Practice')
        .toList();

    expect(
      titles.first,
      'Nepali Practice',
      reason: 'overdue work is summarized above, not repeated here',
    );
  });

  testWidgets('says so plainly when nothing is pending', (tester) async {
    await pump(tester, _data(homework: const []));

    // The section stays, with an empty state. Hiding it made "no deadlines"
    // and "deadlines failed to load" look identical - a parent could not tell
    // a quiet week from a broken screen.
    expect(find.text('Coming up'), findsOneWidget);
    expect(find.text('No upcoming deadlines.'), findsOneWidget);
  });
}

ParentPortalData _data({List<ParentPortalHomework>? homework}) {
  final now = DateTime.now();
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: now,
    activeChildId: 'child-a',
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Asha Rai',
        classSection: 'Grade 4 - A',
        teacher: 'Class teacher',
        attendance: 'Present today',
        attendanceTime: 'Updated now',
        transport: 'No active trip',
        homework: '2 homework pending',
        updates: 'No unread updates',
        homeworkPending: 2,
      ),
    ],
    homework:
        homework ??
        [
          _hw(
            id: 'hw-1',
            childId: 'child-a',
            title: 'Nepali Practice',
            dueAt: now.add(const Duration(days: 3)),
          ),
          _hw(
            id: 'hw-2',
            childId: 'child-a',
            title: 'Overdue maths',
            dueAt: now.subtract(const Duration(days: 4)),
          ),
          _hw(
            id: 'hw-3',
            childId: 'child-a',
            title: 'Finished work',
            dueAt: now.add(const Duration(days: 1)),
            rawStatus: 'COMPLETED',
          ),
          _hw(
            id: 'hw-4',
            childId: 'child-b',
            title: 'Sibling homework',
            dueAt: now.add(const Duration(days: 1)),
          ),
        ],
    updates: const [],
  );
}

ParentPortalHomework _hw({
  required String id,
  required String childId,
  required String title,
  required DateTime dueAt,
  String rawStatus = 'NOT_SUBMITTED',
}) {
  return ParentPortalHomework(
    id: id,
    childId: childId,
    childName: 'Asha Rai',
    classSection: 'Grade 4 - A',
    subject: 'Subject',
    title: title,
    dueLabel: 'Due',
    dueAt: dueAt,
    rawStatus: rawStatus,
    attachmentCount: 0,
    teacher: 'Assigned by school',
  );
}
