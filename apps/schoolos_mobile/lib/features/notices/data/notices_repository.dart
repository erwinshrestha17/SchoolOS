import '../../../core/network/api_client.dart';
import '../domain/notice_models.dart';

class NoticesRepository {
  const NoticesRepository(this._client);

  final ApiClient _client;

  Future<List<Notice>> getNotices() async {
    final center = await _getCenter();
    return center.items.map(_noticeFromNotification).toList();
  }

  Future<Notice> getNoticeDetail(String noticeId) async {
    final notices = await getNotices();
    return notices.firstWhere(
      (notice) => notice.id == noticeId,
      orElse: () => notices.first,
    );
  }

  Future<void> markNoticeRead(String noticeId) async {
    await _client.post('/mobile/me/notifications/$noticeId/read');
  }

  Future<List<NotificationItem>> getNotificationCenter() async {
    final center = await _getCenter();
    return center.items;
  }

  Future<int> getUnreadCount() async {
    final response = await _client.get('/mobile/me/notifications');
    final data = response.data as Map<String, dynamic>;
    return data['unreadCount'] as int? ?? 0;
  }

  Future<_NotificationCenterPayload> _getCenter() async {
    final response = await _client.get('/mobile/me/notifications');
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return _NotificationCenterPayload(
      unreadCount: data['unreadCount'] as int? ?? 0,
      items: items
          .whereType<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList(),
    );
  }

  Notice _noticeFromNotification(NotificationItem item) {
    return Notice(
      id: item.id,
      title: item.title,
      preview: item.message,
      body: item.message,
      publishedBy: 'SchoolOS',
      publishedAt: item.createdAt,
      audience: 'My notifications',
      category: item.category,
      isRead: item.isRead,
    );
  }
}

class _NotificationCenterPayload {
  const _NotificationCenterPayload({
    required this.unreadCount,
    required this.items,
  });

  final int unreadCount;
  final List<NotificationItem> items;
}
