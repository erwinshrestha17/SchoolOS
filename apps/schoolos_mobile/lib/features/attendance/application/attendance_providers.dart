import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/private_read_cache.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_models.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
  );
});

final parentAttendanceProvider = FutureProvider.autoDispose
    .family<AttendanceViewData, String>((ref, studentId) async {
      final repository = ref.watch(attendanceRepositoryProvider);
      final now = DateTime.now();
      final snapshot = await repository.getParentAttendanceSnapshot(
        studentId,
        now,
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

  bool get isReadOnly =>
      attendance.isSubmitted ||
      attendance.isLocked ||
      attendance.hasConflict ||
      !isWorkingDay;

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
    );
  }
}

class TeacherAttendanceController
    extends StateNotifier<TeacherAttendanceState> {
  TeacherAttendanceController({
    required this._repository,
    required bool isOnline,
  }) : _isOnline = isOnline,
       super(
         TeacherAttendanceState(date: DateTime.now(), isOffline: !isOnline),
       ) {
    load();
  }

  final AttendanceRepository _repository;
  final bool _isOnline;

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
        syncStatus: draft != null
            ? AttendanceSyncStatus.queued
            : AttendanceSyncStatus.synced,
        isOffline: !_isOnline || roster.fromCache || today.fromCache,
        attendance: roster.attendance,
        isWorkingDay: roster.isWorkingDay,
        lastUpdated: roster.lastUpdated,
        todayPeriods: today.periods,
        pendingAttendanceCount: today.pendingAttendanceCount,
        draftClientSubmissionId: draft?.clientSubmissionId,
        clearDraftClientSubmissionId: draft == null,
        message: draft != null
            ? (_isOnline
                  ? 'Attendance draft is ready to sync.'
                  : 'Attendance draft is queued on this device.')
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
    if (state.isReadOnly || state.isSubmitting) return;
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.studentId == studentId ? entry.copyWith(status: status) : entry,
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.draft,
      message: 'Attendance changes are not submitted yet.',
    );
  }

  void bulkMarkPresent() {
    if (state.isReadOnly || state.isSubmitting) return;
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.copyWith(status: AttendanceStatus.present),
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.draft,
      message: 'All students marked present. Review before submitting.',
    );
  }

  Future<void> discardDraft() async {
    final classId = state.selectedClassId;
    final date = state.date;
    if (classId == null || date == null || state.isSubmitting) return;
    await _repository.discardDraftAttendance(classId, date);
    state = state.copyWith(
      entries: state.originalEntries,
      hasUnsavedChanges: false,
      syncStatus: AttendanceSyncStatus.synced,
      clearDraftClientSubmissionId: true,
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

    if (!_isOnline) {
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
      state = state.copyWith(draftClientSubmissionId: draft.clientSubmissionId);
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
      state = state.copyWith(
        isSubmitting: false,
        hasUnsavedChanges: false,
        syncStatus: result.status,
        pendingAttendanceCount:
            result.status == AttendanceSyncStatus.synced &&
                state.pendingAttendanceCount > 0
            ? state.pendingAttendanceCount - 1
            : state.pendingAttendanceCount,
        attendance: TeacherAttendanceMeta(
          submittedAt: DateTime.now(),
          lockAt: state.attendance.lockAt,
          isSubmitted: result.status == AttendanceSyncStatus.synced,
          isLocked: state.attendance.isLocked,
          conflictStatus: result.status == AttendanceSyncStatus.conflict
              ? 'FLAGGED'
              : 'NONE',
        ),
        clearDraftClientSubmissionId:
            result.status == AttendanceSyncStatus.synced ||
            result.status == AttendanceSyncStatus.conflict,
        message: result.status == AttendanceSyncStatus.conflict
            ? 'Attendance reached the server but needs conflict review.'
            : result.replayed
            ? 'Attendance was already received. No duplicate was created.'
            : 'Attendance submitted successfully.',
      );
    } on AppException catch (error) {
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
}
