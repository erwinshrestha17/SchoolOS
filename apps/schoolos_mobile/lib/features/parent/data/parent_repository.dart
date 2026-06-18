import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/parent_models.dart';

class ParentRepository {
  const ParentRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  Future<List<GuardianChild>> getGuardianChildren() async {
    final data = await _getMap(
      '/mobile/me/students',
      cacheKey: 'parent_children',
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(GuardianChild.fromJson)
        .toList();
  }

  Future<ChildProfile> getChildProfile(String childId) async {
    final children = await getGuardianChildren();
    if (children.isEmpty) {
      throw StateError('No children are linked to this guardian account.');
    }

    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => throw const NotFoundAppException(
        'This child is not linked to your guardian account.',
      ),
    );

    return getChildProfileForChild(child);
  }

  Future<ChildProfile> getChildProfileForChild(GuardianChild child) async {
    final data = await _getMap(
      '/mobile/students/${child.id}/profile',
      cacheKey: 'parent_profile_${child.id}',
    );
    final profile = data['profile'] as Map<String, dynamic>? ?? const {};
    final emergencyContact =
        profile['emergencyContact'] as Map<String, dynamic>?;
    final medicalSummary =
        profile['medicalSummary'] as Map<String, dynamic>? ?? const {};
    final privacy = profile['privacy'] as Map<String, dynamic>? ?? const {};
    final studentSystemId = profile['studentSystemId'] as String?;
    final admissionNumber = profile['admissionNumber'] as String?;
    final healthNote = _joinNonEmpty([
      medicalSummary['medicalConditions'] as String?,
      medicalSummary['severeAllergies'] as String?,
      medicalSummary['specialNeeds'] as String?,
    ]);

    return ChildProfile(
      child: child,
      classTeacher: 'Open timetable for teacher names by period.',
      guardianSummary:
          '${child.relationship} access verified for ${child.name}.',
      canViewGuardianSummary: true,
      attendanceSummary: 'Open attendance for the latest monthly summary.',
      homeworkSummary: 'Homework is synced from the school mobile API.',
      feesSummary: 'Fee summary is synced from the school mobile API.',
      qrLabel: studentSystemId != null && studentSystemId.isNotEmpty
          ? 'Student ID $studentSystemId is verified for guardian access.'
          : 'Student identity is verified for guardian access.',
      studentSystemId: studentSystemId,
      admissionNumber: admissionNumber,
      admissionDate: profile['admissionDate'] as String?,
      dateOfBirth: profile['dateOfBirth'] as String?,
      gender: profile['gender'] as String?,
      bloodGroup: profile['bloodGroup'] as String?,
      nationality: profile['nationality'] as String?,
      lifecycleStatus: profile['lifecycleStatus'] as String?,
      photoUsageConsent: privacy['photoUsageConsent'] as bool? ?? false,
      dataProcessingConsent: privacy['dataProcessingConsent'] as bool? ?? false,
      healthWarning: healthNote ?? emergencyContact?['name'] as String?,
      canViewHealthWarning:
          (medicalSummary['hasMedicalConsent'] as bool? ?? false) &&
          healthNote != null,
    );
  }

  Future<ParentDashboardSummary> getParentDashboardSummary(
    String childId,
  ) async {
    final children = await getGuardianChildren();
    if (children.isEmpty) {
      throw StateError('No children are linked to this guardian account.');
    }

    final child = children.firstWhere(
      (item) => item.id == childId,
      orElse: () => throw const NotFoundAppException(
        'This child is not linked to your guardian account.',
      ),
    );

    return getParentDashboardSummaryForChild(child);
  }

  Future<ParentDashboardSummary> getParentDashboardSummaryForChild(
    GuardianChild child,
  ) async {
    final data = await _getMap(
      '/mobile/me/dashboard',
      queryParameters: {'studentId': child.id},
      cacheKey: 'parent_dashboard_${child.id}',
    );

    return ParentDashboardSummary.fromMobileDashboard(data, child);
  }

  Future<List<ParentHomeworkItem>> getHomeworkForChild(
    String childId, {
    int take = 30,
  }) async {
    final data = await _getMap(
      '/mobile/students/$childId/homework',
      queryParameters: {'take': '$take'},
      cacheKey: 'parent_homework_${childId}_$take',
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentHomeworkItem.fromJson)
        .toList();
  }

  Future<ParentTimetable> getTimetableForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/timetable');
    final data = response.data as Map<String, dynamic>;
    return ParentTimetable.fromJson(data);
  }

  Future<List<ParentReportCard>> getReportCardsForChild(String childId) async {
    final response = await _client.get(
      '/mobile/students/$childId/report-cards',
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentReportCard.fromJson)
        .toList();
  }

  Future<List<ParentActivityItem>> getActivityFeedForChild(
    String childId, {
    int take = 20,
  }) async {
    final response = await _client.get(
      '/mobile/students/$childId/activity-feed',
      queryParameters: {'take': '$take'},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentActivityItem.fromJson)
        .toList();
  }

  Future<ParentTransportInfo> getTransportForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/transport');
    final data = response.data as Map<String, dynamic>;
    return ParentTransportInfo.fromJson(data);
  }

  Future<ParentCanteenInfo> getCanteenForChild(String childId) async {
    final response = await _client.get('/mobile/students/$childId/canteen');
    final data = response.data as Map<String, dynamic>;
    return ParentCanteenInfo.fromJson(data);
  }

  Future<ParentReceiptPdfDownload> downloadReceiptPdf({
    required String childId,
    required ParentFeeReceipt receipt,
  }) async {
    final response = await _client.get<List<int>>(
      '/mobile/students/$childId/receipts/${Uri.encodeComponent(receipt.receiptNumber)}.pdf',
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: 'application/pdf'},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Receipt PDF was empty.');
    }

    final temporaryDir = await getTemporaryDirectory();
    final receiptDir = Directory('${temporaryDir.path}/schoolos/receipts');
    if (!receiptDir.existsSync()) {
      await receiptDir.create(recursive: true);
    }

    final fileName = '${_safeFileName(receipt.receiptNumber)}.pdf';
    final file = File('${receiptDir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);

    return ParentReceiptPdfDownload(
      fileName: fileName,
      filePath: file.path,
      receipt: receipt,
    );
  }

  Future<ParentTeacherThreadPage> getParentTeacherThreads({
    String? childId,
  }) async {
    final response = await _client.get(
      '/messaging/parent-teacher/threads',
      queryParameters: {
        if (childId != null && childId.isNotEmpty) 'studentId': childId,
        'limit': '25',
      },
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherThreadPage.fromJson(data);
  }

  Future<ParentTeacherThread> openParentTeacherThread(String childId) async {
    final response = await _client.post(
      '/messaging/parent-teacher/threads',
      data: {'studentId': childId},
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherThread.fromJson(
      data['thread'] as Map<String, dynamic>? ?? const {},
    );
  }

  Future<List<ParentTeacherMessage>> getParentTeacherMessages(
    String threadId,
  ) async {
    final response = await _client.get(
      '/messaging/parent-teacher/threads/$threadId/messages',
      queryParameters: {'limit': '50'},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentTeacherMessage.fromJson)
        .toList();
  }

  Future<ParentTeacherSendResult> sendParentTeacherMessage({
    required String threadId,
    required String message,
  }) async {
    final response = await _client.post(
      '/messaging/parent-teacher/threads/$threadId/messages',
      data: {'message': message},
    );
    final data = response.data as Map<String, dynamic>;
    return ParentTeacherSendResult.fromJson(data);
  }

  Future<void> markParentTeacherThreadRead(String threadId) async {
    await _client.patch('/messaging/parent-teacher/threads/$threadId/read');
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    required String cacheKey,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _client.get(
        path,
        queryParameters: queryParameters,
      );
      final data = Map<String, dynamic>.from(
        response.data as Map<String, dynamic>,
      );
      data['_mobileLastUpdated'] = DateTime.now().toIso8601String();
      await cache?.write(cacheKey, data);
      return data;
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      return cached.withMetadata();
    }
  }
}

String _safeFileName(String value) {
  final sanitized = value.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '-');
  return sanitized.isEmpty ? 'receipt' : sanitized;
}

String? _joinNonEmpty(List<String?> values) {
  final filtered = values
      .whereType<String>()
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList();

  if (filtered.isEmpty) {
    return null;
  }

  return filtered.join(' / ');
}
