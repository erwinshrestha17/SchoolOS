import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/private_read_cache.dart';
import '../domain/parent_models.dart';
import '../domain/parent_action_centre_models.dart';
import '../domain/parent_service_request_models.dart';
import '../domain/parent_weekly_progress_models.dart';
import '../../learning_support/domain/learning_support_models.dart';

class ParentRepository {
  ParentRepository(this._client, {this.cache});

  final ApiClient _client;
  final PrivateReadCache? cache;

  /// Downloads currently being written, keyed by their destination file.
  ///
  /// Every protected download writes to a path derived from the record id, so
  /// two overlapping downloads of the same record would interleave their bytes
  /// into one corrupt file. Screens guard their own buttons, but the invariant
  /// belongs here: this is the layer that owns the path. Callers that ask for
  /// a download already in flight join it instead of starting a second write.
  final Map<String, Future<Object>> _downloadsInFlight = {};

  Future<T> _singleFlightDownload<T extends Object>(
    String key,
    Future<T> Function() download,
  ) {
    final existing = _downloadsInFlight[key];
    if (existing is Future<T>) return existing;

    late final Future<T> pending;
    pending = download().whenComplete(() {
      if (identical(_downloadsInFlight[key], pending)) {
        _downloadsInFlight.remove(key);
      }
    });
    _downloadsInFlight[key] = pending;
    return pending;
  }

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

  Future<ParentActionCentre> getActionCentre({String? studentId}) async {
    // Deliberately uncached. The action centre combines current deadlines,
    // balances, acknowledgement state, and private school responses. Showing
    // an old snapshot as actionable would be unsafe.
    final response = await _client.get(
      '/mobile/me/action-centre',
      queryParameters: {
        if (studentId != null && studentId.trim().isNotEmpty)
          'studentId': studentId,
      },
    );
    return ParentActionCentre.fromJson(
      Map<String, dynamic>.from(response.data as Map<String, dynamic>),
    );
  }

  Future<ParentWeeklyProgress> getWeeklyProgress(String childId) async {
    // Deliberately uncached. The digest combines current attendance,
    // submissions, feedback, deadlines, and required actions. An old snapshot
    // must not be presented as a current weekly summary.
    final response = await _client.get(
      '/mobile/students/${Uri.encodeComponent(childId)}/weekly-progress',
    );
    return ParentWeeklyProgress.fromJson(
      Map<String, dynamic>.from(response.data as Map<String, dynamic>),
    );
  }

  Future<ParentLearningSupportSummary> getLearningSupport(
    String childId,
  ) async {
    // Current teacher-authored guidance and intervention updates are
    // deliberately online-only. An old snapshot must not be presented as the
    // child's current support plan.
    final response = await _client.get(
      '/mobile/students/${Uri.encodeComponent(childId)}/learning-summary',
    );
    return ParentLearningSupportSummary.fromJson(
      Map<String, dynamic>.from(response.data as Map<String, dynamic>),
    );
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
    // Deliberately uncached. This payload carries a minor's date of birth,
    // blood group, medical warnings and identity documents; the private-read
    // allowlist rejects `parent_profile_*` for exactly that reason, and
    // `private_read_cache_test.dart` pins it. Offline, the dashboard falls
    // back to its snapshot instead, which persists only the class-teacher
    // name out of all of this.
    final data = await _getMap('/mobile/students/${child.id}/profile');
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
      // Also what the Fees screen reads. Without a key it was the one call
      // that could not answer offline, so a guardian reaching Fees from an
      // otherwise-cached dashboard hit a connection error.
      cacheKey: 'parent_dashboard_summary_${child.id}',
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
        'confirmStudentId': childId,
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
        'confirmStudentId': childId,
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
        'confirmStudentId': childId,
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
    final data = await _getMap('/mobile/students/$childId/report-cards');
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
    required String childId,
    required String consentType,
    required String version,
    required bool granted,
  }) async {
    await _client.post(
      '/mobile/me/consents/decision',
      data: {
        'confirmStudentId': childId,
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
    final data = await _getMap(
      '/mobile/students/$childId/activity-feed',
      queryParameters: {
        'take': '$take',
        if (category != null && category.isNotEmpty) 'category': category,
        if (month != null && month.isNotEmpty) 'month': month,
      },
    );
    final items = data['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentActivityItem.fromJson)
        .toList();
  }

  Future<void> markActivitySeen({
    required String postId,
    required String guardianId,
  }) async {
    await _client.post<dynamic>(
      '/activity-feed/posts/${Uri.encodeComponent(postId)}/reactions',
      data: {'reaction': 'SEEN', 'guardianId': guardianId},
    );
  }

  Future<List<ParentMilestone>> getMilestonesForChild(
    String childId, {
    String? month,
  }) async {
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
    return items
        .whereType<Map<String, dynamic>>()
        .map(ParentMilestone.fromJson)
        .toList();
  }

  Future<Uint8List> getActivityPreview(String previewPath) async {
    if (!previewPath.startsWith('/activity-feed/attachments/')) {
      throw const ValidationException(
        message: 'Activity media is unavailable.',
      );
    }

    final response = await _client.get<List<int>>(
      previewPath,
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const NotFoundAppException('Activity media is unavailable.');
    }
    return Uint8List.fromList(bytes);
  }

  Future<Uint8List> getActivityThumbnail(String thumbnailPath) async {
    if (!thumbnailPath.startsWith('/activity-feed/attachments/') ||
        !thumbnailPath.endsWith('/thumbnail')) {
      throw const ValidationException(
        message: 'Activity thumbnail is unavailable.',
      );
    }

    final response = await _client.get<List<int>>(
      thumbnailPath,
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const NotFoundAppException('Activity thumbnail is unavailable.');
    }
    return Uint8List.fromList(bytes);
  }

  Future<ParentTransportInfo> getTransportForChild(String childId) async {
    final data = await _getMap('/mobile/students/$childId/transport');
    return ParentTransportInfo.fromJson(data);
  }

  Future<ParentCanteenInfo> getCanteenForChild(String childId) async {
    final data = await _getMap('/mobile/students/$childId/canteen');
    return ParentCanteenInfo.fromJson(data);
  }

  Future<ParentLibraryInfo> getLibraryForChild(String childId) async {
    final data = await _getMap('/mobile/students/$childId/library');
    return ParentLibraryInfo.fromJson(data);
  }

  Future<ParentServiceRequestList> getServiceRequestsForChild(
    String childId,
  ) async {
    // Complaint descriptions and evidence are intentionally not cached on the
    // device. The screen remains honest and read-only unavailable offline.
    final data = await _getMap('/mobile/students/$childId/service-requests');
    return ParentServiceRequestList.fromJson(data);
  }

  Future<ParentServiceRequest> createServiceRequest({
    required String childId,
    required String type,
    required String category,
    required String priority,
    required String subject,
    required String description,
    required String idempotencyKey,
    String? invoiceId,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/mobile/students/$childId/service-requests',
      data: {
        'confirmStudentId': childId,
        'type': type,
        'category': category,
        'priority': priority,
        'subject': subject,
        'description': description,
        'idempotencyKey': idempotencyKey,
        if (invoiceId != null && invoiceId.isNotEmpty) 'invoiceId': invoiceId,
      },
    );
    return ParentServiceRequest.fromJson(response.data ?? const {});
  }

  Future<ParentServiceRequest> cancelServiceRequest({
    required String requestId,
    required String reason,
  }) async {
    return _postServiceRequestAction(
      requestId,
      'cancel',
      data: {'reason': reason},
    );
  }

  Future<ParentServiceRequest> confirmServiceRequestResolution(
    String requestId,
  ) async {
    return _postServiceRequestAction(requestId, 'confirm-resolution');
  }

  Future<ParentServiceRequest> reopenServiceRequest({
    required String requestId,
    required String reason,
  }) async {
    return _postServiceRequestAction(
      requestId,
      'reopen',
      data: {'reason': reason},
    );
  }

  Future<ParentServiceRequest> uploadServiceRequestEvidence({
    required String requestId,
    required String fileName,
    required String contentType,
    required Uint8List content,
    String? label,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/mobile/service-requests/$requestId/attachments',
      data: {
        'fileName': fileName,
        'contentType': contentType,
        'base64Content': base64Encode(content),
        if (label != null && label.trim().isNotEmpty) 'label': label.trim(),
      },
    );
    return ParentServiceRequest.fromJson(response.data ?? const {});
  }

  Future<ParentProtectedFileDownload> downloadServiceRequestEvidence({
    required ParentServiceRequest request,
    required ParentServiceRequestAttachment attachment,
  }) {
    return _singleFlightDownload(
      'service-request:${request.id}:${attachment.id}',
      () => _downloadServiceRequestEvidence(
        request: request,
        attachment: attachment,
      ),
    );
  }

  Future<ParentProtectedFileDownload> _downloadServiceRequestEvidence({
    required ParentServiceRequest request,
    required ParentServiceRequestAttachment attachment,
  }) async {
    final expectedPath =
        '/mobile/service-requests/${request.id}/attachments/${attachment.id}';
    if (attachment.downloadPath != expectedPath) {
      throw const ValidationException(
        message: 'This request evidence is unavailable.',
      );
    }
    final response = await _client.get<List<int>>(
      expectedPath,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: attachment.mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const NotFoundAppException('This request evidence is unavailable.');
    }
    final fileName = _safeFileName(attachment.fileName);
    final file = await _protectedFile(
      'service-request-evidence',
      attachment.id,
      fileName,
    );
    await file.writeAsBytes(bytes, flush: true);
    return ParentProtectedFileDownload(fileName: fileName, filePath: file.path);
  }

  Future<ParentServiceRequest> _postServiceRequestAction(
    String requestId,
    String action, {
    Map<String, dynamic>? data,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/mobile/service-requests/$requestId/$action',
      data: data,
    );
    return ParentServiceRequest.fromJson(response.data ?? const {});
  }

  Future<ParentReceiptPdfDownload> downloadReceiptPdf({
    required String childId,
    required ParentFeeReceipt receipt,
  }) {
    return _singleFlightDownload(
      'receipt:$childId:${receipt.receiptNumber}',
      () => _downloadReceiptPdf(childId: childId, receipt: receipt),
    );
  }

  Future<ParentReceiptPdfDownload> _downloadReceiptPdf({
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
  }) {
    return _singleFlightDownload(
      'report-card:$childId:${reportCard.id}',
      () => _downloadReportCardPdf(childId: childId, reportCard: reportCard),
    );
  }

  Future<ParentProtectedFileDownload> _downloadReportCardPdf({
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

  Future<ParentProtectedFileDownload> downloadStudentDocument({
    required String childId,
    required ParentStudentDocument document,
  }) {
    return _singleFlightDownload(
      'student-document:$childId:${document.id}',
      () => _downloadStudentDocument(childId: childId, document: document),
    );
  }

  Future<ParentProtectedFileDownload> _downloadStudentDocument({
    required String childId,
    required ParentStudentDocument document,
  }) async {
    if (!document.hasProtectedDownload) {
      throw StateError('Student document download path was empty.');
    }

    final accessResponse = await _client.get(document.downloadPath);
    final accessData = accessResponse.data as Map<String, dynamic>? ?? const {};
    final url = accessData['url'] as String? ?? '';
    if (url.isEmpty) {
      throw StateError('Student document download URL was empty.');
    }

    final response = await _client.get<List<int>>(
      _client.toApiPath(
        url,
        unavailableMessage: 'This student document is unavailable.',
      ),
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: document.mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Student document was empty.');
    }

    final baseName = document.fileName.isNotEmpty
        ? document.fileName
        : document.title;
    final fileName = _safeFileName(baseName);
    // Scoped by record id: the display name alone is not unique, so two
    // different documents both called "birth.pdf" would otherwise share one
    // path and could be written concurrently.
    final file = await _protectedFile('documents', document.id, fileName);
    await file.writeAsBytes(bytes, flush: true);

    return ParentProtectedFileDownload(fileName: fileName, filePath: file.path);
  }

  Future<ParentProtectedFileDownload> downloadHomeworkAttachment({
    required String childId,
    required String homeworkId,
    required ParentHomeworkAttachment attachment,
  }) {
    return _singleFlightDownload(
      'homework-attachment:$childId:$homeworkId:${attachment.id}',
      () => _downloadHomeworkAttachment(
        childId: childId,
        homeworkId: homeworkId,
        attachment: attachment,
      ),
    );
  }

  Future<ParentProtectedFileDownload> _downloadHomeworkAttachment({
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

    final response = await _client.get<List<int>>(
      _client.toApiPath(
        access.url,
        unavailableMessage: 'This homework attachment is unavailable.',
      ),
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: access.mimeType},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Homework attachment was empty.');
    }

    final fileName = _safeFileName(access.fileName);
    final file = await _protectedFile(
      'homework-attachments',
      attachment.id,
      fileName,
    );
    await file.writeAsBytes(bytes, flush: true);

    return ParentProtectedFileDownload(fileName: fileName, filePath: file.path);
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    String? cacheKey,
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
      if (cacheKey != null) {
        await cache?.write(cacheKey, data);
      }
      return data;
    } on AppException catch (error) {
      if (error is! NetworkException && error is! TimeoutException) rethrow;
      if (cacheKey == null) rethrow;
      final cached = await cache?.read(cacheKey);
      if (cached == null) rethrow;
      return cached.withMetadata();
    }
  }
}

/// Resolves the on-disk location for a protected download.
///
/// The record id is part of the path, not just the display name, so two
/// records that happen to share a filename cannot collide - and cannot be
/// written concurrently, which [_singleFlightDownload] only prevents for
/// repeat requests of the *same* record.
Future<File> _protectedFile(
  String bucket,
  String recordId,
  String fileName,
) async {
  final temporaryDir = await getTemporaryDirectory();
  final directory = Directory(
    '${temporaryDir.path}/schoolos/$bucket/${_safeFileName(recordId)}',
  );
  if (!directory.existsSync()) {
    await directory.create(recursive: true);
  }
  return File('${directory.path}/$fileName');
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
