@Tags(['golden'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_portal_home_tab.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_portal_widgets.dart';
import 'package:schoolos_mobile/shared/widgets/app_exception_view.dart';
import 'package:schoolos_mobile/shared/widgets/school_os_app_shell.dart';

/// Visual pins for the parent Today dashboard.
///
/// Typeface: the app's own bundled Inter, loaded straight out of
/// `assets/fonts/`. The older parent-timetable golden pins Apple's system
/// SFNS instead, which is why it can only run on macOS - and it also means
/// that golden shows a typeface the app never ships. Loading the real family
/// removes the host dependency *and* makes the baseline show what a parent
/// actually sees. Inter and Noto Sans Devanagari are already committed under
/// SIL OFL 1.1; nothing new is vendored here.
///
/// Host: these run wherever the bundled font loads, but the baselines are
/// generated on macOS and only match there. Measured on a Linux container
/// (`ghcr.io/cirruslabs/flutter:3.44.0`) the layout is identical while 4.96%
/// of pixels differ - glyph anti-aliasing, not reflow. Exact-pixel golden
/// comparison across operating systems is not achievable, which is why
/// Flutter's own repository pins goldens to one platform too. Hence the
/// `golden` tag: CI runs `flutter test --exclude-tags golden`, and these stay
/// a local check on the platform that generated them.
///
/// Regenerate with
/// `flutter test --update-goldens test/parent_dashboard_golden_test.dart`.
void main() {
  setUpAll(() async {
    // Weight variants register under one family; Flutter selects between them
    // from each file's own weight metadata, so w400-w800 all resolve.
    await _loadFont('Inter', [
      'assets/fonts/Inter-Regular.ttf',
      'assets/fonts/Inter-Medium.ttf',
      'assets/fonts/Inter-SemiBold.ttf',
      'assets/fonts/Inter-Bold.ttf',
    ]);
    // Written by the test runner into build/ before any test executes.
    await _loadFont('MaterialIcons', [
      'build/unit_test_assets/fonts/MaterialIcons-Regular.otf',
    ]);
  });

  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> pumpDashboard(
    WidgetTester tester,
    ParentPortalData data, {
    required Size size,
    double textScale = 1.0,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: _goldenTheme,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(
              backgroundColor: ParentPortalColors.page,
              appBar: AppBar(
                backgroundColor: ParentPortalColors.page,
                title: const Text(
                  'Today',
                  style: TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                actions: const [
                  Icon(Icons.notifications_none_rounded),
                  SizedBox(width: 16),
                ],
              ),
              body: SafeArea(
                top: false,
                child: ParentPortalHomeTab(data: data),
              ),
              bottomNavigationBar: SchoolOsBottomNavigation(
                selectedIndex: 0,
                onSelected: (_) {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('standard phone', (tester) async {
    await pumpDashboard(tester, _fullData(), size: const Size(390, 1500));
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_standard_phone.png'),
    );
  });

  testWidgets('small phone', (tester) async {
    await pumpDashboard(tester, _fullData(), size: const Size(320, 1500));
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_small_phone.png'),
    );
  });

  testWidgets('large text scale', (tester) async {
    await pumpDashboard(
      tester,
      _fullData(),
      size: const Size(390, 2400),
      textScale: 1.5,
    );
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_large_text.png'),
    );
  });

  testWidgets('empty dashboard', (tester) async {
    await pumpDashboard(tester, _emptyData(), size: const Size(390, 1200));
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_empty.png'),
    );
  });

  testWidgets('offline cached dashboard', (tester) async {
    await pumpDashboard(
      tester,
      _fullData(fromCache: true),
      size: const Size(390, 1500),
    );
    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_offline.png'),
    );
  });

  testWidgets('error state', (tester) async {
    tester.view.physicalSize = const Size(390, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: _goldenTheme,
        home: Scaffold(
          backgroundColor: ParentPortalColors.page,
          body: SafeArea(
            child: AppExceptionView(
              error: const SocketException('Failed host lookup'),
              onRetry: () {},
              onSignIn: () {},
            ),
          ),
          bottomNavigationBar: SchoolOsBottomNavigation(
            selectedIndex: 0,
            onSelected: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Scaffold).first,
      matchesGoldenFile('goldens/parent_dashboard_error.png'),
    );
  });
}

/// `AppTheme.light` unmodified: it already names Inter throughout, and Inter
/// is registered in `setUpAll`, so the baseline renders the shipped type.
ThemeData get _goldenTheme => AppTheme.light;

ParentPortalData _fullData({bool fromCache = false}) {
  // Far-future deadlines on purpose: the dashboard compares them against the
  // real clock, so a nearer date would flip these tiles to "Due today" and
  // then "Overdue" as the calendar moves, and the goldens would rot.
  final due = DateTime.utc(2099, 7, 28, 4);
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: DateTime.utc(2026, 7, 26, 16, 26),
    fromCache: fromCache,
    activeChildId: 'child-a',
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        teacher: 'Ramesh Gurung',
        attendance: 'Attendance not marked today',
        attendanceTime: 'Updated 10:11 PM NPT',
        transport: 'No active trip',
        homework: '3 homework pending',
        updates: 'No unread updates',
        homeworkPending: 3,
        feesStatus: 'PAID',
        feesTotalAmount: 12000,
        feesPaidAmount: 12000,
        capabilities: {'ACADEMICS_VIEW', 'ATTENDANCE_VIEW', 'FEES_VIEW'},
      ),
    ],
    homework: [
      _homework(
        id: 'hw-1',
        title: 'Algebra Worksheet #1',
        subject: 'Mathematics',
        dueAt: due,
      ),
      _homework(
        id: 'hw-2',
        title: 'Class 1-A Nepali Practice 1',
        subject: 'Nepali',
        dueAt: due.add(const Duration(days: 1)),
      ),
      _homework(
        id: 'hw-3',
        title: 'Class 1-A English Practice 2',
        subject: 'English',
        dueAt: due.add(const Duration(days: 2)),
      ),
    ],
    updates: const [
      ParentPortalUpdate(
        id: 'u1',
        category: ParentUpdateCategory.event,
        title: 'Parent-teacher meeting',
        body: 'Friday, 10:00 AM to 2:00 PM in the main hall.',
        metadata: 'Whole school - 5:32 AM',
        route: '/notices/u1',
      ),
    ],
  );
}

ParentPortalData _emptyData() {
  return ParentPortalData(
    parentName: 'Sita Rai',
    schoolName: 'Everest School',
    lastUpdated: DateTime.utc(2026, 7, 26, 16, 26),
    activeChildId: 'child-a',
    children: const [
      ParentPortalChild(
        id: 'child-a',
        name: 'Aarav Adhikari',
        classSection: 'Class 1 - A',
        teacher: 'Ramesh Gurung',
        attendance: 'Present today',
        attendanceTime: 'Updated 10:11 PM NPT',
        transport: 'No active trip',
        homework: 'No pending homework',
        updates: 'No unread updates',
        feesStatus: 'PAID',
        feesTotalAmount: 12000,
        feesPaidAmount: 12000,
        capabilities: {'ACADEMICS_VIEW', 'ATTENDANCE_VIEW', 'FEES_VIEW'},
      ),
    ],
    homework: const [],
    updates: const [],
  );
}

ParentPortalHomework _homework({
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
    dueLabel: 'Due',
    dueAt: dueAt,
    rawStatus: 'NOT_SUBMITTED',
    attachmentCount: 0,
    teacher: 'Assigned by school',
  );
}

Future<void> _loadFont(String family, List<String> paths) async {
  final loader = FontLoader(family);
  for (final path in paths) {
    final file = File(path);
    if (!file.existsSync()) {
      throw StateError(
        'Golden font missing: $path. Run `flutter test` from '
        'apps/schoolos_mobile so relative asset paths resolve.',
      );
    }
    loader.addFont(
      file.readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
    );
  }
  await loader.load();
}
