import {
  PayrollAdjustmentKind,
  Prisma,
  PayrollRunStatus,
  SalaryStructureStatus,
} from '@prisma/client';
import {
  authoritativeEmploymentWhere,
  groupEmploymentsByStaff,
} from '../hr/employment-timeline';
import {
  priceCorrection,
  type SourceLineForPricing,
} from './payroll-adjustments';
import {
  calculateLineFromPlan,
  type CalculatedPayrollLine,
} from './payroll-line-calculation';
import type { PayrollPeriodWindow } from './payroll-period';
import {
  formatMinor,
  planStaffProration,
  prorationBreakdownJson,
  type CompensationSource,
  type PayrollDivisorBasisValue,
  type ProrationUnresolvedCode,
  type StaffProrationPlan,
  toMinor,
} from './payroll-proration';
import {
  findStatutoryScheme,
  StatutoryConfigurationError,
} from './statutory-policy';
import { resolveStatutoryPolicy } from './statutory-policy-resolver';
import type { PrismaService } from '../prisma/prisma.service';
import { formatPayrollPeriodLabel } from '@schoolos/core';

type Db = PrismaService;

export interface PricedAdjustment {
  correctionId: string;
  staffId: string;
  attendanceDate: Date;
  sourcePayrollRunId: string;
  kind: PayrollAdjustmentKind;
  deltaCenti: bigint;
  amount: bigint;
  dailyRate: string;
  pricing: Record<string, unknown>;
}

export interface UnresolvedCorrection {
  correctionId: string;
  staffId: string;
  attendanceDate: string;
  code: string;
  message: string;
}

export interface PeriodConfigurationIssue {
  staffId: string;
  code:
    | StatutoryConfigurationError['code']
    | 'STATUTORY_MEMBERSHIP_REQUIRED'
    | 'STATUTORY_IDENTIFIER_REQUIRED';
  message: string;
}

export interface ProrationIssue {
  staffId: string;
  code: ProrationUnresolvedCode;
  message: string;
}

export interface PeriodPayrollLine extends CalculatedPayrollLine {
  staffId: string;
  contractId: string | null;
  salaryStructureId: string | null;
  employmentId: string;
  employmentFrom: Date;
  employmentTo: Date | null;
  workingDays: number;
  presentDays: number;
  approvedPaidLeaveDays: number;
  unpaidLeaveDays: number;
  attendanceDays: number;
  plan: StaffProrationPlan;
  prorationBreakdown: Prisma.InputJsonValue;
  adjustments: PricedAdjustment[];
}

const LOCKED_RUN_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.APPROVED,
  PayrollRunStatus.FINALIZED,
  PayrollRunStatus.POSTED,
  PayrollRunStatus.PAID,
];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Prices every approved-but-locked 7.7 correction that is still unconsumed and
 * belongs to a period before `period`. `ownRunId` lets a regeneration treat
 * the corrections its own run already holds as available again.
 */
export async function loadAdjustmentPricing(
  db: Db,
  tenantId: string,
  period: Pick<PayrollPeriodWindow, 'startsOn'>,
  options: { ownRunId?: string } = {},
): Promise<{ priced: PricedAdjustment[]; unresolved: UnresolvedCorrection[] }> {
  const corrections = await db.staffAttendanceCorrection.findMany({
    where: {
      tenantId,
      status: 'PENDING_PAYROLL_ADJUSTMENT',
      attendanceDate: { lt: period.startsOn },
      payrollAdjustments: {
        none: {
          status: 'APPLIED',
          ...(options.ownRunId
            ? { payrollRunId: { not: options.ownRunId } }
            : {}),
        },
      },
    },
    select: {
      id: true,
      staffId: true,
      attendanceDate: true,
      originalStatus: true,
      requestedStatus: true,
    },
    orderBy: [{ attendanceDate: 'asc' }, { id: 'asc' }],
  });
  if (!corrections.length) return { priced: [], unresolved: [] };

  const candidateRuns = await db.payrollRun.findMany({
    where: {
      tenantId,
      status: { in: LOCKED_RUN_STATUSES },
      periodStart: { lte: corrections[corrections.length - 1].attendanceDate },
      periodEnd: { gte: corrections[0].attendanceDate },
    },
    select: {
      id: true,
      revision: true,
      periodYear: true,
      periodMonth: true,
      periodStart: true,
      periodEnd: true,
    },
    orderBy: [{ revision: 'desc' }],
  });
  const lines = candidateRuns.length
    ? await db.payrollLine.findMany({
        where: {
          tenantId,
          payrollRunId: { in: candidateRuns.map((run) => run.id) },
          staffId: { in: [...new Set(corrections.map((c) => c.staffId))] },
        },
        select: {
          id: true,
          payrollRunId: true,
          staffId: true,
          prorationBreakdown: true,
        },
      })
    : [];

  const priced: PricedAdjustment[] = [];
  const unresolved: UnresolvedCorrection[] = [];
  for (const correction of corrections) {
    const date = isoDay(correction.attendanceDate);
    let source: SourceLineForPricing | null = null;
    let sourceRunId: string | null = null;
    for (const run of candidateRuns) {
      if (isoDay(run.periodStart) > date || isoDay(run.periodEnd) < date)
        continue;
      const line = lines.find(
        (candidate) =>
          candidate.payrollRunId === run.id &&
          candidate.staffId === correction.staffId,
      );
      if (!line) continue;
      sourceRunId = run.id;
      source = {
        runId: run.id,
        lineId: line.id,
        periodLabel: formatPayrollPeriodLabel(run.periodYear, run.periodMonth),
        breakdown: line.prorationBreakdown,
      };
      break;
    }
    const result = priceCorrection(
      {
        id: correction.id,
        staffId: correction.staffId,
        attendanceDate: date,
        originalStatus: correction.originalStatus,
        requestedStatus: correction.requestedStatus,
      },
      source,
    );
    if (result.outcome === 'NO_PAYROLL_EFFECT') continue;
    if (result.outcome === 'UNRESOLVED' || !sourceRunId) {
      unresolved.push({
        correctionId: correction.id,
        staffId: correction.staffId,
        attendanceDate: date,
        code:
          result.outcome === 'UNRESOLVED' ? result.code : 'SOURCE_LINE_MISSING',
        message:
          result.outcome === 'UNRESOLVED'
            ? result.message
            : 'No approved payroll line paid this staff member for the corrected date',
      });
      continue;
    }
    priced.push({
      correctionId: correction.id,
      staffId: correction.staffId,
      attendanceDate: correction.attendanceDate,
      sourcePayrollRunId: sourceRunId,
      kind: result.kind,
      deltaCenti: result.deltaCenti,
      amount: result.amount,
      dailyRate: result.dailyRate,
      pricing: result.pricing,
    });
  }
  return { priced, unresolved };
}

export interface PeriodCalculation {
  lines: PeriodPayrollLine[];
  totals: ReturnType<typeof sumTotals>;
  policy: Awaited<ReturnType<typeof resolveStatutoryPolicy>>;
  configurationErrors: PeriodConfigurationIssue[];
  prorationErrors: ProrationIssue[];
  unresolvedCorrections: UnresolvedCorrection[];
  staffMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  }>;
  contractsByStaff: Map<
    string,
    {
      contractNumber: string;
      position: string;
      baseSalary: Prisma.Decimal;
      allowances: Prisma.Decimal;
      deductions: Prisma.Decimal;
    }
  >;
  salaryStructureByStaff: Map<
    string,
    {
      id: string;
      basicSalary: Prisma.Decimal;
      allowances: Prisma.Decimal;
      deductions: Prisma.Decimal;
    }
  >;
}

export async function calculatePeriodPayroll(
  db: Db,
  input: {
    tenantId: string;
    period: PayrollPeriodWindow;
    divisorDays: number;
    divisorBasis: PayrollDivisorBasisValue;
    ownRunId?: string;
  },
): Promise<PeriodCalculation> {
  const { tenantId, period, divisorDays, divisorBasis } = input;

  const staffMembers = await db.staff.findMany({
    where: { tenantId, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
  });
  const contracts = await db.staffContract.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      startDate: { lte: period.endsOn },
      OR: [{ endDate: null }, { endDate: { gte: period.startsOn } }],
      staff: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    },
  });
  const salaryStructures = await db.salaryStructure.findMany({
    where: {
      tenantId,
      status: SalaryStructureStatus.ACTIVE,
      effectiveFrom: { lte: period.endsOn },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startsOn } }],
      staff: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
  });
  const attendanceRecords = await db.staffAttendance.findMany({
    where: {
      tenantId,
      attendanceDate: { gte: period.startsOn, lte: period.endsOn },
      status: { in: ['PRESENT', 'LATE'] },
    },
    select: { staffId: true, attendanceDate: true },
  });
  const leaveRequests = await db.staffLeaveRequest.findMany({
    where: {
      tenantId,
      status: 'APPROVED',
      startsOn: { lte: period.endsOn },
      endsOn: { gte: period.startsOn },
    },
    select: {
      staffId: true,
      startsOn: true,
      endsOn: true,
      isPaid: true,
      days: true,
    },
  });
  // StaffEmployment is the authority for "employed in this period".
  const employmentRows = await db.staffEmployment.findMany({
    where: authoritativeEmploymentWhere(tenantId, period),
    select: { id: true, staffId: true, effectiveFrom: true, effectiveTo: true },
  });
  const employmentsByStaff = groupEmploymentsByStaff(employmentRows);

  // Statutory amounts come only from the approved policy in force on the
  // period end date and from each member's own scheme.
  const policy = await resolveStatutoryPolicy(db, period.endsOn);
  const periodEndDay = new Date(`${period.endsOnIso}T00:00:00.000Z`);
  const membershipRows = await db.staffStatutoryMembership.findMany({
    where: {
      tenantId,
      effectiveFrom: { lte: periodEndDay },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: periodEndDay } }],
    },
    select: { staffId: true, scheme: true, memberIdentifier: true },
  });
  const membershipByStaff = new Map(
    membershipRows.map((row) => [row.staffId, row]),
  );

  const contractsByStaff = new Map(
    contracts.map((contract) => [contract.staffId, contract]),
  );
  // The most recent structure represents the staff member in previews.
  const salaryStructureByStaff = new Map<
    string,
    (typeof salaryStructures)[number]
  >();
  for (const structure of salaryStructures)
    if (!salaryStructureByStaff.has(structure.staffId))
      salaryStructureByStaff.set(structure.staffId, structure);

  const sourcesByStaff = new Map<string, CompensationSource[]>();
  const addSource = (staffId: string, source: CompensationSource) =>
    sourcesByStaff.set(staffId, [
      ...(sourcesByStaff.get(staffId) ?? []),
      source,
    ]);
  for (const structure of salaryStructures)
    addSource(structure.staffId, {
      kind: 'SALARY_STRUCTURE',
      id: structure.id,
      from: structure.effectiveFrom,
      to: structure.effectiveTo,
      basic: toMinor(structure.basicSalary),
      allowances: toMinor(structure.allowances),
      fixedDeductions: toMinor(structure.deductions),
      pfEnabled: structure.pfEnabled,
      tdsEnabled: structure.tdsEnabled,
    });
  // A contract only supplies terms when the staff member has no structure.
  for (const contract of contracts)
    if (!salaryStructureByStaff.has(contract.staffId))
      addSource(contract.staffId, {
        kind: 'CONTRACT',
        id: contract.id,
        from: contract.startDate,
        to: contract.endDate,
        basic: toMinor(contract.baseSalary),
        allowances: toMinor(contract.allowances),
        fixedDeductions: toMinor(contract.deductions),
        pfEnabled: false,
        tdsEnabled: true,
      });

  const presentByStaff = new Map<string, Date[]>();
  for (const record of attendanceRecords)
    presentByStaff.set(record.staffId, [
      ...(presentByStaff.get(record.staffId) ?? []),
      record.attendanceDate,
    ]);
  const leavesByStaff = new Map<string, typeof leaveRequests>();
  for (const leave of leaveRequests)
    leavesByStaff.set(leave.staffId, [
      ...(leavesByStaff.get(leave.staffId) ?? []),
      leave,
    ]);

  const adjustmentPricing = await loadAdjustmentPricing(db, tenantId, period, {
    ownRunId: input.ownRunId,
  });

  const configurationErrors: PeriodConfigurationIssue[] = [];
  const prorationErrors: ProrationIssue[] = [];
  const lines: PeriodPayrollLine[] = [];

  for (const [staffId, sources] of [...sourcesByStaff.entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    const employments = employmentsByStaff.get(staffId);
    if (!employments?.length) continue; // reported as MISSING_VERIFIED_EMPLOYMENT
    const employment = employments[0];
    const plan = planStaffProration({
      period: { startsOn: period.startsOn, endsOn: period.endsOn },
      employments,
      sources,
      divisorDays,
      presentDates: presentByStaff.get(staffId) ?? [],
      leaves: (leavesByStaff.get(staffId) ?? []).map((leave) => ({
        startsOn: leave.startsOn,
        endsOn: leave.endsOn,
        isPaid: leave.isPaid,
        days: Number(leave.days),
      })),
    });
    if (plan.status === 'UNRESOLVED') {
      prorationErrors.push({
        staffId,
        code: plan.code,
        message: plan.message,
      });
      continue;
    }

    const reference = plan.segments[plan.segments.length - 1].source;
    const membership = membershipByStaff.get(staffId);
    if (reference.pfEnabled && !membership) {
      configurationErrors.push({
        staffId,
        code: 'STATUTORY_MEMBERSHIP_REQUIRED',
        message:
          'Provident contribution is enabled but no SSF/PF membership covers the period end date',
      });
      continue;
    }
    const retirementRule = membership
      ? findStatutoryScheme(policy?.definition, membership.scheme)
      : null;
    if (
      reference.pfEnabled &&
      retirementRule?.requiresIdentifier &&
      !membership?.memberIdentifier
    ) {
      configurationErrors.push({
        staffId,
        code: 'STATUTORY_IDENTIFIER_REQUIRED',
        message: `${membership?.scheme} membership needs a member identifier`,
      });
      continue;
    }

    const adjustments = adjustmentPricing.priced.filter(
      (item) => item.staffId === staffId,
    );
    let calculated: CalculatedPayrollLine;
    try {
      calculated = calculateLineFromPlan({
        plan,
        policy: policy?.definition ?? null,
        enrollment: {
          retirementScheme:
            reference.pfEnabled && membership ? membership.scheme : null,
          taxWithholding: reference.tdsEnabled,
        },
        adjustments: {
          arrears: adjustments
            .filter((item) => item.kind === PayrollAdjustmentKind.ARREARS)
            .reduce((total, item) => total + item.amount, 0n),
          recoveries: adjustments
            .filter((item) => item.kind === PayrollAdjustmentKind.RECOVERY)
            .reduce((total, item) => total + item.amount, 0n),
        },
      });
    } catch (error) {
      if (error instanceof StatutoryConfigurationError) {
        configurationErrors.push({
          staffId,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }

    const breakdown = {
      ...prorationBreakdownJson(plan, divisorBasis, {
        label: period.label,
        startsOn: period.startsOnIso,
        endsOn: period.endsOnIso,
      }),
      adjustments: adjustments.map((item) => ({
        correctionId: item.correctionId,
        kind: item.kind,
        amount: formatMinor(item.amount),
        attendanceDate: isoDay(item.attendanceDate),
      })),
    };
    lines.push({
      ...calculated,
      staffId,
      contractId:
        calculated.referenceSource.kind === 'CONTRACT'
          ? calculated.referenceSource.id
          : null,
      salaryStructureId:
        calculated.referenceSource.kind === 'SALARY_STRUCTURE'
          ? calculated.referenceSource.id
          : null,
      employmentId: employment.id,
      employmentFrom: employment.effectiveFrom,
      employmentTo: employment.effectiveTo,
      workingDays: divisorDays,
      presentDays: plan.presentDays,
      approvedPaidLeaveDays: Number(plan.paidLeaveCenti) / 100,
      unpaidLeaveDays: Number(plan.unpaidCenti) / 100,
      attendanceDays: Math.round(Number(plan.paidCenti) / 100),
      plan,
      prorationBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      adjustments,
    });
  }

  return {
    lines,
    totals: sumTotals(lines),
    policy,
    configurationErrors,
    prorationErrors,
    unresolvedCorrections: adjustmentPricing.unresolved,
    staffMembers,
    contractsByStaff,
    salaryStructureByStaff,
  };
}

function sumTotals(lines: PeriodPayrollLine[]) {
  const zero = new Prisma.Decimal(0);
  return lines.reduce(
    (totals, line) => ({
      grossAmount: totals.grossAmount.add(line.grossSalary),
      deductionAmount: totals.deductionAmount.add(line.deductions),
      netAmount: totals.netAmount.add(line.netSalary),
      pfEmployeeAmount: totals.pfEmployeeAmount.add(line.pfEmployee),
      pfEmployerAmount: totals.pfEmployerAmount.add(line.pfEmployer),
      tdsAmount: totals.tdsAmount.add(line.tds),
    }),
    {
      grossAmount: zero,
      deductionAmount: zero,
      netAmount: zero,
      pfEmployeeAmount: zero,
      pfEmployerAmount: zero,
      tdsAmount: zero,
    },
  );
}
