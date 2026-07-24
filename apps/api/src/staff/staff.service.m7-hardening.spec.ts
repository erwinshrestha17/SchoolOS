import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Gender, Prisma, StaffStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { StaffService } from './staff.service';

const actor: AuthContext = {
  userId: 'staff-user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'staff@school.test',
  roles: ['teacher'],
  permissions: ['staff:read'],
  authMethod: 'PASSWORD',
};

const hrActor: AuthContext = {
  ...actor,
  userId: 'hr-user-1',
  roles: ['hr'],
  permissions: ['hr:manage', 'staff:read'],
};

describe('StaffService M7 HR hardening', () => {
  it('masks bank, PAN, salary, and payroll fields without HR/payroll management permission', async () => {
    const { service } = buildService({
      staff: buildStaff({
        bankAccount: '1234567890',
        panNumber: 'PAN-123456',
        salaryStructures: [
          {
            id: 'salary-1',
            basicSalary: new Prisma.Decimal(50000),
            allowances: new Prisma.Decimal(5000),
            deductions: new Prisma.Decimal(1000),
            bankAccount: '1234567890',
            bankName: 'Nepal Bank',
            components: [{ name: 'PF' }],
          },
        ],
        payrollLines: [
          {
            id: 'line-1',
            grossSalary: new Prisma.Decimal(55000),
            netSalary: new Prisma.Decimal(49000),
          },
        ],
      }),
    });

    const detail = await service.getStaffDetail('staff-1', actor);

    expect(detail.bankAccount).toBe('12****90');
    expect(detail.panNumber).toBe('PA****56');
    expect(detail.salaryStructures).toEqual([
      expect.objectContaining({
        basicSalary: null,
        allowances: null,
        deductions: null,
        bankAccount: null,
        components: [],
        masked: true,
      }),
    ]);
    expect(detail.payrollLines).toEqual([
      expect.objectContaining({
        grossSalary: null,
        netSalary: null,
        masked: true,
      }),
    ]);
  });

  it('never leaks the raw User relation (passwordHash) via mapStaffDetail, even to a self-service viewer', async () => {
    const { service } = buildService({
      staff: buildStaff({
        user: {
          email: 'asha@school.test',
          passwordHash: 'bcrypt$fake-hash-should-never-be-returned',
          lockedUntil: null,
          failedLoginCount: 0,
          userRoles: [{ role: { name: 'teacher' } }],
        },
      }),
    });

    const detail = await service.getStaffDetail('staff-1', actor);

    expect(detail.user).toBeUndefined();
    expect(JSON.stringify(detail)).not.toContain('passwordHash');
    expect(JSON.stringify(detail)).not.toContain(
      'fake-hash-should-never-be-returned',
    );
    expect(detail.email).toBe('asha@school.test');
    expect(detail.roles).toEqual(['teacher']);
  });

  it('rejects paid leave requests that exceed the available balance', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff(),
      leaveBalances: [
        {
          opening: new Prisma.Decimal(0),
          accrued: new Prisma.Decimal(0),
          allocated: new Prisma.Decimal(1),
          carried: new Prisma.Decimal(0),
          adjusted: new Prisma.Decimal(0),
          used: new Prisma.Decimal(0),
        },
      ],
    });

    await expect(
      service.createLeaveRequest(
        'staff-1',
        {
          leaveType: 'SICK',
          startsOn: '2026-05-01',
          endsOn: '2026-05-03',
          reason: 'Medical leave',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.staffLeaveRequest.create).not.toHaveBeenCalled();
  });

  it('blocks leave approval when the leave overlaps an existing payroll run', async () => {
    const { service, prisma } = buildService({
      leaveRequest: {
        id: 'leave-1',
        tenantId: actor.tenantId,
        staffId: 'staff-1',
        leaveType: 'UNPAID',
        isPaid: false,
        startsOn: new Date('2026-05-10T00:00:00.000Z'),
        endsOn: new Date('2026-05-11T00:00:00.000Z'),
        days: new Prisma.Decimal(2),
        reason: 'Family emergency',
        status: 'PENDING',
      },
      payrollRuns: [
        {
          id: 'run-1',
          periodMonth: 5,
          periodYear: 2026,
          status: 'POSTED',
        },
      ],
    });

    await expect(
      service.reviewLeaveRequest('leave-1', { status: 'APPROVED' }, hrActor),
    ).rejects.toThrow(/Reverse\/regenerate payroll/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks a new leave request that overlaps an existing pending or approved request', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff(),
    });
    (prisma.staffLeaveRequest.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'leave-existing',
      status: 'PENDING',
      startsOn: new Date('2026-05-01T00:00:00.000Z'),
      endsOn: new Date('2026-05-03T00:00:00.000Z'),
    });

    await expect(
      service.createLeaveRequest(
        'staff-1',
        {
          leaveType: 'SICK',
          startsOn: '2026-05-02',
          endsOn: '2026-05-04',
          reason: 'Fever',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.staffLeaveRequest.create).not.toHaveBeenCalled();
  });

  it('blocks leave approval for a staff member who has since been terminated', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff({ status: StaffStatus.TERMINATED }),
      leaveRequest: {
        id: 'leave-1',
        tenantId: actor.tenantId,
        staffId: 'staff-1',
        leaveType: 'SICK',
        isPaid: true,
        startsOn: new Date('2026-05-10T00:00:00.000Z'),
        endsOn: new Date('2026-05-11T00:00:00.000Z'),
        days: new Prisma.Decimal(2),
        reason: 'Fever',
        status: 'PENDING',
      },
    });

    await expect(
      service.reviewLeaveRequest('leave-1', { status: 'APPROVED' }, hrActor),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks leave approval that would overlap another already-approved leave request', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff(),
      leaveRequest: {
        id: 'leave-1',
        tenantId: actor.tenantId,
        staffId: 'staff-1',
        leaveType: 'SICK',
        isPaid: true,
        startsOn: new Date('2026-05-10T00:00:00.000Z'),
        endsOn: new Date('2026-05-11T00:00:00.000Z'),
        days: new Prisma.Decimal(2),
        reason: 'Fever',
        status: 'PENDING',
      },
    });
    (prisma.staffLeaveRequest.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'leave-other',
        startsOn: new Date('2026-05-09T00:00:00.000Z'),
        endsOn: new Date('2026-05-10T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.reviewLeaveRequest('leave-1', { status: 'APPROVED' }, hrActor),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents staff from recording attendance for another staff member', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff({ userId: 'other-user' }),
    });

    await expect(
      service.recordStaffAttendance(
        'staff-1',
        {
          attendanceDate: '2026-05-10',
          checkInAt: '2026-05-10T08:55:00.000Z',
        },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.staffAttendance.upsert).not.toHaveBeenCalled();
  });

  it('returns a paginated tenant-scoped staff directory without sensitive payroll fields', async () => {
    const { service, prisma } = buildService({
      staffList: [
        buildStaff({
          id: 'staff-2',
          employeeId: 'EMP-002',
          firstName: 'Bina',
          lastName: 'Accountant',
          department: 'Finance',
          designation: 'Accountant',
          bankAccount: '9999999999',
          panNumber: 'PAN-999',
        }),
      ],
      staffCount: 13,
    });

    const result = await service.listStaffDirectory(
      {
        page: 2,
        limit: 5,
        search: 'bina',
        status: StaffStatus.ACTIVE,
        contractType: 'PERMANENT' as never,
        department: 'Finance',
      },
      hrActor,
    );

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          status: StaffStatus.ACTIVE,
          contractType: 'PERMANENT',
          department: 'Finance',
          OR: expect.any(Array),
        }),
        skip: 5,
        take: 5,
      }),
    );
    expect(prisma.staff.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: actor.tenantId }),
    });
    expect(result).toMatchObject({
      total: 13,
      page: 2,
      limit: 5,
      hasNextPage: true,
      items: [
        expect.objectContaining({
          id: 'staff-2',
          employeeId: 'EMP-002',
          department: 'Finance',
          designation: 'Accountant',
        }),
      ],
    });
    expect(result.items[0]).not.toHaveProperty('bankAccount');
    expect(result.items[0]).not.toHaveProperty('panNumber');
  });

  describe('staff detail/timeline actor scoping (confirmed gap: previously any staff:read holder could view anyone)', () => {
    it('blocks a teacher from viewing another staff member full profile', async () => {
      const { service } = buildService({
        staff: buildStaff({ id: 'staff-2', userId: 'other-user' }),
      });

      await expect(service.getStaffDetail('staff-2', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a teacher to view their own full profile', async () => {
      const { service } = buildService({
        staff: buildStaff({ id: 'staff-1', userId: actor.userId }),
      });

      await expect(
        service.getStaffDetail('staff-1', actor),
      ).resolves.toBeDefined();
    });

    it('allows an HR-privileged actor to view any staff member profile', async () => {
      const { service } = buildService({
        staff: buildStaff({ id: 'staff-2', userId: 'other-user' }),
      });

      await expect(
        service.getStaffDetail('staff-2', hrActor),
      ).resolves.toBeDefined();
    });

    it('blocks a teacher from viewing another staff member timeline', async () => {
      const { service } = buildService({
        staff: buildStaff({ id: 'staff-2', userId: 'other-user' }),
      });

      await expect(service.getStaffTimeline('staff-2', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an HR-privileged actor to view another staff member timeline', async () => {
      const { service } = buildService({
        staff: buildStaff({ id: 'staff-2', userId: 'other-user' }),
      });

      await expect(
        service.getStaffTimeline('staff-2', hrActor),
      ).resolves.toBeDefined();
    });
  });

  describe('contract expiry reminders (confirmed gap: tenant-wide report gated only by hr:staff:read)', () => {
    it('blocks a base teacher from the contract-expiry report', async () => {
      const { service } = buildService({});

      await expect(service.listContractExpiryReminders(actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an HR-privileged actor to run the contract-expiry report', async () => {
      const { service } = buildService({});

      await expect(
        service.listContractExpiryReminders(hrActor),
      ).resolves.toBeDefined();
    });
  });
});

function buildService(
  options: {
    staff?: Record<string, unknown> | null;
    staffList?: Record<string, unknown>[];
    staffCount?: number;
    leaveBalances?: Record<string, unknown>[];
    leaveRequest?: Record<string, unknown> | null;
    payrollRuns?: Record<string, unknown>[];
  } = {},
) {
  const prisma = {
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? buildStaff()),
      findMany: jest
        .fn()
        .mockResolvedValue(options.staffList ?? [buildStaff()]),
      count: jest.fn().mockResolvedValue(options.staffCount ?? 1),
    },
    staffLeaveBalance: {
      findMany: jest.fn().mockResolvedValue(options.leaveBalances ?? []),
    },
    staffLeaveRequest: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(options.leaveRequest ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    payrollRun: {
      findMany: jest.fn().mockResolvedValue(options.payrollRuns ?? []),
    },
    staffAttendance: {
      upsert: jest.fn(),
    },
    staffLifecycleEvent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    staffContract: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payrollLine: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    staffDocument: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
  };

  const service = new StaffService(
    prisma as never,
    {} as never,
    { record: jest.fn() } as never,
    { recordEvent: jest.fn() } as never,
    { checkLimit: jest.fn(), incrementUsage: jest.fn() } as never,
    { upsertAddress: jest.fn(), assertLocalLevelExists: jest.fn() } as never,
  );

  return { service, prisma };
}

function buildStaff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    tenantId: actor.tenantId,
    userId: actor.userId,
    employeeId: 'EMP-001',
    firstName: 'Asha',
    lastName: 'Teacher',
    dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    gender: Gender.FEMALE,
    address: 'Kathmandu',
    status: StaffStatus.ACTIVE,
    joiningDate: new Date('2026-01-01T00:00:00.000Z'),
    contractType: 'PERMANENT',
    user: {
      email: 'asha@school.test',
      userRoles: [{ role: { name: 'teacher' } }],
    },
    staffContracts: [],
    salaryStructures: [],
    attendanceRecords: [],
    leaveBalances: [],
    leaveRequests: [],
    payrollLines: [],
    qualificationsRecords: [],
    experienceRecords: [],
    teacherAssignments: [],
    ...overrides,
  };
}
