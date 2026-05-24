import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/network/connectivity_provider.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_models.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(ref.watch(apiClientProvider));
});

final parentAttendanceProvider =
    FutureProvider.family<AttendanceViewData, String>((ref, studentId) async {
      final repository = ref.watch(attendanceRepositoryProvider);
      final now = DateTime.now();
      final summary = await repository.getAttendanceSummary(
        studentId,
        DateTimeRangeValue(
          start: DateTime(now.year, now.month),
          end: DateTime(now.year, now.month + 1, 0),
        ),
      );
      final days = await repository.getMonthlyAttendance(studentId, now);
      return AttendanceViewData(
        summary: summary,
        days: days,
        isOffline: !ref.watch(connectivityProvider),
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
    this.hasUnsavedChanges = false,
    this.syncStatus = AttendanceSyncStatus.synced,
    this.message,
    this.isOffline = false,
  });

  final bool isLoading;
  final List<TeacherClassSection> classes;
  final String? selectedClassId;
  final DateTime? date;
  final List<AttendanceStudentEntry> entries;
  final bool hasUnsavedChanges;
  final AttendanceSyncStatus syncStatus;
  final String? message;
  final bool isOffline;

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
    bool? hasUnsavedChanges,
    AttendanceSyncStatus? syncStatus,
    String? message,
    bool? isOffline,
  }) {
    return TeacherAttendanceState(
      isLoading: isLoading ?? this.isLoading,
      classes: classes ?? this.classes,
      selectedClassId: selectedClassId ?? this.selectedClassId,
      date: date ?? this.date,
      entries: entries ?? this.entries,
      hasUnsavedChanges: hasUnsavedChanges ?? this.hasUnsavedChanges,
      syncStatus: syncStatus ?? this.syncStatus,
      message: message ?? this.message,
      isOffline: isOffline ?? this.isOffline,
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

  Future<void> load() async {
    state = state.copyWith(
      isLoading: true,
      isOffline: !_isOnline,
      message: null,
    );
    try {
      final classes = await _repository.getTeacherAssignedClasses();
      if (classes.isEmpty) {
        state = state.copyWith(
          isLoading: false,
          classes: const [],
          entries: const [],
          isOffline: !_isOnline,
          message:
              'Teacher attendance sync needs a purpose-limited class roster API.',
        );
        return;
      }

      final selectedClassId = state.selectedClassId ?? classes.first.id;
      final date = state.date ?? DateTime.now();
      final draft = await _repository.loadDraftAttendance(
        selectedClassId,
        date,
      );
      final sheet = draft.isNotEmpty
          ? draft
          : await _repository.getClassAttendanceSheet(selectedClassId, date);

      state = state.copyWith(
        isLoading: false,
        classes: classes,
        selectedClassId: selectedClassId,
        date: date,
        entries: sheet,
        hasUnsavedChanges: draft.isNotEmpty,
        syncStatus: draft.isNotEmpty
            ? AttendanceSyncStatus.pending
            : AttendanceSyncStatus.synced,
        isOffline: !_isOnline,
        message: !_isOnline
            ? 'You are offline. Attendance changes will be saved as a draft.'
            : null,
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        syncStatus: AttendanceSyncStatus.failed,
        message: 'Could not load attendance sheet. Please try again.',
      );
    }
  }

  Future<void> selectClass(String classSectionId) async {
    state = state.copyWith(selectedClassId: classSectionId);
    await load();
  }

  Future<void> selectDate(DateTime date) async {
    state = state.copyWith(date: date);
    await load();
  }

  void markStudent(String studentId, AttendanceStatus status) {
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.studentId == studentId ? entry.copyWith(status: status) : entry,
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.pending,
      message: 'Attendance changes are not submitted yet.',
    );
  }

  void bulkMarkPresent() {
    state = state.copyWith(
      entries: [
        for (final entry in state.entries)
          entry.copyWith(status: AttendanceStatus.present),
      ],
      hasUnsavedChanges: true,
      syncStatus: AttendanceSyncStatus.pending,
      message: 'All students marked present. Review before submitting.',
    );
  }

  Future<void> submit() async {
    final classId = state.selectedClassId;
    final date = state.date;
    if (classId == null || date == null) {
      return;
    }

    if (!_isOnline) {
      await _repository.saveDraftAttendanceLocally(
        classId,
        date,
        state.entries,
      );
      state = state.copyWith(
        hasUnsavedChanges: true,
        syncStatus: AttendanceSyncStatus.pending,
        isOffline: true,
        message: 'Offline draft saved. Submit when connection returns.',
      );
      return;
    }

    state = state.copyWith(message: 'Submitting attendance...');
    try {
      final status = await _repository.submitAttendance(
        classId,
        date,
        state.entries,
      );
      state = state.copyWith(
        hasUnsavedChanges: false,
        syncStatus: status,
        message: 'Attendance submitted successfully.',
      );
    } catch (_) {
      state = state.copyWith(
        syncStatus: AttendanceSyncStatus.failed,
        message: 'Attendance submission failed. Please retry.',
      );
    }
  }
}
