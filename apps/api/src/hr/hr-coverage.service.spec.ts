import { getNepalSchoolDay } from '@schoolos/core';
import {
  PayrollExceptionSeverity,
  PayrollExceptionStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { HrCoverageService } from './hr-coverage.service';

const actor: AuthContext = {
  userId: 'principal-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'principal@school.test',
  roles: ['principal'],
  permissions: ['hr:read'],
  authMethod: 'PASSWORD',
};

describe('HrCoverageService', () => {
  it('computes tenant-scoped, bounded aggregate coverage counts with an as-of timestamp', async () => {
    const today = getNepalSchoolDay();
    const dayOfWeek = ((): number => {
      const jsDay = new Date(
        `${today.gregorianDate}T00:00:00.000Z`,
      ).getUTCDay();
      return jsDay === 0 ? 7 : jsDay;
    })();

    const { service, prisma } = buildService({
      activeStaffTotal: 10,
      activeTeaching: 6,
      staffWithActiveContract: 7,
      staffWithActiveSalaryStructure: 5,
      absentStaff: [{ staffId: 'staff-absent-1' }],
      onLeaveStaff: [{ staffId: 'staff-leave-1' }],
      pendingLeaveApprovals: 3,
      contractsExpiring: 2,
      latestActiveRun: {
        id: 'run-1',
        periodMonth: 5,
        periodYear: 2026,
      },
      blockingExceptions: 4,
      todaySlots: [
        { id: 'slot-1', staffId: 'staff-absent-1' },
        { id: 'slot-2', staffId: 'staff-leave-1' },
        { id: 'slot-3', staffId: 'staff-present-1' },
      ],
      coveredSubstitutions: [{ timetableSlotId: 'slot-2' }],
    });

    const before = Date.now();
    const summary = await service.getStaffCoverageSummary(actor);
    const after = Date.now();

    expect(new Date(summary.asOf).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(summary.asOf).getTime()).toBeLessThanOrEqual(after);

    expect(summary.staffCounts).toEqual({
      activeTeaching: 6,
      activeNonTeaching: 4,
    });
    expect(summary.attendanceToday).toEqual({
      absent: 1,
      onApprovedLeave: 1,
    });
    expect(summary.pendingLeaveApprovals).toBe(3);
    expect(summary.contractsExpiring).toEqual({
      windowDays: 30,
      count: 2,
    });
    expect(summary.staffWithoutActiveContract).toBe(3);
    expect(summary.staffWithoutActiveSalaryStructure).toBe(5);
    expect(summary.payrollReadiness).toEqual({
      available: true,
      periodMonth: 5,
      periodYear: 2026,
      blockingCount: 4,
    });

    // slot-1 (absent, no substitution) is uncovered; slot-2 (on leave, but
    // has an ASSIGNED substitution) is covered; slot-3's teacher is present.
    expect(summary.classCoverage).toEqual({
      available: true,
      dayOfWeek,
      scheduledPeriods: 3,
      uncoveredPeriods: 1,
    });

    // Every count query must be tenant-scoped.
    expect(prisma.staff.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(prisma.payrollException.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          payrollRunId: 'run-1',
          severity: PayrollExceptionSeverity.BLOCKING,
          status: PayrollExceptionStatus.OPEN,
        }),
      }),
    );
    expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', dayOfWeek }),
      }),
    );
  });

  it('reports payroll readiness as unavailable rather than a fake zero when no run is in progress', async () => {
    const { service } = buildService({ latestActiveRun: null });

    const summary = await service.getStaffCoverageSummary(actor);

    expect(summary.payrollReadiness).toEqual({
      available: false,
      reason: 'No payroll run is currently in progress for this tenant.',
    });
  });

  it('reports class coverage as unavailable rather than a fake zero when no timetable is published today', async () => {
    const { service } = buildService({ todaySlots: [] });

    const summary = await service.getStaffCoverageSummary(actor);

    expect(summary.classCoverage.available).toBe(false);
    expect(summary.classCoverage.uncoveredPeriods).toBeUndefined();
    expect(summary.classCoverage.reason).toMatch(/cannot be derived/i);
  });

  it('never selects salary, bank, or PAN fields from Staff/SalaryStructure/Contract queries', async () => {
    const { service, prisma } = buildService({});

    await service.getStaffCoverageSummary(actor);

    const forbidden = ['basicSalary', 'bankAccount', 'bankName', 'panNumber'];
    for (const call of (prisma.staff.count as jest.Mock).mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(new RegExp(forbidden.join('|')));
    }
    for (const call of (prisma.staffContract.count as jest.Mock).mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(new RegExp(forbidden.join('|')));
    }
  });
});

function buildService(
  options: {
    activeStaffTotal?: number;
    activeTeaching?: number;
    staffWithActiveContract?: number;
    staffWithActiveSalaryStructure?: number;
    absentStaff?: Array<{ staffId: string }>;
    onLeaveStaff?: Array<{ staffId: string }>;
    pendingLeaveApprovals?: number;
    contractsExpiring?: number;
    latestActiveRun?: {
      id: string;
      periodMonth: number;
      periodYear: number;
    } | null;
    blockingExceptions?: number;
    todaySlots?: Array<{ id: string; staffId: string }>;
    coveredSubstitutions?: Array<{ timetableSlotId: string }>;
  } = {},
) {
  const staffCountQueue = [
    options.activeStaffTotal ?? 10,
    options.activeTeaching ?? 6,
    options.staffWithActiveContract ?? 7,
    options.staffWithActiveSalaryStructure ?? 5,
  ];

  const prisma = {
    staff: {
      count: jest
        .fn()
        .mockImplementation(async () => staffCountQueue.shift() ?? 0),
    },
    staffAttendance: {
      findMany: jest.fn().mockResolvedValue(options.absentStaff ?? []),
    },
    staffLeaveRequest: {
      findMany: jest.fn().mockResolvedValue(options.onLeaveStaff ?? []),
      count: jest.fn().mockResolvedValue(options.pendingLeaveApprovals ?? 0),
    },
    staffContract: {
      count: jest.fn().mockResolvedValue(options.contractsExpiring ?? 0),
    },
    payrollRun: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.latestActiveRun === undefined
            ? { id: 'run-1', periodMonth: 5, periodYear: 2026 }
            : options.latestActiveRun,
        ),
    },
    payrollException: {
      count: jest.fn().mockResolvedValue(options.blockingExceptions ?? 0),
    },
    timetableSlot: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.todaySlots ?? [{ id: 'slot-1', staffId: 'staff-present-1' }],
        ),
    },
    timetableSubstitution: {
      findMany: jest.fn().mockResolvedValue(options.coveredSubstitutions ?? []),
    },
  };

  return {
    service: new HrCoverageService(prisma as never),
    prisma,
  };
}
