class ParentServiceRequest {
  const ParentServiceRequest({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.classSection,
    required this.type,
    required this.category,
    required this.priority,
    required this.subject,
    required this.description,
    required this.status,
    required this.responseDeadline,
    required this.isOverdue,
    required this.notes,
    required this.attachments,
    required this.canCancel,
    required this.canConfirmResolution,
    required this.canReopen,
    required this.canAddEvidence,
    required this.createdAt,
    required this.updatedAt,
    this.invoice,
    this.responderName,
    this.resolutionSummary,
  });

  final String id;
  final String studentId;
  final String studentName;
  final String classSection;
  final String type;
  final String category;
  final String priority;
  final String subject;
  final String description;
  final String status;
  final ParentServiceRequestInvoice? invoice;
  final String? responderName;
  final DateTime responseDeadline;
  final bool isOverdue;
  final String? resolutionSummary;
  final List<ParentServiceRequestNote> notes;
  final List<ParentServiceRequestAttachment> attachments;
  final bool canCancel;
  final bool canConfirmResolution;
  final bool canReopen;
  final bool canAddEvidence;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isPaymentDispute => type == 'PAYMENT_DISPUTE';
  bool get isActive =>
      status == 'OPEN' ||
      status == 'ASSIGNED' ||
      status == 'IN_PROGRESS' ||
      status == 'REOPENED';

  factory ParentServiceRequest.fromJson(Map<String, dynamic> json) {
    final student = _map(json['student']);
    final responder = _map(json['responder']);
    final actions = _map(json['actions']);
    final invoice = _map(json['invoice']);
    return ParentServiceRequest(
      id: _string(json['id']),
      studentId: _string(student?['id']),
      studentName: _string(student?['name'], fallback: 'Linked child'),
      classSection: _string(student?['classSection']),
      type: _string(json['type'], fallback: 'GENERAL_COMPLAINT'),
      category: _string(json['category'], fallback: 'OTHER'),
      priority: _string(json['priority'], fallback: 'NORMAL'),
      subject: _string(json['subject'], fallback: 'School request'),
      description: _string(json['description']),
      status: _string(json['status'], fallback: 'OPEN'),
      invoice: invoice == null
          ? null
          : ParentServiceRequestInvoice.fromJson(invoice),
      responderName: _nullableString(responder?['name']),
      responseDeadline: _date(json['responseDeadline']),
      isOverdue: json['isOverdue'] == true,
      resolutionSummary: _nullableString(json['resolutionSummary']),
      notes: _list(json['notes'])
          .whereType<Map<String, dynamic>>()
          .map(ParentServiceRequestNote.fromJson)
          .toList(),
      attachments: _list(json['attachments'])
          .whereType<Map<String, dynamic>>()
          .map(ParentServiceRequestAttachment.fromJson)
          .toList(),
      canCancel: actions?['cancel'] == true,
      canConfirmResolution: actions?['confirmResolution'] == true,
      canReopen: actions?['reopen'] == true,
      canAddEvidence: actions?['addEvidence'] == true,
      createdAt: _date(json['createdAt']),
      updatedAt: _date(json['updatedAt']),
    );
  }
}

class ParentServiceRequestInvoice {
  const ParentServiceRequestInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.status,
    required this.totalAmount,
    required this.dueDate,
  });

  final String id;
  final String invoiceNumber;
  final String status;
  final num totalAmount;
  final DateTime dueDate;

  factory ParentServiceRequestInvoice.fromJson(Map<String, dynamic> json) {
    return ParentServiceRequestInvoice(
      id: _string(json['id']),
      invoiceNumber: _string(json['invoiceNumber'], fallback: 'Invoice'),
      status: _string(json['status']),
      totalAmount: json['totalAmount'] is num
          ? json['totalAmount'] as num
          : num.tryParse('${json['totalAmount']}') ?? 0,
      dueDate: _date(json['dueDate']),
    );
  }
}

class ParentServiceRequestNote {
  const ParentServiceRequestNote({
    required this.id,
    required this.body,
    required this.author,
    required this.createdAt,
  });

  final String id;
  final String body;
  final String author;
  final DateTime createdAt;

  factory ParentServiceRequestNote.fromJson(Map<String, dynamic> json) {
    return ParentServiceRequestNote(
      id: _string(json['id']),
      body: _string(json['body']),
      author: _string(json['author'], fallback: 'School team'),
      createdAt: _date(json['createdAt']),
    );
  }
}

class ParentServiceRequestAttachment {
  const ParentServiceRequestAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.downloadPath,
    required this.createdAt,
    this.label,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String downloadPath;
  final String? label;
  final DateTime createdAt;

  factory ParentServiceRequestAttachment.fromJson(Map<String, dynamic> json) {
    return ParentServiceRequestAttachment(
      id: _string(json['id']),
      fileName: _string(json['fileName'], fallback: 'Evidence'),
      mimeType: _string(json['mimeType']),
      sizeBytes: json['sizeBytes'] is num
          ? (json['sizeBytes'] as num).toInt()
          : int.tryParse('${json['sizeBytes']}') ?? 0,
      downloadPath: _string(json['downloadPath']),
      label: _nullableString(json['label']),
      createdAt: _date(json['createdAt']),
    );
  }
}

class ParentServiceRequestList {
  const ParentServiceRequestList({required this.items, required this.total});

  final List<ParentServiceRequest> items;
  final int total;

  factory ParentServiceRequestList.fromJson(Map<String, dynamic> json) {
    final items = _list(json['items'])
        .whereType<Map<String, dynamic>>()
        .map(ParentServiceRequest.fromJson)
        .toList();
    return ParentServiceRequestList(
      items: items,
      total: json['total'] is num
          ? (json['total'] as num).toInt()
          : items.length,
    );
  }
}

Map<String, dynamic>? _map(Object? value) =>
    value is Map<String, dynamic> ? value : null;

List<dynamic> _list(Object? value) => value is List<dynamic> ? value : const [];

String _string(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _string(value);
  return text.isEmpty ? null : text;
}

DateTime _date(Object? value) =>
    DateTime.tryParse(value is String ? value : '') ??
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
