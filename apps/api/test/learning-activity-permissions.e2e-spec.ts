import { ForbiddenException } from '@nestjs/common';
import {
  LearningActivityType,
  LearningDifficulty,
  LearningMode,
} from '@prisma/client';
import {
  createLearningHarness,
  seedLearningBase,
  teacherActor,
} from './learning-test-utils';

describe('Learning activity permissions (E2E)', () => {
  it('denies teacher activity creation for an unassigned class', async () => {
    const { prisma, activities } = createLearningHarness();
    seedLearningBase(prisma);

    await expect(
      activities.createActivity(
        {
          title: 'Grade 5 fractions',
          classId: 'class-b',
          sectionId: 'section-b',
          subjectId: 'subject-b',
          activityType: LearningActivityType.QUIZ,
          difficulty: LearningDifficulty.EASY,
          mode: LearningMode.COMPUTER_LAB,
        },
        teacherActor(),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies teacher activity creation for an unassigned subject', async () => {
    const { prisma, activities } = createLearningHarness();
    seedLearningBase(prisma);

    await expect(
      activities.createActivity(
        {
          title: 'Science practice',
          classId: 'class-a',
          sectionId: 'section-a',
          subjectId: 'subject-other',
          activityType: LearningActivityType.PRACTICE,
          difficulty: LearningDifficulty.MEDIUM,
          mode: LearningMode.SMART_BOARD,
        },
        teacherActor(),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
