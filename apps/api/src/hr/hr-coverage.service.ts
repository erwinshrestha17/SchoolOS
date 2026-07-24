import { Injectable } from '@nestjs/common';
import { getNepalSchoolDay } from '@schoolos/core';
import type { StaffCoverageSummary } from '@schoolos/core';
import {
  PayrollExceptionSeverity,
  PayrollExceptionStatus,
  PayrollRunStatus,
  SalaryStructureStatus,
  StaffStatus,
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';

const TEACHING_ROLE_NAMES = ['teacher', 'subject_teacher'];
const CONTRACT_EXPIRY_WINDOW_DAYS = 30;
const NON_TERMINAL_PAYROLL_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.DRAFT,
  PayrollRunStatus.GENERATED,
  PayrollRunStatus.UNDER_REVIEW,
  PayrollRunStatus.REVIEWED,
  PayrollRunStatus.APPROVED,
];

function toTimetableDayOfWeek(gregorianDate: string): number {
  const jsDay = new Date(`${gregorianDate}T00:00:00.000Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

@Injectable()
export class HrCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backend-owned staff-coverage summary for HR/school leadership (M7
   * catalog gap). Every figure is a bounded, tenant-scoped aggregate; never
   * returns salary, bank, or PAN data. Sections that cannot be reliably
   * derived report `available: false` with a reason instead of a fake zero.
   */
  async getStaffCoverageSummary(
    actor: AuthContext,
  ): Promise<StaffCoverageSummary> {
    const tenantId = actor.tenantId;
    const today = getNepalSchoolDay();
    const todayRange = {
      gte: today.startUtc,
      lt: today.endExclusiveUtc,
    };
    const expiryWindowEnd = new Date(
      today.startUtc.getTime() + CONTRACT_EXPIRY_WINDOW_DAYS * 86_400_000,
    );

    const [
      activeStaffTotal,
      activeTeaching,
      staffWithActiveContract,
      staffWithActiveSalaryStructure,
      absentStaffIds,
      onLeaveStaffIds,
      pendingLeaveApprovals,
      contractsExpiring,
      latestActiveRun,
    ] = await Promise.all([
      this.prisma.staff.count({
        where: { tenantId, status: StaffStatus.ACTIVE },
      }),
      this.prisma.staff.count({
        where: {
          tenantId,
          status: StaffStatus.ACTIVE,
          user: {
            userRoles: {
              some: { role: { name: { in: TEACHING_ROLE_NAMES } } },
            },
          },
        },
      }),
      this.prisma.staff.count({
        where: {
          tenantId,
          status: StaffStatus.ACTIVE,
          staffContracts: { some: { status: 'ACTIVE' } },
        },
      }),
      this.prisma.staff.count({
        where: {
          tenantId,
          status: StaffStatus.ACTIVE,
          salaryStructures: {
            some: { status: SalaryStructureStatus.ACTIVE },
          },
        },
      }),
      this.prisma.staffAttendance.findMany({
        where: {
          tenantId,
          attendanceDate: todayRange,
          status: 'ABSENT',
        },
        select: { staffId: true },
        take: 5000,
      }),
      this.prisma.staffLeaveRequest.findMany({
        where: {
          tenantId,
          status: 'APPROVED',
          startsOn: { lte: today.startUtc },
          endsOn: { gte: today.startUtc },
        },
        select: { staffId: true },
        take: 5000,
      }),
      this.prisma.staffLeaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.staffContract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          endDate: { gte: today.startUtc, lte: expiryWindowEnd },
        },
      }),
      this.prisma.payrollRun.findFirst({
        where: {
          tenantId,
          status: { in: NON_TERMINAL_PAYROLL_STATUSES },
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        select: { id: true, periodMonth: true, periodYear: true },
      }),
    ]);

    const payrollReadiness = latestActiveRun
      ? {
          available: true,
          periodMonth: latestActiveRun.periodMonth,
          periodYear: latestActiveRun.periodYear,
          blockingCount: await this.prisma.payrollException.count({
            where: {
              tenantId,
              payrollRunId: latestActiveRun.id,
              severity: PayrollExceptionSeverity.BLOCKING,
              status: PayrollExceptionStatus.OPEN,
            },
          }),
        }
      : {
          available: false as const,
          reason: 'No payroll run is currently in progress for this tenant.',
        };

    const classCoverage = await this.getClassCoverage(
      tenantId,
      today.gregorianDate,
      todayRange,
      new Set(absentStaffIds.map((row) => row.staffId)),
      new Set(onLeaveStaffIds.map((row) => row.staffId)),
    );

    return {
      asOf: new Date().toISOString(),
      staffCounts: {
        activeTeaching,
        activeNonTeaching: Math.max(0, activeStaffTotal - activeTeaching),
      },
      attendanceToday: {
        absent: absentStaffIds.length,
        onApprovedLeave: onLeaveStaffIds.length,
      },
      pendingLeaveApprovals,
      contractsExpiring: {
        windowDays: CONTRACT_EXPIRY_WINDOW_DAYS,
        count: contractsExpiring,
      },
      staffWithoutActiveContract: Math.max(
        0,
        activeStaffTotal - staffWithActiveContract,
      ),
      staffWithoutActiveSalaryStructure: Math.max(
        0,
        activeStaffTotal - staffWithActiveSalaryStructure,
      ),
      payrollReadiness,
      classCoverage,
    };
  }

  private async getClassCoverage(
    tenantId: string,
    gregorianDate: string,
    todayRange: { gte: Date; lt: Date },
    absentStaffIds: Set<string>,
    onLeaveStaffIds: Set<string>,
  ): Promise<StaffCoverageSummary['classCoverage']> {
    const dayOfWeek = toTimetableDayOfWeek(gregorianDate);
    const unavailableStaffIds = new Set([
      ...absentStaffIds,
      ...onLeaveStaffIds,
    ]);

    const [todaySlots, coveredSubstitutions] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: {
          tenantId,
          dayOfWeek,
          OR: [
            { versionId: null },
            {
              version: {
                status: {
                  in: [
                    TimetableVersionStatus.PUBLISHED,
                    TimetableVersionStatus.LOCKED,
                  ],
                },
              },
            },
          ],
        },
        select: { id: true, staffId: true },
        take: 5000,
      }),
      this.prisma.timetableSubstitution.findMany({
        where: {
          tenantId,
          date: todayRange,
          status: {
            in: [
              TimetableSubstitutionStatus.ASSIGNED,
              TimetableSubstitutionStatus.COMPLETED,
            ],
          },
        },
        select: { timetableSlotId: true },
        take: 5000,
      }),
    ]);

    if (todaySlots.length === 0) {
      return {
        available: false,
        reason:
          'No published timetable slots are scheduled for today; class coverage cannot be derived.',
        dayOfWeek,
      };
    }

    const coveredSlotIds = new Set(
      coveredSubstitutions.map((row) => row.timetableSlotId),
    );
    const uncoveredPeriods = todaySlots.filter(
      (slot) =>
        unavailableStaffIds.has(slot.staffId) && !coveredSlotIds.has(slot.id),
    ).length;

    return {
      available: true,
      dayOfWeek,
      scheduledPeriods: todaySlots.length,
      uncoveredPeriods,
    };
  }
}
