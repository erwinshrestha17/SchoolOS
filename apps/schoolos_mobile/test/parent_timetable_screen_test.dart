import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_timetable_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_portal_widgets.dart';
import 'package:schoolos_mobile/shared/widgets/school_os_app_shell.dart';

void main() {
  setUpAll(() async {
    if (!Platform.isMacOS) return;
    await _loadFont('SchoolOsGolden', '/System/Library/Fonts/SFNS.ttf');
    await _loadFont(
      'MaterialIcons',
      'build/unit_test_assets/fonts/MaterialIcons-Regular.otf',
    );
  });

  const child = GuardianChild(
    id: 'student-1',
    name: 'Aarav Adhikari',
    classSection: 'Class 1 - A',
    rollNumber: '12',
    academicYear: '2083/84',
    relationship: 'Son',
  );

  const timetable = ParentTimetable(
    versionName: 'Canonical Class 1-A Weekly Timetable',
    status: 'PUBLISHED',
    slots: [
      ParentTimetableSlot(
        id: 'monday-1',
        dayOfWeek: 1,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'Mathematics',
        teacherName: 'Ramesh Gurung',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-2',
        dayOfWeek: 1,
        startsAt: '09:45',
        endsAt: '10:25',
        subjectName: 'Science and Health',
        teacherName: 'Sarita Shrestha',
        periodName: 'Period 2',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-3',
        dayOfWeek: 1,
        startsAt: '10:30',
        endsAt: '11:10',
        subjectName: 'Social Studies and Human Values',
        teacherName: 'Menuka Sharma',
        periodName: 'Period 3',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-4',
        dayOfWeek: 1,
        startsAt: '11:15',
        endsAt: '11:55',
        subjectName: 'Computer and Digital Literacy',
        teacherName: 'Rojina Tamang',
        periodName: 'Period 4',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-5',
        dayOfWeek: 1,
        startsAt: '12:35',
        endsAt: '13:15',
        subjectName: 'Creative Arts',
        teacherName: 'Sabita Tamang',
        periodName: 'Period 5',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-6',
        dayOfWeek: 1,
        startsAt: '13:20',
        endsAt: '14:00',
        subjectName: 'Moral Education and Local Curriculum',
        teacherName: 'Menuka Sharma',
        periodName: 'Period 6',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-7',
        dayOfWeek: 1,
        startsAt: '14:05',
        endsAt: '14:45',
        subjectName: 'Science and Health',
        teacherName: 'Sarita Shrestha',
        periodName: 'Period 7',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'monday-8',
        dayOfWeek: 1,
        startsAt: '14:50',
        endsAt: '15:30',
        subjectName: 'Social Studies and Human Values',
        teacherName: 'Menuka Sharma',
        periodName: 'Period 8',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'tuesday-1',
        dayOfWeek: 2,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'English Language',
        teacherName: 'Anita Rai',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'wednesday-1',
        dayOfWeek: 3,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'Nepali Language',
        teacherName: 'Prakash Thapa',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'thursday-1',
        dayOfWeek: 4,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'Science and Health',
        teacherName: 'Sarita Shrestha',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'friday-1',
        dayOfWeek: 5,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'Creative Arts',
        teacherName: 'Sabita Tamang',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
      ParentTimetableSlot(
        id: 'sunday-1',
        dayOfWeek: 7,
        startsAt: '09:00',
        endsAt: '09:40',
        subjectName: 'Mathematics',
        teacherName: 'Ramesh Gurung',
        periodName: 'Period 1',
        room: 'Class 1-A Room',
      ),
    ],
  );

  testWidgets('filters the linked-child timetable by selected weekday', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          backgroundColor: ParentPortalColors.page,
          body: SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: ParentTimetableView(
              child: child,
              timetable: timetable,
              classTeacher: 'Ramesh Gurung',
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('timetable-day-2')));
    await tester.pumpAndSettle();

    expect(find.text('Tuesday'), findsOneWidget);
    expect(find.text('English Language'), findsOneWidget);
    expect(find.text('Science and Health'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('matches the parent timetable visual treatment', (tester) async {
    tester.view.physicalSize = const Size(432, 911);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: ParentPortalColors.green,
          ),
          scaffoldBackgroundColor: ParentPortalColors.page,
          fontFamily: Platform.isMacOS ? 'SchoolOsGolden' : null,
          useMaterial3: true,
        ),
        home: Scaffold(
          appBar: AppBar(
            title: const Text(
              'Timetable',
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
          body: const SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: ParentTimetableView(
                child: child,
                timetable: timetable,
                classTeacher: 'Ramesh Gurung',
              ),
            ),
          ),
          bottomNavigationBar: SchoolOsBottomNavigation(
            selectedIndex: 5,
            onSelected: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('timetable-day-1')));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/parent_timetable_screen.png'),
    );
  }, skip: !Platform.isMacOS);
}

Future<void> _loadFont(String family, String path) async {
  final bytes = await File(path).readAsBytes();
  final loader = FontLoader(family)
    ..addFont(Future.value(ByteData.sublistView(bytes)));
  await loader.load();
}
