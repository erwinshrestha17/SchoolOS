import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/notice_models.dart';

class NoticesRepository {
  const NoticesRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<List<Notice>> getNotices() async {
    final center = await _getCenter();
    return center.items.map(_noticeFromNotification).toList();
  }

  Future<NoticeFeed> getNoticeFeed() async {
    final center = await _getCenter();
    return NoticeFeed(
      items: center.items.map(_noticeFromNotification).toList(),
      lastUpdated: center.lastUpdated,
      fromCache: center.fromCache,
    );
  }

  Future<Notice> getNoticeDetail(String noticeId) async {
    final data = await _getMap(
      '/mobile/me/notifications/$noticeId',
      cacheKey: 'notice_detail_$noticeId',
    );
    return _noticeFromNotification(NotificationItem.fromJson(data));
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
    final data = await _getMap(
      '/mobile/me/notifications',
      cacheKey: 'notice_feed',
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return _NotificationCenterPayload(
      unreadCount: data['unreadCount'] as int? ?? 0,
      items: items
          .whereType<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList(),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    required String cacheKey,
  }) async {
    try {
      final response = await _client.get(path);
      final data = Map<String, dynamic>.from(
        response.data as Map<String, dynamic>,
      );
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await cache?.write(cacheKey, data);
      return data;
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      return cached.withMetadata();
    }
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
    required this.lastUpdated,
    required this.fromCache,
  });

  final int unreadCount;
  final List<NotificationItem> items;
  final DateTime lastUpdated;
  final bool fromCache;
}
