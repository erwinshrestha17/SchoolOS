import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/features/attendance/application/attendance_providers.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockAttendanceRepository repository;

  const assignedClass = TeacherClassSection(
    id: 'year-1:class-1:section-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    name: 'Grade 3 - A',
    subject: 'Mathematics',
  );
  const entries = [
    AttendanceStudentEntry(
      studentId: 'student-1',
      studentName: 'Asha Sharma',
      rollNumber: '7',
      status: AttendanceStatus.present,
    ),
  ];

  setUpAll(() {
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(assignedClass);
    registerFallbackValue(<AttendanceStudentEntry>[]);
  });

  setUp(() {
    repository = MockAttendanceRepository();
    when(() => repository.getTeacherToday(any())).thenAnswer(
      (_) async => TeacherTodaySnapshot(
        date: DateTime(2026, 6, 18),
        periods: const [],
        classes: const [assignedClass],
        pendingAttendanceCount: 1,
        lastUpdated: DateTime(2026, 6, 18, 8),
      ),
    );
    when(
      () => repository.loadDraftAttendance(any(), any()),
    ).thenAnswer((_) async => null);
    when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
      (_) async => TeacherRosterSnapshot(
        entries: entries,
        attendance: const TeacherAttendanceMeta(
          isSubmitted: false,
          isLocked: false,
          conflictStatus: 'NONE',
        ),
        isWorkingDay: true,
        lastUpdated: DateTime(2026, 6, 18, 8),
      ),
    );
  });

  test(
    'teacher sees assigned classes and an unassigned deep link is denied',
    () async {
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);

      expect(controller.state.classes, [assignedClass]);

      await controller.load(
        requestedClassSectionId: 'year-1:class-other:section-other',
      );

      expect(controller.state.error, isA<PermissionException>());
      expect(controller.state.entries, isEmpty);
    },
  );

  test(
    'locked attendance is read-only and status controls do not mutate it',
    () async {
      when(() => repository.getClassAttendanceSheet(any(), any())).thenAnswer(
        (_) async => TeacherRosterSnapshot(
          entries: entries,
          attendance: const TeacherAttendanceMeta(
            isSubmitted: true,
            isLocked: true,
            conflictStatus: 'NONE',
          ),
          isWorkingDay: true,
          lastUpdated: DateTime(2026, 6, 18, 8),
        ),
      );
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);

      controller.markStudent('student-1', AttendanceStatus.absent);

      expect(controller.state.isReadOnly, isTrue);
      expect(controller.state.entries.single.status, AttendanceStatus.present);
    },
  );

  test(
    'attendance controls track changes and duplicate submit is prevented',
    () async {
      final submitCompleter = Completer<TeacherAttendanceSubmitResult>();
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-submit-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: entries,
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer((_) => submitCompleter.future);
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);
      controller.markStudent('student-1', AttendanceStatus.late);

      final firstSubmit = controller.submit();
      final secondSubmit = controller.submit();
      await Future<void>.delayed(Duration.zero);

      verify(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).called(1);
      submitCompleter.complete(
        const TeacherAttendanceSubmitResult(
          status: AttendanceSyncStatus.synced,
          replayed: false,
        ),
      );
      await Future.wait([firstSubmit, secondSubmit]);

      expect(controller.state.attendance.isSubmitted, isTrue);
      expect(controller.state.hasUnsavedChanges, isFalse);
    },
  );

  test('offline submit queues a draft without calling the server', () async {
    when(
      () => repository.saveDraftAttendanceLocally(any(), any(), any()),
    ).thenAnswer(
      (_) async => TeacherAttendanceDraft(
        clientSubmissionId: 'mobile-offline-1',
        savedAt: DateTime(2026, 6, 18, 8),
        entries: entries,
      ),
    );
    when(
      () => repository.discardDraftAttendance(any(), any()),
    ).thenAnswer((_) async {});
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: false,
    );
    await _waitForLoad(controller);
    controller.markStudent('student-1', AttendanceStatus.absent);

    await controller.submit();

    expect(controller.state.syncStatus, AttendanceSyncStatus.queued);
    expect(controller.state.message, contains('Reconnect'));
    verifyNever(
      () => repository.submitAttendance(any(), any(), any(), any(), any()),
    );

    await controller.discardDraft();
    expect(controller.state.hasUnsavedChanges, isFalse);
    expect(controller.state.entries.single.status, AttendanceStatus.present);
  });

  test(
    'module lock and expired session errors remain typed for safe UI states',
    () async {
      when(
        () => repository.getTeacherToday(any()),
      ).thenThrow(const ModuleLockedException());
      final lockedController = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(lockedController);
      expect(lockedController.state.error, isA<ModuleLockedException>());

      when(
        () => repository.getTeacherToday(any()),
      ).thenThrow(const SessionExpiredException());
      final expiredController = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(expiredController);
      expect(expiredController.state.error, isA<SessionExpiredException>());
    },
  );
}

Future<void> _waitForLoad(TeacherAttendanceController controller) async {
  for (var attempt = 0; attempt < 20 && controller.state.isLoading; attempt++) {
    await Future<void>.delayed(Duration.zero);
  }
}
