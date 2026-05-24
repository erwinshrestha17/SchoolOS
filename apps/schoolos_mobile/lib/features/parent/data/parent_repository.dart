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
    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => children.first,
    );

    return ChildProfile(
      child: child,
      classTeacher: 'Class teacher will appear after timetable sync.',
      guardianSummary: 'Guardian access verified by SchoolOS.',
      canViewGuardianSummary: true,
      attendanceSummary: 'Open attendance for the latest monthly summary.',
      homeworkSummary: 'Homework sync is pending a parent-safe API slice.',
      feesSummary: 'Fee summary sync is pending a parent-safe API slice.',
      qrLabel:
          'School identity QR will be shown after QR permissions are enabled.',
      healthWarning: null,
      canViewHealthWarning: false,
    );
  }

  Future<ParentDashboardSummary> getParentDashboardSummary(
    String childId,
  ) async {
    final children = await getGuardianChildren();
    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => children.first,
    );
    final attendance = await _client.get(
      '/attendance/students/$childId/summary',
    );
    final notifications = await _client.get('/communications/notifications');
    final transportData = await _getOptionalMap(
      '/transport/parent/students/$childId/active-trip',
    );

    final attendanceData = attendance.data as Map<String, dynamic>;
    final notificationData = notifications.data as Map<String, dynamic>;
    final monthSummary =
        attendanceData['monthSummary'] as Map<String, dynamic>? ?? const {};

    final attendancePercent =
        (monthSummary['attendancePercentage'] as num?)?.toStringAsFixed(1) ??
        '0.0';
    return ParentDashboardSummary(
      child: child,
      attendanceToday: '$attendancePercent% attendance this month',
      homeworkPending: 0,
      feesDue: 0,
      unreadNotices: notificationData['unreadCount'] as int? ?? 0,
      transportStatus: _formatTransportStatus(transportData),
      canteenBalance: 0,
      latestActivity: 'Latest activity sync is pending a parent-safe API slice.',
      lastUpdated: DateTime.now(),
    );
  }

  Future<Map<String, dynamic>?> _getOptionalMap(String path) async {
    try {
      final response = await _client.get(path);
      return response.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  String _formatTransportStatus(Map<String, dynamic>? data) {
    if (data == null || data.isEmpty || data['activeTrip'] == null) {
      return 'No active trip';
    }

    final trip = data['activeTrip'] as Map<String, dynamic>;
    final status = trip['status'] as String? ?? 'ACTIVE';
    return 'Trip ${status.toLowerCase().replaceAll('_', ' ')}';
  }
}
