import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/notice_models.dart';

class NoticesRepository {
  NoticesRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  /// Attachment downloads currently being written, keyed by attachment.
  ///
  /// Download and Share both fetch the file and write it to disk, and neither
  /// button was guarded, so a second tap started a concurrent write to the
  /// same path and interleaved two responses into one corrupt file - the file
  /// the reader then opens or shares.
  final Map<String, Future<NoticeAttachmentDownload>> _downloadsInFlight = {};

  Future<List<Notice>> getNotices() async {
    final center = await _getCenter();
    return center.items
        .map(
          (item) =>
              _noticeFromNotification(item, metadataOnly: center.fromCache),
        )
        .toList();
  }

  Future<NoticeFeed> getNoticeFeed() async {
    final center = await _getCenter();
    return NoticeFeed(
      items: center.items
          .map(
            (item) =>
                _noticeFromNotification(item, metadataOnly: center.fromCache),
          )
          .toList(),
      lastUpdated: center.lastUpdated,
      fromCache: center.fromCache,
    );
  }

  Future<Notice> getNoticeDetail(String noticeId) async {
    // A notice opened from a cached dashboard used to dead-end on a
    // connection error. It goes through the same read-through cache as the
    // feed, keyed per notice so one stale detail cannot stand in for another.
    final data = await _getMap(
      '/mobile/me/notifications/$noticeId',
      cacheKey: 'notice_detail_$noticeId',
    );
    return _noticeFromNotification(ParentNotification.fromJson(data));
  }

  Future<void> markNoticeRead(String noticeId) async {
    await _client.post('/mobile/me/notifications/$noticeId/read');
  }

  /// Records this guardian's acknowledgement of a notice.
  ///
  /// The backend keeps only `firstAcknowledgedAt`, so a repeat call is a
  /// no-op rather than a second record - safe to retry after an ambiguous
  /// failure without creating duplicates.
  ///
  Future<void> acknowledgeNotice(String noticeId) async {
    await _client.post('/notices/${Uri.encodeComponent(noticeId)}/acknowledge');
  }

  Future<ParentNotificationPage> getNotificationCenter({
    int limit = 30,
    String? cursor,
    bool unreadOnly = false,
  }) async {
    final queryParameters = <String, dynamic>{'limit': '$limit'};
    if (cursor != null) {
      queryParameters['cursor'] = cursor;
    }
    if (unreadOnly) {
      queryParameters['unreadOnly'] = 'true';
    }

    final response = await _client.get(
      '/mobile/me/notifications',
      queryParameters: queryParameters,
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];
    final deduped = _collapseDeliveryChannels(
      items
          .whereType<Map<String, dynamic>>()
          .map(ParentNotification.fromJson)
          .toList(),
    );
    return ParentNotificationPage(
      items: deduped,
      // Recounted from the collapsed list so the badge matches what the
      // parent can actually see; the server counts deliveries, not
      // notifications.
      unreadCount: deduped.where((item) => !item.isRead).length,
      nextCursor: data['nextCursor'] as String?,
    );
  }

  /// Collapses the per-channel delivery rows the notification centre returns
  /// into one entry per notification.
  ///
  /// `/mobile/me/notifications` is backed by `NotificationDelivery`, which
  /// holds a row per channel, so a notice sent IN_APP and PUSH arrives twice -
  /// three times where SMS is also used. Verified 2026-07-25 against a seeded
  /// tenant: every notice in the parent feed appeared exactly twice, one
  /// IN_APP row and one PUSH row with the same noticeId and childId.
  ///
  /// Collapsing here rather than in the shared query keeps the web
  /// notification centre and the API contract untouched. Entries are grouped
  /// by source *and* child, because one notice legitimately reaches a guardian
  /// once per linked child and those are distinct to the parent. Read state is
  /// merged optimistically: `markNoticeRead` clears every delivery for a
  /// notice, so if any row is read the notification is read.
  static List<ParentNotification> _collapseDeliveryChannels(
    List<ParentNotification> items,
  ) {
    final byKey = <String, ParentNotification>{};
    final ordered = <String>[];

    for (final item in items) {
      final source = item.sourceUpdateId ?? '';
      // Without a source id there is nothing to group on; keep the row as-is.
      final key = source.isEmpty
          ? 'delivery:${item.id}'
          : 'source:$source:child:${item.childId ?? ''}';

      final existing = byKey[key];
      if (existing == null) {
        byKey[key] = item;
        ordered.add(key);
        continue;
      }
      if (existing.readAt == null && item.readAt != null) {
        byKey[key] = existing.copyWith(readAt: item.readAt);
      }
    }

    return [for (final key in ordered) byKey[key]!];
  }

  Future<int> getUnreadCount() async {
    final response = await _client.get('/mobile/me/notifications/unread-count');
    final data = response.data as Map<String, dynamic>;
    return data['unreadCount'] as int? ?? 0;
  }

  Future<void> markAllNotificationsRead() async {
    await _client.post('/mobile/me/notifications/mark-all-read');
  }

  Future<NoticeAttachmentDownload> downloadNoticeAttachment(
    NoticeAttachment attachment,
  ) {
    final key = attachment.id.isEmpty ? attachment.downloadPath : attachment.id;
    final existing = _downloadsInFlight[key];
    if (existing != null) return existing;

    late final Future<NoticeAttachmentDownload> pending;
    pending = _downloadNoticeAttachment(attachment).whenComplete(() {
      if (identical(_downloadsInFlight[key], pending)) {
        _downloadsInFlight.remove(key);
      }
    });
    _downloadsInFlight[key] = pending;
    return pending;
  }

  Future<NoticeAttachmentDownload> _downloadNoticeAttachment(
    NoticeAttachment attachment,
  ) async {
    if (attachment.downloadPath.isEmpty) {
      throw StateError('Notice attachment download path was empty.');
    }

    final response = await _client.get<List<int>>(
      attachment.downloadPath,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: attachment.mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Notice attachment was empty.');
    }

    final fileName = _safeFileName(attachment.fileName);
    // Scoped by attachment id, because two notices can carry attachments with
    // the same display name.
    final temporaryDir = await getTemporaryDirectory();
    final noticeDir = Directory(
      '${temporaryDir.path}/schoolos/notices/'
      '${_safeFileName(attachment.id.isEmpty ? fileName : attachment.id)}',
    );
    if (!noticeDir.existsSync()) {
      await noticeDir.create(recursive: true);
    }

    final file = File('${noticeDir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);

    return NoticeAttachmentDownload(
      fileName: fileName,
      filePath: file.path,
      attachment: attachment,
    );
  }

  Future<_NotificationCenterPayload> _getCenter() async {
    final data = await _getMap(
      '/mobile/me/notifications',
      cacheKey: 'notice_feed',
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    final deduped = _collapseDeliveryChannels(
      items
          .whereType<Map<String, dynamic>>()
          .map(ParentNotification.fromJson)
          .toList(),
    );
    return _NotificationCenterPayload(
      unreadCount: deduped.where((item) => !item.isRead).length,
      items: deduped,
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
      await cache?.write(cacheKey, _safeNoticeFeedData(data));
      return data;
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await cache?.read(cacheKey);
      if (cached == null) rethrow;
      return cached.withMetadata();
    }
  }

  Notice _noticeFromNotification(
    ParentNotification item, {
    bool metadataOnly = false,
  }) {
    final body = metadataOnly ? '' : item.message;
    return Notice(
      id: item.id,
      title: item.title,
      preview: metadataOnly ? 'Reconnect to read this notice.' : body,
      body: body,
      publishedBy: 'SchoolOS',
      publishedAt: item.createdAt,
      audience: item.audience.label,
      category: item.category,
      isRead: item.isRead,
      // The notification id and the notice id are different keys; notice-level
      // actions such as acknowledgement need the latter.
      noticeId: item.sourceUpdateId,
      requiresAcknowledgement: item.requiresAcknowledgement,
      acknowledgedAt: item.acknowledgedAt,
      hasAttachment: item.attachment != null,
      attachment: item.attachment,
    );
  }
}

Map<String, dynamic> _safeNoticeFeedData(Map<String, dynamic> data) {
  return <String, dynamic>{
    'unreadCount': data['unreadCount'] as int? ?? 0,
    'nextCursor': data['nextCursor'] as String?,
    'items': (data['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(_safeNoticeFeedItem)
        .toList(),
  };
}

Map<String, dynamic> _safeNoticeFeedItem(Map<String, dynamic> item) {
  const metadataKeys = <String>{
    'id',
    'title',
    'sourceType',
    'sourceId',
    'childId',
    'noticeId',
    'eventId',
    'activityPostId',
    'route',
    'createdAt',
    'readAt',
    'isRead',
    'noticeCategory',
    'noticePriority',
    'isPinned',
    'requiresAcknowledgement',
    'acknowledgedAt',
  };
  return <String, dynamic>{
    for (final entry in item.entries)
      if (metadataKeys.contains(entry.key)) entry.key: entry.value,
  };
}

String _safeFileName(String value) {
  final sanitized = value.trim().replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '-');
  return sanitized.isEmpty ? 'notice-attachment' : sanitized;
}

class _NotificationCenterPayload {
  const _NotificationCenterPayload({
    required this.unreadCount,
    required this.items,
    required this.lastUpdated,
    required this.fromCache,
  });

  final int unreadCount;
  final List<ParentNotification> items;
  final DateTime lastUpdated;
  final bool fromCache;
}
