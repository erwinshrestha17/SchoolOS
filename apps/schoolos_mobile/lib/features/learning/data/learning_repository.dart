import '../../../core/network/api_client.dart';
import '../domain/learning_summary_models.dart';

class LearningRepository {
  const LearningRepository(this._client);

  final ApiClient _client;

  Future<List<LearningSummary>> getParentLearningSummaries({
    String? studentId,
  }) async {
    final response = await _client.get(
      '/parent/learning/summary',
      queryParameters: {
        if (studentId != null && studentId.isNotEmpty) 'studentId': studentId,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(LearningSummary.fromParentJson)
        .toList();
  }

  Future<LearningSummary> getStudentLearningSummary(String studentId) async {
    final response = await _client.get('/learning/progress/student/$studentId');
    final data = response.data as Map<String, dynamic>;
    return LearningSummary.fromStudentProgressJson(data);
  }
}
