import { Prisma } from '@prisma/client';
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
        tdsEnabled: true,
      }),
    ).toEqual({
      earnings: new Prisma.Decimal(22500),
      grossSalary: new Prisma.Decimal(22500),
      allowances: new Prisma.Decimal(5000),
      leaveDeductions: new Prisma.Decimal(22500),
      pfEmployee: new Prisma.Decimal(0),
      pfEmployer: new Prisma.Decimal(0),
      tds: new Prisma.Decimal(225),
      otherDeductions: new Prisma.Decimal(1000),
      deductions: new Prisma.Decimal(1225),
      netSalary: new Prisma.Decimal(21275),
    });
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

  it('enforces draft to reviewed to approved to posted workflow actions', () => {
    expect(getPayrollRunActions('DRAFT')).toEqual({
      canEdit: true,
      canReview: true,
      canApprove: false,
      canPost: false,
      canPay: false,
      canReverse: false,
      isLocked: false,
    });
    expect(getPayrollRunActions('UNDER_REVIEW')).toMatchObject({
      canReview: false,
      canApprove: true,
      canPost: false,
    });
    expect(getPayrollRunActions('APPROVED')).toMatchObject({
      canReview: false,
      canApprove: false,
      canPost: true,
    });
  });

  it('allows approval after review statuses', () => {
    expect(getPayrollRunActions('DRAFT').canApprove).toBe(false);
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
