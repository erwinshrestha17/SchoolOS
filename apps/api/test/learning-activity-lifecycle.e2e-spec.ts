import { ConflictException } from '@nestjs/common';
import { LearningActivityStatus } from '@prisma/client';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  teacherActor,
} from './learning-test-utils';

describe('Learning activity lifecycle (E2E)', () => {
  it('blocks editing and launching archived activities', async () => {
    const { prisma, activities, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    await activities.archiveActivity('activity-a', teacherActor());
    expect(prisma.__state.learningActivities[0].status).toBe(
      LearningActivityStatus.ARCHIVED,
    );

    await expect(
      activities.updateActivity(
        'activity-a',
        { title: 'Updated title' },
        teacherActor(),
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      sessions.launchSession('activity-a', {}, teacherActor()),
    ).rejects.toThrow(ConflictException);
  });

  it('returns qrToken only on launch and never exposes qrTokenHash in session reads', async () => {
    const { prisma, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    const launched = await sessions.launchSession(
      'activity-a',
      {},
      teacherActor(),
    );

    expect(typeof launched.qrToken).toBe('string');
    expect(launched.qrToken.length).toBeGreaterThan(10);
    expect(launched).not.toHaveProperty('qrTokenHash');

    const listed = await sessions.listSessions(teacherActor(), {});
    expect(listed.items[0]).not.toHaveProperty('qrTokenHash');
    expect(listed.items[0]).not.toHaveProperty('qrToken');

    const detail = await sessions.getSession(teacherActor(), launched.id);
    expect(detail).not.toHaveProperty('qrTokenHash');
    expect(detail).not.toHaveProperty('qrToken');
  });
});
