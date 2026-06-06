import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoRequestsService } from './demo-requests.service';

interface DemoRequestCreateArgs {
  data: Record<string, unknown>;
  select: {
    id: true;
    status: true;
    createdAt: true;
  };
}

describe('DemoRequestsService', () => {
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const createPrismaMock = () => ({
    demoRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  });

  const buildModule = async (prisma: ReturnType<typeof createPrismaMock>) =>
    Test.createTestingModule({
      providers: [
        DemoRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists a public demo request with normalized optional fields', async () => {
    const create = jest.fn<
      Promise<{ id: string; status: string; createdAt: Date }>,
      [DemoRequestCreateArgs]
    >();
    create.mockResolvedValue({
      id: 'demo-request-1',
      status: 'NEW',
      createdAt: new Date('2026-06-04T00:00:00.000Z'),
    });

    const prisma = createPrismaMock();
    prisma.demoRequest.create = create;

    const moduleRef = await buildModule(prisma);
    const service = moduleRef.get(DemoRequestsService);
    const result = await service.create({
      schoolName: ' Everest Academy ',
      schoolType: 'Secondary School',
      location: ' Kathmandu ',
      studentsCount: '500-1000',
      branchesCount: '',
      contactName: ' Principal ',
      role: ' Principal ',
      phone: '9800000000',
      email: 'PRINCIPAL@SCHOOL.EDU.NP',
      preferredContact: 'Email',
      currentSystem: 'Ledger',
      expectedTimeline: 'Within 1 month',
      interestedModules: ['Fees & Receipts', ' Attendance '],
      message: ' Need pilot planning ',
    });

    expect(result).toEqual({
      id: 'demo-request-1',
      status: 'NEW',
      createdAt: new Date('2026-06-04T00:00:00.000Z'),
    });
    expect(create).toHaveBeenCalledTimes(1);
    const createArg = create.mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({
      schoolName: 'Everest Academy',
      location: 'Kathmandu',
      branchesCount: null,
      contactName: 'Principal',
      email: 'principal@school.edu.np',
      interestedModules: ['Fees & Receipts', 'Attendance'],
      message: 'Need pilot planning',
    });
  });

  it('lists demo requests with pagination and filters', async () => {
    const prisma = createPrismaMock();
    prisma.demoRequest.findMany.mockResolvedValue([
      {
        id: 'demo-request-1',
        schoolName: 'Everest Academy',
        schoolType: 'Secondary School',
        location: 'Kathmandu',
        studentsCount: '500-1000',
        contactName: 'Principal',
        role: 'Principal',
        phone: '9800000000',
        email: 'principal@school.edu.np',
        expectedTimeline: 'Within 1 month',
        status: 'NEW',
        createdAt: new Date('2026-06-04T00:00:00.000Z'),
        updatedAt: new Date('2026-06-04T00:00:00.000Z'),
      },
    ]);
    prisma.demoRequest.count.mockResolvedValue(1);

    const moduleRef = await buildModule(prisma);
    const service = moduleRef.get(DemoRequestsService);
    const result = await service.listPage({
      page: 1,
      limit: 25,
      search: 'everest',
      status: 'NEW',
      dateFrom: '2026-06-01T00:00:00.000Z',
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.schoolName).toBe('Everest Academy');
    expect(prisma.demoRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'NEW',
          OR: expect.any(Array),
          createdAt: { gte: new Date('2026-06-01T00:00:00.000Z') },
        }),
        skip: 0,
        take: 25,
      }),
    );
  });

  it('updates demo request status and audits the change', async () => {
    const prisma = createPrismaMock();
    prisma.demoRequest.findUnique.mockResolvedValue({
      id: 'demo-request-1',
      status: 'NEW',
      internalNotes: null,
    });
    prisma.demoRequest.update.mockResolvedValue({
      id: 'demo-request-1',
      schoolName: 'Everest Academy',
      schoolType: 'Secondary School',
      location: 'Kathmandu',
      studentsCount: '500-1000',
      contactName: 'Principal',
      role: 'Principal',
      phone: '9800000000',
      email: 'principal@school.edu.np',
      expectedTimeline: 'Within 1 month',
      status: 'CONTACTED',
      createdAt: new Date('2026-06-04T00:00:00.000Z'),
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
      branchesCount: null,
      preferredContact: 'Email',
      currentSystem: null,
      interestedModules: ['Fees & Receipts'],
      message: 'Need pilot planning',
      internalNotes: 'Called and scheduled follow-up',
    });

    const moduleRef = await buildModule(prisma);
    const service = moduleRef.get(DemoRequestsService);
    const result = await service.updateStatus(
      'demo-request-1',
      {
        status: 'CONTACTED',
        internalNotes: 'Called and scheduled follow-up',
      },
      'platform-user-1',
    );

    expect(result.status).toBe('CONTACTED');
    expect(result.internalNotes).toBe('Called and scheduled follow-up');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'demo_request_status_updated',
        resource: 'demo_request',
        resourceId: 'demo-request-1',
        tenantId: 'platform',
        userId: 'platform-user-1',
      }),
    );
  });

  it('throws when a demo request is missing', async () => {
    const prisma = createPrismaMock();
    prisma.demoRequest.findUnique.mockResolvedValue(null);

    const moduleRef = await buildModule(prisma);
    const service = moduleRef.get(DemoRequestsService);

    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    await expect(
      service.updateStatus(
        'missing',
        { status: 'CONTACTED' },
        'platform-user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
