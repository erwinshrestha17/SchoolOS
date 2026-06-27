import { NotFoundException } from '@nestjs/common';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  seedLearningSession,
  studentActor,
} from './learning-test-utils';

describe('Learning attempt progress (E2E)', () => {
  it('autosaves idempotently, submits idempotently, and records progress once', async () => {
    const { prisma, attempts } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);

    const firstStart = await attempts.startAttempt('session-a', studentActor());
    const secondStart = await attempts.startAttempt(
      'session-a',
      studentActor(),
    );
    expect(secondStart.id).toBe(firstStart.id);

    await attempts.autosaveAttempt(
      firstStart.id,
      { answers: [{ questionId: 'question-a', answer: 'A' }] },
      studentActor(),
    );
    await attempts.autosaveAttempt(
      firstStart.id,
      { answers: [{ questionId: 'question-a', answer: 'A' }] },
      studentActor(),
    );
    expect(prisma.__state.learningAnswers).toHaveLength(1);

    const submitted = await attempts.submitAttempt(
      firstStart.id,
      { answers: [{ questionId: 'question-a', answer: 'A' }] },
      studentActor(),
    );
    const submittedAgain = await attempts.submitAttempt(
      firstStart.id,
      { answers: [{ questionId: 'question-a', answer: 'B' }] },
      studentActor(),
    );

    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.score).toBe(1);
    expect(submittedAgain.score).toBe(1);
    expect(prisma.__state.learningProgress).toHaveLength(1);
    expect(prisma.__state.learningProgress[0].completedCount).toBe(1);
  });

  it('does not record progress from autosave alone', async () => {
    const { prisma, attempts } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);

    const started = await attempts.startAttempt('session-a', studentActor());
    await attempts.autosaveAttempt(
      started.id,
      { answers: [{ questionId: 'question-a', answer: 'A' }] },
      studentActor(),
    );

    expect(prisma.__state.learningProgress).toHaveLength(0);
  });

  it('denies another student from reading or changing an existing attempt', async () => {
    const { prisma, attempts } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);

    const started = await attempts.startAttempt('session-a', studentActor());
    const anotherStudent = { ...studentActor(), userId: 'student-b-user' };

    await expect(
      attempts.autosaveAttempt(
        started.id,
        { answers: [{ questionId: 'question-a', answer: 'A' }] },
        anotherStudent,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      attempts.submitAttempt(
        started.id,
        { answers: [{ questionId: 'question-a', answer: 'A' }] },
        anotherStudent,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.__state.learningAnswers).toHaveLength(0);
    expect(prisma.__state.learningProgress).toHaveLength(0);
  });
});
