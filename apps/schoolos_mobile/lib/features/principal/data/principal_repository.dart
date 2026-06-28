import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';

class PrincipalRepository {
  const PrincipalRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<Map<String, dynamic>> getDashboard() =>
      _getCached('principal_dashboard', '/mobile/principal/dashboard');

  Future<Map<String, dynamic>> getAttention({String filter = 'all'}) =>
      _getCached(
        'principal_attention_$filter',
        '/mobile/principal/attention',
        queryParameters: {'filter': filter},
      );

  Future<Map<String, dynamic>> getApprovals({String status = 'pending'}) =>
      _getCached(
        'principal_approvals_$status',
        '/mobile/principal/approvals',
        queryParameters: {'status': status},
      );

  Future<Map<String, dynamic>> getApprovalDetail(String approvalRequestId) =>
      _getCached(
        'principal_approval_$approvalRequestId',
        '/mobile/principal/approvals/$approvalRequestId',
      );

  Future<Map<String, dynamic>> decideApproval({
    required String approvalRequestId,
    required String decision,
    required String idempotencyKey,
    String? reason,
  }) {
    return _postJson(
      '/mobile/principal/approvals/$approvalRequestId/decisions',
      {
        'decision': decision,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
        'idempotencyKey': idempotencyKey,
      },
    );
  }

  Future<Map<String, dynamic>> getAdmissionsSummary() => _getCached(
    'principal_admissions_summary',
    '/mobile/principal/admissions-summary',
  );

  Future<Map<String, dynamic>> getAttendanceSummary() => _getCached(
    'principal_attendance_summary',
    '/mobile/principal/attendance-summary',
  );

  Future<Map<String, dynamic>> getStaffAbsence() =>
      _getCached('principal_staff_absence', '/mobile/principal/staff-absence');

  Future<Map<String, dynamic>> getFeesSummary() =>
      _getCached('principal_fees_summary', '/mobile/principal/fees-summary');

  Future<Map<String, dynamic>> getAcademicsReadiness() => _getCached(
    'principal_academics_readiness',
    '/mobile/principal/academics-readiness',
  );

  Future<Map<String, dynamic>> getTransportAlerts() => _getCached(
    'principal_transport_alerts',
    '/mobile/principal/transport-alerts',
  );

  Future<Map<String, dynamic>> getEscalations({String status = 'open'}) =>
      _getCached(
        'principal_escalations_$status',
        '/mobile/principal/escalations',
        queryParameters: {'status': status},
      );

  Future<Map<String, dynamic>> getEscalationDetail(String escalationId) =>
      _getCached(
        'principal_escalation_$escalationId',
        '/mobile/principal/escalations/$escalationId',
      );

  Future<Map<String, dynamic>> assignEscalationToSelf(String escalationId) {
    return _postJson(
      '/mobile/principal/escalations/$escalationId/assign-self',
      const <String, dynamic>{},
    );
  }

  Future<Map<String, dynamic>> assignEscalation({
    required String escalationId,
    required String assigneeUserId,
  }) {
    return _postJson('/mobile/principal/escalations/$escalationId/assign', {
      'assigneeUserId': assigneeUserId,
    });
  }

  Future<Map<String, dynamic>> addEscalationNote({
    required String escalationId,
    required String note,
  }) {
    return _postJson('/mobile/principal/escalations/$escalationId/notes', {
      'note': note.trim(),
    });
  }

  Future<Map<String, dynamic>> resolveEscalation({
    required String escalationId,
    required String resolutionReason,
  }) {
    return _postJson('/mobile/principal/escalations/$escalationId/resolve', {
      'resolutionReason': resolutionReason.trim(),
    });
  }

  Future<Map<String, dynamic>> reopenEscalation({
    required String escalationId,
    required String reason,
  }) {
    return _postJson('/mobile/principal/escalations/$escalationId/reopen', {
      'reason': reason.trim(),
    });
  }

  Future<Map<String, dynamic>> searchStudents({String? query}) => _getCached(
    'principal_student_search_${query ?? 'initial'}',
    '/mobile/principal/student-search',
    queryParameters: {if (query != null && query.trim().isNotEmpty) 'q': query},
  );

  Future<Map<String, dynamic>> getReportsSnapshot() => _getCached(
    'principal_reports_snapshot',
    '/mobile/principal/reports-snapshot',
  );

  Future<Map<String, dynamic>> getTasks({String tab = 'my'}) => _getCached(
    'principal_tasks_$tab',
    '/mobile/principal/tasks',
    queryParameters: {'tab': tab},
  );

  Future<Map<String, dynamic>> getClassroomWalkthroughs() => _getCached(
    'principal_classroom_walkthroughs',
    '/mobile/principal/classroom-walkthroughs',
  );

  Future<Map<String, dynamic>> getEmergencyNotice() => _getCached(
    'principal_emergency_notice',
    '/mobile/principal/emergency-notice',
  );

  Future<Map<String, dynamic>> previewEmergencyNoticeRecipients({
    required String title,
    required String body,
    required String priority,
    required String audienceType,
    String? classId,
    String? sectionId,
  }) {
    return _postJson('/mobile/principal/emergency-notices/recipient-preview', {
      'title': title.trim(),
      'body': body.trim(),
      'priority': priority,
      'audienceType': audienceType,
      if (classId != null && classId.trim().isNotEmpty) 'classId': classId,
      if (sectionId != null && sectionId.trim().isNotEmpty)
        'sectionId': sectionId,
    });
  }

  Future<Map<String, dynamic>> submitEmergencyNotice({
    required String title,
    required String body,
    required String priority,
    required String audienceType,
    required String sendMode,
    required String idempotencyKey,
    String? scheduledFor,
    String? attachmentFileId,
    String? reason,
  }) {
    return _postJson('/mobile/principal/emergency-notices', {
      'title': title.trim(),
      'body': body.trim(),
      'priority': priority,
      'audienceType': audienceType,
      'sendMode': sendMode,
      if (scheduledFor != null && scheduledFor.trim().isNotEmpty)
        'scheduledFor': scheduledFor,
      if (attachmentFileId != null && attachmentFileId.trim().isNotEmpty)
        'attachmentFileId': attachmentFileId,
      'idempotencyKey': idempotencyKey,
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }

  Future<Map<String, dynamic>> getEmergencyNoticeStatus(String noticeId) =>
      _getCached(
        'principal_emergency_notice_$noticeId',
        '/mobile/principal/emergency-notices/$noticeId',
      );

  Future<Map<String, dynamic>> _getCached(
    String cacheKey,
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _client.get<dynamic>(
        path,
        queryParameters: queryParameters,
      );
      final data = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : <String, dynamic>{};
      final withMeta = {
        ...data,
        '_mobileLastUpdated': DateTime.now().toIso8601String(),
        '_mobileFromCache': false,
      };
      await cache?.write(cacheKey, withMeta);
      return withMeta;
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      return cached.withMetadata();
    }
  }

  Future<Map<String, dynamic>> _postJson(
    String path,
    Map<String, dynamic> data,
  ) async {
    final response = await _client.post<dynamic>(path, data: data);
    return response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
  }
}
