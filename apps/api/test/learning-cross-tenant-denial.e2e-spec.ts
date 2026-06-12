import { NotFoundException } from '@nestjs/common';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  seedLearningSession,
  studentActor,
} from './learning-test-utils';
import { createAuthContextMock } from './test-helpers';

describe('Learning cross-tenant denial (E2E)', () => {
  it('denies cross-tenant activity access', async () => {
    const { prisma, activities } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    await expect(
      activities.getActivity(
        createAuthContextMock({
          userId: 'tenant-b-user',
          tenantId: 'tenant-b',
          tenantSlug: 'tenant-b',
          roles: ['admin'],
          permissions: ['learning:read'],
        }),
        'activity-a',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies cross-tenant session code access', async () => {
    const { prisma, access } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    seedLearningSession(prisma);

    await expect(
      access.joinSession(
        {
          ...studentActor(),
          tenantId: 'tenant-b',
          tenantSlug: 'tenant-b',
        },
        { sessionCode: 'ABC123' },
      ),
    ).rejects.toThrow();
  });
});
