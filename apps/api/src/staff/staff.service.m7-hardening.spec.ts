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
      service.reviewLeaveRequest(
        'leave-1',
        { status: 'APPROVED' },
        hrActor,
      ),
    ).rejects.toThrow(/Reverse\/regenerate payroll/);

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
});

function buildService(options: {
  staff?: Record<string, unknown> | null;
  leaveBalances?: Array<Record<string, unknown>>;
  leaveRequest?: Record<string, unknown> | null;
  payrollRuns?: Array<Record<string, unknown>>;
} = {}) {
  const prisma = {
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? buildStaff()),
    },
    staffLeaveBalance: {
      findMany: jest.fn().mockResolvedValue(options.leaveBalances ?? []),
    },
    staffLeaveRequest: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(options.leaveRequest ?? null),
      update: jest.fn(),
    },
    payrollRun: {
      findMany: jest.fn().mockResolvedValue(options.payrollRuns ?? []),
    },
    staffAttendance: {
      upsert: jest.fn(),
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
