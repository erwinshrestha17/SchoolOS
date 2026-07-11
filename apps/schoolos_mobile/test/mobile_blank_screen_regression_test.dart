import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/constants/app_routes.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/attendance/application/attendance_providers.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';
import 'package:schoolos_mobile/features/attendance/presentation/screens/teacher_attendance_screen.dart';
import 'package:schoolos_mobile/features/principal/application/principal_providers.dart';
import 'package:schoolos_mobile/features/principal/presentation/screens/principal_screens.dart';
import 'package:schoolos_mobile/features/teacher/application/teacher_providers.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_repository.dart';
import 'package:schoolos_mobile/features/teacher/domain/teacher_models.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_activity_screen.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_class_hub_screen.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_homework_screen.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_messages_screen.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_timetable_screen.dart';
import 'package:schoolos_mobile/features/teacher/presentation/widgets/teacher_app_widgets.dart';

class _MockTeacherRepository extends Mock implements TeacherRepository {}

class _MockAttendanceRepository extends Mock implements AttendanceRepository {}

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getUserRole() async => null;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _FakeApiClient();
}

class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier(super.tokenStorage, super.authRepository, super.appPrefs);

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'principal');
  }
}

void main() {
  const assignedClass = TeacherClassSection(
    id: 'year-1:class-1:section-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    name: 'Grade 3 - A',
    subject: 'Mathematics',
  );
  const student = AttendanceStudentEntry(
    studentId: 'student-1',
    studentName: 'Asha Sharma',
    rollNumber: '7',
    status: AttendanceStatus.present,
  );

  setUpAll(() {
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(assignedClass);
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('principal today stays overflow-free on a compact phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalDashboardProvider.overrideWith((ref) async {
            return {
              'attentionCount': 8,
              'cards': [
                {
                  'key': 'attendance',
                  'label': 'Attendance Risk',
                  'value': '24',
                  'detail': 'classes',
                  'tone': 'warning',
                  'route': AppRoutes.principalAttendanceRisk,
                },
                {
                  'key': 'staff',
                  'label': 'Staff Absence',
                  'value': '0',
                  'detail': 'staff today',
                  'tone': 'success',
                  'route': AppRoutes.principalStaffAbsence,
                },
              ],
              'alerts': <Map<String, dynamic>>[],
              'quickActions': <Map<String, dynamic>>[],
              'recentUpdates': <Map<String, dynamic>>[],
            };
          }),
        ],
        child: const MaterialApp(home: PrincipalTodayScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Principal Today'), findsOneWidget);
    expect(find.text('Attendance Risk'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal approvals paints populated approval content', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalApprovalsProvider.overrideWith((ref, status) async {
            return {
              'summary': {'pending': 1, 'urgent': 1, 'today': 1},
              'items': [
                {
                  'id': 'leave-1',
                  'type': 'leave',
                  'title': 'Leave Request',
                  'subtitle': 'Maya Gurung',
                  'detail': '2 days leave',
                  'status': 'PENDING',
                  'severity': 'high',
                },
              ],
            };
          }),
        ],
        child: const MaterialApp(home: PrincipalApprovalsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Approvals'), findsWidgets);
    expect(find.text('Leave Request'), findsOneWidget);
    expect(find.text('Review'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal approvals paints a clear empty state', (tester) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalApprovalsProvider.overrideWith((ref, status) async {
            return {
              'summary': {'pending': 0, 'urgent': 0, 'today': 0},
              'items': <Map<String, dynamic>>[],
            };
          }),
        ],
        child: const MaterialApp(home: PrincipalApprovalsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nothing needs action here'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal tasks keeps unsupported task creation unavailable', (
    tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalSnapshotProvider.overrideWith((ref, key) async {
            return {
              'metrics': {'dueToday': 0, 'overdue': 0, 'completed': 0},
              'items': <Map<String, dynamic>>[],
              'createTask': {
                'supported': false,
                'message': 'Follow-up task creation needs backend work.',
              },
            };
          }),
        ],
        child: const MaterialApp(home: PrincipalTasksScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Create follow-up task'), findsOneWidget);
    expect(
      find.text(
        'Follow-up task creation is not enabled in the principal app yet. Use the school operations workspace for now.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('backend'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal walkthrough writes remain clearly unavailable', (
    tester,
  ) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalSnapshotProvider.overrideWith((ref, key) async {
            return {
              'metrics': {'scheduled': 1, 'completed': 0, 'followUp': 0},
              'todaysWalkthroughs': [
                {
                  'id': 'slot-1',
                  'title': 'Grade 3 - Mathematics',
                  'subtitle': 'Mina Shrestha',
                  'detail': 'Period 1',
                  'status': 'Scheduled',
                },
              ],
              'recentObservations': <Map<String, dynamic>>[],
              'newObservation': {
                'supported': false,
                'message':
                    'New classroom observations need an audited endpoint.',
              },
            };
          }),
        ],
        child: const MaterialApp(home: PrincipalWalkthroughsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Grade 3 - Mathematics'), findsOneWidget);
    expect(find.text('New observation'), findsOneWidget);
    expect(find.text('Walkthrough follow-up'), findsOneWidget);
    expect(
      find.text(
        'Walkthrough observation capture is not enabled in the principal app yet. Scheduled visits are shown read-only.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Walkthrough follow-up capture is not enabled in the principal app yet. Follow-up status remains read-only here.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('endpoint'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal admissions snapshot shows attention items without a '
      'fake navigable chevron', (tester) async {
    final sharedPrefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakeAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalSnapshotProvider.overrideWith((ref, key) async {
            return {
              'metrics': {
                'waitingForReview': 3,
                'approvedReadyToAdmit': 1,
                'documentsPending': 2,
                'duplicateWarnings': 1,
              },
              'items': [
                {
                  'id': 'waiting-review',
                  'title': 'Admissions needing review',
                  'detail': '3 cases awaiting a school decision',
                  'status': 'attention',
                  'route': '/principal/admissions/review',
                },
                {
                  'id': 'duplicate-warnings',
                  'title': 'Duplicate warnings',
                  'detail': '1 case needs duplicate review',
                  'status': 'attention',
                  'route': '/principal/admissions/duplicates',
                },
              ],
            };
          }),
        ],
        child: const MaterialApp(
          home: PrincipalSnapshotScreen(
            snapshotKey: 'admissions',
            title: 'Admissions',
            subtitle: 'Pending admission and review attention',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Admissions needing review'), findsOneWidget);
    expect(find.text('Duplicate warnings'), findsOneWidget);
    // These items carry a backend `route` that has no matching mobile
    // GoRoute, so the row must not show a chevron implying it is tappable.
    expect(find.byIcon(Icons.chevron_right_rounded), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher attendance paints assigned roster content', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = _MockAttendanceRepository();
    when(() => repository.getTeacherToday(any())).thenAnswer(
      (_) async => TeacherTodaySnapshot(
        date: DateTime(2026, 6, 19),
        periods: const [],
        classes: const [assignedClass],
        pendingAttendanceCount: 1,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    when(
      () => repository.loadDraftAttendance(any(), any()),
    ).thenAnswer((_) async => null);
    when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
      (_) async => TeacherRosterSnapshot(
        entries: const [student],
        attendance: const TeacherAttendanceMeta(
          isSubmitted: false,
          isLocked: false,
          conflictStatus: 'NONE',
        ),
        isWorkingDay: true,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherAttendanceControllerProvider.overrideWith((ref) => controller),
        ],
        child: const MaterialApp(home: TeacherAttendanceScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Attendance'), findsWidgets);
    expect(find.text('Grade 3 - A • Mathematics'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(
      find.text('Asha Sharma'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Asha Sharma'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher attendance paints an assigned empty roster state', (
    tester,
  ) async {
    final repository = _MockAttendanceRepository();
    when(() => repository.getTeacherToday(any())).thenAnswer(
      (_) async => TeacherTodaySnapshot(
        date: DateTime(2026, 6, 19),
        periods: const [],
        classes: const [assignedClass],
        pendingAttendanceCount: 1,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    when(
      () => repository.loadDraftAttendance(any(), any()),
    ).thenAnswer((_) async => null);
    when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
      (_) async => TeacherRosterSnapshot(
        entries: const [],
        attendance: const TeacherAttendanceMeta(
          isSubmitted: false,
          isLocked: false,
          conflictStatus: 'NONE',
        ),
        isWorkingDay: true,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherAttendanceControllerProvider.overrideWith((ref) => controller),
        ],
        child: const MaterialApp(home: TeacherAttendanceScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Grade 3 - A • Mathematics'), findsOneWidget);
    expect(find.text('No students in this roster'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  const secondAssignedClass = TeacherClassSection(
    id: 'year-1:class-2:section-1',
    academicYearId: 'year-1',
    classId: 'class-2',
    sectionId: 'section-1',
    name: 'Grade 4 - B',
    subject: 'Science',
  );

  Future<TeacherAttendanceController> pumpTeacherAttendanceWithTwoClasses(
    WidgetTester tester, {
    required _MockAttendanceRepository repository,
  }) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    when(() => repository.getTeacherToday(any())).thenAnswer(
      (_) async => TeacherTodaySnapshot(
        date: DateTime(2026, 6, 19),
        periods: const [],
        classes: const [assignedClass, secondAssignedClass],
        pendingAttendanceCount: 1,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    when(
      () => repository.loadDraftAttendance(any(), any()),
    ).thenAnswer((_) async => null);
    when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
      (_) async => TeacherRosterSnapshot(
        entries: const [student],
        attendance: const TeacherAttendanceMeta(
          isSubmitted: false,
          isLocked: false,
          conflictStatus: 'NONE',
        ),
        isWorkingDay: true,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherAttendanceControllerProvider.overrideWith((ref) => controller),
        ],
        child: const MaterialApp(home: TeacherAttendanceScreen()),
      ),
    );
    await tester.pumpAndSettle();

    controller.markStudent(student.studentId, AttendanceStatus.absent);
    await tester.pumpAndSettle();
    expect(controller.state.hasUnsavedChanges, isTrue);

    return controller;
  }

  testWidgets(
    'teacher attendance keeps unsaved marks when the class switch is cancelled',
    (tester) async {
      final repository = _MockAttendanceRepository();
      final controller = await pumpTeacherAttendanceWithTwoClasses(
        tester,
        repository: repository,
      );

      await tester.tap(find.text('Grade 3 - A • Mathematics').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Grade 4 - B • Science').last);
      await tester.pumpAndSettle();

      expect(find.text('Discard unsaved attendance?'), findsOneWidget);
      await tester.tap(find.text('Keep editing'));
      await tester.pumpAndSettle();

      verifyNever(
        () => repository.getClassAttendanceSheet(secondAssignedClass, any()),
      );
      expect(controller.state.selectedClassId, assignedClass.id);
      expect(controller.state.hasUnsavedChanges, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'teacher attendance discards unsaved marks and switches class on confirm',
    (tester) async {
      final repository = _MockAttendanceRepository();
      final controller = await pumpTeacherAttendanceWithTwoClasses(
        tester,
        repository: repository,
      );

      await tester.tap(find.text('Grade 3 - A • Mathematics').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Grade 4 - B • Science').last);
      await tester.pumpAndSettle();

      expect(find.text('Discard unsaved attendance?'), findsOneWidget);
      await tester.tap(find.text('Discard'));
      await tester.pumpAndSettle();

      expect(controller.state.selectedClassId, secondAssignedClass.id);
      expect(controller.state.hasUnsavedChanges, isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('teacher class hub opens homework create and review with context', (
    tester,
  ) async {
    final repository = _MockAttendanceRepository();
    when(() => repository.getTeacherToday(any())).thenAnswer(
      (_) async => TeacherTodaySnapshot(
        date: DateTime(2026, 6, 19),
        periods: const [],
        classes: const [assignedClass],
        pendingAttendanceCount: 1,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    when(
      () => repository.loadDraftAttendance(any(), any()),
    ).thenAnswer((_) async => null);
    when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
      (_) async => TeacherRosterSnapshot(
        entries: const [student],
        attendance: const TeacherAttendanceMeta(
          isSubmitted: false,
          isLocked: false,
          conflictStatus: 'NONE',
        ),
        isWorkingDay: true,
        lastUpdated: DateTime(2026, 6, 19, 8),
      ),
    );
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: true,
    );

    Future<void> pumpHub() async {
      final router = GoRouter(
        initialLocation: AppRoutes.teacherClassDetail(assignedClass.id),
        routes: [
          GoRoute(
            path: AppRoutes.teacherClass,
            builder: (context, state) => TeacherClassHubScreen(
              classSectionId: state.pathParameters['classSectionId'] ?? '',
            ),
          ),
          GoRoute(
            path: AppRoutes.teacherHomework,
            builder: (context, state) {
              final query = state.uri.queryParameters;
              return Scaffold(
                body: Text(
                  'homework:${query['mode']}:${query['classId']}:${query['sectionId']}',
                ),
              );
            },
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teacherAttendanceControllerProvider.overrideWith(
              (ref) => controller,
            ),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    }

    await pumpHub();
    await tester.scrollUntilVisible(
      find.text('Activities & milestones'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.widgetWithText(TeacherTaskCard, 'Create homework'));
    await tester.pumpAndSettle();
    expect(find.text('homework:create:class-1:section-1'), findsOneWidget);

    await pumpHub();
    await tester.scrollUntilVisible(
      find.text('Activities & milestones'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.widgetWithText(TeacherTaskCard, 'Review homework'));
    await tester.pumpAndSettle();
    expect(find.text('homework:review:class-1:section-1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher homework paints real assignment content', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final snapshot = TeacherHomeworkSnapshot(
      items: [
        TeacherHomeworkItem(
          id: 'homework-1',
          title: 'Fractions practice',
          instructions: 'Complete questions 1 to 10.',
          className: 'Grade 3',
          sectionName: 'A',
          subjectName: 'Mathematics',
          dueDate: DateTime(2026, 6, 20),
          status: 'DRAFT',
          submissionRequired: true,
          attachmentCount: 0,
          submissions: const TeacherHomeworkCounts(
            total: 24,
            submitted: 2,
            reviewed: 1,
            toReview: 1,
            notSubmitted: 22,
          ),
        ),
      ],
      scopes: const [
        TeacherHomeworkScope(
          id: 'year-1:class-1:section-1:subject-1',
          academicYearId: 'year-1',
          academicYearName: '2082',
          classId: 'class-1',
          className: 'Grade 3',
          sectionId: 'section-1',
          sectionName: 'A',
          subjectId: 'subject-1',
          subjectName: 'Mathematics',
        ),
      ],
      total: 1,
      lastUpdated: DateTime(2026, 6, 19, 8),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherHomeworkProvider.overrideWith((ref, status) async => snapshot),
        ],
        child: const MaterialApp(home: TeacherHomeworkScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Fractions practice'), findsOneWidget);
    expect(find.text('Grade 3 • A • Mathematics'), findsOneWidget);
    expect(find.text('Publish'), findsOneWidget);
    expect(find.text('Review'), findsOneWidget);
    expect(find.textContaining('API not confirmed'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher homework create mode preselects selected class scope', (
    tester,
  ) async {
    final snapshot = TeacherHomeworkSnapshot(
      items: const [],
      scopes: const [
        TeacherHomeworkScope(
          id: 'year-1:class-1:section-1:subject-1',
          academicYearId: 'year-1',
          academicYearName: '2082',
          classId: 'class-1',
          className: 'Grade 3',
          sectionId: 'section-1',
          sectionName: 'A',
          subjectId: 'subject-1',
          subjectName: 'Mathematics',
        ),
      ],
      total: 0,
      lastUpdated: DateTime(2026, 6, 19, 8),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherHomeworkProvider.overrideWith((ref, query) async => snapshot),
        ],
        child: const MaterialApp(
          home: TeacherHomeworkScreen(
            initialClassId: 'class-1',
            initialSectionId: 'section-1',
            initialMode: 'create',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Showing homework for Grade 3 • A • Mathematics'),
      findsOneWidget,
    );
    expect(find.text('Create homework draft'), findsOneWidget);
    expect(find.text('Grade 3 • A • Mathematics'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'teacher homework hides the create action entirely with zero assigned scopes',
    (tester) async {
      // A teacher with no real subjectTeacherAssignment rows for the current
      // academic year must have no way to create homework at all — not a
      // dropdown offering nothing, not a disabled-but-visible button, no
      // create affordance whatsoever.
      final snapshot = TeacherHomeworkSnapshot(
        items: const [],
        scopes: const [],
        total: 0,
        lastUpdated: DateTime(2026, 6, 19, 8),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teacherHomeworkProvider.overrideWith(
              (ref, query) async => snapshot,
            ),
          ],
          child: const MaterialApp(home: TeacherHomeworkScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(FloatingActionButton), findsNothing);
      expect(find.text('Create'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('teacher homework cached mode blocks write attempts', (
    tester,
  ) async {
    final snapshot = TeacherHomeworkSnapshot(
      items: const [],
      scopes: const [
        TeacherHomeworkScope(
          id: 'year-1:class-1:section-1:subject-1',
          academicYearId: 'year-1',
          academicYearName: '2082',
          classId: 'class-1',
          className: 'Grade 3',
          sectionId: 'section-1',
          sectionName: 'A',
          subjectId: 'subject-1',
          subjectName: 'Mathematics',
        ),
      ],
      total: 0,
      lastUpdated: DateTime(2026, 6, 19, 8),
      fromCache: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherHomeworkProvider.overrideWith((ref, query) async => snapshot),
        ],
        child: const MaterialApp(
          home: TeacherHomeworkScreen(initialClassId: 'class-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        'You are offline. Homework is read-only until the connection returns.',
      ),
      findsOneWidget,
    );
    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.text('Create homework'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher activity paints the consent-safe capture surface', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final snapshot = TeacherActivitySnapshot(
      scopes: const [
        TeacherActivityScope(
          id: 'year-1:class-1:section-1',
          academicYearId: 'year-1',
          academicYearName: '2083',
          classId: 'class-1',
          className: 'Grade 3',
          sectionId: 'section-1',
          sectionName: 'A',
        ),
      ],
      posts: const [],
      lastUpdated: DateTime(2026, 6, 29, 8),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherActivityProvider.overrideWith((ref) async => snapshot),
        ],
        child: const MaterialApp(home: TeacherActivityScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Activity & milestones'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Milestone'), findsOneWidget);
    expect(find.text('Assigned class'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'teacher message reply surfaces a retry-able error instead of failing silently',
    (tester) async {
      const thread = TeacherMessageThread(
        id: 'thread-1',
        title: 'Sunita Rai',
        context: 'Asha Rai • Grade 3 - A',
        preview: 'Thank you',
        updatedAt: null,
        status: 'OPEN',
      );
      const availability = TeacherChatAvailability(
        isAvailable: true,
        notice: 'Available now',
        sla: 'Replies within 24 hours',
      );
      final detail = TeacherMessageDetail(
        thread: thread,
        messages: const [],
        availability: availability,
      );
      final repository = _MockTeacherRepository();
      when(
        () => repository.sendMessage(any(), any()),
      ).thenThrow(Exception('network down'));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teacherRepositoryProvider.overrideWithValue(repository),
            teacherMessageDetailProvider(
              thread.id,
            ).overrideWith((ref) async => detail),
          ],
          child: const MaterialApp(
            home: TeacherMessageThreadScreen(threadId: 'thread-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'Please call me back');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.text(
          'Reply could not be sent. Check your connection and try again.',
        ),
        findsOneWidget,
      );
      expect(find.text('Please call me back'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'principal approvals review action stays overflow-free at large text scale',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sharedPrefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
            authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
            authProvider.overrideWith((ref) {
              return _FakeAuthNotifier(
                ref.watch(tokenStorageServiceProvider),
                ref.watch(authRepositoryProvider),
                ref.watch(appPreferencesServiceProvider),
              );
            }),
            principalApprovalsProvider.overrideWith((ref, status) async {
              return {
                'summary': {'pending': 12, 'urgent': 3, 'today': 5},
                'items': [
                  {
                    'id': 'leave-1',
                    'type': 'leave',
                    'title':
                        'Extended maternity and medical leave request requiring principal sign-off',
                    'subtitle': 'Bishwanath Prasad Chaudhary Shrestha',
                    'detail': '45 days leave',
                    'status': 'PENDING',
                    'severity': 'high',
                  },
                ],
              };
            }),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: const PrincipalApprovalsScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Approvals'), findsWidgets);
      expect(find.text('Review'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'principal attention center stays overflow-free on a compact phone at large text scale',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sharedPrefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
            authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
            authProvider.overrideWith((ref) {
              return _FakeAuthNotifier(
                ref.watch(tokenStorageServiceProvider),
                ref.watch(authRepositoryProvider),
                ref.watch(appPreferencesServiceProvider),
              );
            }),
            principalAttentionProvider.overrideWith((ref, filter) async {
              return {
                'summary': {'critical': 9999, 'high': 128, 'medium': 4321},
                'items': [
                  {
                    'id': 'item-1',
                    'type': 'attendance',
                    'title':
                        'Grade 10 Science and Technology Section Diamond attendance follow-up required',
                    'subtitle':
                        'Bishwanath Prasad Chaudhary Shrestha Guardian Association',
                    'detail': 'Escalated 3 days ago',
                    'status': 'CRITICAL',
                    'severity': 'critical',
                  },
                ],
              };
            }),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: const PrincipalAttentionScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Attention Center'), findsWidgets);
      expect(
        find.textContaining('attendance follow-up required'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'principal fee snapshot handles large currency values and long labels without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sharedPrefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appPreferencesServiceProvider.overrideWithValue(
              AppPreferencesService(sharedPrefs),
            ),
            tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
            authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
            authProvider.overrideWith((ref) {
              return _FakeAuthNotifier(
                ref.watch(tokenStorageServiceProvider),
                ref.watch(authRepositoryProvider),
                ref.watch(appPreferencesServiceProvider),
              );
            }),
            principalSnapshotProvider.overrideWith((ref, key) async {
              return {
                'metrics': {
                  'collected': 'Rs. 1,23,45,678.50',
                  'pending': 'Rs. 45,67,890.00',
                  'overdue': 'Rs. 12,34,567.00',
                },
                'watchlist': [
                  {
                    'id': 'watch-1',
                    'title':
                        'Aaradhya Chaudhary Shrestha - Grade 10 Science and Technology Section',
                    'subtitle': 'Overdue since last trimester',
                    'detail': 'Rs. 9,87,654.00 outstanding',
                    'status': 'OVERDUE',
                  },
                ],
                'collectionTrend': [
                  {'label': 'This month', 'amount': 'Rs. 1,23,45,678.50'},
                ],
              };
            }),
          ],
          child: const MaterialApp(
            home: PrincipalSnapshotScreen(
              snapshotKey: 'fees',
              title: 'Fees Snapshot',
              subtitle: 'Read-only school finance overview',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Fees Snapshot'), findsOneWidget);
      expect(find.textContaining('Rs. 1,23,45,678.50'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'teacher timetable stays overflow-free on a compact phone with long labels',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final snapshot = TeacherTimetableSnapshot(
        rangeStart: DateTime(2026, 6, 15),
        rangeEnd: DateTime(2026, 6, 19),
        items: [
          TeacherTimetableItem(
            id: 'period-1',
            date: DateTime(2026, 6, 19),
            className: 'Grade 10 - Science and Technology Section',
            sectionName: 'Diamond',
            subjectName: 'Advanced Computer Science and Programming Fundamentals',
            room: 'Senior Block Laboratory Room 3B',
            startsAt: '09:00',
            endsAt: '09:45',
            status: 'SUBSTITUTED',
            substitution: const TeacherTimetableSubstitution(
              id: 'sub-1',
              date: null,
              status: 'ASSIGNED',
              reason: 'Approved medical leave for the assigned subject teacher',
              role: 'SUBSTITUTE',
              className: 'Grade 10 - Science and Technology Section',
              sectionName: 'Diamond',
              subjectName:
                  'Advanced Computer Science and Programming Fundamentals',
              startsAt: '09:00',
              endsAt: '09:45',
              absentTeacherName: 'Bishwanath Prasad Chaudhary Shrestha',
              substituteTeacherName: 'Erwin Kumar Shrestha',
            ),
          ),
        ],
        substitutions: const [],
        lastUpdated: DateTime(2026, 6, 19, 8),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teacherTimetableProvider.overrideWith((ref) async => snapshot),
          ],
          child: const MaterialApp(home: TeacherTimetableScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Science and Technology Section'),
        findsWidgets,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'teacher messages list stays overflow-free on a compact phone with long thread text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final snapshot = TeacherMessagesSnapshot(
        threads: const [
          TeacherMessageThread(
            id: 'thread-2',
            title: 'Bishwanath Prasad Chaudhary Guardian Association',
            context:
                'Aaradhya Chaudhary Shrestha • Grade 10 - Science and Technology Section • Diamond',
            preview:
                'Thank you very much for the detailed update about the upcoming examination schedule and syllabus coverage',
            updatedAt: null,
            status: 'ESCALATED',
          ),
        ],
        availability: const TeacherChatAvailability(
          isAvailable: false,
          notice:
              'Messaging is restricted outside school hours per the communication policy',
          sla: 'Replies within 24 hours on working days',
        ),
        lastUpdated: DateTime(2026, 6, 19, 8),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            teacherMessagesProvider.overrideWith((ref) async => snapshot),
          ],
          child: const MaterialApp(home: TeacherMessagesScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Guardian Association'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
