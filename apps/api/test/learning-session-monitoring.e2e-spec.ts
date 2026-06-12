import { ForbiddenException } from '@nestjs/common';
import {
  LearningAttemptStatus,
  LearningSessionStatus,
  StaffStatus,
} from '@prisma/client';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  seedLearningSession,
  teacherActor,
} from './learning-test-utils';
import { createAuthContextMock } from './test-helpers';

describe('Learning session monitoring (E2E)', () => {
  it('lists tenant-scoped teacher session summaries with safe counts', async () => {
    const { prisma, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);
    prisma.__state.learningParticipants.push({
      id: 'participant-a',
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      studentId: 'student-a',
      status: 'JOINED',
      joinedAt: new Date(),
    });
    prisma.__state.learningAttempts.push({
      id: 'attempt-a',
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      activityId: 'activity-a',
      studentId: 'student-a',
      attemptNumber: 1,
      status: LearningAttemptStatus.SUBMITTED,
      score: 1,
      accuracy: 100,
      timeSpentSeconds: 30,
      hintsUsed: 0,
      startedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await sessions.listSessions(teacherActor(), {
      status: LearningSessionStatus.LIVE,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'session-a',
      participantCount: 1,
      attemptCount: 1,
      submittedCount: 1,
    });
    expect(result.items[0]).not.toHaveProperty('answers');
  });

  it('records heartbeat only for authorized staff scope', async () => {
    const { prisma, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);
    prisma.__state.staff.push({
      id: 'other-teacher',
      tenantId: 'tenant-a',
      userId: 'other-teacher-user',
      firstName: 'Other',
      lastName: 'Teacher',
      status: StaffStatus.ACTIVE,
    });

    const updated = await sessions.heartbeatSession(
      teacherActor(),
      'session-a',
    );
    expect(updated.teacherHeartbeatAt).toBeInstanceOf(Date);

    await expect(
      sessions.heartbeatSession(
        createAuthContextMock({
          userId: 'other-teacher-user',
          tenantId: 'tenant-a',
          tenantSlug: 'tenant-a',
          roles: ['teacher'],
          permissions: ['learning:read', 'learning:launch'],
        }),
        'session-a',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns participant monitor payload without raw answers', async () => {
    const { prisma, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);
    prisma.__state.learningParticipants.push({
      id: 'participant-a',
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      studentId: 'student-a',
      status: 'JOINED',
      joinedAt: new Date(),
    });
    prisma.__state.learningAttempts.push({
      id: 'attempt-a',
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      activityId: 'activity-a',
      studentId: 'student-a',
      attemptNumber: 1,
      status: LearningAttemptStatus.SUBMITTED,
      score: 1,
      accuracy: 100,
      timeSpentSeconds: 30,
      hintsUsed: 0,
      startedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.__state.learningAnswers.push({
      id: 'answer-a',
      tenantId: 'tenant-a',
      attemptId: 'attempt-a',
      questionId: 'question-a',
      answer: 'private',
      isCorrect: true,
      score: 1,
      answeredAt: new Date(),
    });

    const result = await sessions.listParticipants(teacherActor(), 'session-a');

    expect(result.items[0]).toMatchObject({
      student: { id: 'student-a', name: 'Student A' },
      attempt: { id: 'attempt-a', status: 'SUBMITTED' },
    });
    expect(result.items[0].attempt).not.toHaveProperty('answers');
  });
});
