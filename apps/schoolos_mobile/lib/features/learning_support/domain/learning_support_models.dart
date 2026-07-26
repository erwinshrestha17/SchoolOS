class LearningSupportStudent {
  const LearningSupportStudent({
    required this.id,
    required this.studentSystemId,
    required this.fullName,
    required this.classId,
    required this.className,
    required this.classLevel,
    this.sectionId,
    this.sectionName,
  });

  final String id;
  final String studentSystemId;
  final String fullName;
  final String classId;
  final String className;
  final int classLevel;
  final String? sectionId;
  final String? sectionName;

  factory LearningSupportStudent.fromJson(Map<String, dynamic> json) {
    return LearningSupportStudent(
      id: json['id'] as String? ?? '',
      studentSystemId: json['studentSystemId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Student',
      classId: json['classId'] as String? ?? '',
      className: json['className'] as String? ?? 'Class',
      classLevel: _asInt(json['classLevel']),
      sectionId: json['sectionId'] as String?,
      sectionName: json['sectionName'] as String?,
    );
  }
}

class LearningSupportSubject {
  const LearningSupportSubject({
    required this.id,
    required this.code,
    required this.name,
  });

  final String id;
  final String code;
  final String name;

  factory LearningSupportSubject.fromJson(Map<String, dynamic> json) {
    return LearningSupportSubject(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? 'Subject',
    );
  }
}

class LearningSupportOutcome {
  const LearningSupportOutcome({
    required this.id,
    required this.code,
    required this.title,
    required this.domain,
    this.subject,
  });

  final String id;
  final String code;
  final String title;
  final String domain;
  final LearningSupportSubject? subject;

  factory LearningSupportOutcome.fromJson(Map<String, dynamic> json) {
    return LearningSupportOutcome(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      title: json['title'] as String? ?? 'Learning outcome',
      domain: json['domain'] as String? ?? 'GENERAL',
      subject: json['subject'] is Map<String, dynamic>
          ? LearningSupportSubject.fromJson(
              json['subject'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class LearningProgressItem {
  const LearningProgressItem({
    required this.outcome,
    required this.latestMasteryStatus,
    required this.latestAssessedOn,
    required this.assessmentCount,
    this.previousMasteryStatus,
    this.parentSummary,
  });

  final LearningSupportOutcome outcome;
  final String latestMasteryStatus;
  final DateTime latestAssessedOn;
  final String? previousMasteryStatus;
  final int assessmentCount;
  final String? parentSummary;

  factory LearningProgressItem.fromJson(Map<String, dynamic> json) {
    return LearningProgressItem(
      outcome: LearningSupportOutcome.fromJson(_map(json['outcome'])),
      latestMasteryStatus:
          json['latestMasteryStatus'] as String? ?? 'DEVELOPING',
      latestAssessedOn:
          DateTime.tryParse(json['latestAssessedOn'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      previousMasteryStatus: json['previousMasteryStatus'] as String?,
      assessmentCount: _asInt(json['assessmentCount']),
      parentSummary: json['parentSummary'] as String?,
    );
  }
}

class LearningInterventionEntry {
  const LearningInterventionEntry({
    required this.id,
    required this.entryType,
    required this.body,
    required this.parentVisible,
    required this.createdAt,
    this.nextFollowUpOn,
  });

  final String id;
  final String entryType;
  final String body;
  final bool parentVisible;
  final DateTime createdAt;
  final DateTime? nextFollowUpOn;

  factory LearningInterventionEntry.fromJson(Map<String, dynamic> json) {
    return LearningInterventionEntry(
      id: json['id'] as String? ?? '',
      entryType: json['entryType'] as String? ?? 'NOTE',
      body: json['body'] as String? ?? '',
      parentVisible: json['parentVisible'] as bool? ?? false,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      nextFollowUpOn: DateTime.tryParse(
        json['nextFollowUpOn'] as String? ?? '',
      ),
    );
  }
}

class LearningInterventionCase {
  const LearningInterventionCase({
    required this.id,
    required this.student,
    required this.priority,
    required this.status,
    required this.title,
    required this.concernSummary,
    required this.version,
    required this.entries,
    required this.updatedAt,
    this.ownerName,
    this.parentVisibleSummary,
    this.nextFollowUpOn,
    this.resolutionSummary,
  });

  final String id;
  final LearningSupportStudent student;
  final String priority;
  final String status;
  final String title;
  final String concernSummary;
  final int version;
  final List<LearningInterventionEntry> entries;
  final DateTime updatedAt;
  final String? ownerName;
  final String? parentVisibleSummary;
  final DateTime? nextFollowUpOn;
  final String? resolutionSummary;

  bool get isClosed => status == 'CLOSED';
  bool get isResolved => status == 'RESOLVED';

  factory LearningInterventionCase.fromJson(Map<String, dynamic> json) {
    return LearningInterventionCase(
      id: json['id'] as String? ?? '',
      student: LearningSupportStudent.fromJson(_map(json['student'])),
      priority: json['priority'] as String? ?? 'ROUTINE',
      status: json['status'] as String? ?? 'OPEN',
      title: json['title'] as String? ?? 'Learning follow-up',
      concernSummary: json['concernSummary'] as String? ?? '',
      version: _asInt(json['version']),
      entries: _list(json['entries'])
          .whereType<Map<String, dynamic>>()
          .map(LearningInterventionEntry.fromJson)
          .toList(),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      ownerName: _map(json['owner'])['fullName'] as String?,
      parentVisibleSummary: json['parentVisibleSummary'] as String?,
      nextFollowUpOn: DateTime.tryParse(
        json['nextFollowUpOn'] as String? ?? '',
      ),
      resolutionSummary: json['resolutionSummary'] as String?,
    );
  }
}

class LearningRemedialSupport {
  const LearningRemedialSupport({
    required this.id,
    required this.name,
    required this.subject,
    required this.startsOn,
    this.endsOn,
    this.scheduleNote,
    this.parentSummary,
  });

  final String id;
  final String name;
  final LearningSupportSubject subject;
  final DateTime startsOn;
  final DateTime? endsOn;
  final String? scheduleNote;
  final String? parentSummary;

  factory LearningRemedialSupport.fromJson(Map<String, dynamic> json) {
    return LearningRemedialSupport(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Support group',
      subject: LearningSupportSubject.fromJson(_map(json['subject'])),
      startsOn:
          DateTime.tryParse(json['startsOn'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      endsOn: DateTime.tryParse(json['endsOn'] as String? ?? ''),
      scheduleNote: json['scheduleNote'] as String?,
      parentSummary: json['parentSummary'] as String?,
    );
  }
}

class ParentLearningGuidance {
  const ParentLearningGuidance({
    required this.id,
    required this.title,
    required this.skillExplanation,
    required this.homeActivity,
    required this.status,
    required this.subject,
    required this.teacherName,
    this.outcome,
  });

  final String id;
  final String title;
  final String skillExplanation;
  final String homeActivity;
  final String status;
  final LearningSupportSubject subject;
  final String teacherName;
  final LearningSupportOutcome? outcome;

  factory ParentLearningGuidance.fromJson(Map<String, dynamic> json) {
    return ParentLearningGuidance(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Learning guidance',
      skillExplanation: json['skillExplanation'] as String? ?? '',
      homeActivity: json['homeActivity'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      subject: LearningSupportSubject.fromJson(_map(json['subject'])),
      teacherName:
          _map(json['teacher'])['fullName'] as String? ?? 'Class teacher',
      outcome: json['outcome'] is Map<String, dynamic>
          ? LearningSupportOutcome.fromJson(
              json['outcome'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class ParentLearningSupportSummary {
  const ParentLearningSupportSummary({
    required this.generatedAt,
    required this.student,
    required this.sourceStates,
    required this.outcomeProgress,
    required this.guidance,
    required this.remedialSupport,
    required this.interventionUpdates,
  });

  final DateTime generatedAt;
  final LearningSupportStudent student;
  final Map<String, String> sourceStates;
  final List<LearningProgressItem> outcomeProgress;
  final List<ParentLearningGuidance> guidance;
  final List<LearningRemedialSupport> remedialSupport;
  final List<LearningParentInterventionUpdate> interventionUpdates;

  bool get isEmpty =>
      outcomeProgress.isEmpty &&
      guidance.isEmpty &&
      remedialSupport.isEmpty &&
      interventionUpdates.isEmpty;

  factory ParentLearningSupportSummary.fromJson(Map<String, dynamic> json) {
    return ParentLearningSupportSummary(
      generatedAt:
          DateTime.tryParse(json['generatedAt'] as String? ?? '') ??
          DateTime.now(),
      student: LearningSupportStudent.fromJson(_map(json['student'])),
      sourceStates: _stringMap(json['sourceStates']),
      outcomeProgress: _list(json['outcomeProgress'])
          .whereType<Map<String, dynamic>>()
          .map(LearningProgressItem.fromJson)
          .toList(),
      guidance: _list(json['guidance'])
          .whereType<Map<String, dynamic>>()
          .map(ParentLearningGuidance.fromJson)
          .toList(),
      remedialSupport: _list(json['remedialSupport'])
          .whereType<Map<String, dynamic>>()
          .map(LearningRemedialSupport.fromJson)
          .toList(),
      interventionUpdates: _list(json['interventionUpdates'])
          .whereType<Map<String, dynamic>>()
          .map(LearningParentInterventionUpdate.fromJson)
          .toList(),
    );
  }
}

class LearningParentInterventionUpdate {
  const LearningParentInterventionUpdate({
    required this.caseId,
    required this.status,
    required this.title,
    required this.summary,
    required this.updatedAt,
    this.nextFollowUpOn,
  });

  final String caseId;
  final String status;
  final String title;
  final String summary;
  final DateTime updatedAt;
  final DateTime? nextFollowUpOn;

  factory LearningParentInterventionUpdate.fromJson(Map<String, dynamic> json) {
    return LearningParentInterventionUpdate(
      caseId: json['caseId'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      title: json['title'] as String? ?? 'Learning follow-up',
      summary: json['summary'] as String? ?? '',
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      nextFollowUpOn: DateTime.tryParse(
        json['nextFollowUpOn'] as String? ?? '',
      ),
    );
  }
}

class TeacherStudentLearningSupport {
  const TeacherStudentLearningSupport({
    required this.generatedAt,
    required this.student,
    required this.sourceStates,
    required this.availableOutcomes,
    required this.outcomeProgress,
    required this.interventions,
    required this.remedialGroups,
    required this.parentGuidance,
  });

  final DateTime generatedAt;
  final LearningSupportStudent student;
  final Map<String, String> sourceStates;
  final List<LearningSupportOutcome> availableOutcomes;
  final List<LearningProgressItem> outcomeProgress;
  final List<LearningInterventionCase> interventions;
  final List<LearningRemedialSupport> remedialGroups;
  final List<ParentLearningGuidance> parentGuidance;

  factory TeacherStudentLearningSupport.fromJson(Map<String, dynamic> json) {
    return TeacherStudentLearningSupport(
      generatedAt:
          DateTime.tryParse(json['generatedAt'] as String? ?? '') ??
          DateTime.now(),
      student: LearningSupportStudent.fromJson(_map(json['student'])),
      sourceStates: _stringMap(json['sourceStates']),
      availableOutcomes: _list(json['availableOutcomes'])
          .whereType<Map<String, dynamic>>()
          .map(LearningSupportOutcome.fromJson)
          .toList(),
      outcomeProgress: _list(json['outcomeProgress'])
          .whereType<Map<String, dynamic>>()
          .map(LearningProgressItem.fromJson)
          .toList(),
      interventions: _list(json['interventions'])
          .whereType<Map<String, dynamic>>()
          .map(LearningInterventionCase.fromJson)
          .toList(),
      remedialGroups: _list(json['remedialGroups'])
          .whereType<Map<String, dynamic>>()
          .map(LearningRemedialSupport.fromJson)
          .toList(),
      parentGuidance: _list(json['parentGuidance'])
          .whereType<Map<String, dynamic>>()
          .map(ParentLearningGuidance.fromJson)
          .toList(),
    );
  }
}

class LearningAttentionReason {
  const LearningAttentionReason({
    required this.code,
    required this.label,
    required this.explanation,
  });

  final String code;
  final String label;
  final String explanation;

  factory LearningAttentionReason.fromJson(Map<String, dynamic> json) {
    return LearningAttentionReason(
      code: json['code'] as String? ?? '',
      label: json['label'] as String? ?? 'Follow-up signal',
      explanation: json['explanation'] as String? ?? '',
    );
  }
}

class LearningAttentionItem {
  const LearningAttentionItem({
    required this.signalKey,
    required this.student,
    required this.attentionLevel,
    required this.reasons,
    required this.sourceStates,
    this.activeInterventionCaseId,
  });

  final String signalKey;
  final LearningSupportStudent student;
  final String attentionLevel;
  final List<LearningAttentionReason> reasons;
  final Map<String, String> sourceStates;
  final String? activeInterventionCaseId;

  factory LearningAttentionItem.fromJson(Map<String, dynamic> json) {
    return LearningAttentionItem(
      signalKey: json['signalKey'] as String? ?? '',
      student: LearningSupportStudent.fromJson(_map(json['student'])),
      attentionLevel: json['attentionLevel'] as String? ?? 'WATCH',
      reasons: _list(json['reasons'])
          .whereType<Map<String, dynamic>>()
          .map(LearningAttentionReason.fromJson)
          .toList(),
      sourceStates: _stringMap(json['sourceStates']),
      activeInterventionCaseId: json['activeInterventionCaseId'] as String?,
    );
  }
}

class LearningAttentionPage {
  const LearningAttentionPage({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.generatedAt,
    required this.rulesVersion,
    required this.nonPredictive,
  });

  final List<LearningAttentionItem> items;
  final int total;
  final int page;
  final int limit;
  final DateTime generatedAt;
  final String rulesVersion;
  final bool nonPredictive;

  factory LearningAttentionPage.fromJson(Map<String, dynamic> json) {
    return LearningAttentionPage(
      items: _list(json['items'])
          .whereType<Map<String, dynamic>>()
          .map(LearningAttentionItem.fromJson)
          .toList(),
      total: _asInt(json['total']),
      page: _asInt(json['page']),
      limit: _asInt(json['limit']),
      generatedAt:
          DateTime.tryParse(json['generatedAt'] as String? ?? '') ??
          DateTime.now(),
      rulesVersion: json['rulesVersion'] as String? ?? 'stage3-v1',
      nonPredictive: json['nonPredictive'] as bool? ?? true,
    );
  }
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map<String, dynamic> ? value : const <String, dynamic>{};

List<dynamic> _list(dynamic value) =>
    value is List<dynamic> ? value : const <dynamic>[];

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

Map<String, String> _stringMap(dynamic value) {
  final map = _map(value);
  return map.map(
    (key, item) => MapEntry(key, item?.toString() ?? 'unavailable'),
  );
}
