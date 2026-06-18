enum ParentDataStatus {
  loading,
  success,
  empty,
  error,
  offline,
  unauthorized,
  forbidden,
  moduleLocked,
  sessionExpired,
  timeout,
}

class GuardianChild {
  const GuardianChild({
    required this.id,
    required this.name,
    required this.classSection,
    required this.rollNumber,
    required this.academicYear,
    required this.relationship,
  });

  final String id;
  final String name;
  final String classSection;
  final String rollNumber;
  final String academicYear;
  final String relationship;

  factory GuardianChild.fromJson(Map<String, dynamic> json) {
    return GuardianChild(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Student',
      classSection: json['classSection'] as String? ?? '',
      rollNumber: json['rollNumber'] as String? ?? '',
      academicYear: json['academicYear'] as String? ?? '',
      relationship: json['relationship'] as String? ?? 'Child',
    );
  }
}

class ChildProfile {
  const ChildProfile({
    required this.child,
    required this.classTeacher,
    required this.guardianSummary,
    required this.canViewGuardianSummary,
    required this.attendanceSummary,
    required this.homeworkSummary,
    required this.feesSummary,
    required this.qrLabel,
    this.studentSystemId,
    this.admissionNumber,
    this.admissionDate,
    this.dateOfBirth,
    this.gender,
    this.bloodGroup,
    this.nationality,
    this.lifecycleStatus,
    this.photoUsageConsent = false,
    this.dataProcessingConsent = false,
    this.healthWarning,
    this.canViewHealthWarning = false,
  });

  final GuardianChild child;
  final String classTeacher;
  final String guardianSummary;
  final bool canViewGuardianSummary;
  final String attendanceSummary;
  final String homeworkSummary;
  final String feesSummary;
  final String qrLabel;
  final String? studentSystemId;
  final String? admissionNumber;
  final String? admissionDate;
  final String? dateOfBirth;
  final String? gender;
  final String? bloodGroup;
  final String? nationality;
  final String? lifecycleStatus;
  final bool photoUsageConsent;
  final bool dataProcessingConsent;
  final String? healthWarning;
  final bool canViewHealthWarning;
}

class ParentDashboardSummary {
  const ParentDashboardSummary({
    required this.child,
    required this.attendanceToday,
    required this.homeworkPending,
    this.nextHomeworkDueAt,
    required this.feesDue,
    required this.overdueFeesCount,
    this.nextFeeDueDate,
    this.recentInvoices = const [],
    this.recentReceipts = const [],
    required this.unreadNotices,
    required this.transportStatus,
    this.transportDetail,
    required this.canteenBalance,
    required this.canteenIsLowBalance,
    required this.latestActivity,
    this.latestActivityTitle,
    required this.lastUpdated,
    this.attendanceEnabled = true,
    this.feesEnabled = true,
    this.homeworkEnabled = true,
    this.activityEnabled = true,
    this.transportEnabled = true,
    this.canteenEnabled = true,
    this.fromCache = false,
  });

  final GuardianChild child;
  final String attendanceToday;
  final int homeworkPending;
  final String? nextHomeworkDueAt;
  final num feesDue;
  final int overdueFeesCount;
  final String? nextFeeDueDate;
  final List<ParentFeeInvoice> recentInvoices;
  final List<ParentFeeReceipt> recentReceipts;
  final int unreadNotices;
  final String transportStatus;
  final String? transportDetail;
  final num canteenBalance;
  final bool canteenIsLowBalance;
  final String latestActivity;
  final String? latestActivityTitle;
  final DateTime lastUpdated;
  final bool attendanceEnabled;
  final bool feesEnabled;
  final bool homeworkEnabled;
  final bool activityEnabled;
  final bool transportEnabled;
  final bool canteenEnabled;
  final bool fromCache;

  factory ParentDashboardSummary.fromMobileDashboard(
    Map<String, dynamic> json,
    GuardianChild fallbackChild,
  ) {
    final selectedStudent = _asMap(json['selectedStudent']);
    final child = selectedStudent == null
        ? fallbackChild
        : GuardianChild.fromJson(selectedStudent);
    final attendance = _asMap(json['attendance']);
    final attendanceToday =
        _asMap(attendance?['today'])?['label'] as String? ??
        _formatAttendancePercent(attendance);
    final homework = _asMap(json['homework']);
    final fees = _asMap(json['fees']);
    final notices = _asMap(json['notices']);
    final transport = _asMap(json['transport']);
    final canteen = _asMap(json['canteen']);
    final wallet = _asMap(canteen?['wallet']);
    final latestActivity = _asMap(json['latestActivity']);
    final modules = _asMap(json['modules']);
    final recentInvoices = (_asList(fees?['recentInvoices']))
        .whereType<Map<String, dynamic>>()
        .map(ParentFeeInvoice.fromJson)
        .toList();
    final recentReceipts = (_asList(fees?['recentReceipts']))
        .whereType<Map<String, dynamic>>()
        .map(ParentFeeReceipt.fromJson)
        .toList();

    return ParentDashboardSummary(
      child: child,
      attendanceToday: attendanceToday,
      homeworkPending: _asInt(homework?['pendingCount']),
      nextHomeworkDueAt: homework?['nextDueAt'] as String?,
      feesDue: _asNum(fees?['totalOutstanding']),
      overdueFeesCount: _asInt(fees?['overdueCount']),
      nextFeeDueDate: fees?['nextDueDate'] as String?,
      recentInvoices: recentInvoices,
      recentReceipts: recentReceipts,
      unreadNotices: _asInt(notices?['unreadCount']),
      transportStatus: _formatTransportStatus(transport),
      transportDetail: _formatTransportDetail(transport),
      canteenBalance: _asNum(wallet?['balance']),
      canteenIsLowBalance: wallet?['isLowBalance'] as bool? ?? false,
      latestActivity:
          latestActivity?['caption'] as String? ?? 'No activity yet.',
      latestActivityTitle: latestActivity?['title'] as String?,
      lastUpdated:
          DateTime.tryParse(json['_mobileLastUpdated'] as String? ?? '') ??
          DateTime.now(),
      attendanceEnabled: modules?['attendance'] as bool? ?? true,
      feesEnabled: modules?['fees'] as bool? ?? true,
      homeworkEnabled: modules?['homework'] as bool? ?? true,
      activityEnabled: modules?['activity'] as bool? ?? true,
      transportEnabled: modules?['transport'] as bool? ?? true,
      canteenEnabled: modules?['canteen'] as bool? ?? true,
      fromCache: json['_mobileFromCache'] as bool? ?? false,
    );
  }
}

class ParentFeeInvoice {
  const ParentFeeInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.status,
    this.dueDate,
    required this.totalAmount,
    required this.paidAmount,
    required this.outstandingAmount,
    required this.isOverdue,
    this.receipts = const [],
  });

  final String id;
  final String invoiceNumber;
  final String status;
  final String? dueDate;
  final num totalAmount;
  final num paidAmount;
  final num outstandingAmount;
  final bool isOverdue;
  final List<ParentFeeReceipt> receipts;

  factory ParentFeeInvoice.fromJson(Map<String, dynamic> json) {
    return ParentFeeInvoice(
      id: json['id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? 'Invoice',
      status: json['status'] as String? ?? 'ISSUED',
      dueDate: json['dueDate'] as String?,
      totalAmount: _asNum(json['totalAmount']),
      paidAmount: _asNum(json['paidAmount']),
      outstandingAmount: _asNum(json['outstandingAmount']),
      isOverdue: json['isOverdue'] as bool? ?? false,
      receipts: _asList(json['receipts'])
          .whereType<Map<String, dynamic>>()
          .map(ParentFeeReceipt.fromJson)
          .toList(),
    );
  }
}

class ParentFeeReceipt {
  const ParentFeeReceipt({
    required this.id,
    required this.receiptNumber,
    required this.invoiceId,
    required this.invoiceNumber,
    required this.paymentId,
    required this.amount,
    required this.method,
    this.paidAt,
    this.issuedAt,
  });

  final String id;
  final String receiptNumber;
  final String invoiceId;
  final String invoiceNumber;
  final String paymentId;
  final num amount;
  final String method;
  final String? paidAt;
  final String? issuedAt;

  factory ParentFeeReceipt.fromJson(Map<String, dynamic> json) {
    return ParentFeeReceipt(
      id: json['id'] as String? ?? '',
      receiptNumber: json['receiptNumber'] as String? ?? 'Receipt',
      invoiceId: json['invoiceId'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? 'Invoice',
      paymentId: json['paymentId'] as String? ?? '',
      amount: _asNum(json['amount']),
      method: json['method'] as String? ?? 'PAYMENT',
      paidAt: json['paidAt'] as String?,
      issuedAt: json['issuedAt'] as String?,
    );
  }
}

class ParentReceiptPdfDownload {
  const ParentReceiptPdfDownload({
    required this.fileName,
    required this.filePath,
    required this.receipt,
  });

  final String fileName;
  final String filePath;
  final ParentFeeReceipt receipt;
}

class ParentHomeworkItem {
  const ParentHomeworkItem({
    required this.id,
    required this.title,
    required this.subjectName,
    required this.submissionStatus,
    this.status,
    this.dueAt,
    this.dueDate,
    this.submittedAt,
    this.feedback,
    this.score,
    required this.attachmentCount,
  });

  final String id;
  final String title;
  final String subjectName;
  final String submissionStatus;
  final String? status;
  final String? dueAt;
  final String? dueDate;
  final String? submittedAt;
  final String? feedback;
  final num? score;
  final int attachmentCount;

  bool get isPending {
    return submissionStatus == 'NOT_SUBMITTED' ||
        submissionStatus == 'NEEDS_CORRECTION';
  }

  factory ParentHomeworkItem.fromJson(Map<String, dynamic> json) {
    final subject = _asMap(json['subject']);
    return ParentHomeworkItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Homework',
      subjectName: subject?['name'] as String? ?? 'Subject',
      submissionStatus: json['submissionStatus'] as String? ?? 'NOT_SUBMITTED',
      status: json['status'] as String?,
      dueAt: json['dueAt'] as String?,
      dueDate: json['dueDate'] as String?,
      submittedAt: json['submittedAt'] as String?,
      feedback: json['feedback'] as String?,
      score: json['score'] as num?,
      attachmentCount: _asInt(json['attachmentCount']),
    );
  }
}

class ParentTimetable {
  const ParentTimetable({this.versionName, this.status, this.slots = const []});

  final String? versionName;
  final String? status;
  final List<ParentTimetableSlot> slots;

  factory ParentTimetable.fromJson(Map<String, dynamic> json) {
    final version = _asMap(json['version']);
    final slots = _asList(json['slots'])
        .whereType<Map<String, dynamic>>()
        .map(ParentTimetableSlot.fromJson)
        .toList();

    return ParentTimetable(
      versionName: version?['name'] as String?,
      status: version?['status'] as String?,
      slots: slots,
    );
  }
}

class ParentTimetableSlot {
  const ParentTimetableSlot({
    required this.id,
    required this.dayOfWeek,
    required this.startsAt,
    required this.endsAt,
    required this.subjectName,
    required this.teacherName,
    this.periodName,
    this.room,
  });

  final String id;
  final int dayOfWeek;
  final String startsAt;
  final String endsAt;
  final String subjectName;
  final String teacherName;
  final String? periodName;
  final String? room;

  factory ParentTimetableSlot.fromJson(Map<String, dynamic> json) {
    final subject = _asMap(json['subject']);
    final period = _asMap(json['period']);

    return ParentTimetableSlot(
      id: json['id'] as String? ?? '',
      dayOfWeek: _asInt(json['dayOfWeek']),
      startsAt: json['startsAt'] as String? ?? '',
      endsAt: json['endsAt'] as String? ?? '',
      subjectName: subject?['name'] as String? ?? 'Subject',
      teacherName: json['teacherName'] as String? ?? 'Teacher',
      periodName: period?['name'] as String?,
      room: json['room'] as String?,
    );
  }
}

class ParentReportCard {
  const ParentReportCard({
    required this.id,
    required this.examTerm,
    required this.academicYear,
    required this.percentage,
    required this.grade,
    this.gpa,
    this.remarks,
    this.publishedAt,
    required this.hasFile,
  });

  final String id;
  final String examTerm;
  final String academicYear;
  final num percentage;
  final String grade;
  final num? gpa;
  final String? remarks;
  final String? publishedAt;
  final bool hasFile;

  factory ParentReportCard.fromJson(Map<String, dynamic> json) {
    final academicYear = _asMap(json['academicYear']);
    final examTerm = _asMap(json['examTerm']);

    return ParentReportCard(
      id: json['id'] as String? ?? '',
      examTerm: examTerm?['name'] as String? ?? 'Report card',
      academicYear: academicYear?['name'] as String? ?? '',
      percentage: _asNum(json['percentage']),
      grade: json['grade'] as String? ?? '-',
      gpa: json['gpa'] as num?,
      remarks: json['remarks'] as String?,
      publishedAt: json['publishedAt'] as String?,
      hasFile: json['hasFile'] as bool? ?? false,
    );
  }
}

class ParentConsentStatus {
  const ParentConsentStatus({
    required this.consentType,
    required this.granted,
    this.version,
    this.capturedAt,
    this.revokedAt,
  });

  final String consentType;
  final bool granted;
  final String? version;
  final String? capturedAt;
  final String? revokedAt;

  factory ParentConsentStatus.fromJson(Map<String, dynamic> json) {
    return ParentConsentStatus(
      consentType: json['consentType'] as String? ?? '',
      granted: json['granted'] as bool? ?? false,
      version: json['version'] as String?,
      capturedAt: json['capturedAt'] as String?,
      revokedAt: json['revokedAt'] as String?,
    );
  }
}

class ParentHomeworkAttachment {
  const ParentHomeworkAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    this.createdAt,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String? createdAt;

  factory ParentHomeworkAttachment.fromJson(Map<String, dynamic> json) {
    return ParentHomeworkAttachment(
      id: json['id'] as String? ?? '',
      fileName: json['fileName'] as String? ?? 'Attachment',
      mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      sizeBytes: _asInt(json['sizeBytes']),
      createdAt: json['createdAt'] as String?,
    );
  }
}

class ParentHomeworkAttachmentAccess {
  const ParentHomeworkAttachmentAccess({
    required this.attachmentId,
    required this.fileName,
    required this.mimeType,
    required this.url,
    required this.expiresInSeconds,
  });

  final String attachmentId;
  final String fileName;
  final String mimeType;
  final String url;
  final int expiresInSeconds;

  factory ParentHomeworkAttachmentAccess.fromJson(Map<String, dynamic> json) {
    return ParentHomeworkAttachmentAccess(
      attachmentId: json['attachmentId'] as String? ?? '',
      fileName: json['fileName'] as String? ?? 'Attachment',
      mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      url: json['url'] as String? ?? '',
      expiresInSeconds: _asInt(json['expiresInSeconds']),
    );
  }
}

class ParentProtectedFileDownload {
  const ParentProtectedFileDownload({
    required this.fileName,
    required this.filePath,
  });

  final String fileName;
  final String filePath;
}

class ParentActivityItem {
  const ParentActivityItem({
    required this.id,
    required this.title,
    required this.caption,
    required this.category,
    this.publishedAt,
    required this.attachmentCount,
    required this.reactionCount,
  });

  final String id;
  final String title;
  final String caption;
  final String category;
  final String? publishedAt;
  final int attachmentCount;
  final int reactionCount;

  factory ParentActivityItem.fromJson(Map<String, dynamic> json) {
    return ParentActivityItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Activity',
      caption: json['caption'] as String? ?? '',
      category: json['category'] as String? ?? 'SCHOOL',
      publishedAt: json['publishedAt'] as String?,
      attachmentCount: _asInt(json['attachmentCount']),
      reactionCount: _asInt(json['reactionCount']),
    );
  }
}

class ParentTransportInfo {
  const ParentTransportInfo({
    this.routeName,
    this.routeCode,
    this.stopName,
    this.stopSequence,
    this.vehicleLabel,
    this.vehicleModel,
    this.vehicleCapacity,
    this.tripStatus,
    this.tripDirection,
    this.studentStatus,
    this.latestLocationAt,
    this.latitude,
    this.longitude,
    this.speedKph,
    this.isDelayed = false,
    this.delayMinutes = 0,
    this.delayReason,
    this.assignmentStatus,
    this.enrollmentStatus,
    this.pickupDirection,
    this.feeAmount,
  });

  final String? routeName;
  final String? routeCode;
  final String? stopName;
  final int? stopSequence;
  final String? vehicleLabel;
  final String? vehicleModel;
  final int? vehicleCapacity;
  final String? tripStatus;
  final String? tripDirection;
  final String? studentStatus;
  final String? latestLocationAt;
  final num? latitude;
  final num? longitude;
  final num? speedKph;
  final bool isDelayed;
  final int delayMinutes;
  final String? delayReason;
  final String? assignmentStatus;
  final String? enrollmentStatus;
  final String? pickupDirection;
  final num? feeAmount;

  bool get hasActiveTrip => tripStatus != null;
  bool get hasRoute => routeName != null || routeCode != null;
  bool get hasLatestLocation => latestLocationAt != null;

  factory ParentTransportInfo.fromJson(Map<String, dynamic> json) {
    final activeTrip = _asMap(json['activeTrip']);
    final assignment = _asMap(json['assignment']);
    final enrollment = _asMap(json['enrollment']);
    final route =
        _asMap(activeTrip?['route']) ??
        _asMap(assignment?['route']) ??
        _asMap(enrollment?['route']);
    final stop =
        _asMap(activeTrip?['stop']) ??
        _asMap(assignment?['stop']) ??
        _asMap(enrollment?['stop']);
    final vehicle = _asMap(activeTrip?['vehicle']);
    final latestLocation = _asMap(activeTrip?['latestLocation']);

    return ParentTransportInfo(
      routeName: route?['name'] as String?,
      routeCode: route?['code'] as String?,
      stopName: stop?['name'] as String?,
      stopSequence: _asNullableInt(stop?['sequence']),
      vehicleLabel:
          vehicle?['registrationNumber'] as String? ??
          vehicle?['model'] as String?,
      vehicleModel: vehicle?['model'] as String?,
      vehicleCapacity: _asNullableInt(vehicle?['capacity']),
      tripStatus: activeTrip?['status'] as String?,
      tripDirection: activeTrip?['direction'] as String?,
      studentStatus: activeTrip?['studentStatus'] as String?,
      latestLocationAt: latestLocation?['recordedAt'] as String?,
      latitude: _asNullableNum(latestLocation?['latitude']),
      longitude: _asNullableNum(latestLocation?['longitude']),
      speedKph: _asNullableNum(latestLocation?['speedKph']),
      isDelayed: activeTrip?['isDelayed'] as bool? ?? false,
      delayMinutes: _asInt(activeTrip?['delayMinutes']),
      delayReason: activeTrip?['delayReason'] as String?,
      assignmentStatus: assignment?['status'] as String?,
      enrollmentStatus: enrollment?['status'] as String?,
      pickupDirection: assignment?['pickupDirection'] as String?,
      feeAmount: _asNullableNum(enrollment?['feeAmount']),
    );
  }
}

class ParentCanteenInfo {
  const ParentCanteenInfo({
    this.walletBalance,
    this.lowBalanceThreshold,
    this.isLowBalance = false,
    this.activeMealPlans = const [],
    this.recentTransactions = const [],
    this.menuItems = const [],
  });

  final num? walletBalance;
  final num? lowBalanceThreshold;
  final bool isLowBalance;
  final List<ParentMealPlan> activeMealPlans;
  final List<ParentCanteenTransaction> recentTransactions;
  final List<ParentMenuItem> menuItems;

  factory ParentCanteenInfo.fromJson(Map<String, dynamic> json) {
    final wallet = _asMap(json['wallet']);
    return ParentCanteenInfo(
      walletBalance: wallet == null ? null : _asNum(wallet['balance']),
      lowBalanceThreshold: wallet == null
          ? null
          : _asNum(wallet['lowBalanceThreshold']),
      isLowBalance: wallet?['isLowBalance'] as bool? ?? false,
      activeMealPlans: _asList(
        json['activeMealPlans'],
      ).whereType<Map<String, dynamic>>().map(ParentMealPlan.fromJson).toList(),
      recentTransactions: _asList(json['recentTransactions'])
          .whereType<Map<String, dynamic>>()
          .map(ParentCanteenTransaction.fromJson)
          .toList(),
      menuItems: _asList(
        json['menuItems'],
      ).whereType<Map<String, dynamic>>().map(ParentMenuItem.fromJson).toList(),
    );
  }
}

class ParentLibraryInfo {
  const ParentLibraryInfo({
    this.activeIssues = const [],
    this.recentHistory = const [],
    this.fines = const [],
  });

  final List<ParentLibraryIssue> activeIssues;
  final List<ParentLibraryIssue> recentHistory;
  final List<ParentLibraryFine> fines;

  factory ParentLibraryInfo.fromJson(Map<String, dynamic> json) {
    return ParentLibraryInfo(
      activeIssues: _asList(json['activeIssues'])
          .whereType<Map<String, dynamic>>()
          .map(ParentLibraryIssue.fromJson)
          .toList(),
      recentHistory: _asList(json['recentHistory'])
          .whereType<Map<String, dynamic>>()
          .map(ParentLibraryIssue.fromJson)
          .toList(),
      fines: _asList(json['fines'])
          .whereType<Map<String, dynamic>>()
          .map(ParentLibraryFine.fromJson)
          .toList(),
    );
  }
}

class ParentLibraryIssue {
  const ParentLibraryIssue({
    required this.id,
    required this.status,
    required this.bookTitle,
    this.author,
    this.barcode,
    this.shelfLocation,
    this.issuedAt,
    this.dueAt,
    this.returnedAt,
    this.fineAmount = 0,
  });

  final String id;
  final String status;
  final String bookTitle;
  final String? author;
  final String? barcode;
  final String? shelfLocation;
  final String? issuedAt;
  final String? dueAt;
  final String? returnedAt;
  final num fineAmount;

  bool get isOverdue => status == 'OVERDUE';

  factory ParentLibraryIssue.fromJson(Map<String, dynamic> json) {
    final book = _asMap(json['book']);
    final copy = _asMap(json['copy']);
    return ParentLibraryIssue(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'ISSUED',
      bookTitle: book?['title'] as String? ?? 'Library book',
      author: book?['author'] as String?,
      barcode: copy?['barcode'] as String?,
      shelfLocation: copy?['shelfLocation'] as String?,
      issuedAt: json['issuedAt'] as String?,
      dueAt: json['dueAt'] as String?,
      returnedAt: json['returnedAt'] as String?,
      fineAmount: _asNum(json['fineAmount']),
    );
  }
}

class ParentLibraryFine {
  const ParentLibraryFine({
    required this.id,
    required this.status,
    required this.amount,
    required this.waivedAmount,
    this.feeInvoiceId,
  });

  final String id;
  final String status;
  final num amount;
  final num waivedAmount;
  final String? feeInvoiceId;

  num get outstandingAmount => amount - waivedAmount;

  factory ParentLibraryFine.fromJson(Map<String, dynamic> json) {
    return ParentLibraryFine(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      amount: _asNum(json['amount']),
      waivedAmount: _asNum(json['waivedAmount']),
      feeInvoiceId: json['feeInvoiceId'] as String?,
    );
  }
}

class ParentMealPlan {
  const ParentMealPlan({required this.name, required this.mealType});

  final String name;
  final String mealType;

  factory ParentMealPlan.fromJson(Map<String, dynamic> json) {
    final mealPlan = _asMap(json['mealPlan']);
    return ParentMealPlan(
      name: mealPlan?['name'] as String? ?? 'Meal plan',
      mealType: mealPlan?['mealType'] as String? ?? '',
    );
  }
}

class ParentCanteenTransaction {
  const ParentCanteenTransaction({
    required this.type,
    required this.amount,
    required this.balanceAfter,
    this.transactionDate,
    this.note,
  });

  final String type;
  final num amount;
  final num balanceAfter;
  final String? transactionDate;
  final String? note;

  factory ParentCanteenTransaction.fromJson(Map<String, dynamic> json) {
    return ParentCanteenTransaction(
      type: json['type'] as String? ?? 'TRANSACTION',
      amount: _asNum(json['amount']),
      balanceAfter: _asNum(json['balanceAfter']),
      transactionDate: json['transactionDate'] as String?,
      note: json['note'] as String?,
    );
  }
}

class ParentMenuItem {
  const ParentMenuItem({
    required this.name,
    required this.category,
    required this.unitPrice,
    required this.allergenTags,
  });

  final String name;
  final String category;
  final num unitPrice;
  final List<String> allergenTags;

  factory ParentMenuItem.fromJson(Map<String, dynamic> json) {
    return ParentMenuItem(
      name: json['name'] as String? ?? 'Menu item',
      category: json['category'] as String? ?? 'CANTEEN',
      unitPrice: _asNum(json['unitPrice']),
      allergenTags: _asList(json['allergenTags']).whereType<String>().toList(),
    );
  }
}

class ParentTeacherThreadPage {
  const ParentTeacherThreadPage({required this.items, required this.total});

  final List<ParentTeacherThread> items;
  final int total;

  factory ParentTeacherThreadPage.fromJson(Map<String, dynamic> json) {
    return ParentTeacherThreadPage(
      items: _asList(json['items'])
          .whereType<Map<String, dynamic>>()
          .map(ParentTeacherThread.fromJson)
          .toList(),
      total: _asInt(json['total']),
    );
  }
}

class ParentTeacherThread {
  const ParentTeacherThread({
    required this.id,
    required this.status,
    required this.studentId,
    required this.studentName,
    required this.classSection,
    required this.teacherName,
    required this.sla,
    this.updatedAt,
    this.latestMessages = const [],
  });

  final String id;
  final String status;
  final String studentId;
  final String studentName;
  final String classSection;
  final String teacherName;
  final String sla;
  final String? updatedAt;
  final List<ParentTeacherMessage> latestMessages;

  bool get isClosed => status == 'CLOSED';

  ParentTeacherMessage? get latestMessage =>
      latestMessages.isEmpty ? null : latestMessages.first;

  factory ParentTeacherThread.fromJson(Map<String, dynamic> json) {
    final student = _asMap(json['student']);
    final teacher = _asMap(json['classTeacher']);
    final className = _asMap(student?['class'])?['name'] as String?;
    final sectionName = _asMap(student?['sectionRef'])?['name'] as String?;

    return ParentTeacherThread(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      studentId: json['studentId'] as String? ?? '',
      studentName:
          _personName(
            student,
            firstKey: 'firstNameEn',
            lastKey: 'lastNameEn',
          ) ??
          'Student',
      classSection: [
        className,
        sectionName,
      ].whereType<String>().where((part) => part.isNotEmpty).join(' - '),
      teacherName:
          _personName(teacher, firstKey: 'firstName', lastKey: 'lastName') ??
          'Class teacher',
      sla: json['sla'] as String? ?? 'Usually replies within 1 school day.',
      updatedAt: json['updatedAt'] as String?,
      latestMessages: _asList(json['latestMessages'])
          .whereType<Map<String, dynamic>>()
          .map(ParentTeacherMessage.fromJson)
          .toList(),
    );
  }
}

class ParentTeacherMessage {
  const ParentTeacherMessage({
    required this.id,
    required this.threadId,
    required this.senderUserId,
    required this.senderRole,
    required this.message,
    required this.priority,
    required this.status,
    this.sentAt,
    this.readAt,
  });

  final String id;
  final String threadId;
  final String senderUserId;
  final String senderRole;
  final String message;
  final String priority;
  final String status;
  final String? sentAt;
  final String? readAt;

  bool get isParentSender => senderRole == 'PARENT';

  factory ParentTeacherMessage.fromJson(Map<String, dynamic> json) {
    return ParentTeacherMessage(
      id: json['id'] as String? ?? '',
      threadId: json['threadId'] as String? ?? '',
      senderUserId: json['senderUserId'] as String? ?? '',
      senderRole: json['senderRole'] as String? ?? 'PARENT',
      message: json['message'] as String? ?? '',
      priority: json['priority'] as String? ?? 'NORMAL',
      status: json['status'] as String? ?? 'SENT',
      sentAt: json['sentAt'] as String?,
      readAt: json['readAt'] as String?,
    );
  }
}

class ParentTeacherSendResult {
  const ParentTeacherSendResult({
    required this.message,
    this.queuedNotice,
    required this.sla,
    required this.isAvailable,
  });

  final ParentTeacherMessage message;
  final String? queuedNotice;
  final String sla;
  final bool isAvailable;

  factory ParentTeacherSendResult.fromJson(Map<String, dynamic> json) {
    final availability = _asMap(json['availability']);
    return ParentTeacherSendResult(
      message: ParentTeacherMessage.fromJson(
        _asMap(json['message']) ?? const {},
      ),
      queuedNotice: json['queuedNotice'] as String?,
      sla: json['sla'] as String? ?? 'Usually replies within 1 school day.',
      isAvailable: availability?['isAvailable'] as bool? ?? true,
    );
  }
}

Map<String, dynamic>? _asMap(Object? value) {
  return value is Map<String, dynamic> ? value : null;
}

List<dynamic> _asList(Object? value) {
  return value is List<dynamic> ? value : const [];
}

int _asInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.round();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

int? _asNullableInt(Object? value) {
  if (value == null) {
    return null;
  }
  return _asInt(value);
}

num _asNum(Object? value) {
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value) ?? 0;
  }
  return 0;
}

num? _asNullableNum(Object? value) {
  if (value == null) {
    return null;
  }
  return _asNum(value);
}

String _formatAttendancePercent(Map<String, dynamic>? attendance) {
  final monthSummary = _asMap(attendance?['monthSummary']);
  final percent = _asNum(monthSummary?['attendancePercentage']);
  return '${_formatCompactNumber(percent)}% attendance this month';
}

String _formatTransportStatus(Map<String, dynamic>? transport) {
  final activeTrip = _asMap(transport?['activeTrip']);
  if (activeTrip != null) {
    final studentStatus = activeTrip['studentStatus'] as String? ?? 'ON_ROUTE';
    return _labelize(studentStatus);
  }

  final assignment = _asMap(transport?['assignment']);
  final enrollment = _asMap(transport?['enrollment']);
  if (assignment != null || enrollment != null) {
    return 'Route assigned';
  }

  return 'No active trip';
}

String? _formatTransportDetail(Map<String, dynamic>? transport) {
  final activeTrip = _asMap(transport?['activeTrip']);
  final tripRoute = _asMap(activeTrip?['route']);
  if (tripRoute != null) {
    return tripRoute['name'] as String?;
  }

  final assignment = _asMap(transport?['assignment']);
  final assignmentRoute = _asMap(assignment?['route']);
  if (assignmentRoute != null) {
    return assignmentRoute['name'] as String?;
  }

  final enrollment = _asMap(transport?['enrollment']);
  final enrollmentRoute = _asMap(enrollment?['route']);
  return enrollmentRoute?['name'] as String?;
}

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String _formatCompactNumber(num value) {
  return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(1);
}

String? _personName(
  Map<String, dynamic>? value, {
  required String firstKey,
  required String lastKey,
}) {
  if (value == null) {
    return null;
  }

  final name = [
    value[firstKey] as String?,
    value[lastKey] as String?,
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');

  if (name.isEmpty) {
    return null;
  }

  return name;
}
