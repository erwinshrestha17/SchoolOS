/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdmissionCaseQueuesService } from './admission-case-queues.service';

const actor = { tenantId: 'tenant-a' } as any;

function record(
  duplicateReview: unknown = {},
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'case-a',
    status: 'READY_TO_ADMIT',
    firstNameEn: 'Aarav',
    lastNameEn: 'Shrestha',
    guardianFullName: 'Sita Shrestha',
    guardianPhone: '9800000000',
    source: 'OFFICE_WALK_IN',
    academicYearId: 'year-a',
    classId: 'class-a',
    sectionId: 'section-a',
    convertedStudentId: null,
    duplicateReview,
    policyVersion: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
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
          expect.objectContaining({
            OR: expect.arrayContaining([{ id: { equals: 'Aarav' } }]),
          }),
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

  it('returns a stable, tenant-scoped waitlist with batched capacity truth', async () => {
    const prisma = {
      admissionApplication: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          record(
            {},
            {
              id: 'case-oldest',
              status: 'WAITLISTED',
              policyVersion: {
                tenantId: 'tenant-a',
                enforceCapacityWhenAvailable: true,
                capacityOverride: 3,
              },
            },
          ),
          record(
            {},
            {
              id: 'case-next',
              status: 'WAITLISTED',
              sectionId: 'section-b',
              policyVersion: {
                tenantId: 'tenant-b',
                enforceCapacityWhenAvailable: true,
                capacityOverride: 1,
              },
            },
          ),
        ]),
      },
      class: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'class-a', name: 'Grade 8' }]),
      },
      section: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'section-a',
            classId: 'class-a',
            name: 'Himalaya',
            capacity: 30,
          },
          {
            id: 'section-b',
            classId: 'class-a',
            name: 'Sagarmatha',
            capacity: 10,
          },
        ]),
      },
      enrollment: {
        groupBy: jest.fn().mockResolvedValue([
          {
            academicYearId: 'year-a',
            sectionId: 'section-a',
            _count: { _all: 3 },
          },
          {
            academicYearId: 'year-a',
            sectionId: 'section-b',
            _count: { _all: 9 },
          },
        ]),
      },
    } as any;
    const service = new AdmissionCaseQueuesService(prisma);

    const result = await service.list(actor, {
      queue: 'WAITLISTED',
      page: 1,
      limit: 25,
    });

    expect(prisma.admissionApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(prisma.class.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', id: { in: ['class-a'] } },
      select: { id: true, name: true },
    });
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          id: { in: ['section-a', 'section-b'] },
        },
      }),
    );
    expect(prisma.enrollment.groupBy).toHaveBeenCalledWith({
      by: ['academicYearId', 'sectionId'],
      where: {
        tenantId: 'tenant-a',
        status: 'ACTIVE',
        OR: [
          { academicYearId: 'year-a', sectionId: 'section-a' },
          { academicYearId: 'year-a', sectionId: 'section-b' },
        ],
      },
      _count: { _all: true },
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'case-oldest',
        className: 'Grade 8',
        sectionName: 'Himalaya',
        canPromoteFromWaitlist: false,
        waitlistCapacity: {
          state: 'FULL',
          capacity: 3,
          enrolled: 3,
          seatsAvailable: 0,
          enforced: true,
        },
      }),
      expect.objectContaining({
        id: 'case-next',
        sectionName: 'Sagarmatha',
        canPromoteFromWaitlist: true,
        waitlistCapacity: {
          state: 'NEARLY_FULL',
          capacity: 10,
          enrolled: 9,
          seatsAvailable: 1,
          enforced: false,
        },
      }),
    ]);
  });
});
