import '../../../core/network/api_client.dart';
import '../domain/parent_models.dart';

class ParentRepository {
  const ParentRepository(this._client);

  final ApiClient _client;

  Future<List<GuardianChild>> getGuardianChildren() async {
    final response = await _client.get('/mobile/me/students');
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(GuardianChild.fromJson)
        .toList();
  }

  Future<ChildProfile> getChildProfile(String childId) async {
    final children = await getGuardianChildren();
    if (children.isEmpty) {
      throw StateError('No children are linked to this guardian account.');
    }

    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => children.first,
    );

    return getChildProfileForChild(child);
  }

  Future<ChildProfile> getChildProfileForChild(GuardianChild child) async {
    final response = await _client.get('/mobile/students/${child.id}/profile');
    final data = response.data as Map<String, dynamic>;
    final profile = data['profile'] as Map<String, dynamic>? ?? const {};
    final emergencyContact =
        profile['emergencyContact'] as Map<String, dynamic>?;
    final medicalSummary =
        profile['medicalSummary'] as Map<String, dynamic>? ?? const {};

    return ChildProfile(
      child: child,
      classTeacher: 'Class teacher will appear after timetable sync.',
      guardianSummary: 'Guardian access verified by SchoolOS.',
      canViewGuardianSummary: true,
      attendanceSummary: 'Open attendance for the latest monthly summary.',
      homeworkSummary: 'Homework is synced from the school mobile API.',
      feesSummary: 'Fee summary is synced from the school mobile API.',
      qrLabel:
          'School identity QR will be shown after QR permissions are enabled.',
      healthWarning:
          medicalSummary['medicalConditions'] as String? ??
          emergencyContact?['name'] as String?,
      canViewHealthWarning:
          medicalSummary['hasMedicalConsent'] as bool? ?? false,
    );
  }

  Future<ParentDashboardSummary> getParentDashboardSummary(
    String childId,
  ) async {
    final children = await getGuardianChildren();
    if (children.isEmpty) {
      throw StateError('No children are linked to this guardian account.');
    }

    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => children.first,
    );

    return getParentDashboardSummaryForChild(child);
  }

  Future<ParentDashboardSummary> getParentDashboardSummaryForChild(
    GuardianChild child,
  ) async {
    final response = await _client.get(
      '/mobile/me/dashboard',
      queryParameters: {'studentId': child.id},
    );
    final data = response.data as Map<String, dynamic>;

    return ParentDashboardSummary.fromMobileDashboard(data, child);
  }

  Future<List<ParentHomeworkItem>> getHomeworkForChild(
    String childId, {
    int take = 30,
  }) async {
    final response = await _client.get(
      '/mobile/students/$childId/homework',
      queryParameters: {'take': '$take'},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentHomeworkItem.fromJson)
        .toList();
  }

  Future<ParentTimetable> getTimetableForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/timetable');
    final data = response.data as Map<String, dynamic>;
    return ParentTimetable.fromJson(data);
  }

  Future<List<ParentReportCard>> getReportCardsForChild(String childId) async {
    final response = await _client.get(
      '/mobile/students/$childId/report-cards',
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentReportCard.fromJson)
        .toList();
  }

  Future<List<ParentActivityItem>> getActivityFeedForChild(
    String childId, {
    int take = 20,
  }) async {
    final response = await _client.get(
      '/mobile/students/$childId/activity-feed',
      queryParameters: {'take': '$take'},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentActivityItem.fromJson)
        .toList();
  }

  Future<ParentTransportInfo> getTransportForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/transport');
    final data = response.data as Map<String, dynamic>;
    return ParentTransportInfo.fromJson(data);
  }

  Future<ParentCanteenInfo> getCanteenForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/canteen');
    final data = response.data as Map<String, dynamic>;
    return ParentCanteenInfo.fromJson(data);
  }

  Future<ParentTeacherThreadPage> getParentTeacherThreads({
    String? childId,
  }) async {
    final response = await _client.get(
      '/messaging/parent-teacher/threads',
      queryParameters: {
        if (childId != null && childId.isNotEmpty) 'studentId': childId,
        'limit': '25',
      },
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherThreadPage.fromJson(data);
  }

  Future<ParentTeacherThread> openParentTeacherThread(String childId) async {
    final response = await _client.post(
      '/messaging/parent-teacher/threads',
      data: {'studentId': childId},
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherThread.fromJson(
      data['thread'] as Map<String, dynamic>? ?? const {},
    );
  }

  Future<List<ParentTeacherMessage>> getParentTeacherMessages(
    String threadId,
  ) async {
    final response = await _client.get(
      '/messaging/parent-teacher/threads/$threadId/messages',
      queryParameters: {'limit': '50'},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentTeacherMessage.fromJson)
        .toList();
  }

  Future<ParentTeacherSendResult> sendParentTeacherMessage({
    required String threadId,
    required String message,
  }) async {
    final response = await _client.post(
      '/messaging/parent-teacher/threads/$threadId/messages',
      data: {'message': message},
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherSendResult.fromJson(data);
  }

  Future<void> markParentTeacherThreadRead(String threadId) async {
    await _client.patch('/messaging/parent-teacher/threads/$threadId/read');
  }
}
