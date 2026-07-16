import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/private_read_cache.dart';
import '../../../core/storage/teacher_attendance_draft_store.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_models.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
    draftStore: ref.watch(teacherAttendanceDraftStoreProvider),
  );
});

typedef AttendanceMonthQuery = ({String studentId, int year, int month});

final parentAttendanceProvider = FutureProvider.autoDispose
    .family<AttendanceViewData, AttendanceMonthQuery>((ref, query) async {
      final repository = ref.watch(attendanceRepositoryProvider);
      final snapshot = await repository.getParentAttendanceSnapshot(
        query.studentId,
        DateTime(query.year, query.month),
      );
      return AttendanceViewData(
        summary: snapshot.summary,
        days: snapshot.days,
        isOffline: !ref.watch(connectivityProvider) || snapshot.fromCache,
      );
    });

final teacherAttendanceControllerProvider =
    StateNotifierProvider<TeacherAttendanceController, TeacherAttendanceState>((
      ref,
    ) {
      return TeacherAttendanceController(
        repository: ref.watch(attendanceRepositoryProvider),
        isOnline: ref.watch(connectivityProvider),
      );
    });

class AttendanceViewData {
  const AttendanceViewData({
    required this.summary,
    required this.days,
    required this.isOffline,
  });

  final AttendanceSummary summary;
  final List<AttendanceDay> days;
  final bool isOffline;
}

class TeacherAttendanceState {
  const TeacherAttendanceState({
    this.isLoading = true,
    this.classes = const [],
    this.selectedClassId,
    this.date,
    this.entries = const [],
    this.originalEntries = const [],
    this.hasUnsavedChanges = false,
    this.syncStatus = AttendanceSyncStatus.synced,
    this.message,
    this.isOffline = false,
    this.isSubmitting = false,
    this.attendance = const TeacherAttendanceMeta(
      isSubmitted: false,
      isLocked: false,
      conflictStatus: 'NONE',
    ),
    this.isWorkingDay = true,
    this.lastUpdated,
    this.todayPeriods = const [],
    this.pendingAttendanceCount = 0,
    this.error,
    this.draftClientSubmissionId,
    this.draftReceiptState,
  });

  final bool isLoading;
  final List<TeacherClassSection> classes;
  final String? selectedClassId;
  final DateTime? date;
  final List<AttendanceStudentEntry> entries;
  final List<AttendanceStudentEntry> originalEntries;
  final bool hasUnsavedChanges;
  final AttendanceSyncStatus syncStatus;
  final String? message;
  final bool isOffline;
  final bool isSubmitting;
  final TeacherAttendanceMeta attendance;
  final bool isWorkingDay;
  final DateTime? lastUpdated;
  final List<TeacherTodayPeriod> todayPeriods;
  final int pendingAttendanceCount;
  final Object? error;
  final String? draftClientSubmissionId;
  final AttendanceDraftReceiptState? draftReceiptState;

  bool get isReadOnly =>
      attendance.isSubmitted ||
      attendance.isLocked ||
      attendance.hasConflict ||
      !isWorkingDay;

  bool get isReceiptPending => draftReceiptState?.locksContent ?? false;

  bool get isEditingLocked => isReadOnly || isReceiptPending;

  int get changedCount {
    final originalById = {
      for (final entry in originalEntries) entry.studentId: entry.status,
    };
    return entries
        .where((entry) => originalById[entry.studentId] != entry.status)
        .length;
  }

  TeacherClassSection? get selectedClass {
    if (classes.isEmpty || selectedClassId == null) {
      return null;
    }
    return classes.firstWhere(
      (item) => item.id == selectedClassId,
      orElse: () => classes.first,
    );
  }

  TeacherAttendanceState copyWith({
    bool? isLoading,
    List<TeacherClassSection>? classes,
    String? selectedClassId,
    DateTime? date,
    List<AttendanceStudentEntry>? entries,
    List<AttendanceStudentEntry>? originalEntries,
    bool? hasUnsavedChanges,
    AttendanceSyncStatus? syncStatus,
    String? message,
    bool clearMessage = false,
    bool? isOffline,
    bool? isSubmitting,
    TeacherAttendanceMeta? attendance,
    bool? isWorkingDay,
    DateTime? lastUpdated,
    List<TeacherTodayPeriod>? todayPeriods,
    int? pendingAttendanceCount,
    Object? error,
    bool clearError = false,
    String? draftClientSubmissionId,
    bool clearDraftClientSubmissionId = false,
    AttendanceDraftReceiptState? draftReceiptState,
    bool clearDraftReceiptState = false,
  }) {
    return TeacherAttendanceState(
      isLoading: isLoading ?? this.isLoading,
      classes: classes ?? this.classes,
      selectedClassId: selectedClassId ?? this.selectedClassId,
      date: date ?? this.date,
      entries: entries ?? this.entries,
      originalEntries: originalEntries ?? this.originalEntries,
      hasUnsavedChanges: hasUnsavedChanges ?? this.hasUnsavedChanges,
      syncStatus: syncStatus ?? this.syncStatus,
      message: clearMessage ? null : message ?? this.message,
      isOffline: isOffline ?? this.isOffline,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      attendance: attendance ?? this.attendance,
      isWorkingDay: isWorkingDay ?? this.isWorkingDay,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      todayPeriods: todayPeriods ?? this.todayPeriods,
      pendingAttendanceCount:
          pendingAttendanceCount ?? this.pendingAttendanceCount,
      error: clearError ? null : error ?? this.error,
      draftClientSubmissionId: clearDraftClientSubmissionId
          ? null
          : draftClientSubmissionId ?? this.draftClientSubmissionId,
      draftReceiptState: clearDraftReceiptState
          ? null
          : draftReceiptState ?? this.draftReceiptState,
    );
  }
}

class TeacherAttendanceController
    extends StateNotifier<TeacherAttendanceState> {
  TeacherAttendanceController({
    required this._repository,
    required bool isOnline,
    this.draftSaveDelay = const Duration(milliseconds: 500),
  }) : _isOnline = isOnline,
       super(
         TeacherAttendanceState(date: DateTime.now(), isOffline: !isOnline),
       ) {
    load();
  }

  final AttendanceRepository _repository;
  final bool _isOnline;
  final Duration draftSaveDelay;
  Timer? _draftSaveTimer;

  Future<void> load({String? requestedClassSectionId}) async {
    state = state.copyWith(
      isLoading: true,
      isOffline: !_isOnline,
      clearError: true,
      clearMessage: true,
    );
    try {
      final date = state.date ?? DateTime.now();
      final today = await _repository.getTeacherToday(date);
      final classes = today.classes;
      if (classes.isEmpty) {
        state = state.copyWith(
          isLoading: false,
          classes: const [],
          entries: const [],
          originalEntries: const [],
          isOffline: !_isOnline,
          todayPeriods: today.periods,
          pendingAttendanceCount: 0,
          lastUpdated: today.lastUpdated,
          message:
              'No classes are assigned to you for the current school year.',
        );
        return;
      }

      final selectedClassId =
          requestedClassSectionId ?? state.selectedClassId ?? classes.first.id;
      if (!classes.any((item) => item.id == selectedClassId)) {
        state = state.copyWith(
          isLoading: false,
          classes: classes,
          entries: const [],
          originalEntries: const [],
          todayPeriods: today.periods,
          pendingAttendanceCount: today.pendingAttendanceCount,
          lastUpdated: today.lastUpdated,
          error: const PermissionException(
            'This class is not assigned to you.',
          ),
          message: 'This class is not assigned to you.',
        );
        return;
      }
      final draft = await _repository.loadDraftAttendance(
        selectedClassId,
        date,
      );
      final selectedClass = classes.firstWhere(
        (item) => item.id == selectedClassId,
        orElse: () => classes.first,
      );
      final roster = await _repository.getClassAttendanceSheet(
        selectedClass,
        date,
      );
      final sheet = draft?.entries ?? roster.entries;

      state = state.copyWith(
        isLoading: false,
        classes: classes,
        selectedClassId: selectedClassId,
        date: date,
        entries: sheet,
        originalEntries: roster.entries,
        hasUnsavedChanges: draft != null,
        syncStatus:
            draft?.receiptState.syncStatus ?? AttendanceSyncStatus.synced,
        isOffline: !_isOnline || roster.fromCache || today.fromCache,
        attendance: roster.attendance,
        isWorkingDay: roster.isWorkingDay,
        lastUpdated: roster.lastUpdated,
        todayPeriods: today.periods,
        pendingAttendanceCount: today.pendingAttendanceCount,
        draftClientSubmissionId: draft?.clientSubmissionId,
        clearDraftClientSubmissionId: draft == null,
        draftReceiptState: draft?.receiptState,
        clearDraftReceiptState: draft == null,
        message: draft != null
            ? _draftLoadMessage(draft, isOnline: _isOnline)
            : (!_isOnline || roster.fromCache || today.fromCache)
            ? 'You are offline. Showing the last saved roster.'
            : roster.attendance.hasConflict
            ? 'This attendance record has a conflict and is read-only.'
            : roster.attendance.isLocked
            ? 'Attendance is locked for this date.'
            : roster.attendance.isSubmitted
            ? 'Attendance has already been submitted.'
            : null,
      );
    } on AppException catch (error) {
      state = state.copyWith(
        isLoading: false,
        syncStatus: AttendanceSyncStatus.failed,
        error: error,
        message: error.message,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        syncStatus: AttendanceSyncStatus.failed,
        error: error,
        message: 'Could not load attendance. Please try again.',
      );
    }
  }

  Future<void> selectClass(String classSectionId) async {
    await load(requestedClassSectionId: classSectionId);
  }

  Future<void> selectDate(DateTime date) async {
    state = state.copyWith(date: date);
    await load();
  }

  void markStudent(String studentId, AttendanceStatus status) {
    if (state.isEditingLocked || state.isSubmitting) return;
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.studentId == studentId ? entry.copyWith(status: status) : entry,
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.draft,
      message: 'Attendance changes are not submitted yet.',
    );
    _scheduleLocalDraftSave();
  }

  void bulkMarkPresent() {
    if (state.isEditingLocked || state.isSubmitting) return;
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.copyWith(status: AttendanceStatus.present),
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.draft,
      message: 'All students marked present. Review before submitting.',
    );
    _scheduleLocalDraftSave();
  }

  Future<void> discardDraft() async {
    final classId = state.selectedClassId;
    final date = state.date;
    if (classId == null ||
        date == null ||
        state.isSubmitting ||
        state.isReceiptPending) {
      return;
    }
    _draftSaveTimer?.cancel();
    await _repository.discardDraftAttendance(classId, date);
    state = state.copyWith(
      entries: state.originalEntries,
      hasUnsavedChanges: false,
      syncStatus: AttendanceSyncStatus.synced,
      clearDraftClientSubmissionId: true,
      clearDraftReceiptState: true,
      clearError: true,
      message: 'Draft discarded. The last server roster is shown.',
    );
  }

  Future<void> submit() async {
    final classId = state.selectedClassId;
    final date = state.date;
    if (classId == null ||
        date == null ||
        state.isSubmitting ||
        !state.hasUnsavedChanges ||
        state.isReadOnly) {
      return;
    }

    _draftSaveTimer?.cancel();

    if (!_isOnline) {
      if (state.isReceiptPending) {
        state = state.copyWith(
          isOffline: true,
          syncStatus: AttendanceSyncStatus.serverChecking,
          message:
              'Reconnect before checking this server receipt. The draft remains locked on this phone.',
        );
        return;
      }
      state = state.copyWith(isSubmitting: true);
      try {
        final draft = await _repository.saveDraftAttendanceLocally(
          classId,
          date,
          state.entries,
        );
        state = state.copyWith(
          isSubmitting: false,
          hasUnsavedChanges: true,
          syncStatus: AttendanceSyncStatus.queued,
          isOffline: true,
          draftClientSubmissionId: draft.clientSubmissionId,
          draftReceiptState: draft.receiptState,
          message: 'Draft queued on this device. Reconnect to sync it.',
        );
      } catch (error) {
        state = state.copyWith(
          isSubmitting: false,
          syncStatus: AttendanceSyncStatus.failed,
          message: 'The draft could not be saved on this device.',
        );
      }
      return;
    }

    state = state.copyWith(
      isSubmitting: true,
      syncStatus: AttendanceSyncStatus.syncing,
      message: 'Syncing attendance...',
    );
    try {
      final draft = await _repository.saveDraftAttendanceLocally(
        classId,
        date,
        state.entries,
      );
      state = state.copyWith(
        draftClientSubmissionId: draft.clientSubmissionId,
        draftReceiptState: draft.receiptState,
      );
      final selectedClass = state.selectedClass;
      if (selectedClass == null) {
        state = state.copyWith(isSubmitting: false);
        return;
      }
      final result = await _repository.submitAttendance(
        selectedClass,
        date,
        state.entries,
        draft.clientSubmissionId,
        draft.savedAt,
      );
      final serverOwnsResult = result.canClearDeviceDraft;
      final receiptPersistencePending =
          !serverOwnsResult && !result.deviceReceiptPersisted;
      state = state.copyWith(
        isSubmitting: false,
        hasUnsavedChanges: !serverOwnsResult,
        syncStatus: receiptPersistencePending
            ? AttendanceSyncStatus.serverChecking
            : result.status,
        pendingAttendanceCount:
            result.status == AttendanceSyncStatus.synced &&
                state.pendingAttendanceCount > 0
            ? state.pendingAttendanceCount - 1
            : state.pendingAttendanceCount,
        attendance: TeacherAttendanceMeta(
          submittedAt: serverOwnsResult
              ? DateTime.now()
              : state.attendance.submittedAt,
          lockAt: state.attendance.lockAt,
          isSubmitted: result.status == AttendanceSyncStatus.synced,
          isLocked: state.attendance.isLocked,
          conflictStatus: result.status == AttendanceSyncStatus.conflict
              ? 'FLAGGED'
              : 'NONE',
        ),
        clearDraftClientSubmissionId: serverOwnsResult,
        draftReceiptState: serverOwnsResult
            ? null
            : receiptPersistencePending
            ? AttendanceDraftReceiptState.transportAmbiguous
            : result.draftReceiptState,
        clearDraftReceiptState: serverOwnsResult,
        message: receiptPersistencePending
            ? 'SchoolOS returned a receipt, but this phone could not save it safely. Keep this locked draft and check again.'
            : result.status == AttendanceSyncStatus.conflict
            ? 'Attendance reached the server but needs conflict review.'
            : result.serverStatus == AttendanceServerSyncStatus.rejected
            ? 'SchoolOS did not accept this attendance. The draft remains on this phone for review.'
            : result.status == AttendanceSyncStatus.serverChecking
            ? 'SchoolOS is still checking this attendance. The draft remains on this phone.'
            : result.replayed
            ? 'Attendance was already received. No duplicate was created.'
            : 'Attendance submitted successfully.',
      );
    } on AppException catch (error) {
      final receiptPending = state.isReceiptPending || _isAmbiguousSync(error);
      if (receiptPending) {
        final receiptState = state.isReceiptPending
            ? state.draftReceiptState!
            : AttendanceDraftReceiptState.transportAmbiguous;
        final submissionId = state.draftClientSubmissionId;
        if (submissionId != null) {
          try {
            await _repository.markDraftReceiptState(
              classId,
              date,
              state.entries,
              clientSubmissionId: submissionId,
              receiptState: receiptState,
            );
          } catch (_) {
            // The already-written draft remains fail-closed in memory below.
          }
        }
        state = state.copyWith(
          isSubmitting: false,
          syncStatus: AttendanceSyncStatus.serverChecking,
          draftReceiptState: receiptState,
          message:
              'SchoolOS could not confirm the receipt yet. Keep this locked draft and check again when connected.',
        );
        return;
      }
      state = state.copyWith(
        isSubmitting: false,
        syncStatus: AttendanceSyncStatus.failed,
        message: error is NetworkException || error is TimeoutException
            ? 'Sync failed. Your draft remains on this device. Retry when connected.'
            : error.message,
      );
    } catch (error) {
      state = state.copyWith(
        isSubmitting: false,
        syncStatus: AttendanceSyncStatus.failed,
        message: 'Attendance submission failed. Your draft is still saved.',
      );
    }
  }

  void _scheduleLocalDraftSave() {
    final classId = state.selectedClassId;
    final date = state.date;
    if (classId == null || date == null || state.isEditingLocked) return;

    final entries = List<AttendanceStudentEntry>.unmodifiable(state.entries);
    _draftSaveTimer?.cancel();
    _draftSaveTimer = Timer(
      draftSaveDelay,
      () => unawaited(_saveLocalDraftSnapshot(classId, date, entries)),
    );
  }

  Future<void> _saveLocalDraftSnapshot(
    String classId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    try {
      final draft = await _repository.saveDraftAttendanceLocally(
        classId,
        date,
        entries,
      );
      if (state.selectedClassId != classId || state.date != date) return;

      state = state.copyWith(
        draftClientSubmissionId: draft.clientSubmissionId,
        draftReceiptState: draft.receiptState,
        syncStatus: draft.receiptState == AttendanceDraftReceiptState.local
            ? (_isOnline
                  ? AttendanceSyncStatus.draft
                  : AttendanceSyncStatus.queued)
            : draft.receiptState.syncStatus,
        isOffline: !_isOnline,
        message: draft.receiptState == AttendanceDraftReceiptState.rejected
            ? 'SchoolOS did not accept this attendance. Change the draft to create a new submission, or discard it.'
            : _isOnline
            ? 'Draft saved on this phone. Submit when ready.'
            : 'Draft queued on this device. Reconnect to sync it.',
      );
    } catch (_) {
      if (state.selectedClassId != classId || state.date != date) return;
      state = state.copyWith(
        syncStatus: AttendanceSyncStatus.failed,
        message: 'The draft could not be saved on this device.',
      );
    }
  }

  @override
  void dispose() {
    _draftSaveTimer?.cancel();
    super.dispose();
  }
}

String _draftLoadMessage(
  TeacherAttendanceDraft draft, {
  required bool isOnline,
}) {
  return switch (draft.receiptState) {
    AttendanceDraftReceiptState.local =>
      isOnline
          ? 'Attendance draft is ready to sync.'
          : 'Attendance draft is queued on this device.',
    AttendanceDraftReceiptState.rejected =>
      'SchoolOS did not accept this attendance. Review the draft before creating a new submission.',
    AttendanceDraftReceiptState.processing ||
    AttendanceDraftReceiptState.unknown ||
    AttendanceDraftReceiptState.transportAmbiguous =>
      isOnline
          ? 'SchoolOS is still checking this attendance. The saved draft is locked until the receipt is confirmed.'
          : 'This attendance is awaiting a server receipt. Reconnect before checking it again.',
  };
}

bool _isAmbiguousSync(AppException error) =>
    error is NetworkException ||
    error is TimeoutException ||
    error is ServerException ||
    error is UnknownException;
