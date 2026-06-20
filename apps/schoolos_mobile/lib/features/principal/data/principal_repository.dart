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
}
