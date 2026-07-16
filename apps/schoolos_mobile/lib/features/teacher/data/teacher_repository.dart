import 'dart:convert';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/teacher_models.dart';

class TeacherRepository {
  const TeacherRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<TeacherNoticeSummary> getNoticeSummary() async {
    final response = await _client.get('/mobile/me/notifications/unread-count');
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherNoticeSummary(
      unreadCount: _asInt(data['unreadCount']),
      lastUpdated: DateTime.now(),
    );
  }

  Future<TeacherHomeworkSnapshot> getHomework({
    String? status,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    final cacheKey = [
      'teacher_homework',
      status ?? 'all',
      classId ?? 'all-classes',
      sectionId ?? 'all-sections',
      subjectId ?? 'all-subjects',
    ].join('_');
    late Map<String, dynamic> data;
    try {
      final responses = await Future.wait([
        _client.get(
          '/mobile/teacher/homework',
          queryParameters: {
            'limit': '50',
            ...?status == null ? null : {'status': status},
            if (classId != null && classId.trim().isNotEmpty)
              'classId': classId,
            if (sectionId != null && sectionId.trim().isNotEmpty)
              'sectionId': sectionId,
            if (subjectId != null && subjectId.trim().isNotEmpty)
              'subjectId': subjectId,
          },
        ),
        _client.get('/mobile/teacher/homework/scopes'),
      ]);
      data = {
        'homework': responses[0].data,
        'scopes': responses[1].data,
        '_mobileLastUpdated': DateTime.now().toIso8601String(),
      };
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }

    final homework = data['homework'] is Map<String, dynamic>
        ? data['homework'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final scopes = data['scopes'] is Map<String, dynamic>
        ? data['scopes'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherHomeworkSnapshot(
      items: _asList(homework['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherHomeworkItem.fromJson)
          .toList(),
      scopes: _asList(scopes['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherHomeworkScope.fromJson)
          .toList(),
      total: _asInt(homework['total']),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<void> createHomework({
    required TeacherHomeworkScope scope,
    required String title,
    required String instructions,
    required DateTime dueDate,
    required bool submissionRequired,
    List<TeacherHomeworkDraftAttachment> attachments = const [],
  }) async {
    final attachmentFileIds = <String>[];
    for (final attachment in attachments) {
      attachmentFileIds.add(await _uploadHomeworkAttachment(attachment));
    }

    await _client.post(
      '/mobile/teacher/homework',
      data: {
        'academicYearId': scope.academicYearId,
        'classId': scope.classId,
        if (scope.sectionId != null) 'sectionId': scope.sectionId,
        'subjectId': scope.subjectId,
        'title': title.trim(),
        'instructions': instructions.trim(),
        'dueDate': dueDate.toUtc().toIso8601String(),
        'status': 'DRAFT',
        'submissionRequired': submissionRequired,
        if (attachmentFileIds.isNotEmpty)
          'attachmentFileIds': attachmentFileIds,
      },
    );
  }

  Future<String> _uploadHomeworkAttachment(
    TeacherHomeworkDraftAttachment attachment,
  ) async {
    final data = {
      'fileName': attachment.fileName,
      'contentType': attachment.contentType,
      'base64Content': base64Encode(attachment.bytes),
      'module': 'homework',
    };

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final response = await _client.post<dynamic>(
          '/files/upload',
          data: data,
        );
        final body = response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : const <String, dynamic>{};
        final id = body['id'] as String?;
        if (id == null || id.isEmpty) {
          throw StateError(
            'Homework attachment upload did not return a file id.',
          );
        }
        return id;
      } on AppException catch (error) {
        final retryable =
            error is NetworkException || error is TimeoutException;
        if (!retryable || attempt == 1) rethrow;
        await Future<void>.delayed(const Duration(milliseconds: 600));
      }
    }

    throw const NetworkException(
      'Homework attachment upload did not complete.',
    );
  }

  Future<void> updateHomeworkDraft({
    required String homeworkId,
    required String title,
    required String instructions,
    required DateTime dueDate,
    required bool submissionRequired,
  }) async {
    await _client.patch(
      '/mobile/teacher/homework/$homeworkId',
      data: {
        'title': title.trim(),
        'instructions': instructions.trim(),
        'dueDate': dueDate.toUtc().toIso8601String(),
        'submissionRequired': submissionRequired,
      },
    );
  }

  Future<void> publishHomework(String homeworkId) async {
    await _client.post('/mobile/teacher/homework/$homeworkId/publish');
  }

  Future<List<TeacherHomeworkSubmission>> getHomeworkSubmissions(
    String homeworkId,
  ) async {
    final response = await _client.get(
      '/mobile/teacher/homework/$homeworkId/submissions',
      queryParameters: {'limit': '50'},
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return _asList(data['items'])
        .whereType<Map<String, dynamic>>()
        .map(TeacherHomeworkSubmission.fromJson)
        .toList();
  }

  Future<void> reviewHomeworkSubmission({
    required String submissionId,
    required String status,
    String? teacherRemarks,
    String? correctionRemarks,
  }) async {
    await _client.patch(
      '/mobile/teacher/homework/submissions/$submissionId/review',
      data: {
        'status': status,
        if (teacherRemarks != null && teacherRemarks.trim().isNotEmpty)
          'teacherRemarks': teacherRemarks.trim(),
        if (correctionRemarks != null && correctionRemarks.trim().isNotEmpty)
          'correctionRemarks': correctionRemarks.trim(),
      },
    );
  }

  Future<TeacherActivitySnapshot> getActivity() async {
    final responses = await Future.wait([
      _client.get('/mobile/teacher/activity/scopes'),
      _client.get(
        '/mobile/teacher/activity/posts',
        queryParameters: {'page': 1, 'limit': 20},
      ),
    ]);
    final data = <String, dynamic>{
      'scopes': responses[0].data,
      'posts': responses[1].data,
      '_mobileLastUpdated': DateTime.now().toIso8601String(),
      '_mobileFromCache': false,
    };

    final scopes = data['scopes'] is Map<String, dynamic>
        ? data['scopes'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final posts = data['posts'] is Map<String, dynamic>
        ? data['posts'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherActivitySnapshot(
      scopes: _asList(scopes['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherActivityScope.fromJson)
          .toList(),
      posts: _asList(posts['items'])
          .whereType<Map<String, dynamic>>()
          .map(TeacherActivityPost.fromJson)
          .toList(),
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherActivityStudentPage> getActivityStudents({
    required TeacherActivityScope scope,
    int page = 1,
    String? search,
  }) async {
    final response = await _client.get(
      '/mobile/teacher/activity/students',
      queryParameters: {
        'classId': scope.classId,
        if (scope.sectionId != null) 'sectionId': scope.sectionId,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'page': page,
        'limit': 50,
      },
    );
    final data = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherActivityStudentPage.fromJson(data);
  }

  Future<TeacherActivityPost> createActivityPost({
    required String clientSubmissionId,
    required TeacherActivityScope scope,
    required String title,
    required String caption,
    required String category,
    required List<String> studentIds,
    required List<TeacherActivityMedia> attachments,
  }) async {
    final data = {
      'clientSubmissionId': clientSubmissionId,
      'classId': scope.classId,
      if (scope.sectionId != null) 'sectionId': scope.sectionId,
      'title': title.trim(),
      'caption': caption.trim(),
      'category': category,
      'studentIds': studentIds,
      'attachments': attachments
          .map(
            (attachment) => {
              'fileName': attachment.fileName,
              'contentType': attachment.contentType,
              'base64Content': base64Encode(attachment.bytes),
            },
          )
          .toList(),
    };

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final response = await _client.post(
          '/mobile/teacher/activity/posts',
          data: data,
        );
        final body = response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : const <String, dynamic>{};
        return TeacherActivityPost.fromJson(body);
      } on AppException catch (error) {
        final retryable =
            error is NetworkException || error is TimeoutException;
        if (!retryable || attempt == 1) rethrow;
        await Future<void>.delayed(const Duration(milliseconds: 600));
      }
    }

    throw const NetworkException('Activity upload did not complete.');
  }

  Future<void> createMilestone({
    required String clientSubmissionId,
    required TeacherActivityScope scope,
    required String studentId,
    required String domain,
    required String milestone,
    required String status,
    String? observationNote,
  }) async {
    final data = {
      'clientSubmissionId': clientSubmissionId,
      'classId': scope.classId,
      if (scope.sectionId != null) 'sectionId': scope.sectionId,
      'studentId': studentId,
      'domain': domain.trim(),
      'milestone': milestone.trim(),
      'status': status,
      if (observationNote != null && observationNote.trim().isNotEmpty)
        'observationNote': observationNote.trim(),
      'observedAt': DateTime.now().toUtc().toIso8601String(),
    };

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _client.post('/mobile/teacher/activity/milestones', data: data);
        return;
      } on AppException catch (error) {
        final retryable =
            error is NetworkException || error is TimeoutException;
        if (!retryable || attempt == 1) rethrow;
        await Future<void>.delayed(const Duration(milliseconds: 600));
      }
    }
  }

  Future<TeacherTimetableSnapshot> getTimetable({
    DateTime? weekStart,
    int days = 7,
  }) async {
    const cacheKey = 'teacher_timetable_week';
    late Map<String, dynamic> data;
    try {
      final response = await _client.get(
        '/mobile/teacher/timetable',
        queryParameters: {
          if (weekStart != null) 'weekStart': weekStart.toIso8601String(),
          'days': days,
        },
      );
      data = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : const <String, dynamic>{};
      data = {...data, '_mobileLastUpdated': DateTime.now().toIso8601String()};
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = await cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }

    return TeacherTimetableSnapshot.fromJson(
      data,
      fromCache: data['_mobileFromCache'] as bool? ?? false,
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

List<dynamic> _asList(Object? value) {
  return value is List<dynamic> ? value : const [];
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return 0;
}
