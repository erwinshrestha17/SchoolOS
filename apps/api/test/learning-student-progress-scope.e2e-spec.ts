import { ForbiddenException } from '@nestjs/common';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  studentActor,
} from './learning-test-utils';

describe('Learning student progress scope (E2E)', () => {
  it('allows a student to read only their own learning progress', async () => {
    const { prisma, progress } = createLearningHarness();
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

    const own = await progress.getStudentProgress(studentActor(), 'student-a');
    expect(own.student.id).toBe('student-a');
    expect(own.items).toHaveLength(1);
    expect(JSON.stringify(own)).not.toMatch(/leaderboard|ranking|rank/i);

    await expect(
      progress.getStudentProgress(studentActor(), 'student-b'),
    ).rejects.toThrow(ForbiddenException);
  });
});
