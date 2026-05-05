import {
  calculatePayrollLine,
  calculatePayrollTotals,
  getPayrollRunActions,
  getOverlapDays,
} from './payroll.service';

describe('payroll calculations', () => {
  it('prorates salary by attendance and applies demo statutory deductions', () => {
    expect(
      calculatePayrollLine({
        baseSalary: 40000,
        allowances: 5000,
        contractDeductions: 1000,
        attendanceDays: 15,
        workingDays: 30,
      }),
    ).toEqual({
      grossSalary: 22500,
      allowances: 5000,
      deductions: 1225,
      netSalary: 21275,
    });
  });

  it('keeps payroll totals balanced for ledger posting', () => {
    expect(
      calculatePayrollTotals([
        { grossSalary: 45000, deductions: 1450, netSalary: 43550 },
        { grossSalary: 30000, deductions: 300, netSalary: 29700 },
      ]),
    ).toEqual({
      grossAmount: 75000,
      deductionAmount: 1750,
      netAmount: 73250,
    });
  });

  it('enforces draft to reviewed to approved to posted workflow actions', () => {
    expect(getPayrollRunActions('DRAFT')).toEqual({
      canReview: true,
      canApprove: true,
      canPost: false,
    });
    expect(getPayrollRunActions('REVIEWED')).toEqual({
      canReview: false,
      canApprove: true,
      canPost: false,
    });
    expect(getPayrollRunActions('APPROVED')).toEqual({
      canReview: false,
      canApprove: false,
      canPost: true,
    });
  });

  it('allows approval from both DRAFT and REVIEWED statuses', () => {
    expect(getPayrollRunActions('DRAFT').canApprove).toBe(true);
    expect(getPayrollRunActions('REVIEWED').canApprove).toBe(true);
    expect(getPayrollRunActions('APPROVED').canApprove).toBe(false);
    expect(getPayrollRunActions('POSTED').canApprove).toBe(false);
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
