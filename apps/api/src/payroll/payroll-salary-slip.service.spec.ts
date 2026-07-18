import { PayrollRunStatus } from '@prisma/client';
import {
  buildApprovedSalarySlipLines,
  buildApprovedSalarySlipPdf,
  canGenerateSalarySlipForRunStatus,
} from './payroll-salary-slip.service';

describe('payroll salary slip PDFs', () => {
  it('allows salary slip generation only for approved payroll runs', () => {
    expect(canGenerateSalarySlipForRunStatus(PayrollRunStatus.DRAFT)).toBe(
      false,
    );
    expect(canGenerateSalarySlipForRunStatus(PayrollRunStatus.REVIEWED)).toBe(
      false,
    );
    expect(canGenerateSalarySlipForRunStatus(PayrollRunStatus.APPROVED)).toBe(
      true,
    );
    expect(canGenerateSalarySlipForRunStatus(PayrollRunStatus.POSTED)).toBe(
      true,
    );
    expect(canGenerateSalarySlipForRunStatus(PayrollRunStatus.VOID)).toBe(
      false,
    );
  });

  it('builds approved salary slip lines with payroll and staff details', () => {
    const lines = buildApprovedSalarySlipLines({
      schoolName: 'Sunrise Academy',
      staffName: 'Sita Sharma',
      employeeId: 'EMP-001',
      periodMonth: 5,
      periodYear: 2026,
      grossSalary: 42000,
      allowances: 5000,
      deductions: 1420,
      netSalary: 40580,
      attendanceDays: 27,
      workingDays: 30,
      approvedAt: new Date(Date.UTC(2026, 4, 31)),
      status: 'Payroll Approved',
    });

    expect(lines).toContain('Sunrise Academy');
    expect(lines).toContain('Salary Slip');
    expect(lines).toContain('Status: Payroll Approved');
    expect(lines).toContain('Employee: Sita Sharma');
    expect(lines).toContain('Employee ID: EMP-001');
    expect(lines).toContain('Payroll Period: 5/2026');
    expect(lines).toContain('Gross Salary: Rs 42000.00');
    expect(lines).toContain('Allowances: Rs 5000.00');
    expect(lines).toContain('Deductions: Rs 1420.00');
    expect(lines).toContain('Net Salary: Rs 40580.00');
    expect(lines).toContain('Attendance Days: 27/30');
    expect(lines).toContain('Approved Date: 2026-05-31');
  });

  it('returns a valid PDF buffer without creating M9 accounting entries', () => {
    const pdf = buildApprovedSalarySlipPdf({
      schoolName: 'Sunrise Academy',
      staffName: 'Sita Sharma',
      employeeId: 'EMP-001',
      periodMonth: 5,
      periodYear: 2026,
      grossSalary: 42000,
      allowances: 5000,
      deductions: 1420,
      netSalary: 40580,
      attendanceDays: 27,
      workingDays: 30,
      approvedAt: new Date(Date.UTC(2026, 4, 31)),
      status: 'Payroll Approved',
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString()).toContain('No M9 accounting journal entry');
  });
});
