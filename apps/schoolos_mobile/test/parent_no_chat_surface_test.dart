import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_updates_tab.dart';
import 'package:schoolos_mobile/features/notices/presentation/widgets/notice_helpers.dart';
import 'package:schoolos_mobile/features/notices/presentation/screens/notification_center_screen.dart';

/// Chat and unrestricted direct messaging are removed from the product. The
/// parent app must not present a messaging surface, and must not reintroduce
/// one through a label, filter or navigation entry.
///
/// Historical message-type notifications still exist in tenants that used the
/// old module. They stay readable - under "All", opening the notification
/// inbox - but nothing may invite the parent to send or reply.
void main() {
  testWidgets('the updates tab offers no messaging filter', (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ParentPortalUpdatesTab(data: _data())),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Filter'));
    await tester.pumpAndSettle();

    for (final banned in ['Messages', 'Message', 'Chat', 'Reply', 'Inbox']) {
      expect(
        find.text(banned),
        findsNothing,
        reason: '"$banned" reintroduces a messaging surface',
      );
    }
    expect(find.text('Filter school posts'), findsOneWidget);
    expect(find.text('Notices'), findsOneWidget);
    expect(find.text('Events'), findsOneWidget);
  });

  testWidgets('a legacy message-type update is still readable', (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ParentPortalUpdatesTab(data: _data())),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Legacy school update'),
      findsOneWidget,
      reason:
          'removing the filter must not hide history; the entry still lists '
          'under All',
    );
  });

  testWidgets('school posts expose compact parent context and honest states', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ParentPortalUpdatesTab(data: _data())),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('School posts'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Attendance follow-up'),
      300,
      scrollable: find.byType(Scrollable).last,
    );

    expect(find.text('Action required'), findsOneWidget);
    expect(find.textContaining('Asha Rai · Grade 4 - A'), findsOneWidget);
    expect(find.text('Read'), findsNothing);
    expect(find.byIcon(Icons.chevron_right_rounded), findsWidgets);
  });

  test('communication timestamps use parent-friendly Nepal labels', () {
    final now = DateTime.utc(2026, 7, 29, 8);
    expect(parentCommunicationTimestamp(now, now: now), startsWith('Today ·'));
    expect(parentCommunicationTimeGroup(now, now: now), 'Today');
  });

  test('the alerts summary distinguishes unread state from history', () {
    expect(notificationSummaryTitle(0), 'No unread alerts');
    expect(
      notificationSummaryMessage(0),
      contains('Earlier alerts remain below'),
    );
    expect(notificationSummaryTitle(3), '3 unread alerts');
  });

  test('no chat vocabulary remains in parent-facing source', () {
    // A source sweep rather than a widget check, so a chat surface cannot be
    // reintroduced anywhere in the parent feature - screens, providers,
    // repositories or models.
    final banned = RegExp(
      r'\b(chat|conversation|typingIndicator|onlinePresence|directMessage)',
      caseSensitive: false,
    );
    final offenders = <String>[];

    for (final directory in [
      Directory('lib/features/parent'),
      Directory('lib/features/notices'),
    ]) {
      for (final entity in directory.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        for (final line in entity.readAsLinesSync()) {
          final trimmed = line.trim();
          // Comments explaining why chat is absent are not a chat surface,
          // and Material icon identifiers are glyph names, not behaviour.
          if (trimmed.startsWith('//') || trimmed.startsWith('///')) continue;
          if (line.contains('Icons.')) continue;
          if (banned.hasMatch(line)) {
            offenders.add('${entity.path}: ${line.trim()}');
          }
        }
      }
    }

    expect(offenders, isEmpty, reason: offenders.join('\n'));
  });
}

ParentPortalData _data() {
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: DateTime(2026, 7, 25, 9),
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
        homework: 'No pending homework',
        updates: 'No unread updates',
      ),
    ],
    homework: const [],
    updates: [
      ParentPortalUpdate(
        id: 'update-2',
        childId: 'child-a',
        category: ParentUpdateCategory.notice,
        title: 'Attendance follow-up',
        body: 'Please review today’s attendance record.',
        metadata: 'Asha Rai',
        createdAt: DateTime(2026, 7, 25, 10),
        childName: 'Asha Rai',
        classSection: 'Grade 4 - A',
        isImportant: true,
        requiresAcknowledgement: true,
        unreadCount: 1,
        route: '/notices/update-2',
        audience: 'For Asha Rai',
      ),
      ParentPortalUpdate(
        id: 'update-1',
        category: ParentUpdateCategory.message,
        title: 'Legacy school update',
        body: 'Sent before direct messaging was withdrawn.',
        metadata: 'Whole school',
        createdAt: DateTime(2026, 7, 20, 9),
      ),
    ],
  );
}
