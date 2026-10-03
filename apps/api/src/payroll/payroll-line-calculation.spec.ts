import { Prisma } from '@prisma/client';
import {
  calculateLineFromPlan,
  singleSourcePlan,
} from './payroll-line-calculation';
import type { StatutoryPolicyDefinition } from './statutory-policy';

// FIXTURE rates only: these are not Nepal statutory rates.
const policy = {
  schemes: [
    { code: 'PF', base: 'BASIC', employeeRate: '0.10', employerRate: '0.10' },
    { code: 'REMUNERATION_TAX', base: 'GROSS', employeeRate: '0.02' },
  ],
} as unknown as StatutoryPolicyDefinition;

const plan = (overrides: Record<string, unknown> = {}) =>
  singleSourcePlan({
    baseSalary: '30000',
    allowances: '3000',
    contractDeductions: '0',
    paidDays: 30,
    divisorDays: 30,
    ...overrides,
  });

const money = (value: Prisma.Decimal) => value.toFixed(2);

describe('calculateLineFromPlan', () => {
  it('computes gross, fixed deductions and net without statutory amounts', () => {
    const line = calculateLineFromPlan({
      plan: plan({ contractDeductions: '1500' }),
      policy: null,
      enrollment: { retirementScheme: null, taxWithholding: false },
    });
    expect(money(line.grossSalary)).toBe('33000.00');
    expect(money(line.otherDeductions)).toBe('1500.00');
    expect(money(line.deductions)).toBe('1500.00');
    expect(money(line.netSalary)).toBe('31500.00');
    expect(line.statutoryAmounts).toEqual([]);
  });

  it('keeps a negative net as it is instead of clamping it to zero', () => {
    const line = calculateLineFromPlan({
      plan: plan({ contractDeductions: '40000' }),
      policy: null,
      enrollment: { retirementScheme: null, taxWithholding: false },
    });
    expect(money(line.grossSalary)).toBe('33000.00');
    expect(money(line.deductions)).toBe('40000.00');
    expect(money(line.netSalary)).toBe('-7000.00');
    expect(line.netSalary.isNegative()).toBe(true);
  });

  it('adds arrears to gross and recoveries to deductions but keeps statutory bases on regular pay', () => {
    const base = calculateLineFromPlan({
      plan: plan(),
      policy,
      enrollment: { retirementScheme: 'PF', taxWithholding: true },
    });
    const adjusted = calculateLineFromPlan({
      plan: plan(),
      policy,
      enrollment: { retirementScheme: 'PF', taxWithholding: true },
      adjustments: { arrears: 100_000n, recoveries: 25_000n },
    });
    expect(money(base.pfEmployee)).toBe('3000.00');
    expect(money(base.tds)).toBe('660.00');
    // Statutory amounts are identical: arrears/recoveries are outside the base.
    expect(money(adjusted.pfEmployee)).toBe(money(base.pfEmployee));
    expect(money(adjusted.tds)).toBe(money(base.tds));
    expect(money(adjusted.regularGross)).toBe('33000.00');
    expect(money(adjusted.adjustmentEarnings)).toBe('1000.00');
    expect(money(adjusted.adjustmentDeductions)).toBe('250.00');
    expect(money(adjusted.grossSalary)).toBe('34000.00');
    expect(money(adjusted.deductions)).toBe('3910.00');
    expect(money(adjusted.netSalary)).toBe('30090.00');
  });

  it('reports the leave deduction as the shortfall against the employed entitlement', () => {
    const line = calculateLineFromPlan({
      plan: plan({ paidDays: 24 }),
      policy: null,
      enrollment: { retirementScheme: null, taxWithholding: false },
    });
    expect(money(line.grossSalary)).toBe('26400.00');
    expect(money(line.leaveDeductions)).toBe('6600.00');
    expect(money(line.paidDays)).toBe('24.00');
    expect(money(line.unpaidDays)).toBe('6.00');
  });

  it('fails closed when a statutory amount is owed and no policy applies', () => {
    expect(() =>
      calculateLineFromPlan({
        plan: plan(),
        policy: null,
        enrollment: { retirementScheme: 'PF', taxWithholding: false },
      }),
    ).toThrow(/No approved statutory policy/);
  });
});
