import { ForbiddenException } from '@nestjs/common';
import { LearningSessionStatus, StudentLifecycleStatus } from '@prisma/client';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  seedLearningSession,
  studentActor,
  teacherActor,
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

  it('denies joining another section session in the same class', async () => {
    const { prisma, access } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    prisma.__state.sections.push({
      id: 'section-a-alt',
      tenantId: 'tenant-a',
      classId: 'class-a',
      name: 'B',
    });
    prisma.__state.students.push({
      id: 'student-a-alt',
      tenantId: 'tenant-a',
      userId: 'student-alt-user',
      studentSystemId: 'ST-A-ALT',
      firstNameEn: 'Student',
      lastNameEn: 'Alt',
      classId: 'class-a',
      sectionId: 'section-a-alt',
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      dateOfBirth: new Date(),
      admissionDate: new Date(),
    });
    seedLearningSession(prisma);

    await expect(
      access.joinSession(
        {
          ...studentActor(),
          userId: 'student-alt-user',
        },
        { sessionCode: 'ABC123' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows joining a live session with a valid QR token hash lookup', async () => {
    const { prisma, access, sessions } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    const launched = await sessions.launchSession(
      'activity-a',
      {},
      teacherActor(),
    );

    const joined = await access.joinSession(studentActor(), {
      qrToken: launched.qrToken,
    });

    expect(joined.session.id).toBe(launched.id);
    expect(joined.participant.studentId).toBe('student-a');
    expect(JSON.stringify(joined)).not.toContain(launched.qrToken);
  });
});
