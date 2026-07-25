import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_home_tab.dart';

/// "Coming up" is the dashboard's dated-deadline surface. It must show the
/// selected child's pending work only, order by urgency, and say *in words*
/// whether something is overdue - a colour alone fails a colour-blind reader.
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

  testWidgets('labels overdue work in words, not colour alone', (tester) async {
    await pump(tester, _data());

    expect(
      find.text('Overdue'),
      findsOneWidget,
      reason: 'status must be readable without perceiving colour',
    );
  });

  testWidgets('orders by nearest deadline first', (tester) async {
    await pump(tester, _data());

    final titles = tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data)
        .where(
          (value) => value == 'Overdue maths' || value == 'Nepali Practice',
        )
        .toList();

    expect(
      titles.first,
      'Overdue maths',
      reason: 'the most urgent deadline leads',
    );
  });

  testWidgets('is absent entirely when nothing is pending', (tester) async {
    await pump(tester, _data(homework: const []));

    expect(
      find.text('Coming up'),
      findsNothing,
      reason: 'an empty deadline card is noise, not information',
    );
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
