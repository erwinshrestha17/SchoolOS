import { Test } from '@nestjs/testing';
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

    const prisma = {
      demoRequest: {
        create,
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DemoRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

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
    expect(createArg?.select).toEqual({
      id: true,
      status: true,
      createdAt: true,
    });
  });
});
