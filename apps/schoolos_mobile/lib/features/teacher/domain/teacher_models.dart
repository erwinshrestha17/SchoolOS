import 'dart:typed_data';

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

class TeacherHomeworkScope {
  const TeacherHomeworkScope({
    required this.id,
    required this.academicYearId,
    required this.academicYearName,
    required this.classId,
    required this.className,
    this.sectionId,
    this.sectionName,
    required this.subjectId,
    required this.subjectName,
  });

  final String id;
  final String academicYearId;
  final String academicYearName;
  final String classId;
  final String className;
  final String? sectionId;
  final String? sectionName;
  final String subjectId;
  final String subjectName;

  String get label => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
    subjectName,
  ].join(' • ');

  factory TeacherHomeworkScope.fromJson(Map<String, dynamic> json) {
    return TeacherHomeworkScope(
      id: json['id'] as String? ?? '',
      academicYearId: json['academicYearId'] as String? ?? '',
      academicYearName: json['academicYearName'] as String? ?? '',
      classId: json['classId'] as String? ?? '',
      className: json['className'] as String? ?? 'Class',
      sectionId: json['sectionId'] as String?,
      sectionName: json['sectionName'] as String?,
      subjectId: json['subjectId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? 'Subject',
    );
  }
}

class TeacherHomeworkCounts {
  const TeacherHomeworkCounts({
    required this.total,
    required this.submitted,
    required this.reviewed,
    required this.toReview,
    required this.notSubmitted,
  });

  final int total;
  final int submitted;
  final int reviewed;
  final int toReview;
  final int notSubmitted;

  factory TeacherHomeworkCounts.fromJson(Map<String, dynamic> json) {
    return TeacherHomeworkCounts(
      total: _asInt(json['total']),
      submitted: _asInt(json['submitted']),
      reviewed: _asInt(json['reviewed']),
      toReview: _asInt(json['toReview']),
      notSubmitted: _asInt(json['notSubmitted']),
    );
  }
}

class TeacherHomeworkItem {
  const TeacherHomeworkItem({
    required this.id,
    required this.title,
    required this.instructions,
    required this.className,
    this.sectionName,
    required this.subjectName,
    required this.dueDate,
    required this.status,
    required this.submissionRequired,
    required this.attachmentCount,
    required this.submissions,
  });

  final String id;
  final String title;
  final String instructions;
  final String className;
  final String? sectionName;
  final String subjectName;
  final DateTime? dueDate;
  final String status;
  final bool submissionRequired;
  final int attachmentCount;
  final TeacherHomeworkCounts submissions;

  String get classLabel => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
    subjectName,
  ].join(' • ');

  factory TeacherHomeworkItem.fromJson(Map<String, dynamic> json) {
    final submissions = json['submissions'] is Map<String, dynamic>
        ? json['submissions'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherHomeworkItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Homework',
      instructions: json['instructions'] as String? ?? '',
      className: json['className'] as String? ?? 'Class',
      sectionName: json['sectionName'] as String?,
      subjectName: json['subjectName'] as String? ?? 'Subject',
      dueDate: DateTime.tryParse(json['dueDate'] as String? ?? ''),
      status: json['status'] as String? ?? 'DRAFT',
      submissionRequired: json['submissionRequired'] as bool? ?? true,
      attachmentCount: _asInt(json['attachmentCount']),
      submissions: TeacherHomeworkCounts.fromJson(submissions),
    );
  }
}

class TeacherHomeworkSnapshot {
  const TeacherHomeworkSnapshot({
    required this.items,
    required this.scopes,
    required this.total,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final List<TeacherHomeworkItem> items;
  final List<TeacherHomeworkScope> scopes;
  final int total;
  final DateTime lastUpdated;
  final bool fromCache;

  int get toReview =>
      items.fold(0, (count, item) => count + item.submissions.toReview);
}

class TeacherHomeworkQuery {
  const TeacherHomeworkQuery({
    this.status,
    this.classId,
    this.sectionId,
    this.subjectId,
    this.reviewOnly = false,
  });

  final String? status;
  final String? classId;
  final String? sectionId;
  final String? subjectId;
  final bool reviewOnly;

  bool get hasClassContext => classId != null && classId!.trim().isNotEmpty;

  bool matchesScope(TeacherHomeworkScope scope) {
    if (classId != null && classId!.trim().isNotEmpty) {
      if (scope.classId != classId) return false;
    }
    if (sectionId != null && sectionId!.trim().isNotEmpty) {
      if (scope.sectionId != sectionId) return false;
    }
    if (subjectId != null && subjectId!.trim().isNotEmpty) {
      if (scope.subjectId != subjectId) return false;
    }
    return true;
  }

  @override
  bool operator ==(Object other) {
    return other is TeacherHomeworkQuery &&
        other.status == status &&
        other.classId == classId &&
        other.sectionId == sectionId &&
        other.subjectId == subjectId &&
        other.reviewOnly == reviewOnly;
  }

  @override
  int get hashCode =>
      Object.hash(status, classId, sectionId, subjectId, reviewOnly);
}

class TeacherHomeworkSubmission {
  const TeacherHomeworkSubmission({
    required this.id,
    required this.studentName,
    required this.rollNumber,
    required this.status,
    this.submittedAt,
    this.teacherRemarks,
    this.correctionRemarks,
    required this.attachmentCount,
  });

  final String id;
  final String studentName;
  final String rollNumber;
  final String status;
  final DateTime? submittedAt;
  final String? teacherRemarks;
  final String? correctionRemarks;
  final int attachmentCount;

  factory TeacherHomeworkSubmission.fromJson(Map<String, dynamic> json) {
    return TeacherHomeworkSubmission(
      id: json['id'] as String? ?? '',
      studentName: json['studentName'] as String? ?? 'Student',
      rollNumber: '${json['rollNumber'] ?? '-'}',
      status: json['status'] as String? ?? 'NOT_SUBMITTED',
      submittedAt: DateTime.tryParse(json['submittedAt'] as String? ?? ''),
      teacherRemarks: json['teacherRemarks'] as String?,
      correctionRemarks: json['correctionRemarks'] as String?,
      attachmentCount: _asInt(json['attachmentCount']),
    );
  }
}

class TeacherHomeworkDraftAttachment {
  const TeacherHomeworkDraftAttachment({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final Uint8List bytes;
}

class TeacherTimetableSnapshot {
  const TeacherTimetableSnapshot({
    required this.rangeStart,
    required this.rangeEnd,
    required this.items,
    required this.substitutions,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final DateTime? rangeStart;
  final DateTime? rangeEnd;
  final List<TeacherTimetableItem> items;
  final List<TeacherTimetableSubstitution> substitutions;
  final DateTime lastUpdated;
  final bool fromCache;

  List<TeacherTimetableSubstitution> get todayChanges {
    final now = DateTime.now();
    return substitutions.where((item) {
      final date = item.date;
      return date != null &&
          date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    }).toList();
  }

  factory TeacherTimetableSnapshot.fromJson(
    Map<String, dynamic> json, {
    bool fromCache = false,
    DateTime? lastUpdated,
  }) {
    final range = json['range'] is Map<String, dynamic>
        ? json['range'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherTimetableSnapshot(
      rangeStart: DateTime.tryParse(range['startsOn'] as String? ?? ''),
      rangeEnd: DateTime.tryParse(range['endsOn'] as String? ?? ''),
      items: _asList(json['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherTimetableItem.fromJson)
          .toList(),
      substitutions: _asList(json['substitutions'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherTimetableSubstitution.fromJson)
          .toList(),
      lastUpdated: lastUpdated ?? DateTime.now(),
      fromCache: fromCache,
    );
  }
}

class TeacherTimetableItem {
  const TeacherTimetableItem({
    required this.id,
    this.date,
    required this.className,
    this.sectionName,
    required this.subjectName,
    this.room,
    required this.startsAt,
    required this.endsAt,
    required this.status,
    this.substitution,
  });

  final String id;
  final DateTime? date;
  final String className;
  final String? sectionName;
  final String subjectName;
  final String? room;
  final String startsAt;
  final String endsAt;
  final String status;
  final TeacherTimetableSubstitution? substitution;

  String get classLabel => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
  ].join(' • ');

  factory TeacherTimetableItem.fromJson(Map<String, dynamic> json) {
    return TeacherTimetableItem(
      id: json['id'] as String? ?? '',
      date: DateTime.tryParse(json['date'] as String? ?? ''),
      className: json['className'] as String? ?? 'Class',
      sectionName: json['sectionName'] as String?,
      subjectName: json['subjectName'] as String? ?? 'Subject',
      room: json['room'] as String?,
      startsAt: json['startsAt'] as String? ?? '',
      endsAt: json['endsAt'] as String? ?? '',
      status: json['status'] as String? ?? 'SCHEDULED',
      substitution: json['substitution'] is Map<String, dynamic>
          ? TeacherTimetableSubstitution.fromJson(
              json['substitution'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class TeacherTimetableSubstitution {
  const TeacherTimetableSubstitution({
    required this.id,
    this.date,
    required this.status,
    required this.reason,
    required this.role,
    required this.className,
    this.sectionName,
    required this.subjectName,
    required this.startsAt,
    required this.endsAt,
    this.room,
    this.absentTeacherName,
    this.substituteTeacherName,
  });

  final String id;
  final DateTime? date;
  final String status;
  final String reason;
  final String role;
  final String className;
  final String? sectionName;
  final String subjectName;
  final String startsAt;
  final String endsAt;
  final String? room;
  final String? absentTeacherName;
  final String? substituteTeacherName;

  String get classLabel => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
    subjectName,
  ].join(' • ');

  factory TeacherTimetableSubstitution.fromJson(Map<String, dynamic> json) {
    return TeacherTimetableSubstitution(
      id: json['id'] as String? ?? '',
      date: DateTime.tryParse(json['date'] as String? ?? ''),
      status: json['status'] as String? ?? 'PENDING',
      reason: json['reason'] as String? ?? 'Schedule change',
      role: json['role'] as String? ?? '',
      className: json['className'] as String? ?? 'Class',
      sectionName: json['sectionName'] as String?,
      subjectName: json['subjectName'] as String? ?? 'Subject',
      startsAt: json['startsAt'] as String? ?? '',
      endsAt: json['endsAt'] as String? ?? '',
      room: json['room'] as String?,
      absentTeacherName: json['absentTeacherName'] as String?,
      substituteTeacherName: json['substituteTeacherName'] as String?,
    );
  }
}

class TeacherActivityScope {
  const TeacherActivityScope({
    required this.id,
    required this.academicYearId,
    required this.academicYearName,
    required this.classId,
    required this.className,
    this.sectionId,
    this.sectionName,
  });

  final String id;
  final String academicYearId;
  final String academicYearName;
  final String classId;
  final String className;
  final String? sectionId;
  final String? sectionName;

  String get label => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
  ].join(' • ');

  factory TeacherActivityScope.fromJson(Map<String, dynamic> json) {
    return TeacherActivityScope(
      id: json['id'] as String? ?? '',
      academicYearId: json['academicYearId'] as String? ?? '',
      academicYearName: json['academicYearName'] as String? ?? '',
      classId: json['classId'] as String? ?? '',
      className: json['className'] as String? ?? 'Class',
      sectionId: json['sectionId'] as String?,
      sectionName: json['sectionName'] as String?,
    );
  }
}

class TeacherActivityStudent {
  const TeacherActivityStudent({
    required this.id,
    required this.studentSystemId,
    required this.fullName,
    this.rollNumber,
    required this.mediaConsentGranted,
  });

  final String id;
  final String studentSystemId;
  final String fullName;
  final int? rollNumber;
  final bool mediaConsentGranted;

  factory TeacherActivityStudent.fromJson(Map<String, dynamic> json) {
    return TeacherActivityStudent(
      id: json['id'] as String? ?? '',
      studentSystemId: json['studentSystemId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Student',
      rollNumber: json['rollNumber'] is num
          ? (json['rollNumber'] as num).toInt()
          : null,
      mediaConsentGranted: json['mediaConsentGranted'] as bool? ?? false,
    );
  }
}

class TeacherActivityStudentPage {
  const TeacherActivityStudentPage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.total,
  });

  final List<TeacherActivityStudent> items;
  final int page;
  final int totalPages;
  final int total;

  factory TeacherActivityStudentPage.fromJson(Map<String, dynamic> json) {
    final meta = json['meta'] is Map<String, dynamic>
        ? json['meta'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherActivityStudentPage(
      items: _asList(json['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherActivityStudent.fromJson)
          .toList(),
      page: _asInt(meta['page']),
      totalPages: _asInt(meta['totalPages']),
      total: _asInt(meta['total']),
    );
  }
}

class TeacherActivityAttachment {
  const TeacherActivityAttachment({
    required this.id,
    required this.fileName,
    required this.contentType,
    required this.sizeBytes,
    required this.processingStatus,
    this.previewUrl,
  });

  final String id;
  final String fileName;
  final String contentType;
  final int sizeBytes;
  final String processingStatus;
  final String? previewUrl;

  factory TeacherActivityAttachment.fromJson(Map<String, dynamic> json) {
    return TeacherActivityAttachment(
      id: json['id'] as String? ?? '',
      fileName: json['fileName'] as String? ?? 'Activity image',
      contentType: json['contentType'] as String? ?? 'image/jpeg',
      sizeBytes: _asInt(json['sizeBytes']),
      processingStatus: json['processingStatus'] as String? ?? 'PENDING',
      previewUrl: json['previewUrl'] as String?,
    );
  }
}

class TeacherActivityPost {
  const TeacherActivityPost({
    required this.id,
    required this.title,
    required this.caption,
    required this.category,
    required this.status,
    required this.className,
    this.sectionName,
    required this.createdAt,
    required this.attachments,
  });

  final String id;
  final String title;
  final String caption;
  final String category;
  final String status;
  final String className;
  final String? sectionName;
  final DateTime? createdAt;
  final List<TeacherActivityAttachment> attachments;

  String get classLabel => [
    className,
    if (sectionName != null && sectionName!.isNotEmpty) sectionName!,
  ].join(' • ');

  factory TeacherActivityPost.fromJson(Map<String, dynamic> json) {
    final classData = json['class'] is Map<String, dynamic>
        ? json['class'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final sectionData = json['section'] is Map<String, dynamic>
        ? json['section'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherActivityPost(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Activity',
      caption: json['caption'] as String? ?? '',
      category: json['category'] as String? ?? 'GENERAL',
      status: json['status'] as String? ?? 'PENDING_APPROVAL',
      className: classData['name'] as String? ?? 'Class',
      sectionName: sectionData['name'] as String?,
      createdAt: DateTime.tryParse(
        json['createdAt'] as String? ?? json['publishedAt'] as String? ?? '',
      ),
      attachments: _asList(json['attachments'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherActivityAttachment.fromJson)
          .toList(),
    );
  }
}

class TeacherActivitySnapshot {
  const TeacherActivitySnapshot({
    required this.scopes,
    required this.posts,
    required this.lastUpdated,
    this.fromCache = false,
  });

  final List<TeacherActivityScope> scopes;
  final List<TeacherActivityPost> posts;
  final DateTime lastUpdated;
  final bool fromCache;
}

class TeacherActivityMedia {
  const TeacherActivityMedia({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final Uint8List bytes;
}

List<dynamic> _asList(Object? value) {
  return value is List<dynamic> ? value : const [];
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return 0;
}
