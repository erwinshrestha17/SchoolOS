import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/learning/domain/learning_summary_models.dart';

void main() {
  test(
    'parses parent learning summary without raw answers or ranking fields',
    () {
      final summary = LearningSummary.fromParentJson({
        'child': {
          'id': 'student-a',
          'name': 'Student A',
          'class': {'name': 'Grade 4'},
          'section': {'name': 'A'},
        },
        'activityCount': 2,
        'supportiveLabel': {'label': 'IMPROVING', 'text': 'Improving'},
        'recentCompletedActivities': [
          {
            'id': 'activity-a',
            'title': 'Fractions',
            'subject': {'name': 'Math'},
            'accuracy': 80,
          },
        ],
        'strongTopics': [
          {
            'label': 'STRONG',
            'labelText': 'Strong',
            'completedCount': 1,
            'averageAccuracy': 92,
            'activity': {'title': 'Shapes'},
          },
        ],
        'needsPracticeTopics': const [],
        'answers': const ['must not be parsed'],
        'rank': 1,
      });

      expect(summary.studentId, 'student-a');
      expect(summary.studentName, 'Student A');
      expect(summary.supportiveLabel.text, 'Improving');
      expect(summary.recentCompletedActivities.single.title, 'Fractions');
      expect(summary.strongTopics.single.activityTitle, 'Shapes');
    },
  );

  test('derives student supportive label from self-scoped progress', () {
    final summary = LearningSummary.fromStudentProgressJson({
      'student': {'id': 'student-a', 'name': 'Student A'},
      'items': [
        {
          'label': 'NEEDS_PRACTICE',
          'labelText': 'Needs practice',
          'completedCount': 1,
          'averageAccuracy': 40,
          'subject': {'name': 'Math'},
        },
        {
          'label': 'STRONG',
          'labelText': 'Strong',
          'completedCount': 2,
          'averageAccuracy': 90,
          'activity': {'title': 'Angles'},
        },
      ],
    });

    expect(summary.activityCount, 3);
    expect(summary.supportiveLabel.label, 'NEEDS_PRACTICE');
    expect(summary.needsPracticeTopics.single.subjectName, 'Math');
    expect(summary.strongTopics.single.activityTitle, 'Angles');
  });
}
