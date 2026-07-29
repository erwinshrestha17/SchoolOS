import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_portal_models.dart';

/// A parent's main homework signal is "has my child done this?". The app used
/// to map three status values - one of which (`GRADED`) is not in the backend
/// enum at all - and let the other eight fall through to "Pending", so work
/// that had been handed in, marked, excused or completed all read as
/// outstanding. Device QA showed an item marked 10/10 displayed as
/// "Pending / Overdue".
void main() {
  group('every backend status maps to something true', () {
    // Mirrors HomeworkSubmissionStatus in prisma/schema.prisma.
    const backendValues = [
      'NOT_SUBMITTED',
      'SUBMITTED',
      'LATE',
      'REVIEWED',
      'NEEDS_CORRECTION',
      'EXCUSED',
      'COMPLETED',
      'INCOMPLETE',
      'PARTIALLY_COMPLETED',
      'ABSENT',
    ];

    test('none fall through to the unknown bucket', () {
      for (final value in backendValues) {
        expect(
          ParentHomeworkState.fromApi(value),
          isNot(ParentHomeworkState.unknown),
          reason: '$value is a real backend status and must be mapped',
        );
      }
    });

    test('handed-in and finished work is settled, not outstanding', () {
      for (final value in [
        'SUBMITTED',
        'LATE',
        'REVIEWED',
        'EXCUSED',
        'COMPLETED',
      ]) {
        expect(
          ParentHomeworkState.fromApi(value).isSettled,
          isTrue,
          reason: '$value must not be shown to a parent as outstanding',
        );
      }
    });

    test('work still needing action is flagged for the parent', () {
      for (final value in [
        'NOT_SUBMITTED',
        'NEEDS_CORRECTION',
        'INCOMPLETE',
        'PARTIALLY_COMPLETED',
      ]) {
        expect(
          ParentHomeworkState.fromApi(value).needsAttention,
          isTrue,
          reason: '$value is something the parent should chase',
        );
      }
    });

    test('an unrecognised value says so rather than guessing', () {
      final state = ParentHomeworkState.fromApi('SOME_NEW_STATUS');
      expect(state, ParentHomeworkState.unknown);
      expect(state.isSettled, isFalse);
      expect(state.label, 'Status unavailable');
    });
  });

  group('marks', () {
    test('a score is only a mark once work was handed in', () {
      // The API sends score: 0 for never-submitted homework, which reads to a
      // parent as a failing grade.
      final unsubmitted = _hw(rawStatus: 'NOT_SUBMITTED', score: 0);
      expect(unsubmitted.hasMark, isFalse);

      final marked = _hw(
        rawStatus: 'REVIEWED',
        score: 10,
        submittedAt: DateTime(2026, 7, 19),
      );
      expect(marked.hasMark, isTrue);
    });

    test('a reviewed item reads as marked, not pending', () {
      final item = _hw(
        rawStatus: 'REVIEWED',
        score: 10,
        maxScore: 10,
        submittedAt: DateTime(2026, 7, 19),
      );
      expect(item.statusLabel, 'Marked');
      expect(item.isCompleted, isTrue);
      expect(item.scoreLabel, '10/10');
    });

    test('a numeric score without a maximum never masquerades as a ratio', () {
      final item = _hw(
        rawStatus: 'REVIEWED',
        score: 9,
        submittedAt: DateTime(2026, 7, 19),
      );
      expect(item.scoreLabel, 'Score 9 · maximum not set');
    });
  });

  group('primary parent status', () {
    final now = DateTime.utc(2026, 7, 29, 6);
    final due = DateTime.utc(2026, 7, 18, 6);

    test('reviewed late work is completed late, never overdue', () {
      final item = _hw(
        rawStatus: 'REVIEWED',
        dueAt: due,
        submittedAt: DateTime.utc(2026, 7, 19, 6),
      );

      expect(
        item.primaryStatusAt(now),
        ParentHomeworkPrimaryStatus.completedLate,
      );
      expect(item.isOverdueAt(now), isFalse);
    });

    test('late work waiting for review is submitted late', () {
      final item = _hw(
        rawStatus: 'LATE',
        dueAt: due,
        submittedAt: DateTime.utc(2026, 7, 19, 6),
      );
      expect(
        item.primaryStatusAt(now),
        ParentHomeworkPrimaryStatus.submittedLate,
      );
    });

    test('only unfinished past-due work is overdue', () {
      final item = _hw(rawStatus: 'NOT_SUBMITTED', dueAt: due);
      expect(item.primaryStatusAt(now), ParentHomeworkPrimaryStatus.overdue);
      expect(item.isOverdueAt(now), isTrue);
    });

    test('unfinished work within three days is due soon', () {
      final item = _hw(
        rawStatus: 'NOT_SUBMITTED',
        dueAt: now.add(const Duration(days: 2)),
      );
      expect(item.primaryStatusAt(now), ParentHomeworkPrimaryStatus.dueSoon);
      expect(item.isDueSoonAt(now), isTrue);
    });
  });

  test('repeated class context is removed from the display title', () {
    final item = _hw(
      rawStatus: 'NOT_SUBMITTED',
      title: 'Class 1-A Mathematics Review 3',
      classSection: 'Class 1 - A',
    );
    expect(item.displayTitle, 'Mathematics Review 3');
  });
}

ParentPortalHomework _hw({
  required String rawStatus,
  String title = 'Review 3',
  String classSection = 'Grade 4 - A',
  DateTime? dueAt,
  num? score,
  num? maxScore,
  DateTime? submittedAt,
}) {
  return ParentPortalHomework(
    id: 'hw-1',
    childId: 'child-a',
    childName: 'Asha Rai',
    classSection: classSection,
    subject: 'Mathematics',
    title: title,
    dueLabel: 'Due',
    dueAt: dueAt,
    rawStatus: rawStatus,
    attachmentCount: 0,
    teacher: 'Assigned by school',
    score: score,
    maxScore: maxScore,
    submittedAt: submittedAt,
  );
}
