import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_home_tab.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_more_tab.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_dashboard_widgets.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_portal_widgets.dart';

/// What the parent Today dashboard paints, and what it must never paint.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  /// Pumps the dashboard behind a real router, so route pushes are exercised
  /// rather than mocked, and records every location the screen navigates to.
  Future<List<String>> pump(
    WidgetTester tester,
    ParentPortalData data, {
    Size size = const Size(420, 1400),
    double textScale = 1.0,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final visited = <String>[];
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(
            backgroundColor: ParentPortalColors.page,
            body: SafeArea(child: ParentPortalHomeTab(data: data)),
          ),
        ),
        GoRoute(
          path: '/:rest(.*)',
          builder: (context, state) {
            visited.add(state.uri.toString());
            return const Scaffold(body: Text('destination'));
          },
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return visited;
  }

  group('loaded state', () {
    testWidgets('paints every section of the dashboard', (tester) async {
      await pump(tester, _data(homeworkPending: 3));

      expect(find.text('Namaste, Sita Rai'), findsOneWidget);
      expect(find.text('ATTENTION NEEDED'), findsOneWidget);
      expect(find.text("Aarav's school day"), findsOneWidget);
      expect(find.text('Coming up'), findsOneWidget);
      expect(find.text('Quick actions'), findsOneWidget);
      expect(find.text('Latest update'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('greets without a name rather than with a login handle', (
      tester,
    ) async {
      await pump(tester, _data(parentName: 'guardian.c01a001'));

      expect(find.text('Namaste'), findsOneWidget);
      expect(find.textContaining('guardian.c01a001'), findsNothing);
    });

    testWidgets('an unmarked attendance day is not dressed as good news', (
      tester,
    ) async {
      await pump(tester, _data(attendance: 'Attendance not marked today'));

      final icon = tester.widget<Icon>(
        find.byIcon(Icons.help_outline_rounded).first,
      );
      expect(
        icon.color,
        isNot(ParentPortalColors.green),
        reason: 'no record is not a green tick',
      );
    });

    testWidgets('each status row is reachable on its own', (tester) async {
      final visited = await pump(tester, _data());

      await tester.tap(find.text('Fees paid'));
      await tester.pumpAndSettle();

      expect(visited, ['/parent/fees']);
    });
  });

  group('priority card', () {
    testWidgets('leads with the top item and counts the rest', (tester) async {
      await pump(tester, _data(homeworkPending: 3, feesDue: 500));

      expect(find.text('Rs 500 fees due'), findsOneWidget);
      expect(find.text('1 more item needs your attention'), findsOneWidget);
    });

    testWidgets('is absent when nothing needs the parent', (tester) async {
      await pump(tester, _data());

      expect(find.text('ATTENTION NEEDED'), findsNothing);
      expect(find.text('Review now'), findsNothing);
    });

    testWidgets('Review now opens the pending item', (tester) async {
      final visited = await pump(tester, _data(homeworkPending: 3));

      await tester.tap(find.text('Review now'));
      await tester.pumpAndSettle();

      expect(visited, ['/parent/homework?child=child-a']);
    });

    testWidgets('a double tap opens the item once, not twice', (tester) async {
      final visited = await pump(tester, _data(homeworkPending: 3));

      await tester.tap(find.text('Review now'));
      await tester.pump(const Duration(milliseconds: 30));
      await tester.tap(find.text('Review now'), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(
        visited,
        hasLength(1),
        reason: 'a fumbled double tap must not stack the screen twice',
      );
    });
  });

  group('coming up', () {
    testWidgets('shows at most three, nearest deadline first', (tester) async {
      final now = DateTime.now();
      await pump(
        tester,
        _data(
          homework: [
            for (var day = 1; day <= 5; day++)
              _homework(
                id: 'hw-$day',
                title: 'Work $day',
                dueAt: now.add(Duration(days: day + 1)),
              ),
          ],
        ),
      );

      expect(find.text('Work 1'), findsOneWidget);
      expect(find.text('Work 3'), findsOneWidget);
      expect(find.text('Work 4'), findsNothing);
    });

    testWidgets('states an empty week instead of hiding the section', (
      tester,
    ) async {
      await pump(tester, _data());

      expect(find.text('Coming up'), findsOneWidget);
      expect(find.text('Nothing due right now.'), findsOneWidget);
    });

    testWidgets('says "Overdue" in words, not only in red', (tester) async {
      await pump(
        tester,
        _data(
          homework: [
            _homework(
              id: 'hw-1',
              title: 'Late maths',
              dueAt: DateTime.now().subtract(const Duration(days: 3)),
            ),
          ],
        ),
      );

      expect(find.text('Overdue'), findsOneWidget);
    });
  });

  group('latest update', () {
    testWidgets('never prints a machine identifier at a parent', (
      tester,
    ) async {
      await pump(
        tester,
        _data(
          updates: [
            _update(id: 'u1', title: 'E2E scheduled notice 1784869836649'),
          ],
        ),
      );

      expect(find.textContaining('1784869836649'), findsNothing);
      expect(find.text('E2E scheduled notice'), findsOneWidget);
    });

    testWidgets('says so when the school has sent nothing', (tester) async {
      await pump(tester, _data());

      expect(find.text('No updates from school yet.'), findsOneWidget);
    });
  });

  group('quick actions', () {
    testWidgets('each tile reaches its screen', (tester) async {
      for (final entry in {
        'Attendance': '/parent/attendance',
        'Pay fees': '/parent/fees',
        'School calendar': '/parent/more/calendar',
      }.entries) {
        // A fresh dashboard per tile: the first tap replaces the screen with
        // its destination, so there is nothing left to scroll afterwards.
        final visited = await pump(tester, _data());
        await tester.scrollUntilVisible(
          find.text(entry.key),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text(entry.key));
        await tester.pumpAndSettle();
        expect(visited, [entry.value]);
      }
    });
  });

  group('offline and resilience', () {
    testWidgets('cached data is labelled as cached, with its age', (
      tester,
    ) async {
      await pump(tester, _data(fromCache: true));

      // The chip must state *when*, not just that it is saved - "showing
      // saved data" with no age tells a parent nothing about whether the fee
      // balance in front of them is an hour or eleven hours old.
      expect(
        find.textContaining('Showing saved data • Last updated'),
        findsOneWidget,
      );
    });

    testWidgets('cached fee status is marked stale on its own row', (
      tester,
    ) async {
      await pump(tester, _data(fromCache: true));

      expect(find.text('Saved copy'), findsOneWidget);
      expect(
        find.bySemanticsLabel(RegExp(r'^Fees: .*Saved copy, not live$')),
        findsOneWidget,
      );
    });

    testWidgets('live data carries no stale marking anywhere', (tester) async {
      await pump(tester, _data());

      expect(find.textContaining('Showing saved data'), findsNothing);
      expect(find.text('Saved copy'), findsNothing);
    });

    testWidgets('an unlinked guardian is told why, not shown a blank page', (
      tester,
    ) async {
      await pump(tester, _data(children: const []));

      expect(find.text('No linked child'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a locked module reports itself rather than a false status', (
      tester,
    ) async {
      await pump(
        tester,
        _data(
          attendance: 'Attendance module locked',
          homeworkLabel: 'Homework module locked',
        ),
      );

      expect(find.text('Attendance module locked'), findsOneWidget);
      expect(find.text('Homework module locked'), findsOneWidget);
    });
  });

  group('layout limits', () {
    testWidgets('a small phone at 1.5x text scale does not overflow', (
      tester,
    ) async {
      await pump(
        tester,
        _data(
          name: 'Aaradhya Chaudhary Shrestha',
          homeworkPending: 3,
          homework: [
            _homework(
              id: 'hw-1',
              title:
                  'Complete the extended algebra revision worksheet before Friday',
              dueAt: DateTime.now().add(const Duration(days: 4)),
            ),
          ],
        ),
        size: const Size(320, 2400),
        textScale: 1.5,
      );

      expect(find.text('Quick actions'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a large phone at 2.0x text scale does not overflow', (
      tester,
    ) async {
      await pump(
        tester,
        _data(homeworkPending: 3, feesDue: 125000),
        size: const Size(430, 3200),
        textScale: 2.0,
      );

      expect(tester.takeException(), isNull);
    });
  });

  group('accessibility', () {
    testWidgets('interactive targets and labels meet the guidelines', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await pump(tester, _data(homeworkPending: 3, feesDue: 500));

      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      handle.dispose();
    });

    testWidgets('a status row announces its subject and status together', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await pump(tester, _data(attendance: 'Present today'));

      expect(
        find.bySemanticsLabel('Attendance: Present today. Updated 10:11 AM'),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('section headers', () {
    testWidgets('View all falls back to a route when there is no tab bar', (
      tester,
    ) async {
      final visited = await pump(tester, _data());

      await tester.tap(find.text('View all').first);
      await tester.pumpAndSettle();

      expect(visited, ['/parent/children']);
    });

    testWidgets('View all switches tabs when the shell provides one', (
      tester,
    ) async {
      final opened = <int>[];
      tester.view.physicalSize = const Size(420, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: ParentPortalHomeTab(data: _data(), onOpenTab: opened.add),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('View all').first);
      await tester.pumpAndSettle();

      expect(opened, [ParentShellTab.children]);
    });
  });

  group('account handle never reaches a parent', () {
    testWidgets('the More tab profile card falls back to the role', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: ParentPortalMoreTab(
                data: _data(parentName: 'guardian.c01a001'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('guardian.c01a001'), findsNothing);
      expect(find.text('Parent'), findsOneWidget);
    });

    testWidgets('a real name is shown on the More tab as written', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: ParentPortalMoreTab(data: _data(parentName: 'Sita Rai')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sita Rai'), findsOneWidget);
    });
  });

  group('loading state', () {
    testWidgets(
      'the skeleton holds the dashboard\'s shape and announces itself',
      (tester) async {
        final handle = tester.ensureSemantics();
        tester.view.physicalSize = const Size(390, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: const Scaffold(body: ParentDashboardSkeleton()),
          ),
        );
        // pumpAndSettle would hang on an animated skeleton; that it returns is
        // part of the contract.
        await tester.pumpAndSettle();

        expect(find.bySemanticsLabel('Loading your dashboard'), findsOneWidget);
        expect(tester.takeException(), isNull);
        handle.dispose();
      },
    );
  });

  group('reusable widgets', () {
    testWidgets('a disabled quick action does not fire', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Center(
              child: QuickActionTile(
                icon: Icons.payments_outlined,
                label: 'Pay fees',
                color: ParentPortalColors.orange,
                onTap: null,
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Pay fees'));
      await tester.pumpAndSettle();
      expect(taps, 0);
    });

    testWidgets('a busy quick action shows progress and blocks taps', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Center(
              child: QuickActionTile(
                icon: Icons.payments_outlined,
                label: 'Pay fees',
                color: ParentPortalColors.orange,
                isBusy: true,
                onTap: () => taps++,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.text('Pay fees'));
      expect(taps, 0);
    });
  });
}

ParentPortalData _data({
  String parentName = 'Sita Rai',
  String name = 'Aarav Adhikari',
  String attendance = 'Present today',
  String? homeworkLabel,
  int homeworkPending = 0,
  num feesDue = 0,
  List<ParentPortalChild>? children,
  List<ParentPortalHomework> homework = const [],
  List<ParentPortalUpdate> updates = const [],
  bool fromCache = false,
}) {
  return ParentPortalData(
    parentName: parentName,
    schoolName: 'Everest School',
    lastUpdated: DateTime.utc(2026, 7, 26, 4, 26),
    fromCache: fromCache,
    activeChildId: 'child-a',
    children:
        children ??
        [
          ParentPortalChild(
            id: 'child-a',
            name: name,
            classSection: 'Class 1 - A',
            teacher: 'Ramesh Gurung',
            attendance: attendance,
            attendanceTime: 'Updated 10:11 AM',
            transport: 'No active trip',
            homework:
                homeworkLabel ??
                (homeworkPending > 0
                    ? '$homeworkPending homework pending'
                    : 'No pending homework'),
            updates: 'No unread updates',
            homeworkPending: homeworkPending,
            feesDue: feesDue,
            feesStatus: feesDue > 0 ? 'DUE' : 'PAID',
            feesTotalAmount: 12000,
          ),
        ],
    homework: homework,
    updates: updates,
  );
}

ParentPortalHomework _homework({
  required String id,
  required String title,
  required DateTime dueAt,
}) {
  return ParentPortalHomework(
    id: id,
    childId: 'child-a',
    childName: 'Aarav Adhikari',
    classSection: 'Class 1 - A',
    subject: 'Mathematics',
    title: title,
    dueLabel: 'Due',
    dueAt: dueAt,
    rawStatus: 'NOT_SUBMITTED',
    attachmentCount: 0,
    teacher: 'Assigned by school',
  );
}

ParentPortalUpdate _update({required String id, required String title}) {
  return ParentPortalUpdate(
    id: id,
    category: ParentUpdateCategory.notice,
    title: title,
    body: 'Scheduled lifecycle evidence.',
    metadata: 'Whole school - 5:32 AM',
    route: '/notices/$id',
  );
}
