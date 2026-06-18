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

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.category,
    required this.createdAt,
    required this.isRead,
  });

  final String id;
  final String title;
  final String message;
  final NoticeCategory category;
  final DateTime createdAt;
  final bool isRead;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Notification',
      message: json['body'] as String? ?? json['message'] as String? ?? '',
      category: _categoryFromSource(json['sourceType'] as String?),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      isRead: json['isRead'] as bool? ?? false,
    );
  }
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
