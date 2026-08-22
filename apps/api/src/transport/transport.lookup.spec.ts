import { StaffStatus } from '@prisma/client';
import { TransportService } from './transport.service';

describe('Transport lookup boundaries', () => {
  const tenantId = 'tenant-1';

  function createService() {
    const prisma: any = {
      staff: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      transportDriverAssignment: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    const service = new TransportService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );

    return { prisma, service };
  }

  it('returns only narrow active staff options from the authenticated tenant', async () => {
    const { prisma, service } = createService();
    prisma.staff.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        employeeId: 'EMP-001',
        staffCode: 'DRV-001',
        firstName: 'Ram',
        lastName: 'Shrestha',
        department: 'Transport',
        designation: 'Driver',
      },
    ]);
    prisma.staff.count.mockResolvedValue(1);

    const result = await service.listActiveStaffOptions(
      { search: 'Ram', page: 1, limit: 25 },
      {
        userId: 'admin-1',
        tenantId,
        roles: ['admin'],
        permissions: ['transport:assignments:create'],
      } as any,
    );

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: StaffStatus.ACTIVE,
        }),
        select: {
          id: true,
          employeeId: true,
          staffCode: true,
          firstName: true,
          lastName: true,
          department: true,
          designation: true,
        },
        skip: 0,
        take: 25,
      }),
    );
    expect(prisma.staff.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId,
        status: StaffStatus.ACTIVE,
      }),
    });
    expect(result).toEqual({
      items: [
        {
          id: 'staff-1',
          employeeId: 'EMP-001',
          staffCode: 'DRV-001',
          fullName: 'Ram Shrestha',
          department: 'Transport',
          designation: 'Driver',
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
      hasNextPage: false,
    });
  });

  it('keeps driver assignment lookup self-scoped even for a broadly privileged actor', async () => {
    const { prisma, service } = createService();
    prisma.transportDriverAssignment.findMany.mockResolvedValue([]);

    await service.listDriverOwnAssignments({
      userId: 'admin-1',
      tenantId,
      roles: ['admin'],
      permissions: ['transport:manage', 'transport:operate'],
    } as any);

    expect(prisma.transportDriverAssignment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        staff: { userId: 'admin-1' },
      },
      select: {
        id: true,
        vehicleId: true,
        routeId: true,
        licenseNumber: true,
        licenseExpires: true,
        startsAt: true,
        endsAt: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            model: true,
            capacity: true,
            status: true,
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }],
      take: 100,
    });
  });
});
