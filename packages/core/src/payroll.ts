import type { StaffSummary } from "./types.js";

export type SalaryComponentSummary = {
  id: string;
  name: string;
  componentType: string;
  amount: number;
  taxable: boolean;
};

export type SalaryStructureSummary = {
  id: string;
  staffId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  basicSalary: number;
  allowances: number;
  deductions: number;
  pfEnabled: boolean;
  tdsEnabled: boolean;
  paymentMethod: string;
  bankAccount?: string | null;
  bankName?: string | null;
  status: string;
  components?: SalaryComponentSummary[];
  staff?: StaffSummary;
};

export type PayrollRunSummary = {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  pfEmployeeAmount?: number;
  pfEmployerAmount?: number;
  tdsAmount?: number;
  lineCount?: number;
  journalEntryId: string | null;
  disbursementJournalEntryId?: string | null;
  lines?: PayrollLineSummary[];
};

export type PayrollLineSummary = {
  id: string;
  staffId: string;
  grossSalary: number;
  basicSalary?: number;
  earnings?: number;
  allowances?: number;
  leaveDeductions?: number;
  pfEmployee?: number;
  pfEmployer?: number;
  tds?: number;
  otherDeductions?: number;
  deductions: number;
  netSalary: number;
  paidDays?: number;
  unpaidDays?: number;
  attendanceDays: number;
  workingDays: number;
  paymentStatus?: string;
  status: string;
  staff?: {
    id: string;
    firstNameEn?: string;
    lastNameEn?: string;
    employeeId?: string;
  };
};

export type PayrollPreviewResult = {
  staffId: string;
  fullName: string;
  employeeId: string;
  contractSummary?: {
    contractNumber: string;
    position: string;
    baseSalary: number;
    allowances: number;
    deductions: number;
  };
  periodMonth: number;
  periodYear: number;
  workingDays: number;
  presentDays: number;
  approvedPaidLeaveDays: number;
  unpaidLeaveDays: number;
  baseSalary: number;
  allowances: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  warnings: string[];
};

export type PayslipSummary = {
  id: string;
  payrollRunId: string;
  payrollLineId: string;
  staffId: string;
  payslipNumber: string;
  status: string;
  grossSalary: number;
  deductionAmount: number;
  netSalary: number;
  issuedAt: string | null;
  staff?: StaffSummary & { fullName?: string };
  payrollRun?: {
    id: string;
    periodMonth: number;
    periodYear: number;
    status: string;
  };
  periodMonth?: number;
  periodYear?: number;
  netAmount?: number;
};
