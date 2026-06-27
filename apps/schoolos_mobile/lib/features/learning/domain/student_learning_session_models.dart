class StudentLearningSessionJoin {
  const StudentLearningSessionJoin({
    required this.participantId,
    required this.studentId,
    required this.session,
  });

  final String participantId;
  final String studentId;
  final StudentLearningSession session;

  factory StudentLearningSessionJoin.fromJson(Map<String, dynamic> json) {
    final participant = json['participant'] is Map<String, dynamic>
        ? json['participant'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final session = json['session'] is Map<String, dynamic>
        ? json['session'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return StudentLearningSessionJoin(
      participantId: participant['id'] as String? ?? '',
      studentId: participant['studentId'] as String? ?? '',
      session: StudentLearningSession.fromJson(session),
    );
  }
}

class StudentLearningSession {
  const StudentLearningSession({
    required this.id,
    required this.activityId,
    required this.status,
    required this.schoolOnly,
    required this.expiresAt,
    required this.activity,
  });

  final String id;
  final String activityId;
  final String status;
  final bool schoolOnly;
  final DateTime? expiresAt;
  final StudentLearningActivity activity;

  factory StudentLearningSession.fromJson(Map<String, dynamic> json) {
    final activity = json['activity'] is Map<String, dynamic>
        ? json['activity'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return StudentLearningSession(
      id: json['id'] as String? ?? '',
      activityId: json['activityId'] as String? ?? '',
      status: json['status'] as String? ?? '',
      schoolOnly: json['schoolOnly'] as bool? ?? false,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
      activity: StudentLearningActivity.fromJson(activity),
    );
  }
}

class StudentLearningActivity {
  const StudentLearningActivity({
    required this.id,
    required this.title,
    required this.description,
    required this.difficulty,
    required this.languageMode,
    required this.estimatedMinutes,
    required this.questionCount,
  });

  final String id;
  final String title;
  final String? description;
  final String difficulty;
  final String languageMode;
  final int? estimatedMinutes;
  final int questionCount;

  factory StudentLearningActivity.fromJson(Map<String, dynamic> json) {
    final questions = json['questions'] as List<dynamic>? ?? const [];
    return StudentLearningActivity(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Learning activity',
      description: json['description'] as String?,
      difficulty: json['difficulty'] as String? ?? '',
      languageMode: json['languageMode'] as String? ?? '',
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt(),
      questionCount: questions.length,
    );
  }
}
