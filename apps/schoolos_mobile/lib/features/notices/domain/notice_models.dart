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
    this.noticeId,
    this.requiresAcknowledgement = false,
    this.acknowledgedAt,
    this.hasAttachment = false,
    this.attachment,
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

  /// The underlying notice this entry came from, when it is a notice at all.
  ///
  /// [id] is the *notification* id, which is what the parent-scoped
  /// `/mobile/me/notifications` endpoints key on. Notice-level actions such as
  /// acknowledgement are keyed on the notice instead, and passing the
  /// notification id there 404s. Null for entries that are not notices
  /// (events, activity posts), which therefore cannot be acknowledged.
  final String? noticeId;
  final bool requiresAcknowledgement;
  final DateTime? acknowledgedAt;
  final bool hasAttachment;
  final NoticeAttachment? attachment;

  bool get canAcknowledge =>
      (noticeId ?? '').isNotEmpty && requiresAcknowledgement;
  bool get isAcknowledged => acknowledgedAt != null;

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
      noticeId: noticeId,
      requiresAcknowledgement: requiresAcknowledgement,
      acknowledgedAt: acknowledgedAt,
      hasAttachment: hasAttachment,
      attachment: attachment,
    );
  }
}

class NoticeAttachment {
  const NoticeAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.downloadPath,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String downloadPath;

  factory NoticeAttachment.fromJson(Map<String, dynamic> json) {
    return NoticeAttachment(
      id: json['id'] as String? ?? '',
      fileName: json['fileName'] as String? ?? 'Notice attachment',
      mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      sizeBytes: json['sizeBytes'] as int? ?? 0,
      downloadPath: json['downloadPath'] as String? ?? '',
    );
  }
}

class NoticeAttachmentDownload {
  const NoticeAttachmentDownload({
    required this.fileName,
    required this.filePath,
    required this.attachment,
  });

  final String fileName;
  final String filePath;
  final NoticeAttachment attachment;
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

enum ParentNotificationPriority {
  normal,
  urgent,
  emergency;

  factory ParentNotificationPriority.fromApi(String? value) {
    return switch ((value ?? '').trim().toUpperCase()) {
      'URGENT' => ParentNotificationPriority.urgent,
      'EMERGENCY' => ParentNotificationPriority.emergency,
      _ => ParentNotificationPriority.normal,
    };
  }
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
    this.priority = ParentNotificationPriority.normal,
    this.childId,
    this.sourceUpdateId,
    this.readAt,
    this.isPinned = false,
    this.requiresAcknowledgement = false,
    this.acknowledgedAt,
    this.metadata,
    this.attachment,
    this.audience = const ParentNotificationAudience(),
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
  final ParentNotificationPriority priority;
  final DateTime? readAt;
  final bool isPinned;
  final bool requiresAcknowledgement;
  final DateTime? acknowledgedAt;
  final Map<String, dynamic>? metadata;
  final NoticeAttachment? attachment;
  final ParentNotificationAudience audience;

  bool get isRead => readAt != null;
  bool get isImportant =>
      priority == ParentNotificationPriority.urgent ||
      priority == ParentNotificationPriority.emergency;
  bool get isEmergency => priority == ParentNotificationPriority.emergency;
  String get message => body;

  factory ParentNotification.fromJson(Map<String, dynamic> json) {
    final sourceType = json['sourceType'] as String? ?? '';
    final type = _notificationTypeFromSource(sourceType);
    final priority = ParentNotificationPriority.fromApi(
      json['noticePriority'] as String?,
    );
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
      category: _categoryFromSource(
        sourceType,
        noticeCategory: json['noticeCategory'] as String?,
        priority: priority,
      ),
      priority: priority,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      readAt:
          DateTime.tryParse(json['readAt'] as String? ?? '') ??
          (json['isRead'] == true
              ? DateTime.fromMillisecondsSinceEpoch(0)
              : null),
      isPinned: json['isPinned'] as bool? ?? false,
      requiresAcknowledgement:
          json['requiresAcknowledgement'] as bool? ?? false,
      acknowledgedAt: DateTime.tryParse(
        json['acknowledgedAt'] as String? ?? '',
      ),
      metadata: Map<String, dynamic>.from(json),
      attachment: json['attachment'] is Map<String, dynamic>
          ? NoticeAttachment.fromJson(
              json['attachment'] as Map<String, dynamic>,
            )
          : null,
      audience: json['audience'] is Map<String, dynamic>
          ? ParentNotificationAudience.fromJson(
              json['audience'] as Map<String, dynamic>,
            )
          : const ParentNotificationAudience(),
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
      priority: priority,
      readAt: clearReadAt ? null : readAt ?? this.readAt,
      isPinned: isPinned,
      requiresAcknowledgement: requiresAcknowledgement,
      acknowledgedAt: acknowledgedAt,
      metadata: metadata,
      attachment: attachment,
      audience: audience,
    );
  }
}

class ParentNotificationAudience {
  const ParentNotificationAudience({
    this.type = 'ALL',
    this.label = 'Whole school',
    this.childName,
    this.className,
    this.sectionName,
  });

  final String type;
  final String label;
  final String? childName;
  final String? className;
  final String? sectionName;

  factory ParentNotificationAudience.fromJson(Map<String, dynamic> json) {
    return ParentNotificationAudience(
      type: json['type'] as String? ?? 'ALL',
      label: json['label'] as String? ?? 'Whole school',
      childName: json['childName'] as String?,
      className: json['className'] as String?,
      sectionName: json['sectionName'] as String?,
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

NoticeCategory _categoryFromSource(
  String? sourceType, {
  String? noticeCategory,
  ParentNotificationPriority priority = ParentNotificationPriority.normal,
}) {
  if (priority == ParentNotificationPriority.emergency) {
    return NoticeCategory.emergency;
  }
  if (priority == ParentNotificationPriority.urgent) {
    return NoticeCategory.important;
  }

  switch ((noticeCategory ?? '').trim().toUpperCase()) {
    case 'EMERGENCY':
      return NoticeCategory.emergency;
    case 'FEES':
      return NoticeCategory.fee;
    case 'EXAMS':
      return NoticeCategory.academic;
    case 'TRANSPORT_DELAY':
      return NoticeCategory.transport;
    case 'GENERAL':
    case 'HOLIDAY':
    case 'EVENT':
      return NoticeCategory.general;
  }

  final source = (sourceType ?? '').trim().toLowerCase();
  if (source.isEmpty || source == 'notice' || source == 'event') {
    return NoticeCategory.general;
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
    ParentNotificationType.message => '/notifications',
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
