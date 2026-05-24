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

NoticeCategory _categoryFromSource(String? sourceType) {
  switch (sourceType) {
    case 'homework':
      return NoticeCategory.homework;
    case 'fee':
    case 'fees':
      return NoticeCategory.fee;
    case 'transport':
      return NoticeCategory.transport;
    case 'attendance':
      return NoticeCategory.academic;
    case 'notice':
    default:
      return NoticeCategory.important;
  }
}
