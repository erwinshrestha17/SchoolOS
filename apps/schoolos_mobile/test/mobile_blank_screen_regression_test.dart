import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
import 'package:schoolos_mobile/features/teacher/domain/teacher_models.dart';
import 'package:schoolos_mobile/features/teacher/presentation/screens/teacher_homework_screen.dart';

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
}
