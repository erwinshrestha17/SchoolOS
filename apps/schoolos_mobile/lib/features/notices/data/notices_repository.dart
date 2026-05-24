import '../domain/notice_models.dart';

class NoticesRepository {
  const NoticesRepository();

  Future<List<Notice>> getNotices() async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    return _notices;
  }

  Future<Notice> getNoticeDetail(String noticeId) async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    return _notices.firstWhere(
      (notice) => notice.id == noticeId,
      orElse: () => _notices.first,
    );
  }

  Future<void> markNoticeRead(String noticeId) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
  }

  Future<List<NotificationItem>> getNotificationCenter() async {
    await Future<void>.delayed(const Duration(milliseconds: 220));
    return [
      NotificationItem(
        id: 'n-1',
        title: 'Unread notice',
        message: 'Sports meet moved to June 10.',
        category: NoticeCategory.important,
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        isRead: false,
      ),
      NotificationItem(
        id: 'n-2',
        title: 'Attendance alert',
        message: 'Aarav was marked present at 09:12 AM.',
        category: NoticeCategory.academic,
        createdAt: DateTime.now().subtract(const Duration(hours: 4)),
        isRead: true,
      ),
      NotificationItem(
        id: 'n-3',
        title: 'Fee alert',
        message: 'NPR 4,200 is due by June 5.',
        category: NoticeCategory.fee,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
        isRead: false,
      ),
      NotificationItem(
        id: 'n-4',
        title: 'Transport placeholder',
        message:
            'Route tracking alerts will appear here when transport sync is enabled.',
        category: NoticeCategory.transport,
        createdAt: DateTime.now().subtract(const Duration(days: 1, hours: 3)),
        isRead: true,
      ),
    ];
  }

  Future<int> getUnreadCount() async {
    final notices = await getNotices();
    return notices.where((notice) => !notice.isRead).length;
  }
}

final _notices = [
  Notice(
    id: 'notice-sports-meet',
    title: 'Sports meet moved to June 10',
    preview:
        'Regular classes continue as planned. Updated event schedule follows.',
    body:
        'Annual Sports Meet has been moved to June 10 because of weather conditions. Regular classes continue as planned. The updated event schedule will be shared after morning assembly.',
    publishedBy: 'Principal Office',
    publishedAt: DateTime.now().subtract(const Duration(hours: 2)),
    audience: 'Parents and students',
    category: NoticeCategory.important,
    isRead: false,
    hasAttachment: true,
  ),
  Notice(
    id: 'notice-science-project',
    title: 'Grade 4 science project reminder',
    preview:
        'Students should bring labelled project materials by Friday morning.',
    body:
        'Grade 4 students should bring their labelled science project materials by Friday morning. Please avoid sending sharp tools or glass containers.',
    publishedBy: 'Mrs. Sharma',
    publishedAt: DateTime.now().subtract(const Duration(days: 1)),
    audience: 'Grade 4 - Lotus',
    category: NoticeCategory.academic,
    isRead: false,
  ),
  Notice(
    id: 'notice-route-12',
    title: 'Route 12 early boarding',
    preview: 'Route 12 students will board 10 minutes early today.',
    body:
        'Route 12 students will board 10 minutes early because of road maintenance near Chabahil. Parents will receive route status once the driver starts the trip.',
    publishedBy: 'Transport Desk',
    publishedAt: DateTime.now().subtract(const Duration(days: 2)),
    audience: 'Route 12 parents',
    category: NoticeCategory.emergency,
    isRead: true,
  ),
];
