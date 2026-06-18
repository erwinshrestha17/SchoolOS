enum NoticeCategory {
  general,
  important,
  emergency,
  academic,
  fee,
  transport,
  homework,
  approval,
}

class Notice {
  const Notice({
    required this.id,
    required this.title,
    required this.preview,
    required this.body,
    required this.publishedBy,
    required this.publishedAt,
    required this.audience,
    required this.category,
    required this.isRead,
    this.hasAttachment = false,
  });

  final String id;
  final String title;
  final String preview;
  final String body;
  final String publishedBy;
  final DateTime publishedAt;
  final String audience;
  final NoticeCategory category;
  final bool isRead;
  final bool hasAttachment;

  bool get isEmergency => category == NoticeCategory.emergency;
  bool get isImportant => category == NoticeCategory.important || isEmergency;

  Notice copyWith({bool? isRead}) {
    return Notice(
      id: id,
      title: title,
      preview: preview,
      body: body,
      publishedBy: publishedBy,
      publishedAt: publishedAt,
      audience: audience,
      category: category,
      isRead: isRead ?? this.isRead,
      hasAttachment: hasAttachment,
    );
  }
}

enum ParentNotificationType {
  notice,
  message,
  homework,
  event,
  gallery,
  fee,
  attendance,
  transport,
  other,
}

class ParentNotification {
  const ParentNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.targetId,
    required this.route,
    required this.createdAt,
    this.category = NoticeCategory.important,
    this.childId,
    this.sourceUpdateId,
    this.readAt,
    this.metadata,
  });

  final String id;
  final ParentNotificationType type;
  final String title;
  final String body;
  final String targetId;
  final String route;
  final String? childId;
  final String? sourceUpdateId;
  final DateTime createdAt;
  final NoticeCategory category;
  final DateTime? readAt;
  final Map<String, dynamic>? metadata;

  bool get isRead => readAt != null;
  String get message => body;

  factory ParentNotification.fromJson(Map<String, dynamic> json) {
    final sourceType = json['sourceType'] as String? ?? '';
    final type = _notificationTypeFromSource(sourceType);
    return ParentNotification(
      id: json['id'] as String? ?? '',
      type: type,
      title: json['title'] as String? ?? 'Notification',
      body: json['body'] as String? ?? json['message'] as String? ?? '',
      targetId:
          json['noticeId'] as String? ??
          json['eventId'] as String? ??
          json['activityPostId'] as String? ??
          json['sourceId'] as String? ??
          '',
      route: json['route'] as String? ?? _routeFromSource(type, json),
      childId: json['childId'] as String?,
      sourceUpdateId:
          json['noticeId'] as String? ?? json['sourceId'] as String?,
      category: _categoryFromSource(sourceType),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      readAt:
          DateTime.tryParse(json['readAt'] as String? ?? '') ??
          (json['isRead'] == true
              ? DateTime.fromMillisecondsSinceEpoch(0)
              : null),
      metadata: Map<String, dynamic>.from(json),
    );
  }

  ParentNotification copyWith({DateTime? readAt, bool clearReadAt = false}) {
    return ParentNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      targetId: targetId,
      route: route,
      childId: childId,
      sourceUpdateId: sourceUpdateId,
      createdAt: createdAt,
      category: category,
      readAt: clearReadAt ? null : readAt ?? this.readAt,
      metadata: metadata,
    );
  }
}

class ParentNotificationPage {
  const ParentNotificationPage({
    required this.items,
    required this.unreadCount,
    this.nextCursor,
  });
  final List<ParentNotification> items;
  final int unreadCount;
  final String? nextCursor;
}

class NoticeFeed {
  const NoticeFeed({
    required this.items,
    required this.lastUpdated,
    required this.fromCache,
  });

  final List<Notice> items;
  final DateTime lastUpdated;
  final bool fromCache;
}

NoticeCategory _categoryFromSource(String? sourceType) {
  final source = (sourceType ?? '').trim().toLowerCase();
  if (source.isEmpty || source == 'notice' || source == 'event') {
    return NoticeCategory.important;
  }
  if (source.contains('emergency')) {
    return NoticeCategory.emergency;
  }
  if (source.startsWith('homework')) {
    return NoticeCategory.homework;
  }
  if (source.startsWith('fee') || source.contains('payment')) {
    return NoticeCategory.fee;
  }
  if (source.startsWith('transport') || source.contains('trip')) {
    return NoticeCategory.transport;
  }
  if (source.startsWith('attendance') ||
      source.contains('report_card') ||
      source.contains('exam') ||
      source.contains('timetable')) {
    return NoticeCategory.academic;
  }
  if (source.contains('approval') || source.contains('consent')) {
    return NoticeCategory.approval;
  }
  return NoticeCategory.important;
}

ParentNotificationType _notificationTypeFromSource(String sourceType) {
  final source = sourceType.toLowerCase();
  if (source.contains('notice')) return ParentNotificationType.notice;
  if (source.contains('message')) return ParentNotificationType.message;
  if (source.contains('homework')) return ParentNotificationType.homework;
  if (source.contains('event')) return ParentNotificationType.event;
  if (source.contains('gallery') || source.contains('activity')) {
    return ParentNotificationType.gallery;
  }
  if (source.contains('fee') ||
      source.contains('invoice') ||
      source.contains('payment')) {
    return ParentNotificationType.fee;
  }
  if (source.contains('attendance')) return ParentNotificationType.attendance;
  if (source.contains('transport') || source.contains('trip')) {
    return ParentNotificationType.transport;
  }
  return ParentNotificationType.other;
}

String _routeFromSource(
  ParentNotificationType type,
  Map<String, dynamic> json,
) {
  final id = json['id'] as String? ?? '';
  final sourceId = json['sourceId'] as String? ?? '';
  final childId = json['childId'] as String?;
  return switch (type) {
    ParentNotificationType.notice => '/notices/$id',
    ParentNotificationType.message => '/parent/chat?threadId=$sourceId',
    ParentNotificationType.homework => '/parent/homework/$sourceId',
    ParentNotificationType.event => '/parent/updates?eventId=$sourceId',
    ParentNotificationType.gallery => '/parent/activity?postId=$sourceId',
    ParentNotificationType.fee => '/parent/fees?invoiceId=$sourceId',
    ParentNotificationType.attendance when childId != null =>
      '/parent/children/$childId/attendance',
    ParentNotificationType.transport when childId != null =>
      '/parent/more/transport?childId=$childId',
    _ => '/parent/updates',
  };
}
