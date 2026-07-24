import type { StaffSummary } from "./staff.js";

export type PayrollMoneyAmount = string | number;

export type SalaryComponentSummary = {
  id: string;
  name: string;
  componentType: string;
  amount: PayrollMoneyAmount;
  taxable: boolean;
};

export type SalaryStructureSummary = {
  id: string;
  staffId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  basicSalary: PayrollMoneyAmount;
  allowances: PayrollMoneyAmount;
  deductions: PayrollMoneyAmount;
  pfEnabled: boolean;
  tdsEnabled: boolean;
  paymentMethod: string;
  bankAccount?: string | null;
  bankName?: string | null;
  status: string;
  components?: SalaryComponentSummary[];
  staff?: StaffSummary;
};

export type PayrollRunAllowedActions = {
  canEdit: boolean;
  canReview: boolean;
  canSubmitReview: boolean;
  canCompleteReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPost: boolean;
  canPay: boolean;
  canReverse: boolean;
  isLocked: boolean;
};

export type PayrollRunSummary = {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  grossAmount: PayrollMoneyAmount;
  deductionAmount: PayrollMoneyAmount;
  netAmount: PayrollMoneyAmount;
  pfEmployeeAmount?: PayrollMoneyAmount;
  pfEmployerAmount?: PayrollMoneyAmount;
  tdsAmount?: PayrollMoneyAmount;
  lineCount?: number;
  payslipCount?: number;
  journalEntryId: string | null;
  disbursementJournalEntryId?: string | null;
  allowedActions: PayrollRunAllowedActions;
  lines?: PayrollLineSummary[];
};

export type PayrollLineSummary = {
  id: string;
  staffId: string;
  grossSalary: PayrollMoneyAmount;
  basicSalary?: PayrollMoneyAmount;
  earnings?: PayrollMoneyAmount;
  allowances?: PayrollMoneyAmount;
  leaveDeductions?: PayrollMoneyAmount;
  pfEmployee?: PayrollMoneyAmount;
  pfEmployer?: PayrollMoneyAmount;
  tds?: PayrollMoneyAmount;
  otherDeductions?: PayrollMoneyAmount;
  deductions: PayrollMoneyAmount;
  netSalary: PayrollMoneyAmount;
  paidDays?: PayrollMoneyAmount;
  unpaidDays?: PayrollMoneyAmount;
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
    baseSalary: PayrollMoneyAmount;
    allowances: PayrollMoneyAmount;
    deductions: PayrollMoneyAmount;
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
  grossSalary: PayrollMoneyAmount;
  deductionAmount: PayrollMoneyAmount;
  pfEmployee?: PayrollMoneyAmount;
  pfEmployer?: PayrollMoneyAmount;
  tds?: PayrollMoneyAmount;
  netSalary: PayrollMoneyAmount;
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
  netAmount?: PayrollMoneyAmount;
};

export type PayslipRegenerationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED";

export type PayslipRegenerationJobSummary = {
  jobId: string;
  payrollRunId: string;
  payslipId: string;
  payslipNumber: string;
  status: PayslipRegenerationJobStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  generated: number | null;
  skipped: number | null;
  payslipCount: number | null;
};

export type PayrollDashboardSummary = {
  filters: {
    periodMonth: number;
    periodYear: number;
    payrollRunId: string | null;
    contractWindowDays: number;
    timezone: "Asia/Kathmandu";
    windowStart: string;
    windowEndExclusive: string;
  };
  activeStaffCount: number;
  activeStaffWithoutActiveSalaryStructureCount: number;
  contractsExpiringWithinWindow: number;
  pendingLeaveRequests: number;
  onLeaveTodayCount: number;
  payrollRunsByStatus: Record<string, number>;
  latestPayrollRun: Pick<
    PayrollRunSummary,
    | "id"
    | "periodMonth"
    | "periodYear"
    | "status"
    | "journalEntryId"
    | "disbursementJournalEntryId"
  > | null;
  selectedPayrollRun: {
    id: string;
    periodMonth: number;
    periodYear: number;
    status: string;
    employeeCount: number;
    totalGross: PayrollMoneyAmount;
    totalDeductions: PayrollMoneyAmount;
    totalNet: PayrollMoneyAmount;
    pfEmployeeAmount: PayrollMoneyAmount;
    pfEmployerAmount: PayrollMoneyAmount;
    tdsAmount: PayrollMoneyAmount;
    approvalReadiness: PayrollRunAllowedActions;
    postingReadiness: {
      canPost: boolean;
      accountingJournalId: string | null;
      disbursementJournalEntryId?: string | null;
      createsAccountingAccrualOnly: boolean;
      salaryDisbursementProviderSupported: boolean;
    };
    payslipGeneration: {
      status: "UNAVAILABLE" | "PENDING" | "PARTIAL" | "COMPLETE";
      total: number;
      expected: number;
      byStatus: Record<string, number>;
    };
    validationExceptionCount: number;
    validationExceptionSource: "payroll_exception_workflow";
    validationExceptionsBySeverity: Record<PayrollExceptionSeverity, number>;
  } | null;
};

export type PayrollExceptionSeverity = "BLOCKING" | "WARNING" | "INFO";
export type PayrollExceptionStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "WAIVED";
export type PayrollExceptionCode =
  | "MISSING_SALARY_STRUCTURE"
  | "NO_EFFECTIVE_SALARY_STRUCTURE"
  | "MISSING_ACTIVE_CONTRACT"
  | "EXPIRED_CONTRACT"
  | "INACTIVE_STAFF_INCLUDED"
  | "MISSING_ATTENDANCE"
  | "ATTENDANCE_ANOMALY"
  | "LEAVE_OVERLAP"
  | "MISSING_PAN"
  | "MISSING_BANK_ACCOUNT"
  | "MISSING_STATUTORY_CONFIGURATION"
  | "INVALID_WORKING_DAYS"
  | "NEGATIVE_NET_PAY"
  | "ZERO_GROSS_PAY"
  | "MISSING_ACCOUNT_MAPPING"
  | "FISCAL_PERIOD_LOCKED"
  | "ACCOUNTING_POSTING_FAILED"
  | "PAYSLIP_GENERATION_FAILED";

export type PayrollExceptionSummary = {
  id: string;
  payrollRunId: string | null;
  staffId: string | null;
  employeeId: string | null;
  staffName: string | null;
  department: string | null;
  code: PayrollExceptionCode;
  severity: PayrollExceptionSeverity;
  status: PayrollExceptionStatus;
  title: string;
  safeMessage: string;
  resolutionRoute: string | null;
  blockedActions: string[];
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
};

export type PayrollReadinessSummary = {
  period: { year: number; month: number };
  staffConsidered: number;
  staffExcluded: number;
  blockingExceptionCount: number;
  warningCount: number;
  informationalCount: number;
  exceptionsByCategory: Partial<Record<PayrollExceptionCode, number>>;
  readinessStatus: "BLOCKED" | "NEEDS_ACKNOWLEDGEMENT" | "READY";
  allowedNextAction: string | null;
  lastCalculatedAt: string;
  stale: boolean;
  selectedPayrollRun: Pick<PayrollRunSummary, "id" | "status"> | null;
};

export type PayrollExceptionPage = {
  items: PayrollExceptionSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  readiness: PayrollReadinessSummary;
};
