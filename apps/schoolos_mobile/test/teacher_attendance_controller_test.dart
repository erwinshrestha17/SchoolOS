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
    registerFallbackValue(AttendanceDraftReceiptState.local);
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
          serverStatus: AttendanceServerSyncStatus.accepted,
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

  test('attendance changes autosave to a stable device draft', () async {
    when(
      () => repository.saveDraftAttendanceLocally(any(), any(), any()),
    ).thenAnswer(
      (_) async => TeacherAttendanceDraft(
        clientSubmissionId: 'mobile-autosave-1',
        savedAt: DateTime(2026, 6, 18, 8),
        entries: entries,
      ),
    );
    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: false,
      draftSaveDelay: Duration.zero,
    );
    await _waitForLoad(controller);

    controller.markStudent('student-1', AttendanceStatus.absent);
    await _waitForDraft(controller);

    verify(
      () => repository.saveDraftAttendanceLocally(any(), any(), any()),
    ).called(1);
    expect(controller.state.hasUnsavedChanges, isTrue);
    expect(controller.state.syncStatus, AttendanceSyncStatus.queued);
    expect(controller.state.draftClientSubmissionId, 'mobile-autosave-1');
    expect(controller.state.message, contains('Reconnect'));
  });

  test('online sync failure keeps the saved draft retryable', () async {
    when(
      () => repository.saveDraftAttendanceLocally(any(), any(), any()),
    ).thenAnswer(
      (_) async => TeacherAttendanceDraft(
        clientSubmissionId: 'mobile-retry-1',
        savedAt: DateTime(2026, 6, 18, 8),
        entries: entries,
      ),
    );
    when(
      () => repository.submitAttendance(any(), any(), any(), any(), any()),
    ).thenThrow(const NetworkException());
    when(
      () => repository.markDraftReceiptState(
        any(),
        any(),
        any(),
        clientSubmissionId: any(named: 'clientSubmissionId'),
        receiptState: any(named: 'receiptState'),
      ),
    ).thenAnswer(
      (_) async => TeacherAttendanceDraft(
        clientSubmissionId: 'mobile-retry-1',
        savedAt: DateTime(2026, 6, 18, 8),
        entries: entries,
        receiptState: AttendanceDraftReceiptState.transportAmbiguous,
      ),
    );

    final controller = TeacherAttendanceController(
      repository: repository,
      isOnline: true,
    );
    await _waitForLoad(controller);
    controller.markStudent('student-1', AttendanceStatus.absent);

    await controller.submit();

    expect(controller.state.syncStatus, AttendanceSyncStatus.serverChecking);
    expect(controller.state.hasUnsavedChanges, isTrue);
    expect(controller.state.draftClientSubmissionId, 'mobile-retry-1');
    expect(
      controller.state.draftReceiptState,
      AttendanceDraftReceiptState.transportAmbiguous,
    );
    expect(controller.state.isEditingLocked, isTrue);
    expect(controller.state.message, contains('could not confirm'));

    controller.markStudent('student-1', AttendanceStatus.late);
    await controller.discardDraft();
    expect(controller.state.entries.single.status, AttendanceStatus.absent);
    verifyNever(() => repository.discardDraftAttendance(any(), any()));
  });

  test(
    'PROCESSING receipt exposes a server-check state and keeps draft',
    () async {
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-processing-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: entries,
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer(
        (_) async => const TeacherAttendanceSubmitResult(
          serverStatus: AttendanceServerSyncStatus.processing,
          replayed: true,
        ),
      );
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);
      controller.markStudent('student-1', AttendanceStatus.absent);

      await controller.submit();

      expect(controller.state.syncStatus, AttendanceSyncStatus.serverChecking);
      expect(controller.state.hasUnsavedChanges, isTrue);
      expect(controller.state.draftClientSubmissionId, 'mobile-processing-1');
      expect(
        controller.state.draftReceiptState,
        AttendanceDraftReceiptState.processing,
      );
      expect(controller.state.isEditingLocked, isTrue);
      expect(controller.state.attendance.isSubmitted, isFalse);
      expect(controller.state.message, contains('still checking'));
      expect(controller.state.message, contains('draft remains'));

      controller.markStudent('student-1', AttendanceStatus.late);
      await controller.discardDraft();
      expect(controller.state.entries.single.status, AttendanceStatus.absent);
      verifyNever(() => repository.discardDraftAttendance(any(), any()));
    },
  );

  test(
    'REJECTED receipt keeps the draft in a reviewable failed state',
    () async {
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-rejected-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: entries,
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer(
        (_) async => const TeacherAttendanceSubmitResult(
          serverStatus: AttendanceServerSyncStatus.rejected,
          replayed: true,
        ),
      );
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);
      controller.markStudent('student-1', AttendanceStatus.absent);

      await controller.submit();

      expect(controller.state.syncStatus, AttendanceSyncStatus.failed);
      expect(controller.state.hasUnsavedChanges, isTrue);
      expect(controller.state.draftClientSubmissionId, 'mobile-rejected-1');
      expect(
        controller.state.draftReceiptState,
        AttendanceDraftReceiptState.rejected,
      );
      expect(controller.state.isEditingLocked, isFalse);
      expect(controller.state.attendance.isSubmitted, isFalse);
      expect(controller.state.message, contains('did not accept'));
      expect(controller.state.message, contains('draft remains'));

      controller.markStudent('student-1', AttendanceStatus.late);
      expect(controller.state.entries.single.status, AttendanceStatus.late);
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-rejected-2',
          savedAt: DateTime(2026, 6, 18, 9),
          entries: const [
            AttendanceStudentEntry(
              studentId: 'student-1',
              studentName: 'Asha Sharma',
              rollNumber: '7',
              status: AttendanceStatus.late,
            ),
          ],
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer(
        (_) async => const TeacherAttendanceSubmitResult(
          serverStatus: AttendanceServerSyncStatus.accepted,
          replayed: false,
        ),
      );

      await controller.submit();

      final submittedIds = verify(
        () => repository.submitAttendance(
          any(),
          any(),
          any(),
          captureAny(),
          any(),
        ),
      ).captured.cast<String>();
      expect(submittedIds, ['mobile-rejected-1', 'mobile-rejected-2']);
      expect(controller.state.attendance.isSubmitted, isTrue);
      expect(controller.state.draftClientSubmissionId, isNull);
    },
  );

  test(
    'receipt persistence failure remains locked despite a REJECTED response',
    () async {
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-receipt-storage-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: entries,
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer(
        (_) async => const TeacherAttendanceSubmitResult(
          serverStatus: AttendanceServerSyncStatus.rejected,
          replayed: true,
          deviceReceiptPersisted: false,
        ),
      );
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);
      controller.markStudent('student-1', AttendanceStatus.absent);

      await controller.submit();

      expect(controller.state.syncStatus, AttendanceSyncStatus.serverChecking);
      expect(
        controller.state.draftReceiptState,
        AttendanceDraftReceiptState.transportAmbiguous,
      );
      expect(controller.state.isEditingLocked, isTrue);
      expect(controller.state.message, contains('could not save it safely'));
      controller.markStudent('student-1', AttendanceStatus.late);
      await controller.discardDraft();
      expect(controller.state.entries.single.status, AttendanceStatus.absent);
      verifyNever(() => repository.discardDraftAttendance(any(), any()));
    },
  );

  test(
    'reloaded PROCESSING receipt stays locked and retries the same ID',
    () async {
      when(() => repository.loadDraftAttendance(any(), any())).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-processing-reload-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: const [
            AttendanceStudentEntry(
              studentId: 'student-1',
              studentName: 'Asha Sharma',
              rollNumber: '7',
              status: AttendanceStatus.absent,
            ),
          ],
          receiptState: AttendanceDraftReceiptState.processing,
        ),
      );
      when(
        () => repository.saveDraftAttendanceLocally(any(), any(), any()),
      ).thenAnswer(
        (_) async => TeacherAttendanceDraft(
          clientSubmissionId: 'mobile-processing-reload-1',
          savedAt: DateTime(2026, 6, 18, 8),
          entries: const [
            AttendanceStudentEntry(
              studentId: 'student-1',
              studentName: 'Asha Sharma',
              rollNumber: '7',
              status: AttendanceStatus.absent,
            ),
          ],
          receiptState: AttendanceDraftReceiptState.processing,
        ),
      );
      when(
        () => repository.submitAttendance(any(), any(), any(), any(), any()),
      ).thenAnswer(
        (_) async => const TeacherAttendanceSubmitResult(
          serverStatus: AttendanceServerSyncStatus.accepted,
          replayed: true,
        ),
      );
      final controller = TeacherAttendanceController(
        repository: repository,
        isOnline: true,
      );
      await _waitForLoad(controller);

      expect(controller.state.syncStatus, AttendanceSyncStatus.serverChecking);
      expect(controller.state.isEditingLocked, isTrue);
      controller.markStudent('student-1', AttendanceStatus.leave);
      await controller.discardDraft();
      expect(controller.state.entries.single.status, AttendanceStatus.absent);
      verifyNever(() => repository.discardDraftAttendance(any(), any()));

      await controller.submit();

      final submissionId =
          verify(
                () => repository.submitAttendance(
                  any(),
                  any(),
                  any(),
                  captureAny(),
                  any(),
                ),
              ).captured.single
              as String;
      expect(submissionId, 'mobile-processing-reload-1');
      expect(controller.state.attendance.isSubmitted, isTrue);
    },
  );

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

Future<void> _waitForDraft(TeacherAttendanceController controller) async {
  for (
    var attempt = 0;
    attempt < 20 && controller.state.draftClientSubmissionId == null;
    attempt++
  ) {
    await Future<void>.delayed(Duration.zero);
  }
}
