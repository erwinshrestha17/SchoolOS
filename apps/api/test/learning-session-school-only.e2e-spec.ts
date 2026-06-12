import { ForbiddenException } from '@nestjs/common';
import { LearningSessionStatus } from '@prisma/client';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  seedLearningSession,
  studentActor,
} from './learning-test-utils';

describe('Learning session school-only access (E2E)', () => {
  it('denies joining an inactive session', async () => {
    const { prisma, access } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma, { status: LearningSessionStatus.PAUSED });

    await expect(
      access.joinSession(studentActor(), { sessionCode: 'ABC123' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies joining an expired session', async () => {
    const { prisma, access } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma, { expiresAt: new Date(Date.now() - 1000) });

    await expect(
      access.joinSession(studentActor(), { sessionCode: 'ABC123' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies joining another class session', async () => {
    const { prisma, access } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma, { classId: 'class-b', sectionId: 'section-b' });

    await expect(
      access.joinSession(studentActor(), { sessionCode: 'ABC123' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
