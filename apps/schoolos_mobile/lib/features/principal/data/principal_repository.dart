import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../learning_support/domain/learning_support_models.dart';

class PrincipalRepository {
  const PrincipalRepository(this._client);

  final ApiClient _client;

  Future<Map<String, dynamic>> getDashboard() =>
      _getCached('principal_dashboard', '/mobile/principal/dashboard');

  Future<Map<String, dynamic>> getAttention({String filter = 'all'}) =>
      _getCached(
        'principal_attention_$filter',
        '/mobile/principal/attention',
        queryParameters: {'filter': filter},
      );

  Future<LearningAttentionPage> getLearningAttention({int page = 1}) async {
    final response = await _client.get(
      '/mobile/principal/learning-attention',
      queryParameters: {'page': page, 'limit': 20},
    );
    return LearningAttentionPage.fromJson(
      Map<String, dynamic>.from(response.data as Map<String, dynamic>),
    );
  }

  Future<List<LearningInterventionCase>> getLearningInterventionCases({
    int page = 1,
  }) async {
    final response = await _client.get(
      '/mobile/principal/intervention-cases',
      queryParameters: {'page': page, 'limit': 20},
    );
    final data = Map<String, dynamic>.from(
      response.data as Map<String, dynamic>,
    );
    return (data['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LearningInterventionCase.fromJson)
        .toList();
  }

  Future<LearningInterventionCase> getLearningInterventionCase(
    String caseId,
  ) async {
    final response = await _client.get(
      '/mobile/principal/intervention-cases/${Uri.encodeComponent(caseId)}',
    );
    return LearningInterventionCase.fromJson(
      Map<String, dynamic>.from(response.data as Map<String, dynamic>),
    );
  }

  Future<void> addLearningInterventionEntry({
    required String caseId,
    required String entryType,
    required String body,
    required bool parentVisible,
    required String clientRequestId,
  }) async {
    await _client.post(
      '/mobile/principal/intervention-cases/${Uri.encodeComponent(caseId)}/entries',
      data: {
        'entryType': entryType,
        'body': body.trim(),
        'parentVisible': parentVisible,
        'clientRequestId': clientRequestId,
      },
    );
  }

  Future<void> updateLearningIntervention({
    required String caseId,
    required String status,
    required String reason,
    required int expectedVersion,
    String? resolutionSummary,
  }) async {
    await _client.patch(
      '/mobile/principal/intervention-cases/${Uri.encodeComponent(caseId)}',
      data: {
        'status': status,
        'reason': reason.trim(),
        'expectedVersion': expectedVersion,
        if (resolutionSummary != null && resolutionSummary.trim().isNotEmpty)
          'resolutionSummary': resolutionSummary.trim(),
      },
    );
  }

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

  Future<Map<String, dynamic>> getApprovalDelegationCandidates(
    String approvalRequestId,
  ) => _getCached(
    'principal_approval_delegation_candidates_$approvalRequestId',
    '/mobile/principal/approvals/$approvalRequestId/delegation-candidates',
  );

  Future<Map<String, dynamic>> delegateApproval({
    required String approvalRequestId,
    required String delegatedToUserId,
    required String reason,
  }) {
    return _postJson(
      '/mobile/principal/approvals/$approvalRequestId/delegation',
      {'delegatedToUserId': delegatedToUserId, 'reason': reason.trim()},
    );
  }

  Future<Map<String, dynamic>> getServiceRequests({
    String? status,
    int page = 1,
  }) => _getCached(
    'principal_service_requests_${status ?? 'all'}_$page',
    '/mobile/principal/service-requests',
    queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      'page': page,
      'limit': 50,
    },
  );

  Future<Map<String, dynamic>> getServiceRequest(String requestId) =>
      _getCached(
        'principal_service_request_$requestId',
        '/mobile/principal/service-requests/$requestId',
      );

  Future<Map<String, dynamic>> triageServiceRequest({
    required String requestId,
    required String priority,
    required String responseDeadline,
    required String status,
    required String reason,
  }) {
    return _postJson(
      '/mobile/principal/service-requests/$requestId/triage-self',
      {
        'priority': priority,
        'responseDeadline': responseDeadline,
        'status': status,
        'reason': reason.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> addServiceRequestNote({
    required String requestId,
    required String body,
    required String visibility,
  }) {
    return _postJson('/mobile/principal/service-requests/$requestId/notes', {
      'body': body.trim(),
      'visibility': visibility,
    });
  }

  Future<Map<String, dynamic>> resolveServiceRequest({
    required String requestId,
    required String resolutionSummary,
  }) {
    return _postJson('/mobile/principal/service-requests/$requestId/resolve', {
      'resolutionSummary': resolutionSummary.trim(),
    });
  }

  Future<Map<String, dynamic>> getServiceRequestEscalationCandidates(
    String requestId,
  ) => _getCached(
    'principal_service_request_escalation_candidates_$requestId',
    '/mobile/principal/service-requests/$requestId/escalation-candidates',
  );

  Future<Map<String, dynamic>> escalateServiceRequest({
    required String requestId,
    required String reason,
    required String assignedToUserId,
  }) {
    return _postJson('/mobile/principal/service-requests/$requestId/escalate', {
      'reason': reason.trim(),
      'assignedToUserId': assignedToUserId,
    });
  }

  Future<PrincipalProtectedFileDownload> downloadServiceRequestEvidence({
    required String requestId,
    required String attachmentId,
    required String downloadPath,
    required String fileName,
    required String mimeType,
  }) async {
    final expected = '/service-requests/$requestId/attachments/$attachmentId';
    if (downloadPath != expected) {
      throw const ValidationException(
        message: 'This request evidence is unavailable.',
      );
    }
    final response = await _client.get<List<int>>(
      expected,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const NotFoundAppException('This request evidence is unavailable.');
    }
    final directory = Directory(
      '${(await getTemporaryDirectory()).path}/schoolos/principal-request-evidence/$attachmentId',
    );
    if (!directory.existsSync()) await directory.create(recursive: true);
    final safeName = _safeFileName(fileName);
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);
    return PrincipalProtectedFileDownload(
      fileName: safeName,
      filePath: file.path,
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

  Future<Map<String, dynamic>> createClassroomWalkthrough({
    required String teacherStaffId,
    required String academicYearId,
    required String observedOn,
    required String strengths,
    required String developmentFocus,
    required String clientRequestId,
    String? agreedAction,
    String? followUpOn,
  }) => _postJson('/mobile/principal/classroom-walkthroughs', {
    'teacherStaffId': teacherStaffId,
    'academicYearId': academicYearId,
    'observedOn': observedOn,
    'strengths': strengths.trim(),
    'developmentFocus': developmentFocus.trim(),
    if (agreedAction != null && agreedAction.trim().isNotEmpty)
      'agreedAction': agreedAction.trim(),
    if (followUpOn != null && followUpOn.trim().isNotEmpty)
      'followUpOn': followUpOn,
    'clientRequestId': clientRequestId,
  });

  Future<Map<String, dynamic>> updateClassroomWalkthrough({
    required String observationId,
    required int expectedVersion,
    required String status,
    required String reason,
    String? agreedAction,
    String? teacherResponse,
    String? followUpOn,
  }) => _patchJson(
    '/mobile/principal/classroom-walkthroughs/${Uri.encodeComponent(observationId)}',
    {
      'expectedVersion': expectedVersion,
      'status': status,
      'reason': reason.trim(),
      if (agreedAction != null && agreedAction.trim().isNotEmpty)
        'agreedAction': agreedAction.trim(),
      if (teacherResponse != null && teacherResponse.trim().isNotEmpty)
        'teacherResponse': teacherResponse.trim(),
      if (followUpOn != null && followUpOn.trim().isNotEmpty)
        'followUpOn': followUpOn,
    },
  );

  Future<Map<String, dynamic>> getSchoolImprovementPlans() => _getCached(
    'principal_school_improvement_plans',
    '/mobile/principal/school-improvement-plans',
  );

  Future<Map<String, dynamic>> updateSchoolImprovementAction({
    required String actionId,
    required int expectedVersion,
    required String status,
    required String reason,
    String? progressNote,
  }) => _patchJson(
    '/mobile/principal/school-improvement-actions/${Uri.encodeComponent(actionId)}',
    {
      'expectedVersion': expectedVersion,
      'status': status,
      'reason': reason.trim(),
      if (progressNote != null && progressNote.trim().isNotEmpty)
        'progressNote': progressNote.trim(),
    },
  );

  Future<Map<String, dynamic>> getBoardExamReadiness(String track) =>
      _getCached(
        'principal_board_exam_readiness_$track',
        '/mobile/principal/board-exam-readiness/${Uri.encodeComponent(track)}',
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
    // Principal records are deliberately network-only. The resource label is
    // retained to keep each purpose-limited caller explicit.
    if (cacheKey.isEmpty) {
      throw ArgumentError.value(cacheKey, 'resourceLabel');
    }
    final response = await _client.get<dynamic>(
      path,
      queryParameters: queryParameters,
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
    return {
      ...data,
      '_mobileLastUpdated': DateTime.now().toIso8601String(),
      '_mobileFromCache': false,
    };
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

  Future<Map<String, dynamic>> _patchJson(
    String path,
    Map<String, dynamic> data,
  ) async {
    final response = await _client.patch<dynamic>(path, data: data);
    return response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : <String, dynamic>{};
  }
}

class PrincipalProtectedFileDownload {
  const PrincipalProtectedFileDownload({
    required this.fileName,
    required this.filePath,
  });

  final String fileName;
  final String filePath;
}

String _safeFileName(String value) {
  final safe = value.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '-');
  return safe.isEmpty ? 'evidence' : safe;
}
