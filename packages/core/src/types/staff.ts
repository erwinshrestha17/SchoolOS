import type {
  PayrollLineSummary,
  PayrollMoneyAmount,
  SalaryStructureSummary,
} from './payroll.js';

export type StaffSummary = {
  id: string;
  employeeId: string;
  staffCode?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  roles: string[];
  joiningDate: string;
  contractType: string;
  status?: string;
  department?: string | null;
  designation?: string | null;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  photoUrl?: string | null;
  user?: {
    email: string;
    userRoles: Array<{ role: { name: string } }>;
  };
  staffContracts?: StaffContractSummary[];
};

export type StaffDetail = StaffSummary & {
  personal?: {
    dateOfBirth: string;
    gender: string;
    address: string;
    emergencyContact?: {
      name?: string | null;
      phone?: string | null;
      relation?: string | null;
    };
  };
  employment?: {
    department?: string | null;
    designation?: string | null;
    employmentType?: string | null;
    joiningDate: string;
    contractStatus?: string | null;
    teacherRegistryId?: string | null;
  };
  salaryStructures?: SalaryStructureSummary[];
  attendanceRecords?: unknown[];
  leaveBalances?: StaffLeaveBalanceSummary[];
  leaveRequests?: StaffLeaveRequestSummary[];
  payrollLines?: PayrollLineSummary[];
};

export type StaffLeaveRequestSummary = {
  id: string;
  staffId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number;
  reason: string;
  status: string;
  reviewedAt: string | null;
  staff?: StaffSummary;
};

export type StaffLeaveBalanceSummary = {
  id: string;
  staffId: string;
  leaveType: string;
  year: number;
  entitlement: number;
  carriedForward: number;
  used: number;
  pending: number;
  remaining: number;
  staff?: StaffSummary;
};

export type StaffLeaveReviewResult = {
  reviewed: StaffLeaveRequestSummary;
  overlapAnomalies: Array<{
    attendanceDate: string;
    existingStatus: string;
    proposedStatus: string;
  }>;
};

export type StaffContractSummary = {
  id: string;
  staffId: string;
  contractNumber: string;
  position: string;
  startDate: string;
  endDate: string | null;
  baseSalary: PayrollMoneyAmount;
  allowances: PayrollMoneyAmount;
  deductions: PayrollMoneyAmount;
  status: string;
};

/**
 * Backend-owned HR/staff-coverage summary (M7 catalog gap). Every count is a
 * bounded aggregate query scoped to the current tenant and "today" in Nepal
 * local time. Never includes salary, bank, or PAN data. Sub-sections that
 * cannot be reliably derived from existing data report `available: false`
 * with a `reason` instead of a fabricated zero.
 */
export type StaffCoverageSummary = {
  asOf: string;
  staffCounts: {
    activeTeaching: number;
    activeNonTeaching: number;
  };
  attendanceToday: {
    absent: number;
    onApprovedLeave: number;
  };
  pendingLeaveApprovals: number;
  contractsExpiring: {
    windowDays: number;
    count: number;
  };
  staffWithoutActiveContract: number;
  staffWithoutActiveSalaryStructure: number;
  payrollReadiness: {
    available: boolean;
    reason?: string;
    periodMonth?: number;
    periodYear?: number;
    blockingCount?: number;
  };
  classCoverage: {
    available: boolean;
    reason?: string;
    dayOfWeek?: number;
    scheduledPeriods?: number;
    uncoveredPeriods?: number;
  };
};
