import { NotFoundException } from '@nestjs/common';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';
import {
  createLearningHarness,
  seedLearningActivity,
  seedLearningBase,
  teacherActor,
} from './learning-test-utils';
import { createAuthContextMock } from './test-helpers';

describe('Learning resources (E2E)', () => {
  it('creates, lists, and archives activity resources with audit logs', async () => {
    const { prisma, resources, auditService } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    const created = await resources.attachActivityResource(
      teacherActor(),
      'activity-a',
      {
        type: LearningResourceType.LINK,
        title: 'Fraction reference',
        url: 'https://school.example/resources/fractions',
      },
    );

    expect(created).toMatchObject({
      title: 'Fraction reference',
      activityId: 'activity-a',
      status: LearningResourceStatus.ACTIVE,
    });

    const listed = await resources.listActivityResources(
      teacherActor(),
      'activity-a',
    );
    expect(listed.items).toHaveLength(1);

    const archived = await resources.archiveResource(
      teacherActor(),
      created.id,
    );
    expect(archived.status).toBe(LearningResourceStatus.ARCHIVED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'archive',
        resource: 'learning_resource',
        tenantId: 'tenant-a',
      }),
    );
  });

  it('validates File Registry ownership for file resources', async () => {
    const { prisma, resources } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);
    prisma.__state.fileAssets.push({
      id: 'file-a',
      tenantId: 'tenant-a',
      module: 'learning',
      entityType: 'LearningResource',
      entityId: 'activity-a',
      objectKey: 'tenant-a/learning/file-a.pdf',
      bucket: 'private',
      originalFilename: 'fractions.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      checksum: 'checksum',
      accessLevel: 'PRIVATE',
      uploadedBy: 'teacher-user',
      softDeletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await resources.attachActivityResource(
      teacherActor(),
      'activity-a',
      {
        type: LearningResourceType.FILE,
        title: 'Worksheet PDF',
        fileAssetId: 'file-a',
      },
    );

    expect(created.fileAsset).toMatchObject({
      id: 'file-a',
      fileName: 'fractions.pdf',
    });

    await expect(
      resources.attachActivityResource(teacherActor(), 'activity-a', {
        type: LearningResourceType.FILE,
        title: 'Wrong tenant file',
        fileAssetId: 'missing-file',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies cross-tenant resource detail access', async () => {
    const { prisma, resources } = createLearningHarness();
    seedLearningBase(prisma);
    seedLearningActivity(prisma);

    const created = await resources.attachActivityResource(
      teacherActor(),
      'activity-a',
      {
        type: LearningResourceType.NOTE,
        title: 'Teacher note',
        metadata: { note: 'Use board examples.' },
      },
    );

    await expect(
      resources.getResource(
        createAuthContextMock({
          userId: 'tenant-b-user',
          tenantId: 'tenant-b',
          tenantSlug: 'tenant-b',
          roles: ['admin'],
          permissions: ['learning:read'],
        }),
        created.id,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
