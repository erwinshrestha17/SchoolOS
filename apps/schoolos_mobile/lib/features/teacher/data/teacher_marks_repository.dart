import '../../../core/network/api_client.dart';
import '../../../core/sync/school_authority_discovery.dart';

class TeacherMarksRepository {
  const TeacherMarksRepository(this._client, {this.authorityDiscovery});

  final ApiClient _client;
  final SchoolAuthorityDiscovery? authorityDiscovery;

  Future<List<TeacherAssessmentComponent>> listComponents({
    String? classId,
    String? subjectId,
    String? examTermId,
  }) async {
    final response = await _client.get(
      '/mobile/teacher/marks/components',
      queryParameters: {
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        if (examTermId != null && examTermId.isNotEmpty)
          'examTermId': examTermId,
        'limit': 50,
      },
    );
    final data = response.data;
    final items = data is Map<String, dynamic> ? data['items'] : data;
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map(
          (item) => TeacherAssessmentComponent.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList();
  }

  Future<List<TeacherMarkEntry>> listMarks({
    required String assessmentComponentId,
    String? classId,
    String? sectionId,
    String? examTermId,
  }) async {
    final response = await _client.get(
      '/mobile/teacher/marks',
      queryParameters: {
        'assessmentComponentId': assessmentComponentId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (sectionId != null && sectionId.isNotEmpty) 'sectionId': sectionId,
        if (examTermId != null && examTermId.isNotEmpty)
          'examTermId': examTermId,
        'limit': 100,
      },
    );
    final data = response.data;
    final items = data is Map<String, dynamic> ? data['items'] : data;
    if (items is! List) return const [];
    return items
        .whereType<Map>()
        .map(
          (item) => TeacherMarkEntry.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<void> bulkUpsert({
    required String examTermId,
    required String assessmentComponentId,
    required String classId,
    String? sectionId,
    required String subjectId,
    required List<TeacherMarkUpsert> entries,
  }) async {
    await authorityDiscovery?.refresh();
    await _client.post(
      '/mobile/teacher/marks/bulk-upsert',
      data: {
        'examTermId': examTermId,
        'assessmentComponentId': assessmentComponentId,
        'classId': classId,
        if (sectionId != null && sectionId.isNotEmpty) 'sectionId': sectionId,
        'subjectId': subjectId,
        'entries': entries.map((entry) => entry.toJson()).toList(),
        ...?authorityDiscovery?.fields(),
      },
    );
  }
}

class TeacherAssessmentComponent {
  const TeacherAssessmentComponent({
    required this.id,
    required this.name,
    required this.examTermId,
    required this.examTermName,
    required this.subjectId,
    required this.subjectName,
    required this.classId,
    required this.className,
    required this.maxMarks,
    this.isLocked = false,
  });

  final String id;
  final String name;
  final String examTermId;
  final String examTermName;
  final String subjectId;
  final String subjectName;
  final String classId;
  final String className;
  final num maxMarks;
  final bool isLocked;

  factory TeacherAssessmentComponent.fromJson(Map<String, dynamic> json) {
    final subject = json['subject'] is Map
        ? Map<String, dynamic>.from(json['subject'] as Map)
        : const <String, dynamic>{};
    final examTerm = json['examTerm'] is Map
        ? Map<String, dynamic>.from(json['examTerm'] as Map)
        : const <String, dynamic>{};
    final klass = subject['class'] is Map
        ? Map<String, dynamic>.from(subject['class'] as Map)
        : const <String, dynamic>{};
    return TeacherAssessmentComponent(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Assessment',
      examTermId:
          json['examTermId'] as String? ?? examTerm['id'] as String? ?? '',
      examTermName: examTerm['name'] as String? ?? 'Exam term',
      subjectId: json['subjectId'] as String? ?? subject['id'] as String? ?? '',
      subjectName: subject['name'] as String? ?? 'Subject',
      classId: subject['classId'] as String? ?? klass['id'] as String? ?? '',
      className: klass['name'] as String? ?? 'Class',
      maxMarks: json['maxMarks'] is num
          ? json['maxMarks'] as num
          : num.tryParse('${json['maxMarks']}') ?? 0,
      isLocked: examTerm['isLocked'] == true || json['isLocked'] == true,
    );
  }
}

class TeacherMarkEntry {
  const TeacherMarkEntry({
    required this.studentId,
    required this.studentName,
    required this.rollNumber,
    this.marksObtained,
    this.isAbsent = false,
    this.isLocked = false,
    this.remarks,
    this.updatedAt,
  });

  final String studentId;
  final String studentName;
  final String rollNumber;
  final num? marksObtained;
  final bool isAbsent;
  final bool isLocked;
  final String? remarks;
  final String? updatedAt;

  factory TeacherMarkEntry.fromJson(Map<String, dynamic> json) {
    final student = json['student'] is Map
        ? Map<String, dynamic>.from(json['student'] as Map)
        : const <String, dynamic>{};
    final first = student['firstNameEn'] as String? ?? '';
    final last = student['lastNameEn'] as String? ?? '';
    final name = [
      first,
      last,
    ].where((part) => part.trim().isNotEmpty).join(' ');
    return TeacherMarkEntry(
      studentId: json['studentId'] as String? ?? student['id'] as String? ?? '',
      studentName: name.isEmpty
          ? (student['fullNameEn'] as String? ?? 'Student')
          : name,
      rollNumber: '${student['rollNumber'] ?? ''}',
      marksObtained: json['marksObtained'] is num
          ? json['marksObtained'] as num
          : num.tryParse('${json['marksObtained']}'),
      isAbsent: json['isAbsent'] == true,
      isLocked: json['isLocked'] == true,
      remarks: json['remarks'] as String?,
      updatedAt: json['updatedAt'] is String
          ? json['updatedAt'] as String
          : json['updatedAt']?.toString(),
    );
  }
}

class TeacherMarkUpsert {
  const TeacherMarkUpsert({
    required this.studentId,
    this.marksObtained,
    this.isAbsent = false,
    this.isDraft = false,
    this.remarks,
    this.expectedVersion,
  });

  final String studentId;
  final num? marksObtained;
  final bool isAbsent;
  final bool isDraft;
  final String? remarks;
  final String? expectedVersion;

  Map<String, dynamic> toJson() => {
    'studentId': studentId,
    if (marksObtained != null) 'marksObtained': marksObtained,
    'isAbsent': isAbsent,
    'isDraft': isDraft,
    if (remarks != null && remarks!.trim().isNotEmpty) 'remarks': remarks,
    if (expectedVersion != null && expectedVersion!.trim().isNotEmpty)
      'expectedVersion': expectedVersion,
  };
}
