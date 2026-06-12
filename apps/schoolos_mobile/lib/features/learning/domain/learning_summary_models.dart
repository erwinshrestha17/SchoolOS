class LearningSummary {
  const LearningSummary({
    required this.studentId,
    required this.studentName,
    required this.activityCount,
    required this.supportiveLabel,
    this.className,
    this.sectionName,
    this.recentCompletedActivities = const [],
    this.strongTopics = const [],
    this.needsPracticeTopics = const [],
    this.progress = const [],
  });

  final String studentId;
  final String studentName;
  final int activityCount;
  final LearningSupportiveLabel supportiveLabel;
  final String? className;
  final String? sectionName;
  final List<LearningCompletedActivity> recentCompletedActivities;
  final List<LearningProgressTopic> strongTopics;
  final List<LearningProgressTopic> needsPracticeTopics;
  final List<LearningProgressTopic> progress;

  factory LearningSummary.fromParentJson(Map<String, dynamic> json) {
    final child = _asMap(json['child']) ?? const {};
    final label = _asMap(json['supportiveLabel']) ?? const {};
    return LearningSummary(
      studentId: child['id'] as String? ?? '',
      studentName: child['name'] as String? ?? 'Student',
      className: _asMap(child['class'])?['name'] as String?,
      sectionName: _asMap(child['section'])?['name'] as String?,
      activityCount: _asInt(json['activityCount']),
      supportiveLabel: LearningSupportiveLabel.fromJson(label),
      recentCompletedActivities: _asList(json['recentCompletedActivities'])
          .whereType<Map<String, dynamic>>()
          .map(LearningCompletedActivity.fromJson)
          .toList(),
      strongTopics: _asList(json['strongTopics'])
          .whereType<Map<String, dynamic>>()
          .map(LearningProgressTopic.fromJson)
          .toList(),
      needsPracticeTopics: _asList(json['needsPracticeTopics'])
          .whereType<Map<String, dynamic>>()
          .map(LearningProgressTopic.fromJson)
          .toList(),
    );
  }

  factory LearningSummary.fromStudentProgressJson(Map<String, dynamic> json) {
    final student = _asMap(json['student']) ?? const {};
    final progress = _asList(json['items'])
        .whereType<Map<String, dynamic>>()
        .map(LearningProgressTopic.fromJson)
        .toList();
    final needsPractice = progress
        .where((item) => item.label == 'NEEDS_PRACTICE')
        .toList();
    final strong = progress.where((item) => item.label == 'STRONG').toList();
    return LearningSummary(
      studentId: student['id'] as String? ?? '',
      studentName: student['name'] as String? ?? 'Student',
      activityCount: progress.fold<int>(
        0,
        (sum, item) => sum + item.completedCount,
      ),
      supportiveLabel: LearningSupportiveLabel.fromProgress(progress),
      progress: progress,
      strongTopics: strong,
      needsPracticeTopics: needsPractice,
    );
  }
}

class LearningSupportiveLabel {
  const LearningSupportiveLabel({required this.label, required this.text});

  final String label;
  final String text;

  factory LearningSupportiveLabel.fromJson(Map<String, dynamic> json) {
    return LearningSupportiveLabel(
      label: json['label'] as String? ?? 'NEEDS_PRACTICE',
      text: json['text'] as String? ?? 'Needs practice',
    );
  }

  factory LearningSupportiveLabel.fromProgress(
    List<LearningProgressTopic> progress,
  ) {
    if (progress.any((item) => item.label == 'NEEDS_PRACTICE')) {
      return const LearningSupportiveLabel(
        label: 'NEEDS_PRACTICE',
        text: 'Needs practice',
      );
    }
    if (progress.any((item) => item.label == 'IMPROVING')) {
      return const LearningSupportiveLabel(
        label: 'IMPROVING',
        text: 'Improving',
      );
    }
    if (progress.any((item) => item.label == 'READY')) {
      return const LearningSupportiveLabel(label: 'READY', text: 'Ready');
    }
    if (progress.any((item) => item.label == 'STRONG')) {
      return const LearningSupportiveLabel(label: 'STRONG', text: 'Strong');
    }
    return const LearningSupportiveLabel(
      label: 'NEEDS_PRACTICE',
      text: 'Needs practice',
    );
  }
}

class LearningCompletedActivity {
  const LearningCompletedActivity({
    required this.id,
    required this.title,
    this.subjectName,
    this.difficulty,
    this.submittedAt,
    this.accuracy,
  });

  final String id;
  final String title;
  final String? subjectName;
  final String? difficulty;
  final String? submittedAt;
  final num? accuracy;

  factory LearningCompletedActivity.fromJson(Map<String, dynamic> json) {
    return LearningCompletedActivity(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Learning activity',
      subjectName: _asMap(json['subject'])?['name'] as String?,
      difficulty: json['difficulty'] as String?,
      submittedAt: json['submittedAt'] as String?,
      accuracy: _asNullableNum(json['accuracy']),
    );
  }
}

class LearningProgressTopic {
  const LearningProgressTopic({
    required this.label,
    required this.labelText,
    required this.completedCount,
    required this.averageAccuracy,
    this.subjectName,
    this.activityTitle,
    this.lastAttemptAt,
  });

  final String label;
  final String labelText;
  final int completedCount;
  final num averageAccuracy;
  final String? subjectName;
  final String? activityTitle;
  final String? lastAttemptAt;

  factory LearningProgressTopic.fromJson(Map<String, dynamic> json) {
    return LearningProgressTopic(
      label: json['label'] as String? ?? 'NEEDS_PRACTICE',
      labelText: json['labelText'] as String? ?? 'Needs practice',
      completedCount: _asInt(json['completedCount']),
      averageAccuracy: _asNum(json['averageAccuracy']),
      subjectName: _asMap(json['subject'])?['name'] as String?,
      activityTitle: _asMap(json['activity'])?['title'] as String?,
      lastAttemptAt: json['lastAttemptAt'] as String?,
    );
  }
}

Map<String, dynamic>? _asMap(dynamic value) {
  return value is Map<String, dynamic> ? value : null;
}

List<dynamic> _asList(dynamic value) {
  return value is List<dynamic> ? value : const [];
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

num _asNum(dynamic value) => _asNullableNum(value) ?? 0;

num? _asNullableNum(dynamic value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}
