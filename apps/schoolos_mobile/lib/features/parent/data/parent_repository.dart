import 'dart:io';
import 'dart:typed_data';

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
    final classTeacher =
        profile['classTeacher'] as Map<String, dynamic>? ?? const {};
    final studentSystemId = profile['studentSystemId'] as String?;
    final admissionNumber = profile['admissionNumber'] as String?;
    final documents = (profile['documents'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ParentStudentDocument.fromJson)
        .toList();
    final qrStatus = profile['qrStatus'] is Map<String, dynamic>
        ? ParentQrStatus.fromJson(profile['qrStatus'] as Map<String, dynamic>)
        : null;
    final healthNote = _joinNonEmpty([
      medicalSummary['medicalConditions'] as String?,
      medicalSummary['severeAllergies'] as String?,
      medicalSummary['specialNeeds'] as String?,
    ]);

    return ChildProfile(
      child: child,
      classTeacher:
          classTeacher['name'] as String? ?? 'Class teacher not assigned',
      classTeacherId: classTeacher['id'] as String?,
      guardianSummary:
          '${child.relationship} access verified for ${child.name}.',
      canViewGuardianSummary: true,
      attendanceSummary: 'Open attendance for the latest monthly summary.',
      homeworkSummary: 'Homework is synced from the school mobile API.',
      feesSummary: 'Fee summary is synced from the school mobile API.',
      qrLabel: _qrLabel(studentSystemId, qrStatus),
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
      documents: documents,
      qrStatus: qrStatus,
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
    final data = await _getMap(
      '/mobile/students/$childId/timetable',
      cacheKey: 'parent_timetable_$childId',
    );
    return ParentTimetable.fromJson(data);
  }

  Future<ParentExamSchedule> getExamScheduleForChild(String childId) async {
    final data = await _getMap(
      '/mobile/students/$childId/exam-schedule',
      cacheKey: 'parent_exam_schedule_$childId',
    );
    return ParentExamSchedule.fromJson(data);
  }

  Future<ParentPaymentGatewayReadiness> getPaymentGatewayReadiness(
    String childId,
  ) async {
    final response = await _client.get(
      '/mobile/students/$childId/payment-gateway-readiness',
    );
    return ParentPaymentGatewayReadiness.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<ParentPaymentIntent> initiatePayment({
    required String childId,
    required String invoiceId,
    required num amount,
    required String provider,
    required String idempotencyKey,
  }) async {
    final response = await _client.post(
      '/mobile/students/$childId/payment-intents',
      data: {
        'invoiceId': invoiceId,
        'amount': amount,
        'provider': provider,
        'idempotencyKey': idempotencyKey,
      },
    );
    return ParentPaymentIntent.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ParentSandboxPaymentResult> payInvoiceInSandbox({
    required String childId,
    required String invoiceId,
    required num amount,
    required String provider,
    required String idempotencyKey,
  }) async {
    final response = await _client.post(
      '/mobile/students/$childId/sandbox-payments/fees',
      data: {
        'invoiceId': invoiceId,
        'amount': amount,
        'provider': provider,
        'idempotencyKey': idempotencyKey,
      },
    );
    return ParentSandboxPaymentResult.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<ParentSandboxPaymentResult> topUpCanteenInSandbox({
    required String childId,
    required num amount,
    required String provider,
    required String idempotencyKey,
  }) async {
    final response = await _client.post(
      '/mobile/students/$childId/sandbox-payments/canteen-top-up',
      data: {
        'amount': amount,
        'provider': provider,
        'idempotencyKey': idempotencyKey,
      },
    );
    return ParentSandboxPaymentResult.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<List<ParentReportCard>> getReportCardsForChild(String childId) async {
    final data = await _getMap(
      '/mobile/students/$childId/report-cards',
      cacheKey: 'parent_report_cards_$childId',
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentReportCard.fromJson)
        .toList();
  }

  Future<List<ParentConsentStatus>> getMyConsentStatus() async {
    final response = await _client.get('/mobile/me/consents');
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentConsentStatus.fromJson)
        .toList();
  }

  Future<void> decideMyConsent({
    required String consentType,
    required String version,
    required bool granted,
  }) async {
    await _client.post(
      '/mobile/me/consents/decision',
      data: {
        'consentType': consentType,
        'version': version,
        'granted': granted,
      },
    );
  }

  Future<List<ParentHomeworkAttachment>> getHomeworkAttachments({
    required String childId,
    required String homeworkId,
  }) async {
    final response = await _client.get(
      '/mobile/students/$childId/homework/$homeworkId/attachments',
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentHomeworkAttachment.fromJson)
        .toList();
  }

  Future<ParentHomeworkAttachmentAccess> getHomeworkAttachmentDownloadAccess({
    required String childId,
    required String homeworkId,
    required String attachmentId,
  }) async {
    final response = await _client.get(
      '/mobile/students/$childId/homework/$homeworkId/attachments/$attachmentId/download-url',
    );
    final data = response.data as Map<String, dynamic>;
    return ParentHomeworkAttachmentAccess.fromJson(data);
  }

  Future<List<ParentActivityItem>> getActivityFeedForChild(
    String childId, {
    int take = 20,
    String? category,
    String? month,
  }) async {
    final cacheKey =
        'parent_activity_${childId}_${take}_${category ?? ''}_${month ?? ''}';
    final data = await _getMap(
      '/mobile/students/$childId/activity-feed',
      queryParameters: {
        'take': '$take',
        if (category != null && category.isNotEmpty) 'category': category,
        if (month != null && month.isNotEmpty) 'month': month,
      },
      cacheKey: cacheKey,
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentActivityItem.fromJson)
        .toList();
  }

  Future<void> submitActivityReaction({
    required String postId,
    required String guardianId,
    required String reaction,
  }) async {
    await _client.post<dynamic>(
      '/activity-feed/posts/${Uri.encodeComponent(postId)}/reactions',
      data: {'reaction': reaction, 'guardianId': guardianId},
    );
  }

  Future<List<ParentMilestone>> getMilestonesForChild(
    String childId, {
    String? month,
  }) async {
    const cacheKeyPrefix = 'parent_milestones_';
    final cacheKey = '$cacheKeyPrefix${childId}_${month ?? ''}';
    try {
      final response = await _client.get<dynamic>(
        '/activity-feed/milestones',
        queryParameters: {
          'studentId': childId,
          if (month != null && month.isNotEmpty) 'month': month,
        },
      );
      final items = response.data is List
          ? response.data as List<dynamic>
          : const <dynamic>[];
      await cache?.write(cacheKey, {'items': items});
      return items
          .whereType<Map<String, dynamic>>()
          .map(ParentMilestone.fromJson)
          .toList();
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      final cached = cache?.read(cacheKey);
      if (cached == null) rethrow;
      final items =
          cached.withMetadata()['items'] as List<dynamic>? ?? const [];
      return items
          .whereType<Map<String, dynamic>>()
          .map(ParentMilestone.fromJson)
          .toList();
    }
  }

  Future<Uint8List> getActivityPreview(String previewPath) async {
    if (!previewPath.startsWith('/activity-feed/attachments/')) {
      throw const ValidationException(
        message: 'Activity media is unavailable.',
      );
    }

    final response = await _client.dio.get<List<int>>(
      previewPath,
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const NotFoundAppException('Activity media is unavailable.');
    }
    return Uint8List.fromList(bytes);
  }

  Future<ParentTransportInfo> getTransportForChild(String childId) async {
    final data = await _getMap(
      '/mobile/students/$childId/transport',
      cacheKey: 'parent_transport_$childId',
    );
    return ParentTransportInfo.fromJson(data);
  }

  Future<ParentCanteenInfo> getCanteenForChild(String childId) async {
    final data = await _getMap(
      '/mobile/students/$childId/canteen',
      cacheKey: 'parent_canteen_$childId',
    );
    return ParentCanteenInfo.fromJson(data);
  }

  Future<ParentLibraryInfo> getLibraryForChild(String childId) async {
    final data = await _getMap(
      '/mobile/students/$childId/library',
      cacheKey: 'parent_library_$childId',
    );
    return ParentLibraryInfo.fromJson(data);
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

  Future<ParentProtectedFileDownload> downloadReportCardPdf({
    required String childId,
    required ParentReportCard reportCard,
  }) async {
    final response = await _client.get<List<int>>(
      '/mobile/students/$childId/report-cards/${reportCard.id}.pdf',
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: 'application/pdf'},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Report card PDF was empty.');
    }

    final temporaryDir = await getTemporaryDirectory();
    final reportCardDir = Directory(
      '${temporaryDir.path}/schoolos/report-cards',
    );
    if (!reportCardDir.existsSync()) {
      await reportCardDir.create(recursive: true);
    }

    final fileName = '${_safeFileName(reportCard.id)}.pdf';
    final file = File('${reportCardDir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);

    return ParentProtectedFileDownload(fileName: fileName, filePath: file.path);
  }

  Future<ParentProtectedFileDownload> downloadHomeworkAttachment({
    required String childId,
    required String homeworkId,
    required ParentHomeworkAttachment attachment,
  }) async {
    final access = await getHomeworkAttachmentDownloadAccess(
      childId: childId,
      homeworkId: homeworkId,
      attachmentId: attachment.id,
    );
    if (access.url.isEmpty) {
      throw StateError('Homework attachment download URL was empty.');
    }

    final response = await _client.dio.get<List<int>>(
      access.url,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: access.mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Homework attachment was empty.');
    }

    final temporaryDir = await getTemporaryDirectory();
    final attachmentDir = Directory(
      '${temporaryDir.path}/schoolos/homework-attachments',
    );
    if (!attachmentDir.existsSync()) {
      await attachmentDir.create(recursive: true);
    }

    final fileName = _safeFileName(access.fileName);
    final file = File('${attachmentDir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);

    return ParentProtectedFileDownload(fileName: fileName, filePath: file.path);
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

String _qrLabel(String? studentSystemId, ParentQrStatus? qrStatus) {
  if (qrStatus?.isActive ?? false) {
    return studentSystemId != null && studentSystemId.isNotEmpty
        ? 'Student QR is active for school-approved scans. ID $studentSystemId is verified for guardian access.'
        : 'Student QR is active for school-approved scans.';
  }

  return studentSystemId != null && studentSystemId.isNotEmpty
      ? 'Student ID $studentSystemId is verified for guardian access.'
      : 'Student identity is verified for guardian access.';
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
