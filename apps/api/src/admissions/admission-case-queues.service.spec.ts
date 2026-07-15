/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdmissionCaseQueuesService } from './admission-case-queues.service';

const actor = { tenantId: 'tenant-a' } as any;

function record(duplicateReview: unknown = {}) {
  return {
    id: 'case-a',
    status: 'READY_TO_ADMIT',
    firstNameEn: 'Aarav',
    lastNameEn: 'Shrestha',
    guardianFullName: 'Sita Shrestha',
    guardianPhone: '9800000000',
    source: 'OFFICE_WALK_IN',
    classId: 'class-a',
    sectionId: 'section-a',
    convertedStudentId: null,
    duplicateReview,
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  };
}

describe('AdmissionCaseQueuesService', () => {
  it('applies duplicate metadata and search filters before database pagination', async () => {
    const prisma = {
      admissionApplication: {
        count: jest.fn().mockResolvedValue(26),
        findMany: jest
          .fn()
          .mockResolvedValue([
            record({ duplicateRisk: true, duplicateCandidates: [{}] }),
          ]),
      },
    } as any;
    const service = new AdmissionCaseQueuesService(prisma);

    const result = await service.list(actor, {
      queue: 'DUPLICATE_WARNINGS',
      search: 'Aarav',
      page: 1,
      limit: 25,
    });

    expect(prisma.admissionApplication.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        status: { in: expect.any(Array) },
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              {
                duplicateReview: {
                  path: ['duplicateRisk'],
                  equals: true,
                },
              },
            ]),
          }),
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    });
    expect(result.total).toBe(26);
    expect(result.hasNextPage).toBe(true);
    expect(result.items[0].hasDuplicateWarning).toBe(true);
  });

  it('does not treat an empty duplicate-candidate array as a warning', async () => {
    const prisma = {
      admissionApplication: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([record({ duplicateCandidates: [] })]),
      },
    } as any;
    const service = new AdmissionCaseQueuesService(prisma);

    const result = await service.list(actor, { page: 1, limit: 25 });

    expect(result.items[0].hasDuplicateWarning).toBe(false);
  });

  it('filters document follow-up cases in the database', async () => {
    const prisma = {
      admissionApplication: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    const service = new AdmissionCaseQueuesService(prisma);

    await service.list(actor, { queue: 'DOCUMENTS_PENDING' });

    expect(prisma.admissionApplication.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ['ADMITTED'] },
        AND: expect.arrayContaining([
          {
            duplicateReview: {
              path: ['followUps'],
              array_contains: [{ code: 'DOCUMENTS_PENDING' }],
            },
          },
        ]),
      }),
    });
  });

  it('maps the completed workspace queue to admitted storage statuses', async () => {
    const prisma = {
      admissionApplication: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    const service = new AdmissionCaseQueuesService(prisma);

    await service.list(actor, { queue: 'COMPLETED' });

    expect(prisma.admissionApplication.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        status: { in: ['ADMITTED', 'ENROLLED'] },
      }),
    });
  });
});
