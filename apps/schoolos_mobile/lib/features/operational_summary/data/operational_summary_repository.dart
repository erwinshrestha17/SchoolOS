import '../../../core/network/api_client.dart';
import '../domain/operational_summary_models.dart';

class OperationalSummaryRepository {
  const OperationalSummaryRepository(this._client);

  final ApiClient _client;

  static const Map<OperationalMobilePersona, String> _paths = {
    OperationalMobilePersona.parent: '/mobile/parent/summary',
    OperationalMobilePersona.teacher: '/mobile/teacher/summary',
    OperationalMobilePersona.principal: '/mobile/principal/summary',
    OperationalMobilePersona.driver: '/mobile/driver/summary',
    OperationalMobilePersona.staff: '/mobile/staff/summary',
  };

  static String pathFor(OperationalMobilePersona persona) => _paths[persona]!;

  Future<OperationalMobileSummary> getParentSummary() =>
      getSummary(OperationalMobilePersona.parent);
  Future<OperationalMobileSummary> getTeacherSummary() =>
      getSummary(OperationalMobilePersona.teacher);
  Future<OperationalMobileSummary> getPrincipalSummary() =>
      getSummary(OperationalMobilePersona.principal);
  Future<OperationalMobileSummary> getDriverSummary() =>
      getSummary(OperationalMobilePersona.driver);
  Future<OperationalMobileSummary> getStaffSummary() =>
      getSummary(OperationalMobilePersona.staff);

  Future<OperationalMobileSummary> getSummary(
    OperationalMobilePersona persona,
  ) async {
    final response = await _client.get(pathFor(persona));
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw StateError('The school summary is temporarily unavailable.');
    }
    return OperationalMobileSummary.fromJson(persona, data);
  }
}
