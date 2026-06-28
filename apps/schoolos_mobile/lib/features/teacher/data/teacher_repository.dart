import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/teacher_models.dart';

class TeacherRepository {
  const TeacherRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<TeacherMessagesSnapshot> getMessages({String? search}) async {
    const cacheKey = 'teacher_messages';
    late Map<String, dynamic> data;
    try {
      final responses = await Future.wait([
        _client.get(
          '/messaging/parent-teacher/threads',
          queryParameters: {
            'limit': '30',
            if (search != null && search.trim().isNotEmpty)
              'search': search.trim(),
          },
        ),
        _client.get('/messaging/parent-teacher/availability/status'),
      ]);
      data = {
        'threads': responses[0].data,
        'availability': responses[1].data,
        '_mobileLastUpdated': DateTime.now().toIso8601String(),
      };
      await cache?.write(cacheKey, data);
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      data = cached.withMetadata();
    }

    final threads = data['threads'] is Map<String, dynamic>
        ? TeacherMessageThreadPage.fromJson(
            data['threads'] as Map<String, dynamic>,
          ).items
        : const <TeacherMessageThread>[];
    final availability = data['availability'] is Map<String, dynamic>
        ? TeacherChatAvailability.fromJson(
            data['availability'] as Map<String, dynamic>,
          )
        : const TeacherChatAvailability(
            isAvailable: false,
            notice: 'Messaging availability is unavailable.',
            sla: '',
          );

    return TeacherMessagesSnapshot(
      threads: threads,
      availability: availability,
      lastUpdated:
          DateTime.tryParse(data['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      fromCache: data['_mobileFromCache'] as bool? ?? false,
    );
  }

  Future<TeacherMessageDetail> getMessageDetail(String threadId) async {
    final responses = await Future.wait([
      _client.get('/messaging/parent-teacher/threads/$threadId'),
      _client.get(
        '/messaging/parent-teacher/threads/$threadId/messages',
        queryParameters: {'limit': '50'},
      ),
      _client.get('/messaging/parent-teacher/availability/status'),
    ]);
    final threadData = responses[0].data is Map<String, dynamic>
        ? responses[0].data as Map<String, dynamic>
        : const <String, dynamic>{};
    final messagesData = responses[1].data is Map<String, dynamic>
        ? responses[1].data as Map<String, dynamic>
        : const <String, dynamic>{};
    final availabilityData = responses[2].data is Map<String, dynamic>
        ? responses[2].data as Map<String, dynamic>
        : const <String, dynamic>{};
    final items = messagesData['items'] is List<dynamic>
        ? messagesData['items'] as List<dynamic>
        : const <dynamic>[];

    return TeacherMessageDetail(
      thread: TeacherMessageThread.fromJson(threadData),
      messages: items
          .whereType<Map<String, dynamic>>()
          .map(TeacherMessage.fromJson)
          .toList(),
      availability: TeacherChatAvailability.fromJson(availabilityData),
    );
  }

  Future<void> sendMessage(String threadId, String message) async {
    await _client.post(
      '/messaging/parent-teacher/threads/$threadId/messages',
      data: {'message': message.trim()},
    );
  }

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

  Future<TeacherHomeworkSnapshot> getHomework({String? status}) async {
    final cacheKey = 'teacher_homework_${status ?? 'all'}';
    late Map<String, dynamic> data;
    try {
      final responses = await Future.wait([
        _client.get(
          '/mobile/teacher/homework',
          queryParameters: {
            'limit': '50',
            ...?status == null ? null : {'status': status},
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
      final cached = cache?.read(cacheKey);
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
  }) async {
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
      },
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
      final cached = cache?.read(cacheKey);
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
