import { Prisma } from '@prisma/client';
import {
  computeStatutoryForLine,
  type StatutoryAmount,
  type StatutoryEnrollment,
  type StatutoryPolicyDefinition,
} from './statutory-policy';
import {
  divRoundHalfUp,
  formatMinor,
  toMinor,
  type CompensationSource,
  type StaffProrationPlan,
} from './payroll-proration';

/**
 * Phase 7.9 — turns a resolved proration plan into the amounts of one payroll
 * line.
 *
 *   gross       = regular pay for the paid days + consumed arrears
 *   deductions  = fixed deductions + statutory (policy) + consumed recoveries
 *   net         = gross − deductions            (never clamped: a negative net
 *                 is reported as it is and blocks the run, it is not hidden
 *                 by dropping a deduction or flooring at zero)
 *
 * Statutory bases see only the regular pay of the period (see the 7.9 report:
 * treatment of arrears for PF/SSF/TDS needs an authoritative policy ruling).
 */
export interface LineAdjustmentAmounts {
  arrears: bigint;
  recoveries: bigint;
}

export interface CalculatedPayrollLine {
  baseSalary: Prisma.Decimal;
  allowances: Prisma.Decimal;
  earnings: Prisma.Decimal;
  regularGross: Prisma.Decimal;
  grossSalary: Prisma.Decimal;
  leaveDeductions: Prisma.Decimal;
  pfEmployee: Prisma.Decimal;
  pfEmployer: Prisma.Decimal;
  tds: Prisma.Decimal;
  otherDeductions: Prisma.Decimal;
  adjustmentEarnings: Prisma.Decimal;
  adjustmentDeductions: Prisma.Decimal;
  deductions: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  paidDays: Prisma.Decimal;
  unpaidDays: Prisma.Decimal;
  statutoryAmounts: StatutoryAmount[];
  /** The compensation source of the latest segment (the line's reference). */
  referenceSource: CompensationSource;
}

const dec = (minor: bigint) => new Prisma.Decimal(formatMinor(minor));

export function calculateLineFromPlan(input: {
  plan: StaffProrationPlan;
  policy: StatutoryPolicyDefinition | null;
  enrollment: StatutoryEnrollment;
  adjustments?: LineAdjustmentAmounts;
}): CalculatedPayrollLine {
  const { plan } = input;
  const adjustments = input.adjustments ?? { arrears: 0n, recoveries: 0n };
  const regularGross = plan.totals.gross;

  // Statutory amounts are computed by the approved policy only.
  const statutory = computeStatutoryForLine(input.policy, input.enrollment, {
    basic: dec(plan.totals.basic),
    basicPlusAllowances: dec(regularGross),
    gross: dec(regularGross),
  });
  const pfEmployee = toMinor(statutory.pfEmployee.toFixed(2));
  const pfEmployer = toMinor(statutory.pfEmployer.toFixed(2));
  const tds = toMinor(statutory.tds.toFixed(2));

  const gross = regularGross + adjustments.arrears;
  const deductions =
    plan.totals.fixedDeductions + pfEmployee + tds + adjustments.recoveries;
  const reference = plan.segments[plan.segments.length - 1].source;

  return {
    baseSalary: dec(reference.basic),
    allowances: dec(reference.allowances),
    earnings: dec(regularGross),
    regularGross: dec(regularGross),
    grossSalary: dec(gross),
    leaveDeductions: dec(plan.totals.employedEntitlement - regularGross),
    pfEmployee: dec(pfEmployee),
    pfEmployer: dec(pfEmployer),
    tds: dec(tds),
    otherDeductions: dec(plan.totals.fixedDeductions),
    adjustmentEarnings: dec(adjustments.arrears),
    adjustmentDeductions: dec(adjustments.recoveries),
    deductions: dec(deductions),
    netSalary: dec(gross - deductions),
    paidDays: dec(plan.paidCenti),
    unpaidDays: dec(plan.unpaidCenti),
    statutoryAmounts: statutory.amounts,
    referenceSource: reference,
  };
}

/**
 * Single-source line from raw counts (the pre-7.9 entry point, kept for
 * callers and tests that price one salary). Fixed deductions are charged in
 * full, exactly as before; the net is no longer floored at zero.
 */
export function singleSourcePlan(input: {
  baseSalary: Prisma.Decimal | number | string;
  allowances: Prisma.Decimal | number | string;
  contractDeductions: Prisma.Decimal | number | string;
  paidDays: number;
  divisorDays: number;
}): StaffProrationPlan {
  const W = BigInt(input.divisorDays) * 100n;
  const paidCenti = BigInt(Math.round(input.paidDays * 100));
  const capped = paidCenti > W ? W : paidCenti;
  const basic = toMinor(new Prisma.Decimal(input.baseSalary).toFixed(2));
  const allowances = toMinor(new Prisma.Decimal(input.allowances).toFixed(2));
  const fixed = toMinor(
    new Prisma.Decimal(input.contractDeductions).toFixed(2),
  );
  const monthly = basic + allowances;
  const gross = divRoundHalfUp(monthly * capped, W);
  const epoch = new Date(0);
  return {
    status: 'RESOLVED',
    divisorDays: input.divisorDays,
    periodCalendarDays: input.divisorDays,
    employedDays: input.divisorDays,
    presentDays: Math.floor(Number(capped) / 100),
    paidLeaveCenti: 0n,
    unpaidLeaveCenti: 0n,
    overlappingRecordDays: 0,
    paidCenti: capped,
    unpaidCenti: W - capped,
    ledger: [],
    segments: [
      {
        source: {
          kind: 'SALARY_STRUCTURE',
          id: 'single-source',
          from: epoch,
          to: null,
          basic,
          allowances,
          fixedDeductions: fixed,
          pfEnabled: false,
          tdsEnabled: false,
        },
        from: '1970-01-01',
        to: '1970-01-01',
        days: input.divisorDays,
        paidCenti: capped,
        gross,
        basic: divRoundHalfUp(basic * capped, W),
        fixedDeductions: fixed,
        employedEntitlement: monthly,
      },
    ],
    totals: {
      gross,
      basic: divRoundHalfUp(basic * capped, W),
      fixedDeductions: fixed,
      employedEntitlement: monthly,
    },
  };
}
