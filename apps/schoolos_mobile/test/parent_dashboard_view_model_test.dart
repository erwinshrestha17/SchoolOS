import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/application/parent_dashboard_view_model.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';

/// The Today dashboard's decisions, tested without a widget tree.
///
/// Everything here is a rule about what a parent is *told*: which status a
/// label means, which pending item outranks which, and what is not safe to
/// print. Each is a defect the dashboard has shipped at least once.
void main() {
  group('guardian display name', () {
    test('a real name is greeted as written', () {
      expect(guardianDisplayName('Sita Rai'), 'Sita Rai');
      expect(guardianDisplayName('  Sita Rai  '), 'Sita Rai');
      // A single-word name is still a name.
      expect(guardianDisplayName('Sita'), 'Sita');
    });

    test('a login handle is never greeted at a parent', () {
      // These are the real shapes seeded guardian accounts fall back to when
      // the school records no first or last name.
      for (final handle in [
        'guardian.c01a001',
        'parent_204',
        'c01a001@school.edu.np',
        'guardian-7',
      ]) {
        expect(
          guardianDisplayName(handle),
          isNull,
          reason: '$handle is an account identifier, not a person',
        );
      }
    });

    test('an empty or placeholder name falls back to no name', () {
      expect(guardianDisplayName(''), isNull);
      expect(guardianDisplayName('   '), isNull);
      expect(guardianDisplayName('Parent'), isNull);
    });
  });

  group('attendance status mapping', () {
    test('an unrecognised label is never reported as present', () {
      for (final label in [
        'Something the school typed',
        'Marked by class teacher',
        '?',
      ]) {
        expect(
          attendanceToneFromLabel(label),
          isNot(ParentStatusTone.positive),
          reason: '"$label" must not be rendered as a full day attended',
        );
      }
    });

    test('an unmarked day reads as no record, not as good news', () {
      // The reference screenshot showed "Attendance not marked today" behind a
      // green tick. A parent skims the colour and moves on.
      for (final label in [
        'Attendance not marked today',
        'Attendance not recorded',
        'No record for today',
      ]) {
        expect(attendanceToneFromLabel(label), ParentStatusTone.neutral);
      }
    });

    test('an unmarked day uses neutral parent-facing wording', () {
      final row = attendanceRowFor(
        _child(attendance: 'Attendance not marked today'),
      );
      expect(row.title, 'Attendance awaiting teacher update');
      expect(row.subtitle, 'School has not marked attendance yet');
      expect(row.tone, ParentStatusTone.neutral);
    });

    test('the states the backend can report each get their own tone', () {
      expect(
        attendanceToneFromLabel('Present today'),
        ParentStatusTone.positive,
      );
      expect(
        attendanceToneFromLabel('Absent today'),
        ParentStatusTone.critical,
      );
      expect(
        attendanceToneFromLabel('Late arrival'),
        ParentStatusTone.attention,
      );
      expect(attendanceToneFromLabel('Half day'), ParentStatusTone.attention);
      expect(
        attendanceToneFromLabel('On leave'),
        ParentStatusTone.informational,
      );
      expect(
        attendanceToneFromLabel('Excused leave'),
        ParentStatusTone.informational,
      );
      expect(
        attendanceToneFromLabel('Holiday'),
        ParentStatusTone.informational,
      );
      expect(
        attendanceToneFromLabel('Attendance module locked'),
        ParentStatusTone.unavailable,
      );
      expect(attendanceToneFromLabel(''), ParentStatusTone.unavailable);
    });
  });

  group('fee status mapping', () {
    test('a settled account is paid', () {
      final row = feesRowFor(
        _child(feesDue: 0, feesStatus: 'PAID', feesTotalAmount: 12000),
      );
      expect(row.tone, ParentStatusTone.positive);
      expect(row.title, 'Fees paid');
    });

    test('a never-invoiced child is not reported as paid', () {
      final row = feesRowFor(
        _child(feesDue: 0, feesStatus: 'PAID', feesTotalAmount: 0),
      );
      expect(row.tone, ParentStatusTone.neutral);
      expect(row.title, 'No fee invoice issued');
    });

    test('an outstanding balance names the amount', () {
      final row = feesRowFor(_child(feesDue: 3700, feesTotalAmount: 12000));
      expect(row.tone, ParentStatusTone.attention);
      expect(row.title, 'Fees due Rs 3,700');
    });

    test('a part-paid bill says how much is left, not that it is due', () {
      final row = feesRowFor(
        _child(feesDue: 3700, feesPaidAmount: 8300, feesTotalAmount: 12000),
      );
      expect(row.tone, ParentStatusTone.attention);
      expect(row.title, 'Partly paid, Rs 3,700 left');
    });

    test('an overdue bill escalates above a merely due one', () {
      final row = feesRowFor(
        _child(feesDue: 3700, feesStatus: 'OVERDUE', feesTotalAmount: 12000),
      );
      expect(row.tone, ParentStatusTone.critical);
      expect(row.title, 'Fees overdue Rs 3,700');
    });

    test('a locked fee module says so instead of claiming a balance', () {
      final row = feesRowFor(_child(feesStatus: 'LOCKED'));
      expect(row.tone, ParentStatusTone.unavailable);
      expect(row.title, 'Fee status not available');
    });
  });

  group('priority selection', () {
    test('nothing pending produces no attention card', () {
      final model = ParentDashboardViewModel.from(
        _data(children: [_child()]),
        now: DateTime(2026, 7, 26, 10),
      );
      expect(model.priority, isNull);
      expect(model.otherPriorityCount, 0);
    });

    test('a stalled bus outranks money, and money outranks homework', () {
      final actions = priorityActionsFor(
        _child(
          transport: 'Bus location is stale',
          feesDue: 500,
          homeworkPending: 3,
          unreadUpdates: 2,
        ),
      );
      expect(actions.map((action) => action.kind), [
        ParentPriorityKind.transport,
        ParentPriorityKind.fees,
        ParentPriorityKind.homework,
        ParentPriorityKind.updates,
      ]);
    });

    test('the card leads with one item and counts the rest', () {
      final model = ParentDashboardViewModel.from(
        _data(children: [_child(feesDue: 500, homeworkPending: 3)]),
        now: DateTime(2026, 7, 26, 10),
      );
      expect(model.priority!.kind, ParentPriorityKind.fees);
      expect(model.otherPriorityCount, 1);
    });

    test('homework is counted in words a parent reads, and pluralised', () {
      expect(
        priorityActionsFor(_child(homeworkPending: 3)).single.summary,
        '3 homework items need review',
      );
      expect(
        priorityActionsFor(_child(homeworkPending: 1)).single.summary,
        '1 homework item needs review',
      );
      expect(
        priorityActionsFor(
          _child(homeworkPending: 3),
          overdueHomeworkCount: 3,
        ).single.summary,
        '3 homework items are overdue',
      );
    });
  });

  group('coming up', () {
    final now = DateTime.utc(2026, 7, 26, 4);

    test('shows only the selected child\'s unfinished, dated work', () {
      final items = upcomingItemsFor(
        _data(homework: _mixedHomework(now)),
        childId: 'child-a',
        now: now,
      );
      final titles = items.map((item) => item.title).toList();

      expect(titles, isNot(contains('Sibling homework')));
      expect(titles, isNot(contains('Finished work')));
      expect(titles, isNot(contains('Undated work')));
    });

    test('keeps overdue work out of Coming up', () {
      final items = upcomingItemsFor(
        _data(homework: _mixedHomework(now)),
        childId: 'child-a',
        now: now,
      );
      expect(items.map((item) => item.title), isNot(contains('Overdue maths')));
      expect(
        overdueHomeworkCountFor(
          _data(homework: _mixedHomework(now)),
          childId: 'child-a',
          now: now,
        ),
        1,
      );
    });

    test('never shows more than three, however heavy the week', () {
      final homework = [
        for (var day = 1; day <= 9; day++)
          _homework(
            id: 'hw-$day',
            childId: 'child-a',
            title: 'Work $day',
            dueAt: now.add(Duration(days: day)),
          ),
      ];
      final items = upcomingItemsFor(
        _data(homework: homework),
        childId: 'child-a',
        now: now,
      );
      expect(items, hasLength(3));
      expect(items.last.title, 'Work 3');
    });

    test('the Nepal midnight boundary flips the day, not the UTC one', () {
      // Kathmandu is UTC+5:45, so a Nepal day begins at 18:15 UTC the previous
      // evening. Held against homework due on the 27th, one UTC minute either
      // side of that boundary must move the verdict a whole day.
      final due27 = DateTime.utc(2026, 7, 27, 6);

      expect(
        urgencyFor(due27, DateTime.utc(2026, 7, 25, 18, 14)),
        ParentUpcomingUrgency.later,
        reason: 'still the 25th in Nepal, so the 27th is two days out',
      );
      expect(
        urgencyFor(due27, DateTime.utc(2026, 7, 25, 18, 15)),
        ParentUpcomingUrgency.dueTomorrow,
        reason: 'one minute later Nepal is on the 26th and the 27th is next',
      );
      expect(
        urgencyFor(due27, DateTime.utc(2026, 7, 26, 18, 14)),
        ParentUpcomingUrgency.dueTomorrow,
      );
      expect(
        urgencyFor(due27, DateTime.utc(2026, 7, 26, 18, 15)),
        ParentUpcomingUrgency.dueToday,
        reason: 'the school has rolled into the 27th',
      );
    });

    test(
      'a due instant either side of Nepal midnight lands on the right day',
      () {
        // The deadline itself is bucketed in Nepal time too, not UTC.
        final now = DateTime.utc(2026, 7, 26, 6);
        expect(
          urgencyFor(DateTime.utc(2026, 7, 26, 18, 14), now),
          ParentUpcomingUrgency.dueToday,
        );
        expect(
          urgencyFor(DateTime.utc(2026, 7, 26, 18, 15), now),
          ParentUpcomingUrgency.dueTomorrow,
          reason: '18:15 UTC is already the next school day in Kathmandu',
        );
      },
    );

    test('the handset timezone cannot change the school-day verdict', () {
      // Same two instants, whatever the device clock is set to: both are
      // absolute UTC moments and the comparison never touches local time.
      // 20:00 UTC on the 26th is 01:45 on the 27th in Kathmandu, so work due
      // on the 27th is due today - whatever the handset believes the date is.
      final due = DateTime.utc(2026, 7, 27, 6);
      final now = DateTime.utc(2026, 7, 26, 20);
      expect(urgencyFor(due, now), ParentUpcomingUrgency.dueToday);
      expect(
        urgencyFor(due.toLocal(), now.toLocal()),
        ParentUpcomingUrgency.dueToday,
        reason: 'the same instants expressed locally must classify identically',
      );
    });

    test('urgency is measured on the school day, not the handset day', () {
      // 2026-07-26 23:30 UTC is already 2026-07-27 in Kathmandu (UTC+5:45),
      // so work due on the 27th is due *today* for the school.
      final lateEvening = DateTime.utc(2026, 7, 26, 23, 30);
      expect(
        urgencyFor(DateTime.utc(2026, 7, 27, 4), lateEvening),
        ParentUpcomingUrgency.dueToday,
      );
      expect(
        urgencyFor(DateTime.utc(2026, 7, 28, 4), lateEvening),
        ParentUpcomingUrgency.dueTomorrow,
      );
      expect(
        urgencyFor(DateTime.utc(2026, 7, 26, 4), lateEvening),
        ParentUpcomingUrgency.overdue,
      );
    });
  });

  group('latest update', () {
    test('a sibling-only update does not appear under this child', () {
      final update = latestUpdateFor(
        _data(
          updates: [
            _update(id: 'u1', childId: 'child-b', title: 'Sibling notice'),
            _update(id: 'u2', childId: null, title: 'Whole school notice'),
          ],
        ),
        childId: 'child-a',
      );
      expect(update!.title, 'Whole school notice');
    });

    test('a machine identifier is stripped out of the title', () {
      // Automated fixtures append an epoch stamp; a guardian reads a number
      // they cannot act on and assumes the app is broken.
      expect(
        displayUpdateTitle('E2E scheduled notice 1784869836649'),
        'E2E scheduled notice',
      );
      expect(displayUpdateTitle('Sports day - 1784869836649'), 'Sports day');
      expect(displayUpdateTitle('Holiday notice'), 'Holiday notice');
    });

    test('a real title with a real number keeps it', () {
      expect(
        displayUpdateTitle('Fee reminder for Class 10'),
        'Fee reminder for Class 10',
      );
      expect(displayUpdateTitle('Bus route 7 change'), 'Bus route 7 change');
      // A Nepali mobile number is ten digits and must survive. Only an
      // epoch-millisecond run (thirteen digits) is machine noise.
      expect(
        displayUpdateTitle('Snow day: call 9841234567 before 8am'),
        'Snow day: call 9841234567 before 8am',
      );
      expect(
        displayUpdateTitle('Account 123456789012345 closed'),
        'Account closed',
      );
    });

    test('an update that is nothing but an identifier is skipped', () {
      expect(displayUpdateTitle('1784869836649'), isNull);

      final update = latestUpdateFor(
        _data(
          updates: [
            _update(id: 'u1', title: '1784869836649'),
            _update(id: 'u2', title: 'Parent-teacher meeting'),
          ],
        ),
        childId: 'child-a',
      );
      expect(update!.title, 'Parent-teacher meeting');
    });

    test('the local parent-action verification fixture is skipped', () {
      final update = latestUpdateFor(
        _data(
          updates: [
            _update(
              id: 'u1',
              title: 'Required parent action check be5c7882',
              body: 'Please review and confirm this local verification notice.',
            ),
            _update(id: 'u2', title: 'Parent-teacher meeting'),
          ],
        ),
        childId: 'child-a',
      );

      expect(update!.title, 'Parent-teacher meeting');
    });

    test('no updates at all produces no card rather than a fake one', () {
      expect(latestUpdateFor(_data(), childId: 'child-a'), isNull);
    });
  });

  group('child switching', () {
    test('the model follows the active child', () {
      final data = _data(
        activeChildId: 'child-b',
        children: [
          _child(id: 'child-a', name: 'Asha Rai'),
          _child(id: 'child-b', name: 'Bikash Rai', homeworkPending: 2),
        ],
      );
      final model = ParentDashboardViewModel.from(
        data,
        now: DateTime(2026, 7, 26),
      );

      expect(model.child!.name, 'Bikash Rai');
      expect(model.child!.firstName, 'Bikash');
      expect(model.linkedChildCount, 2);
      expect(model.priority!.kind, ParentPriorityKind.homework);
    });

    test('an unknown active child falls back to the first linked one', () {
      final model = ParentDashboardViewModel.from(
        _data(
          activeChildId: 'child-gone',
          children: [_child(id: 'child-a', name: 'Asha Rai')],
        ),
        now: DateTime(2026, 7, 26),
      );
      expect(model.child!.id, 'child-a');
    });

    test('no linked child produces no child projection', () {
      final model = ParentDashboardViewModel.from(
        _data(children: const []),
        now: DateTime(2026, 7, 26),
      );
      expect(model.child, isNull);
      expect(model.hasChild, isFalse);
      expect(model.upcoming, isEmpty);
      expect(model.latestUpdate, isNull);
    });
  });

  group('malformed and missing fields', () {
    test('a placeholder class teacher is dropped rather than printed', () {
      final model = ParentDashboardViewModel.from(
        _data(children: [_child(teacher: 'Class teacher not assigned')]),
        now: DateTime(2026, 7, 26),
      );
      expect(model.child!.teacher, isNull);
    });

    test('blank status text degrades to an explicit "not available"', () {
      final row = attendanceRowFor(_child(attendance: '   '));
      expect(row.title, 'Attendance not available');
      expect(row.tone, ParentStatusTone.unavailable);
    });

    test('every status row announces its subject and full status', () {
      final model = ParentDashboardViewModel.from(
        _data(children: [_child(attendance: 'Present today')]),
        now: DateTime(2026, 7, 26),
      );
      expect(
        model.child!.statusRows.first.semanticLabel,
        'Attendance: Present today. Updated 10:11 AM',
      );
    });

    test('cached data is reported as cached', () {
      final model = ParentDashboardViewModel.from(
        _data(fromCache: true),
        now: DateTime(2026, 7, 26),
      );
      expect(model.isStale, isTrue);
    });
  });
}

ParentPortalChild _child({
  String id = 'child-a',
  String name = 'Aarav Adhikari',
  String attendance = 'Present today',
  String teacher = 'Ramesh Gurung',
  String transport = 'No active trip',
  int homeworkPending = 0,
  int unreadUpdates = 0,
  num feesDue = 0,
  num feesPaidAmount = 0,
  num feesTotalAmount = 12000,
  String feesStatus = 'PAID',
}) {
  return ParentPortalChild(
    id: id,
    name: name,
    classSection: 'Class 1 - A',
    teacher: teacher,
    attendance: attendance,
    attendanceTime: 'Updated 10:11 AM',
    transport: transport,
    homework: homeworkPending > 0
        ? '$homeworkPending homework pending'
        : 'No pending homework',
    updates: 'No unread updates',
    homeworkPending: homeworkPending,
    unreadUpdates: unreadUpdates,
    feesDue: feesDue,
    feesStatus: feesStatus,
    feesPaidAmount: feesPaidAmount,
    feesTotalAmount: feesTotalAmount,
  );
}

ParentPortalData _data({
  List<ParentPortalChild>? children,
  List<ParentPortalHomework> homework = const [],
  List<ParentPortalUpdate> updates = const [],
  String activeChildId = 'child-a',
  bool fromCache = false,
}) {
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: DateTime.utc(2026, 7, 26, 4, 26),
    fromCache: fromCache,
    activeChildId: activeChildId,
    children: children ?? [_child()],
    homework: homework,
    updates: updates,
  );
}

List<ParentPortalHomework> _mixedHomework(DateTime now) {
  return [
    _homework(
      id: 'hw-1',
      childId: 'child-a',
      title: 'Nepali Practice',
      dueAt: now.add(const Duration(days: 3)),
    ),
    _homework(
      id: 'hw-2',
      childId: 'child-a',
      title: 'Overdue maths',
      dueAt: now.subtract(const Duration(days: 4)),
    ),
    _homework(
      id: 'hw-3',
      childId: 'child-a',
      title: 'Finished work',
      dueAt: now.add(const Duration(days: 1)),
      rawStatus: 'COMPLETED',
    ),
    _homework(
      id: 'hw-4',
      childId: 'child-b',
      title: 'Sibling homework',
      dueAt: now.add(const Duration(days: 1)),
    ),
    _homework(id: 'hw-5', childId: 'child-a', title: 'Undated work'),
  ];
}

ParentPortalHomework _homework({
  required String id,
  required String childId,
  required String title,
  DateTime? dueAt,
  String rawStatus = 'NOT_SUBMITTED',
}) {
  return ParentPortalHomework(
    id: id,
    childId: childId,
    childName: 'Aarav Adhikari',
    classSection: 'Class 1 - A',
    subject: 'Mathematics',
    title: title,
    dueLabel: 'Due',
    dueAt: dueAt,
    rawStatus: rawStatus,
    attachmentCount: 0,
    teacher: 'Assigned by school',
  );
}

ParentPortalUpdate _update({
  required String id,
  required String title,
  String? childId,
  String body = 'Details',
}) {
  return ParentPortalUpdate(
    id: id,
    childId: childId,
    category: ParentUpdateCategory.notice,
    title: title,
    body: body,
    metadata: 'Whole school - 5:32 AM',
  );
}
