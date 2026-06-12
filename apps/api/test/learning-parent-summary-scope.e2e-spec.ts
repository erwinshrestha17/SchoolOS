import { ForbiddenException } from '@nestjs/common';
import {
  createLearningHarness,
  parentActor,
  seedLearningActivity,
  seedLearningBase,
} from './learning-test-utils';

describe('Learning parent summary scope (E2E)', () => {
  it('denies a parent summary for another child', async () => {
    const { prisma, parentSummary } = createLearningHarness();
    seedLearningBase(prisma);

    await expect(
      parentSummary.getSummary(parentActor(), 'student-b'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns child-scoped summary without raw answers', async () => {
    const { prisma, parentSummary } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    prisma.__state.learningProgress.push({
      id: 'progress-a',
      tenantId: 'tenant-a',
      studentId: 'student-a',
      progressKey: 'subject:subject-a:topic:none:activity:activity-a',
      subjectId: 'subject-a',
      activityId: 'activity-a',
      completedCount: 1,
      averageAccuracy: 100,
      label: 'STRONG',
    });
    prisma.__state.learningAttempts.push({
      id: 'attempt-a',
      tenantId: 'tenant-a',
      studentId: 'student-a',
      sessionId: 'session-a',
      activityId: 'activity-a',
      status: 'SUBMITTED',
      submittedAt: new Date(),
      score: 1,
      accuracy: 100,
    });
    prisma.__state.learningAnswers.push({
      id: 'answer-a',
      tenantId: 'tenant-a',
      attemptId: 'attempt-a',
      questionId: 'question-a',
      answer: 'A',
    });

    const summary = await parentSummary.getSummary(parentActor(), 'student-a');
    expect(summary.items).toHaveLength(1);
    expect(JSON.stringify(summary)).not.toContain('answer-a');
  });
});
