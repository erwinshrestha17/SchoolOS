import {
  calculatePayrollLine,
  calculatePayrollTotals,
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
});
