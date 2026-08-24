import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../../../core/storage/teacher_attendance_draft_store.dart';
import '../../../core/storage/teacher_attendance_scope_version_store.dart';
import '../domain/attendance_models.dart';

enum TeacherAttendanceScopeRefresh {
  unchanged,
  localDataPurged,
  transportUnavailable;

  bool get purgedLocalData => this == localDataPurged;
}

class AttendanceRepository {
  AttendanceRepository(
    this._client, {
    this.cache,
    this.draftStore,
    this.scopeVersionStore,
  });

  final ApiClient _client;
  final PrivateReadCache? cache;
  final TeacherAttendanceDraftStore? draftStore;
  final TeacherAttendanceScopeVersionStore? scopeVersionStore;
  Future<void> _scopeFence = Future<void>.value();
  int _scopeEpoch = 0;

  /// Verifies the server-owned teacher assignment version before any
  /// attendance cache or draft is read on an online load.
  Future<TeacherAttendanceScopeRefresh> refreshTeacherAttendanceScope() async {
    final dependencies = _requireTeacherAttendanceScopeDependencies();

    late final Response<dynamic> response;
    try {
      response = await _client.get('/mobile/teacher/attendance/scope-version');
    } on AppException catch (error, stackTrace) {
      if (error is NetworkException || error is TimeoutException) {
        return _withScopeFence(() async {
          if (await dependencies.scopeVersionStore.isQuarantined()) {
            throw const CacheException(
              'Teacher attendance access must be reverified before local data can be opened.',
            );
          }
          return TeacherAttendanceScopeRefresh.transportUnavailable;
        });
      }
      if (error is PermissionException || error is ModuleLockedException) {
        await clearTeacherAttendanceScopeStrict(
          clearVersion: true,
          quarantine: true,
        );
      } else {
        await _quarantineTeacherAttendanceScope(clearVersion: false);
      }
      Error.throwWithStackTrace(error, stackTrace);
    }

    final data = response.data;
    final scopeVersion = data is Map<String, dynamic>
        ? data['scopeVersion']
        : null;
    if (scopeVersion is! String ||
        !isValidTeacherAttendanceScopeVersion(scopeVersion)) {
      await _quarantineTeacherAttendanceScope(clearVersion: false);
      throw const ServerException(
        message:
            'SchoolOS could not verify this teacher attendance access state.',
        code: 'INVALID_TEACHER_SCOPE_VERSION',
      );
    }

    return _withScopeFence(() async {
      final storedState = await dependencies.scopeVersionStore.readState();
      if (storedState?.scopeVersion == scopeVersion &&
          storedState?.quarantined != true) {
        return TeacherAttendanceScopeRefresh.unchanged;
      }

      final storedVersion = storedState?.scopeVersion;
      if (storedVersion != null &&
          BigInt.parse(storedVersion) > BigInt.parse(scopeVersion)) {
        if (storedState?.quarantined == true) {
          throw const CacheException(
            'Teacher attendance access must be reverified before local data can be opened.',
          );
        }
        // A slower, older verification response must not roll back a newer
        // scope version already accepted by another load.
        return TeacherAttendanceScopeRefresh.unchanged;
      }

      // The first verified observation also purges legacy, unversioned local
      // data. Invalidate in-flight persistence and persist quarantine before
      // either purge. The verified version clears quarantine only after both
      // strict purges succeed.
      _scopeEpoch += 1;
      await dependencies.scopeVersionStore.quarantine(clearVersion: false);
      await _clearTeacherAttendanceScopeStrictUnlocked(
        dependencies,
        clearVersion: false,
      );
      await dependencies.scopeVersionStore.write(scopeVersion);
      return TeacherAttendanceScopeRefresh.localDataPurged;
    });
  }

  Future<void> clearTeacherAttendanceScopeStrict({
    required bool clearVersion,
    bool quarantine = false,
  }) async {
    final dependencies = _requireTeacherAttendanceScopeDependencies();
    await _withScopeFence(() async {
      _scopeEpoch += 1;
      await _clearTeacherAttendanceScopeStrictUnlocked(
        dependencies,
        clearVersion: clearVersion,
        quarantine: quarantine,
      );
    });
  }

  Future<void> _clearTeacherAttendanceScopeStrictUnlocked(
    _TeacherAttendanceScopeDependencies dependencies, {
    required bool clearVersion,
    bool quarantine = false,
  }) async {
    var failed = false;

    try {
      await dependencies.cache.clearTeacherAttendanceScopeStrict();
    } catch (_) {
      failed = true;
    }
    try {
      await dependencies.draftStore.clearCurrentScopeStrict();
    } catch (_) {
      failed = true;
    }
    if (clearVersion) {
      try {
        if (quarantine) {
          await dependencies.scopeVersionStore.quarantine(clearVersion: true);
        } else {
          await dependencies.scopeVersionStore.clear();
        }
      } catch (_) {
        failed = true;
      }
    }

    if (failed) {
      throw const CacheException(
        'Teacher attendance data could not be cleared securely.',
      );
    }
  }

  Future<void> assertTeacherAttendanceScopeReadableOffline() async {
    final dependencies = _requireTeacherAttendanceScopeDependencies();
    await _withScopeFence(() async {
      if (await dependencies.scopeVersionStore.isQuarantined()) {
        throw const CacheException(
          'Teacher attendance access must be reverified while connected before local data can be opened.',
        );
      }
    });
  }

  Future<void> _quarantineTeacherAttendanceScope({
    required bool clearVersion,
  }) async {
    final dependencies = _requireTeacherAttendanceScopeDependencies();
    await _withScopeFence(() async {
      _scopeEpoch += 1;
      await dependencies.scopeVersionStore.quarantine(
        clearVersion: clearVersion,
      );
    });
  }

  _TeacherAttendanceScopeDependencies
  _requireTeacherAttendanceScopeDependencies() {
    final activeCache = cache;
    final activeDraftStore = draftStore;
    final activeVersionStore = scopeVersionStore;
    if (activeCache == null ||
        activeDraftStore == null ||
        activeVersionStore == null) {
      throw const CacheException(
        'Teacher attendance access verification is unavailable for this session.',
      );
    }
    return _TeacherAttendanceScopeDependencies(
      cache: activeCache,
      draftStore: activeDraftStore,
      scopeVersionStore: activeVersionStore,
    );
  }

  Future<_TeacherAttendanceScopeTicket?>
  _captureTeacherAttendanceScopeTicket() {
    final activeVersionStore = scopeVersionStore;
    if (activeVersionStore == null) {
      return Future<_TeacherAttendanceScopeTicket?>.value();
    }
    return _withScopeFence(() async {
      final state = await activeVersionStore.readState();
      if (state?.quarantined == true) {
        throw const CacheException(
          'Teacher attendance access must be reverified before local data can be opened.',
        );
      }
      return _TeacherAttendanceScopeTicket(
        epoch: _scopeEpoch,
        scopeVersion: state?.scopeVersion,
      );
    });
  }

  Future<bool> _isScopeTicketCurrentUnlocked(
    _TeacherAttendanceScopeTicket ticket,
  ) async {
    final activeVersionStore = scopeVersionStore;
    if (activeVersionStore == null || ticket.epoch != _scopeEpoch) return false;
    final state = await activeVersionStore.readState();
    return state?.quarantined != true &&
        state?.scopeVersion == ticket.scopeVersion;
  }

  Future<void> _assertScopeTicketCurrent(_TeacherAttendanceScopeTicket ticket) {
    return _withScopeFence(() async {
      if (!await _isScopeTicketCurrentUnlocked(ticket)) {
        throw const CacheException(
          'Teacher attendance access changed before local data could be used.',
        );
      }
    });
  }

  Future<void> _writeTeacherAttendanceCache(
    String resourceKey,
    Map<String, dynamic> data,
    _TeacherAttendanceScopeTicket? ticket,
  ) async {
    final activeCache = cache;
    if (activeCache == null) return;
    if (ticket == null) {
      await activeCache.write(resourceKey, data);
      return;
    }

    await _withScopeFence(() async {
      if (!await _isScopeTicketCurrentUnlocked(ticket)) {
        throw const CacheException(
          'Teacher attendance access changed before local data could be stored.',
        );
      }
      await activeCache.write(
        resourceKey,
        data,
        authorizationScopeVersion: ticket.scopeVersion,
        beforeCommit: () => _isScopeTicketCurrentUnlocked(ticket),
      );
      if (!await _isScopeTicketCurrentUnlocked(ticket)) {
        throw const CacheException(
          'Teacher attendance access changed before local data could be stored.',
        );
      }
    });
  }

  Future<CachedPrivateRead?> _readTeacherAttendanceCache(
    String resourceKey,
    _TeacherAttendanceScopeTicket? ticket,
  ) async {
    final activeCache = cache;
    if (activeCache == null) return null;
    if (ticket == null) return activeCache.read(resourceKey);

    return _withScopeFence(() async {
      if (!await _isScopeTicketCurrentUnlocked(ticket)) {
        throw const CacheException(
          'Teacher attendance access changed before local data could be opened.',
        );
      }
      final cached = await activeCache.read(
        resourceKey,
        expectedAuthorizationScopeVersion: ticket.scopeVersion,
        enforceAuthorizationScopeVersion: true,
        beforeReturn: () => _isScopeTicketCurrentUnlocked(ticket),
      );
      if (!await _isScopeTicketCurrentUnlocked(ticket)) {
        throw const CacheException(
          'Teacher attendance access changed before local data could be opened.',
        );
      }
      return cached;
    });
  }

  Future<T> _withScopeFence<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _scopeFence = _scopeFence.then((_) async {
      try {
        completer.complete(await action());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  Future<AttendanceSnapshot> getParentAttendanceSnapshot(
    String studentId,
    DateTime month,
  ) async {
    final cacheKey = 'attendance_${studentId}_${month.year}_${month.month}';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/students/$studentId/attendance-summary',
        queryParameters: {'month': month.month, 'year': month.year},
      );
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    final today = _asMap(data['today']);
    final monthSummary = _asMap(data['monthSummary']);
    final history = _asList(data['monthHistory']).isNotEmpty
        ? _asList(data['monthHistory'])
        : _asList(data['recentHistory']);

    return AttendanceSnapshot(
      summary: AttendanceSummary(
        studentId: studentId,
        studentName: 'Student',
        todayStatus: attendanceStatusFromApi(today?['status'] as String?),
        todayLabel: today?['label'] as String?,
        todayRemark: today?['remark'] as String?,
        markedAt: DateTime.tryParse(today?['markedAt'] as String? ?? ''),
        presentCount: _asInt(monthSummary?['present']),
        absentCount: _asInt(monthSummary?['absent']),
        lateCount: _asInt(monthSummary?['late']),
        leaveCount: _asInt(monthSummary?['leave']),
        totalMarked: _asInt(monthSummary?['totalMarked']),
        attendancePercentage: _asDouble(monthSummary?['attendancePercentage']),
        lastUpdated:
            DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
            DateTime.now(),
      ),
      days: history.whereType<Map<String, dynamic>>().map((item) {
        return AttendanceDay(
          date: DateTime.tryParse(item['date'] as String? ?? '') ?? month,
          status: attendanceStatusFromApi(item['status'] as String?),
          label: item['label'] as String?,
          remark: item['remark'] as String?,
        );
      }).toList(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<AttendanceSummary> getAttendanceSummary(
    String studentId,
    DateTimeRangeValue range,
  ) async {
    final snapshot = await getParentAttendanceSnapshot(studentId, range.start);
    return snapshot.summary;
  }

  Future<List<AttendanceDay>> getMonthlyAttendance(
    String studentId,
    DateTime month,
  ) async {
    final snapshot = await getParentAttendanceSnapshot(studentId, month);
    return snapshot.days;
  }

  Future<List<ParentAttendanceCorrection>> getParentAttendanceCorrections(
    String studentId,
  ) async {
    final response = await _client.get(
      '/mobile/students/$studentId/attendance-corrections',
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return _asList(data['items'])
        .whereType<Map<String, dynamic>>()
        .map(ParentAttendanceCorrection.fromJson)
        .toList();
  }

  Future<ParentAttendanceCorrection> createParentAttendanceCorrection({
    required String studentId,
    required DateTime attendanceDate,
    required AttendanceStatus requestedStatus,
    required String reason,
  }) async {
    final response = await _client.post(
      '/mobile/students/$studentId/attendance-corrections',
      data: {
        'attendanceDate': _dateOnly(attendanceDate),
        'requestedStatus': attendanceStatusToApi(requestedStatus),
        'reason': reason.trim(),
      },
    );
    return ParentAttendanceCorrection.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Future<ParentAttendanceCorrection> cancelParentAttendanceCorrection({
    required String studentId,
    required String requestId,
    required String reason,
  }) async {
    final response = await _client.post(
      '/mobile/students/$studentId/attendance-corrections/$requestId/cancel',
      data: {'reason': reason.trim()},
    );
    return ParentAttendanceCorrection.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Map<String, dynamic>? _asMap(Object? value) {
    return value is Map<String, dynamic> ? value : null;
  }

  List<dynamic> _asList(Object? value) {
    return value is List<dynamic> ? value : const [];
  }

  int _asInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.toInt();
    }
    return 0;
  }

  double? _asDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return null;
  }

  Future<TeacherClassesSnapshot> getTeacherAssignedClasses() async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    const cacheKey = 'teacher_assigned_classes';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get('/mobile/teacher/attendance/classes');
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await _writeTeacherAttendanceCache(cacheKey, data, scopeTicket);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await _readTeacherAttendanceCache(cacheKey, scopeTicket);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    return TeacherClassesSnapshot(
      classes: _asList(data['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherClassSection.fromJson)
          .toList(),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherTodaySnapshot> getTeacherToday(DateTime date) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    final dateKey = _dateOnly(date);
    final cacheKey = 'teacher_today_$dateKey';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/teacher/attendance/today',
        queryParameters: {'date': dateKey},
      );
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await _writeTeacherAttendanceCache(cacheKey, data, scopeTicket);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await _readTeacherAttendanceCache(cacheKey, scopeTicket);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    return TeacherTodaySnapshot(
      date: DateTime.tryParse(data['date'] as String? ?? '') ?? date,
      periods: _asList(data['periods'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherTodayPeriod.fromJson)
          .toList(),
      classes: _asList(data['classes'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherClassSection.fromJson)
          .toList(),
      pendingAttendanceCount: _asInt(data['pendingAttendanceCount']),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherRosterSnapshot> getClassAttendanceSheet(
    TeacherClassSection classSection,
    DateTime date,
  ) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    final cacheKey = 'teacher_roster_${classSection.id}_${_dateOnly(date)}';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/teacher/attendance/roster',
        queryParameters: {
          'academicYearId': classSection.academicYearId,
          'classId': classSection.classId,
          if (classSection.sectionId != null)
            'sectionId': classSection.sectionId,
          'attendanceDate': _dateOnly(date),
        },
      );
      data = Map<String, dynamic>.from(response.data as Map<String, dynamic>);
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await _writeTeacherAttendanceCache(cacheKey, data, scopeTicket);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await _readTeacherAttendanceCache(cacheKey, scopeTicket);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }
    final attendance = data['attendanceState'] is Map<String, dynamic>
        ? TeacherAttendanceMeta.fromJson(
            data['attendanceState'] as Map<String, dynamic>,
          )
        : const TeacherAttendanceMeta(
            isSubmitted: false,
            isLocked: false,
            conflictStatus: 'NONE',
          );
    final calendar = data['calendarDay'] is Map<String, dynamic>
        ? data['calendarDay'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherRosterSnapshot(
      entries: _asList(data['students'])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentEntry.fromJson)
          .toList(),
      attendance: attendance,
      isWorkingDay: calendar['isWorkingDay'] as bool? ?? true,
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherStudentSummary> getTeacherStudentSummary(
    TeacherClassSection classSection,
    String studentId,
  ) async {
    final response = await _client.get(
      '/mobile/teacher/students/$studentId/summary',
      queryParameters: {
        'academicYearId': classSection.academicYearId,
        'classId': classSection.classId,
        if (classSection.sectionId != null) 'sectionId': classSection.sectionId,
      },
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherStudentSummary.fromJson(data);
  }

  Future<TeacherAttendanceSubmitResult> submitAttendance(
    TeacherClassSection classSection,
    DateTime date,
    List<AttendanceStudentEntry> entries,
    String clientSubmissionId,
    DateTime deviceTimestamp,
  ) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    final existing = await _loadDraftAttendanceWithTicket(
      classSection.id,
      date,
      scopeTicket,
    );
    if (existing == null ||
        existing.clientSubmissionId != clientSubmissionId ||
        !_sameAttendanceContent(existing.entries, entries)) {
      throw const ConflictAppException();
    }

    final priorReceiptState = existing.receiptState;
    if (!priorReceiptState.locksContent) {
      await _markDraftReceiptStateWithTicket(
        classSection.id,
        date,
        entries,
        clientSubmissionId: clientSubmissionId,
        receiptState: AttendanceDraftReceiptState.transportAmbiguous,
        scopeTicket: scopeTicket,
      );
    }

    late final Response<dynamic> response;
    try {
      response = await _client.post(
        '/mobile/teacher/attendance/sync',
        data: {
          'academicYearId': classSection.academicYearId,
          'classId': classSection.classId,
          if (classSection.sectionId != null)
            'sectionId': classSection.sectionId,
          'attendanceDate': _dateOnly(date),
          'exceptions': [
            for (final entry in entries)
              if (entry.status != AttendanceStatus.present)
                {
                  'studentId': entry.studentId,
                  'status': _statusToApi(entry.status),
                },
          ],
          'clientSubmissionId': clientSubmissionId,
          'deviceTimestamp': deviceTimestamp.toUtc().toIso8601String(),
        },
      );
    } on AppException catch (error) {
      if (!priorReceiptState.locksContent && !_isAmbiguousSubmission(error)) {
        try {
          await _markDraftReceiptStateWithTicket(
            classSection.id,
            date,
            entries,
            clientSubmissionId: clientSubmissionId,
            receiptState: priorReceiptState,
            scopeTicket: scopeTicket,
          );
        } catch (_) {
          throw const UnknownException(
            'SchoolOS could not safely restore the local attendance receipt.',
          );
        }
      }
      rethrow;
    } catch (_) {
      throw const UnknownException(
        'SchoolOS could not confirm the attendance receipt.',
      );
    }
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    var result = TeacherAttendanceSubmitResult(
      serverStatus: _parseAttendanceServerSyncStatus(data['syncStatus']),
      replayed: data['replayed'] as bool? ?? false,
      rejectionReason: data['rejectionReason'] as String?,
    );
    if (result.isAuthorizationRevoked) {
      throw const PermissionException(
        'Your teaching assignment changed. This attendance draft can no longer be submitted.',
        'TEACHER_SCOPE_DENIED',
      );
    }
    if (result.canClearDeviceDraft) {
      await _removeDraft(classSection.id, date, scopeTicket: scopeTicket);
    } else {
      try {
        await _markDraftReceiptStateWithTicket(
          classSection.id,
          date,
          entries,
          clientSubmissionId: clientSubmissionId,
          receiptState: result.draftReceiptState,
          scopeTicket: scopeTicket,
        );
      } catch (_) {
        result = TeacherAttendanceSubmitResult(
          serverStatus: result.serverStatus,
          replayed: result.replayed,
          deviceReceiptPersisted: false,
          rejectionReason: result.rejectionReason,
        );
      }
    }
    if (scopeTicket != null) {
      await _assertScopeTicketCurrent(scopeTicket);
    }
    return result;
  }

  Future<TeacherAttendanceDraft> saveDraftAttendanceLocally(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries,
  ) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    final existing = await _loadDraftAttendanceWithTicket(
      classSectionId,
      date,
      scopeTicket,
    );
    final contentChanged =
        existing != null && !_sameAttendanceContent(existing.entries, entries);
    if (contentChanged && existing.receiptState.locksContent) {
      throw const ConflictAppException();
    }

    final rotateRejectedSubmission =
        contentChanged &&
        existing.receiptState == AttendanceDraftReceiptState.rejected;
    final draft = TeacherAttendanceDraft(
      clientSubmissionId: rotateRejectedSubmission
          ? _newClientSubmissionId()
          : existing?.clientSubmissionId ?? _newClientSubmissionId(),
      savedAt: rotateRejectedSubmission
          ? DateTime.now()
          : existing?.savedAt ?? DateTime.now(),
      entries: entries,
      receiptState: rotateRejectedSubmission
          ? AttendanceDraftReceiptState.local
          : existing?.receiptState ?? AttendanceDraftReceiptState.local,
    );
    await _writeDraft(classSectionId, date, draft, scopeTicket);
    return draft;
  }

  Future<TeacherAttendanceDraft> markDraftReceiptState(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries, {
    required String clientSubmissionId,
    required AttendanceDraftReceiptState receiptState,
  }) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    return _markDraftReceiptStateWithTicket(
      classSectionId,
      date,
      entries,
      clientSubmissionId: clientSubmissionId,
      receiptState: receiptState,
      scopeTicket: scopeTicket,
    );
  }

  Future<TeacherAttendanceDraft> _markDraftReceiptStateWithTicket(
    String classSectionId,
    DateTime date,
    List<AttendanceStudentEntry> entries, {
    required String clientSubmissionId,
    required AttendanceDraftReceiptState receiptState,
    required _TeacherAttendanceScopeTicket? scopeTicket,
  }) async {
    final existing = await _loadDraftAttendanceWithTicket(
      classSectionId,
      date,
      scopeTicket,
    );
    if (existing == null ||
        existing.clientSubmissionId != clientSubmissionId ||
        !_sameAttendanceContent(existing.entries, entries)) {
      throw const ConflictAppException();
    }

    final draft = TeacherAttendanceDraft(
      clientSubmissionId: existing.clientSubmissionId,
      savedAt: existing.savedAt,
      entries: existing.entries,
      receiptState: receiptState,
    );
    await _writeDraft(classSectionId, date, draft, scopeTicket);
    return draft;
  }

  Future<void> _writeDraft(
    String classSectionId,
    DateTime date,
    TeacherAttendanceDraft draft,
    _TeacherAttendanceScopeTicket? scopeTicket,
  ) async {
    final activeDraftStore = draftStore;
    var stored = false;
    if (activeDraftStore != null && scopeTicket == null) {
      stored = await activeDraftStore.write(
        classSectionId: classSectionId,
        date: _dateOnly(date),
        payload: {
          'clientSubmissionId': draft.clientSubmissionId,
          'savedAt': draft.savedAt.toIso8601String(),
          'entries': [for (final entry in draft.entries) entry.toJson()],
          'receiptState': draft.receiptState.name,
        },
      );
    } else if (activeDraftStore != null && scopeTicket != null) {
      stored = await _withScopeFence(() async {
        if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
          throw const CacheException(
            'Teacher attendance access changed before the draft could be stored.',
          );
        }
        final didStore = await activeDraftStore.write(
          classSectionId: classSectionId,
          date: _dateOnly(date),
          payload: {
            'clientSubmissionId': draft.clientSubmissionId,
            'savedAt': draft.savedAt.toIso8601String(),
            'entries': [for (final entry in draft.entries) entry.toJson()],
            'receiptState': draft.receiptState.name,
          },
          authorizationScopeVersion: scopeTicket.scopeVersion,
          beforeCommit: () => _isScopeTicketCurrentUnlocked(scopeTicket),
        );
        if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
          throw const CacheException(
            'Teacher attendance access changed before the draft could be stored.',
          );
        }
        return didStore;
      });
    }
    if (!stored) {
      throw const CacheException(
        'Attendance draft could not be stored securely for this teacher session.',
      );
    }
  }

  Future<TeacherAttendanceDraft?> loadDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    return _loadDraftAttendanceWithTicket(classSectionId, date, scopeTicket);
  }

  Future<TeacherAttendanceDraft?> _loadDraftAttendanceWithTicket(
    String classSectionId,
    DateTime date,
    _TeacherAttendanceScopeTicket? scopeTicket,
  ) async {
    final activeDraftStore = draftStore;
    Map<String, dynamic>? data;
    if (activeDraftStore != null && scopeTicket == null) {
      data = await activeDraftStore.read(
        classSectionId: classSectionId,
        date: _dateOnly(date),
      );
    } else if (activeDraftStore != null && scopeTicket != null) {
      data = await _withScopeFence(() async {
        if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
          throw const CacheException(
            'Teacher attendance access changed before the draft could be opened.',
          );
        }
        final storedDraft = await activeDraftStore.read(
          classSectionId: classSectionId,
          date: _dateOnly(date),
          expectedAuthorizationScopeVersion: scopeTicket.scopeVersion,
          enforceAuthorizationScopeVersion: true,
          beforeReturn: () => _isScopeTicketCurrentUnlocked(scopeTicket),
        );
        if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
          throw const CacheException(
            'Teacher attendance access changed before the draft could be opened.',
          );
        }
        return storedDraft;
      });
    }
    if (data == null) return null;
    final draft = _decodeTeacherAttendanceDraft(data);
    if (draft == null) {
      await _removeDraft(classSectionId, date, scopeTicket: scopeTicket);
      return null;
    }
    if (scopeTicket != null) {
      await _assertScopeTicketCurrent(scopeTicket);
    }
    return draft;
  }

  TeacherAttendanceDraft? _decodeTeacherAttendanceDraft(
    Map<String, dynamic> data,
  ) {
    try {
      final entries = _asList(data['entries'])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceStudentEntry.fromJson)
          .toList();
      final clientSubmissionId = data['clientSubmissionId'] as String?;
      final savedAt = DateTime.tryParse(data['savedAt'] as String? ?? '');
      if (entries.isEmpty ||
          clientSubmissionId == null ||
          clientSubmissionId.trim().isEmpty ||
          savedAt == null) {
        return null;
      }
      return TeacherAttendanceDraft(
        clientSubmissionId: clientSubmissionId,
        savedAt: savedAt,
        entries: entries,
        receiptState: _parseDraftReceiptState(data['receiptState']),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _removeDraft(
    String classSectionId,
    DateTime date, {
    _TeacherAttendanceScopeTicket? scopeTicket,
  }) async {
    final activeDraftStore = draftStore;
    if (activeDraftStore == null) return;
    if (scopeTicket == null) {
      await activeDraftStore.delete(
        classSectionId: classSectionId,
        date: _dateOnly(date),
      );
      return;
    }
    await _withScopeFence(() async {
      if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
        throw const CacheException(
          'Teacher attendance access changed before the draft could be removed.',
        );
      }
      await activeDraftStore.delete(
        classSectionId: classSectionId,
        date: _dateOnly(date),
      );
      if (!await _isScopeTicketCurrentUnlocked(scopeTicket)) {
        throw const CacheException(
          'Teacher attendance access changed before the draft could be removed.',
        );
      }
    });
  }

  Future<void> discardDraftAttendance(
    String classSectionId,
    DateTime date,
  ) async {
    final scopeTicket = await _captureTeacherAttendanceScopeTicket();
    await _removeDraft(classSectionId, date, scopeTicket: scopeTicket);
  }
}

class _TeacherAttendanceScopeDependencies {
  const _TeacherAttendanceScopeDependencies({
    required this.cache,
    required this.draftStore,
    required this.scopeVersionStore,
  });

  final PrivateReadCache cache;
  final TeacherAttendanceDraftStore draftStore;
  final TeacherAttendanceScopeVersionStore scopeVersionStore;
}

class _TeacherAttendanceScopeTicket {
  const _TeacherAttendanceScopeTicket({
    required this.epoch,
    required this.scopeVersion,
  });

  final int epoch;
  final String? scopeVersion;
}

String _newClientSubmissionId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  final token = base64UrlEncode(bytes).replaceAll('=', '');
  return 'mobile-attendance-${DateTime.now().microsecondsSinceEpoch}-$token';
}

AttendanceDraftReceiptState _parseDraftReceiptState(Object? value) {
  if (value == null) return AttendanceDraftReceiptState.local;
  if (value is! String) return AttendanceDraftReceiptState.unknown;

  return switch (value.trim()) {
    'local' => AttendanceDraftReceiptState.local,
    'processing' => AttendanceDraftReceiptState.processing,
    'unknown' => AttendanceDraftReceiptState.unknown,
    'transportAmbiguous' => AttendanceDraftReceiptState.transportAmbiguous,
    'rejected' => AttendanceDraftReceiptState.rejected,
    _ => AttendanceDraftReceiptState.unknown,
  };
}

bool _sameAttendanceContent(
  List<AttendanceStudentEntry> left,
  List<AttendanceStudentEntry> right,
) {
  if (left.length != right.length) return false;
  final leftByStudent = <String, AttendanceStatus>{};
  final rightByStudent = <String, AttendanceStatus>{};
  for (final entry in left) {
    if (entry.studentId.isEmpty || leftByStudent.containsKey(entry.studentId)) {
      return false;
    }
    leftByStudent[entry.studentId] = entry.status;
  }
  for (final entry in right) {
    if (entry.studentId.isEmpty ||
        rightByStudent.containsKey(entry.studentId)) {
      return false;
    }
    rightByStudent[entry.studentId] = entry.status;
  }
  if (leftByStudent.length != rightByStudent.length) return false;
  return leftByStudent.entries.every(
    (entry) => rightByStudent[entry.key] == entry.value,
  );
}

String _dateOnly(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}

String _statusToApi(AttendanceStatus status) {
  switch (status) {
    case AttendanceStatus.absent:
      return 'ABSENT';
    case AttendanceStatus.late:
      return 'LATE';
    case AttendanceStatus.halfDay:
      return 'HALF_DAY';
    case AttendanceStatus.leave:
      return 'EXCUSED_LEAVE';
    case AttendanceStatus.festival:
    case AttendanceStatus.holiday:
      return 'HOLIDAY';
    case AttendanceStatus.present:
    // A status this build could not interpret is never written back as a
    // deliberate mark; the teacher re-marks it explicitly instead.
    case AttendanceStatus.unknown:
      return 'PRESENT';
  }
}

AttendanceServerSyncStatus _parseAttendanceServerSyncStatus(Object? value) {
  if (value is! String) return AttendanceServerSyncStatus.unknown;

  return switch (value.trim().toUpperCase()) {
    'ACCEPTED' => AttendanceServerSyncStatus.accepted,
    'SYNCED' => AttendanceServerSyncStatus.synced,
    'CONFLICTED' => AttendanceServerSyncStatus.conflicted,
    'REJECTED' => AttendanceServerSyncStatus.rejected,
    'PROCESSING' => AttendanceServerSyncStatus.processing,
    _ => AttendanceServerSyncStatus.unknown,
  };
}

bool _isAmbiguousSubmission(AppException error) =>
    error is NetworkException ||
    error is TimeoutException ||
    error is ServerException ||
    error is UnknownException;

class DateTimeRangeValue {
  const DateTimeRangeValue({required this.start, required this.end});

  final DateTime start;
  final DateTime end;
}
