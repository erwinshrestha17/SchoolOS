class TeacherMessageThread {
  const TeacherMessageThread({
    required this.id,
    required this.title,
    required this.context,
    required this.preview,
    required this.updatedAt,
    required this.status,
  });

  final String id;
  final String title;
  final String context;
  final String preview;
  final DateTime? updatedAt;
  final String status;

  factory TeacherMessageThread.fromJson(Map<String, dynamic> json) {
    final guardian = json['guardian'] is Map<String, dynamic>
        ? json['guardian'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final student = json['student'] is Map<String, dynamic>
        ? json['student'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final latestMessages = json['latestMessages'] is List<dynamic>
        ? json['latestMessages'] as List<dynamic>
        : const <dynamic>[];
    final latest =
        latestMessages.isNotEmpty &&
            latestMessages.first is Map<String, dynamic>
        ? latestMessages.first as Map<String, dynamic>
        : const <String, dynamic>{};
    final studentName = [
      student['firstNameEn'] as String?,
      student['lastNameEn'] as String?,
    ].where((part) => part != null && part.trim().isNotEmpty).join(' ');
    final className = student['class'] is Map<String, dynamic>
        ? (student['class'] as Map<String, dynamic>)['name'] as String?
        : null;
    final sectionName = student['sectionRef'] is Map<String, dynamic>
        ? (student['sectionRef'] as Map<String, dynamic>)['name'] as String?
        : null;

    return TeacherMessageThread(
      id: json['id'] as String? ?? '',
      title: guardian['fullName'] as String? ?? 'Parent thread',
      context: [
        if (studentName.isNotEmpty) studentName,
        if (className != null && className.trim().isNotEmpty) className,
        if (sectionName != null && sectionName.trim().isNotEmpty) sectionName,
      ].join(' • '),
      preview: latest['message'] as String? ?? 'No messages yet.',
      updatedAt: DateTime.tryParse(
        json['updatedAt'] as String? ?? latest['sentAt'] as String? ?? '',
      ),
      status: json['status'] as String? ?? 'OPEN',
    );
  }
}

class TeacherMessageThreadPage {
  const TeacherMessageThreadPage({
    required this.items,
    required this.total,
    required this.hasNextPage,
  });

  final List<TeacherMessageThread> items;
  final int total;
  final bool hasNextPage;

  factory TeacherMessageThreadPage.fromJson(Map<String, dynamic> json) {
    final items = json['items'] is List<dynamic>
        ? json['items'] as List<dynamic>
        : const <dynamic>[];
    return TeacherMessageThreadPage(
      items: items
          .whereType<Map<String, dynamic>>()
          .map(TeacherMessageThread.fromJson)
          .toList(),
      total: _asInt(json['total']),
      hasNextPage: json['hasNextPage'] as bool? ?? false,
    );
  }
}

class TeacherChatAvailability {
  const TeacherChatAvailability({
    required this.isAvailable,
    required this.notice,
    required this.sla,
    this.nextWindow,
  });

  final bool isAvailable;
  final String notice;
  final String sla;
  final String? nextWindow;

  factory TeacherChatAvailability.fromJson(Map<String, dynamic> json) {
    return TeacherChatAvailability(
      isAvailable: json['isAvailable'] as bool? ?? false,
      notice: json['notice'] as String? ?? 'Messaging availability is unknown.',
      sla: json['sla'] as String? ?? '',
      nextWindow: json['nextWindow'] as String?,
    );
  }
}

class TeacherMessagesSnapshot {
  const TeacherMessagesSnapshot({
    required this.threads,
    required this.availability,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final List<TeacherMessageThread> threads;
  final TeacherChatAvailability availability;
  final DateTime lastUpdated;
  final bool fromCache;
}

class TeacherMessage {
  const TeacherMessage({
    required this.id,
    required this.body,
    required this.senderRole,
    required this.sentAt,
    required this.status,
  });

  final String id;
  final String body;
  final String senderRole;
  final DateTime? sentAt;
  final String status;

  bool get isTeacher => senderRole.toUpperCase() == 'TEACHER';

  factory TeacherMessage.fromJson(Map<String, dynamic> json) {
    return TeacherMessage(
      id: json['id'] as String? ?? '',
      body: json['message'] as String? ?? '',
      senderRole: json['senderRole'] as String? ?? '',
      sentAt: DateTime.tryParse(json['sentAt'] as String? ?? ''),
      status: json['status'] as String? ?? '',
    );
  }
}

class TeacherMessageDetail {
  const TeacherMessageDetail({
    required this.thread,
    required this.messages,
    required this.availability,
  });

  final TeacherMessageThread thread;
  final List<TeacherMessage> messages;
  final TeacherChatAvailability availability;
}

class TeacherNoticeSummary {
  const TeacherNoticeSummary({
    required this.unreadCount,
    required this.lastUpdated,
  });

  final int unreadCount;
  final DateTime lastUpdated;
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return 0;
}
