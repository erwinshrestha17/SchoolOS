import { Prisma } from '@prisma/client';
import {
  calculatePayrollLine,
  calculatePayrollTotals,
  getPayrollRunActions,
  getOverlapDays,
  payrollRunLifecycle,
} from './payroll.service';
import { parseStatutoryPolicyPayload } from './statutory-policy';

describe('payroll calculations', () => {
  // FIXTURE numbers only: these are not Nepal statutory rates.
  const fixturePolicy = parseStatutoryPolicyPayload({
    schemes: [
      {
        code: 'REMUNERATION_TAX',
        base: 'GROSS',
        employeeRate: '0.02',
      },
      {
        code: 'PF',
        base: 'BASIC',
        employeeRate: '0.07',
        employerRate: '0.13',
      },
    ],
  });

  it('prorates salary by attendance and takes statutory amounts from the policy', () => {
    expect(
      calculatePayrollLine({
        baseSalary: 40000,
        allowances: 5000,
        contractDeductions: 1000,
        attendanceDays: 15,
        workingDays: 30,
        policy: fixturePolicy,
        enrollment: { retirementScheme: null, taxWithholding: true },
      }),
    ).toMatchObject({
      earnings: new Prisma.Decimal(22500),
      grossSalary: new Prisma.Decimal(22500),
      allowances: new Prisma.Decimal(5000),
      leaveDeductions: new Prisma.Decimal(22500),
      pfEmployee: new Prisma.Decimal(0),
      pfEmployer: new Prisma.Decimal(0),
      tds: new Prisma.Decimal(450),
      otherDeductions: new Prisma.Decimal(1000),
      deductions: new Prisma.Decimal(1450),
      netSalary: new Prisma.Decimal(21050),
    });
  });

  it('applies the member scheme to its own base, prorated', () => {
    const line = calculatePayrollLine({
      baseSalary: 40000,
      allowances: 5000,
      contractDeductions: 0,
      attendanceDays: 15,
      workingDays: 30,
      policy: fixturePolicy,
      enrollment: { retirementScheme: 'PF', taxWithholding: false },
    });
    // BASIC base is the prorated basic (20000), not gross.
    expect(line.pfEmployee).toEqual(new Prisma.Decimal(1400));
    expect(line.pfEmployer).toEqual(new Prisma.Decimal(2600));
    expect(line.statutoryAmounts).toHaveLength(1);
    expect(line.statutoryAmounts[0].baseAmount).toEqual(
      new Prisma.Decimal(20000),
    );
  });

  it('never computes a statutory amount without an approved policy', () => {
    expect(() =>
      calculatePayrollLine({
        baseSalary: 40000,
        allowances: 0,
        contractDeductions: 0,
        attendanceDays: 30,
        workingDays: 30,
        policy: null,
        enrollment: { retirementScheme: null, taxWithholding: true },
      }),
    ).toThrow('No approved statutory policy');
    // No enrolment, no policy needed.
    expect(
      calculatePayrollLine({
        baseSalary: 40000,
        allowances: 0,
        contractDeductions: 0,
        attendanceDays: 30,
        workingDays: 30,
        policy: null,
        enrollment: { retirementScheme: null, taxWithholding: false },
      }).deductions,
    ).toEqual(new Prisma.Decimal(0));
  });

  it('keeps payroll totals balanced for ledger posting', () => {
    expect(
      calculatePayrollTotals([
        {
          grossSalary: new Prisma.Decimal(45000),
          deductions: new Prisma.Decimal(1450),
          netSalary: new Prisma.Decimal(43550),
        },
        {
          grossSalary: new Prisma.Decimal(30000),
          deductions: new Prisma.Decimal(300),
          netSalary: new Prisma.Decimal(29700),
        },
      ]),
    ).toEqual({
      grossAmount: new Prisma.Decimal(75000),
      deductionAmount: new Prisma.Decimal(1750),
      netAmount: new Prisma.Decimal(73250),
      pfEmployeeAmount: new Prisma.Decimal(0),
      pfEmployerAmount: new Prisma.Decimal(0),
      tdsAmount: new Prisma.Decimal(0),
    });
  });

  it('enforces validation, independent review, approval, finalization and posting workflow actions', () => {
    expect(payrollRunLifecycle('DRAFT')).toEqual({
      canEdit: true,
      canValidate: true,
      canFinalize: false,
      canCancelFinalized: false,
      canReview: false,
      canSubmitReview: false,
      canCompleteReview: false,
      canApprove: false,
      canReject: false,
      canPost: false,
      canPay: false,
      canReverse: false,
      isLocked: false,
    });
    expect(payrollRunLifecycle('VALIDATED')).toMatchObject({
      canSubmitReview: true,
      canApprove: false,
    });
    expect(payrollRunLifecycle('UNDER_REVIEW')).toMatchObject({
      canEdit: false,
      canReview: false,
      canSubmitReview: false,
      canCompleteReview: true,
      canApprove: false,
      canReject: true,
      canPost: false,
    });
    expect(payrollRunLifecycle('REVIEWED')).toMatchObject({
      canCompleteReview: false,
      canApprove: true,
      canReject: true,
      canPost: false,
    });
    expect(payrollRunLifecycle('APPROVED')).toMatchObject({
      canReview: false,
      canApprove: false,
      canReject: true,
      canFinalize: true,
      canPost: false,
    });
    expect(payrollRunLifecycle('FINALIZED')).toMatchObject({
      canEdit: false,
      canPost: true,
      isLocked: true,
      canReject: false,
      canCancelFinalized: true,
    });
  });

  it('never advertises actor-facing actions the actor does not hold', () => {
    const noPayrollDuties = {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-one',
      userId: 'viewer-1',
      email: null,
      authMethod: 'PASSWORD',
      roles: ['principal'],
      permissions: ['payroll:run:read'],
    } as never;
    for (const status of [
      'DRAFT',
      'VALIDATED',
      'UNDER_REVIEW',
      'REVIEWED',
      'APPROVED',
      'FINALIZED',
      'POSTED',
      'PAID',
    ]) {
      const actions = getPayrollRunActions(status, noPayrollDuties);
      for (const [key, value] of Object.entries(actions)) {
        if (key !== 'isLocked')
          expect({ status, key, value }).toEqual({ status, key, value: false });
      }
    }
  });

  it('allows approval after review statuses', () => {
    expect(payrollRunLifecycle('DRAFT').canApprove).toBe(false);
    expect(payrollRunLifecycle('REVIEWED').canApprove).toBe(true);
    expect(payrollRunLifecycle('APPROVED').canApprove).toBe(false);
    expect(payrollRunLifecycle('POSTED').canApprove).toBe(false);
  });

  it('calculates overlap days correctly for leave requests', () => {
    // Period: May 2026 (May 1 to May 31)
    const periodStart = new Date(Date.UTC(2026, 4, 1));
    const periodEnd = new Date(Date.UTC(2026, 4, 31, 23, 59, 59, 999));

    // Case 1: Leave fully within period (May 5 to May 10 = 6 days)
    expect(
      getOverlapDays(
        new Date(Date.UTC(2026, 4, 5)),
        new Date(Date.UTC(2026, 4, 10)),
        periodStart,
        periodEnd,
      ),
    ).toBe(6);

    // Case 2: Leave starts before, ends within (April 25 to May 5 = 5 days in May)
    expect(
      getOverlapDays(
        new Date(Date.UTC(2026, 3, 25)),
        new Date(Date.UTC(2026, 4, 5)),
        periodStart,
        periodEnd,
      ),
    ).toBe(5);

    // Case 3: Leave starts within, ends after (May 25 to June 5 = 7 days in May)
    // May 25, 26, 27, 28, 29, 30, 31 = 7 days
    expect(
      getOverlapDays(
        new Date(Date.UTC(2026, 4, 25)),
        new Date(Date.UTC(2026, 5, 5)),
        periodStart,
        periodEnd,
      ),
    ).toBe(7);

    // Case 4: Leave spans entire period (April 1 to June 30 = 31 days in May)
    expect(
      getOverlapDays(
        new Date(Date.UTC(2026, 3, 1)),
        new Date(Date.UTC(2026, 5, 30)),
        periodStart,
        periodEnd,
      ),
    ).toBe(31);

    // Case 5: No overlap (April 1 to April 30)
    expect(
      getOverlapDays(
        new Date(Date.UTC(2026, 3, 1)),
        new Date(Date.UTC(2026, 3, 30)),
        periodStart,
        periodEnd,
      ),
    ).toBe(0);
  });
});
